# syntax=docker/dockerfile:1

# Website API (@bps/account-server). Build context is the repo root, because
# lexicon codegen reads ../lexicons relative to server/ — the image mirrors the
# repo layout (/app/lexicons + /app/server) so that path resolves unchanged.
#
# No compile step: Node 24 strips TypeScript types at require time, so `src/`
# ships as-is. The build stage exists only to generate the lexicon client.

FROM node:24-bookworm-slim AS build

WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY lexicons /app/lexicons
COPY server/ ./
RUN npm run lex:build


FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/server/src ./src

USER node

# Matches BPS_PORT's default. Everything else the server needs is required env
# (see src/config.ts, which throws on boot rather than starting up degraded).
EXPOSE 8080

# Deliberately not `npm start` — that passes --env-file=.env, which does not
# exist here; config comes from the runtime environment. Exec form keeps node
# as PID 1 so its SIGTERM handler runs the graceful shutdown in src/server.ts.
CMD ["node", "src/server.ts"]
