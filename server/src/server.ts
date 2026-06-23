import { loadConfig } from './config.ts'
import { logger } from './logger.ts'
import { startOtel } from './otel.ts'
import { createDb } from './db/index.ts'
import { runMigrations } from './db/migrate.ts'
import { buildApp } from './app.ts'

async function main() {
  const cfg = loadConfig()
  const otel = await startOtel()
  const db = createDb(cfg.databaseUrl)

  await runMigrations(db)

  const app = buildApp(db)
  const server = app.listen(cfg.port, () => {
    logger.info(`account server listening on :${cfg.port}`)
  })

  const shutdown = async (signal: string) => {
    logger.info(`received ${signal}, shutting down`)
    server.close()
    await db.destroy()
    await otel.shutdown()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((err) => {
  logger.error(err)
  process.exit(1)
})
