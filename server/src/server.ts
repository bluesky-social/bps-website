import { loadConfig } from './config.ts'
import { logger } from './logger.ts'
import { startOtel } from './otel.ts'
import { createDb } from './db/index.ts'
import { runMigrations } from './db/migrate.ts'
import { createOAuthClient } from './oauth/client.ts'
import { createPostgresApiKeyProvider } from './apikeys/postgres-provider.ts'
import { buildApp } from './app.ts'

async function main() {
  const cfg = loadConfig()
  const otel = await startOtel()
  const db = createDb(cfg.databaseUrl)

  await runMigrations(db)

  const client = await createOAuthClient(db, cfg)
  const apiKeys = createPostgresApiKeyProvider(db)
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
