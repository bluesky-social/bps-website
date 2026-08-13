# BPS Account Server

Backend for the authenticated account section of the BPS website. Node 24,
TypeScript via built-in type-stripping (no build step), Express v5 +
`@atproto/lex-server`, Kysely + Postgres.

## Prerequisites

- Node ≥ 24 (`node -v`)
- Docker (for local Postgres)

## Setup

```bash
cd server
npm install
cp .env.example .env        # adjust BPS_* values as needed
docker compose up -d        # Postgres on :5433
npm run lex:build           # generate TS from ../lexicons
npm run migrate             # apply migrations
npm run dev                 # http://localhost:8080
```

## Verify

```bash
curl localhost:8080/_health                          # {"status":"ok"}
```

## Scripts

- `npm run dev` — watch-mode server
- `npm start` — run once
- `npm test` — `node --test` suite (needs Postgres up)
- `npm run migrate` — apply migrations
- `npm run lex:build` — regenerate lexicon TS from `../lexicons`

## Container image

Built by `.github/workflows/containers.yml` as `bps-website-api`. Build from the
**repo root**, not `server/` — lexicon codegen reads `../lexicons`:

```bash
docker build -f server/Dockerfile -t bps-website-api .   # from the repo root
docker build -f Dockerfile -t bps-website-api ..         # from server/
```

There is no compile step: Node 24 strips TS types at load, so `src/` ships as-is.
The image runs as the non-root `node` user, sets `NODE_ENV=production` (which
makes `BPS_OAUTH_PRIVATE_KEY` required — see below), and takes all config from
the environment rather than an `.env` file.

Migrations run automatically at boot (`src/server.ts`), so a deploy needs no
separate migration step. Config is validated first and the process exits
non-zero on anything missing, rather than starting up degraded.

## Conventions

- App env vars are `BPS_`-prefixed; OTel/`OTEL_*` and `NODE_ENV` are not.
- Erasable-only TS (no enum/namespace/parameter-properties).
- Lexicons are authored under repo-root `lexicons/` and committed; generated TS
  in `server/src/lexicons/` is git-ignored.

### Gatekeeper env vars

| Var | Required | Purpose |
| --- | --- | --- |
| `BPS_GATEKEEPER_URL` | optional | Gatekeeper base URL. When set, API keys are stored in Gatekeeper instead of local Postgres, and the other `BPS_GATEKEEPER_*` vars become required. |
| `BPS_GATEKEEPER_BEARER_TOKEN` | with URL | Shared secret sent as `Authorization: Bearer` on every Gatekeeper request. |
| `BPS_GATEKEEPER_EMAIL` | with URL | Identity sent as `X-Beyond-Email` (Gatekeeper direct-auth mode). |

## OAuth

Login uses atproto OAuth (`@atproto/oauth-client-node`). Two session concepts:

- **App login cookie** (`bps_session`, iron-session): holds only `{ did }`.
- **atproto OAuth tokens**: stored server-side in Postgres (`oauth_session`),
  used to call the user's PDS/AppView.

### Endpoints

- `GET /jwks.json` — public signing keys (ES256, `private_key_jwt`). Empty in
  dev (loopback client uses `token_endpoint_auth_method: none`).
- `GET /oauth-callback` — redirect_uri; finishes login, sets the cookie, 302s to
  `${BPS_SITE_ORIGIN}/account`.
