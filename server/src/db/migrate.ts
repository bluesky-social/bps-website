import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration'
import type { DB } from './index.ts'
import { createDb } from './index.ts'
import { loadConfig } from '../config.ts'
import { logger } from '../logger.ts'

import * as m001 from './migrations/001_account.ts'
import * as m002 from './migrations/002_api_key.ts'
import * as m003 from './migrations/003_oauth_state.ts'
import * as m004 from './migrations/004_oauth_session.ts'

const migrations: Record<string, Migration> = {
  '001_account': m001,
  '002_api_key': m002,
  '003_oauth_state': m003,
  '004_oauth_session': m004,
}

export class StaticProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations
  }
}

export async function runMigrations(db: DB): Promise<void> {
  const migrator = new Migrator({ db, provider: new StaticProvider() })
  const { error, results } = await migrator.migrateToLatest()
  results?.forEach((r) => {
    if (r.status === 'Success') logger.info(`migration ${r.migrationName} applied`)
    else if (r.status === 'Error') logger.error(`migration ${r.migrationName} FAILED`)
  })
  if (error) throw error
}

// CLI entry: `npm run migrate`
if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = loadConfig()
  const db = createDb(cfg.databaseUrl)
  runMigrations(db)
    .then(() => db.destroy())
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error(err)
      process.exit(1)
    })
}
