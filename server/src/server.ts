import { loadConfig } from './config.ts'
import { logger } from './logger.ts'
import { startOtel } from './otel.ts'
import { createDb } from './db/index.ts'
import { runMigrations } from './db/migrate.ts'
import { createOAuthClient } from './oauth/client.ts'
import { createLockPool, createRequestLock } from './oauth/request-lock.ts'
import { createPostgresApiKeyProvider } from './apikeys/postgres-provider.ts'
import { createGatekeeperClient } from './apikeys/gatekeeper-client.ts'
import { createGatekeeperApiKeyProvider } from './apikeys/gatekeeper-provider.ts'
import { resolveJetstreamPolicy } from './apikeys/jetstream-policy.ts'
import { buildApp } from './app.ts'

async function main() {
  const cfg = loadConfig()
  const otel = await startOtel()
  const db = createDb(cfg.databaseUrl)
  // Deliberately its own pool — a lock is held while its body queries the
  // session store, so sharing the Kysely pool risks a starvation deadlock.
  const lockPool = createLockPool(cfg.databaseUrl)

  await runMigrations(db)

  const client = await createOAuthClient(db, cfg, createRequestLock(lockPool))
  // The client_id document is published by the website build (see
  // oauth/client-metadata-doc.mjs), not served here. If it 404s, or its contents
  // differ from what this process holds, login fails at the PAR request — so log
  // what we resolved to, to make that skew visible at deploy time.
  logger.info(
    {
      clientId: client.clientMetadata.client_id,
      redirectUri: client.clientMetadata.redirect_uris[0],
    },
    'oauth client identity resolved',
  )
  // API keys live in Gatekeeper when configured; local Postgres otherwise
  // (dev default). The service name stays hardcoded here; the policy attached
  // to new keys is the built-in default unless BPS_JETSTREAM_KEY_POLICY
  // replaces it — see jetstream-policy.ts. Future services add their own
  // { service, defaultPolicy } pair (and an ApiKeyProvider interface change).
  //
  // The Postgres provider is a local stand-in that issues no policy at all, so
  // a configured policy only takes effect on the Gatekeeper path.
  const jetstreamPolicy = resolveJetstreamPolicy(cfg.jetstreamKeyPolicy)
  const apiKeys = cfg.gatekeeper
    ? createGatekeeperApiKeyProvider(db, createGatekeeperClient(cfg.gatekeeper), {
        service: 'jetstream',
        defaultPolicy: jetstreamPolicy.policy,
      })
    : createPostgresApiKeyProvider(db)
  logger.info(
    {
      provider: cfg.gatekeeper ? 'gatekeeper' : 'postgres',
      // Source only, never the policy itself — enough to spot a deployment
      // that isn't running the policy someone thinks it is.
      keyPolicy: jetstreamPolicy.source,
    },
    'api key provider selected',
  )
  const app = buildApp({ db, config: cfg, client, apiKeys })
  const server = app.listen(cfg.port, () => {
    logger.info(`account server listening on :${cfg.port}`)
  })

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info(`received ${signal}, shutting down`)
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await db.destroy()
    await lockPool.end()
    await otel.shutdown()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((err) => {
  logger.error({ err }, 'fatal boot error')
  process.exit(1)
})