- XRPC `internal.bps.oauth.start?handle=…` — returns `{ authorizeUrl }`
  (400 `InvalidHandle` if the handle can't be resolved).
- XRPC `internal.bps.oauth.logout` (POST, authed) — revokes the atproto session,
  deletes the `oauth_session` row, clears the cookie.
- XRPC `internal.bps.account.whoami` (authed) — `{ did, handle?, email? }`. The
  stored `email` mirrors the PDS account email (captured at login, refreshed
  opportunistically on whoami); it is not user-editable here.

### The client_id document lives on the website, not here

`client_id` is `${BPS_SITE_ORIGIN}/oauth-client-metadata.json`, and this service
deliberately does not serve that path. An atproto `client_id` *is* the URL its
document is fetched from — the authorization server rejects a document whose
`client_id` disagrees with that URL — so putting it on the site origin is what
gives the consent screen the public domain rather than the API hostname. The
Docusaurus build writes the file (`oauth-client-metadata` plugin in
`docusaurus.config.js`); `redirect_uris` and `jwks_uri` inside it still point
here, which the atproto spec permits. Only `client_uri` is origin-constrained,
and it tracks `client_id`.

Both copies of the document — published and in-process — come from
`src/oauth/client-metadata-doc.mjs`, so the shape cannot drift. **Config can
still drift, and it breaks login outright.** Two invariants at deploy time:

| Website build | must equal | This service |
| --- | --- | --- |
| `BPS_SITE_URL` build arg (`url` in `docusaurus.config.js`) | | `BPS_SITE_ORIGIN` |
| `BPS_PUBLIC_API_ORIGIN` build arg | | `BPS_API_ORIGIN` |

The resolved `client_id` and `redirect_uri` are logged at boot
(`oauth client identity resolved`) to make a mismatch visible without a login
attempt.

`BPS_SITE_ORIGIN` is singular here, and not only for the document: it also gates
CORS (`src/cors.ts`) and is where a completed login redirects. So one deployment
of this service answers for exactly one site. Staging shares the
`bps-api.bsky.network` deployment rather than running its own, which means
pointing `BPS_SITE_ORIGIN` at `https://bps-preview.bsky.network` — and while it
is pointed there, production cannot log in.

### Dev vs production client

- **Dev** (`NODE_ENV` ≠ `production` with an `http://` `BPS_API_ORIGIN`): uses the
  atproto **loopback** client — `client_id = http://localhost?redirect_uri=…`,
  no hosted metadata, no signing key. Leave `BPS_OAUTH_PRIVATE_KEY` empty. The
  published document is irrelevant in dev, which is why the site's build-only
  plugin not running under `docusaurus start` costs nothing.
- **Production**: hosted-metadata + `private_key_jwt`. Set `BPS_OAUTH_PRIVATE_KEY`
  (PKCS8 PEM or JWK JSON) and `BPS_OAUTH_KEY_ID`.

### Refresh lock

Token refresh is serialized per account by a Postgres advisory lock
(`src/oauth/request-lock.ts`). Two replicas refreshing the same session at once
can get the refresh token revoked by the PDS, and the OAuth client's default lock
is in-process only, so it does not cover the overlap in a rolling deploy. Without
a lock the client also warns `No lock mechanism provided` at boot.

The lock is a `pg_advisory_xact_lock` keyed on a 64-bit hash of the client's lock
name (`@atproto-oauth-client-<did>`), held for the refresh and released by its
transaction. It runs on its own connection pool rather than the Kysely one: the
lock is held while its body reads `oauth_session`, so a single shared pool would
let lock holders take every connection and then deadlock waiting for one to do
their own work. Budget up to 20 Postgres connections per replica, 10 per pool.

Waiting on a contended lock gives up after 30 seconds (`lock_timeout`) and fails
the request instead of refreshing unlocked. Keep
`idle_in_transaction_session_timeout` above that (Postgres and RDS both default
to disabled): the lock lives in an open transaction, and killing that transaction
mid-refresh releases the lock while the refresh is still in flight.

### Manual e2e smoke test

The full authorization-code + PKCE + DPoP round-trip can't run in CI (needs a
live atproto auth server + a real account). To exercise it manually:

1. `npm run dev`, then
   `curl "localhost:8080/xrpc/internal.bps.oauth.start?handle=YOUR_HANDLE"`.
2. Open the returned `authorizeUrl` in a browser and approve. You'll be
   redirected to `${BPS_SITE_ORIGIN}/account`. You can verify there, or confirm
   directly in the database below.
3. Confirm rows were created:
   ```bash
   docker compose exec postgres psql -U bps -d bps_account \
     -c "select did, email is not null as has_email from account;"
   docker compose exec postgres psql -U bps -d bps_account \
     -c "select did, length(session) from oauth_session;"
   ```
   A row in **both** tables for your DID = pass.

## Account ops + API keys

All authed via the `bps_session` cookie.

- XRPC `internal.bps.account.profile` — public bsky profile `{ did, handle, displayName?, avatar? }` (fetched unauthenticated from the public AppView; not cached).
- XRPC `internal.bps.account.delete` (POST) — hard-deletes the account + keys + OAuth session, revokes atproto access, clears the cookie.
- XRPC `internal.bps.apiKey.create` (POST `{label, expiresAt?}`) — returns the full `jsk_…` secret **once**.
- XRPC `internal.bps.apiKey.list` — metadata only (`{id,label,preview,createdAt,expiresAt?}`); never the secret.
- XRPC `internal.bps.apiKey.delete` (POST `{id}`) — delete = instant revoke.

API keys are opaque (`jsk_<random>`), scoped to Jetstream (`jetstream:read`), stored
as a SHA-256 hash + a masked preview — the plaintext is shown once and is not
retrievable. Keys go through the `ApiKeyProvider` port (`src/apikeys/provider.ts`);
the Postgres adapter is `src/apikeys/postgres-provider.ts`, and a Gatekeeper
adapter (`src/apikeys/gatekeeper-provider.ts`) can replace it without changing
callers — see the Gatekeeper env vars above.

Key listings carry a `status` (`active`, `expired`, or `future`); revoked
(deleted) keys are never listed. Under the Gatekeeper provider the status
comes from Gatekeeper's server-side lifecycle classification; the Postgres
provider derives it from `expires_at` at read time.

Note: `whoami` returns 401 if the cookie is valid but the account row no longer
exists (e.g. after `account.delete`). Expected client errors (4xx) are logged at
`warn`; only unexpected failures log at `error`.
