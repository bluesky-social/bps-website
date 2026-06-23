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
curl localhost:8080/healthz                          # {"status":"ok"}
curl localhost:8080/xrpc/internal.bps.health         # {"status":"ok","db":true}
```

## Scripts
- `npm run dev` — watch-mode server
- `npm start` — run once
- `npm test` — `node --test` suite (needs Postgres up)
- `npm run migrate` — apply migrations
- `npm run lex:build` — regenerate lexicon TS from `../lexicons`

## Conventions
- App env vars are `BPS_`-prefixed; OTel/`OTEL_*` and `NODE_ENV` are not.
- DIDs are typed `DidString` (`@atproto/syntax`), never raw `string`.
- Erasable-only TS (no enum/namespace/parameter-properties).
- Lexicons are authored under repo-root `lexicons/` and committed; generated TS
  in `server/src/lexicons/` is git-ignored.
