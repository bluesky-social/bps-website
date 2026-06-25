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

## Conventions

- App env vars are `BPS_`-prefixed; OTel/`OTEL_*` and `NODE_ENV` are not.
- Erasable-only TS (no enum/namespace/parameter-properties).
- Lexicons are authored under repo-root `lexicons/` and committed; generated TS
  in `server/src/lexicons/` is git-ignored.

## OAuth

Login uses atproto OAuth (`@atproto/oauth-client-node`). Two session concepts:

- **App login cookie** (`bps_session`, iron-session): holds only `{ did }`.
- **atproto OAuth tokens**: stored server-side in Postgres (`oauth_session`),
  used to call the user's PDS/AppView.

### Endpoints

- `GET /oauth-client-metadata.json` — OAuth client metadata; this URL is the
  `client_id` (production / hosted-metadata mode).
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

### Dev vs production client

- **Dev** (`NODE_ENV` ≠ `production` with an `http://` `BPS_API_ORIGIN`): uses the
  atproto **loopback** client — `client_id = http://localhost?redirect_uri=…`,
  no hosted metadata, no signing key. Leave `BPS_OAUTH_PRIVATE_KEY` empty.
- **Production**: hosted-metadata + `private_key_jwt`. Set `BPS_OAUTH_PRIVATE_KEY`
  (PKCS8 PEM or JWK JSON) and `BPS_OAUTH_KEY_ID`.

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
the Postgres adapter is `src/apikeys/postgres-provider.ts` (a Kong adapter can
replace it without changing callers).

Note: `whoami` returns 401 if the cookie is valid but the account row no longer
exists (e.g. after `account.delete`). Expected client errors (4xx) are logged at
`warn`; only unexpected failures log at `error`.
