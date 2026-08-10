import { loadConfig } from './config.ts'
import { logger } from './logger.ts'
import { startOtel } from './otel.ts'
import { createDb } from './db/index.ts'
import { runMigrations } from './db/migrate.ts'
import { createOAuthClient } from './oauth/client.ts'
import { createPostgresApiKeyProvider } from './apikeys/postgres-provider.ts'
import { createGatekeeperClient } from './apikeys/gatekeeper-client.ts'
import { createGatekeeperApiKeyProvider } from './apikeys/gatekeeper-provider.ts'
import { JETSTREAM_DEFAULT_POLICY } from './apikeys/jetstream-policy.ts'
import { buildApp } from './app.ts'

async function main() {
  const cfg = loadConfig()
  const otel = await startOtel()
  const db = createDb(cfg.databaseUrl)

  await runMigrations(db)

  const client = await createOAuthClient(db, cfg)
  // API keys live in Gatekeeper when configured; local Postgres otherwise
  // (dev default). Service name + default policy are deliberately hardcoded
  // here, not config — see jetstream-policy.ts. Future services add their own
  // { service, defaultPolicy } pair (and an ApiKeyProvider interface change).
  const apiKeys = cfg.gatekeeper
    ? createGatekeeperApiKeyProvider(db, createGatekeeperClient(cfg.gatekeeper), {
        service: 'jetstream',
        defaultPolicy: JETSTREAM_DEFAULT_POLICY,
      })
    : createPostgresApiKeyProvider(db)
  logger.info(
    { provider: cfg.gatekeeper ? 'gatekeeper' : 'postgres' },
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
