import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import type { Database } from './types.ts'

export type DB = Kysely<Database>

export function createDb(databaseUrl: string): DB {
  const dialect = new PostgresDialect({
    pool: new pg.Pool({ connectionString: databaseUrl, max: 10 }),
  })
  return new Kysely<Database>({ dialect })
}
