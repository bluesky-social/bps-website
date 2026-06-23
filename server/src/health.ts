import { sql } from 'kysely'
import type { DB } from './db/index.ts'

export async function checkHealth(db: DB): Promise<{ status: 'ok'; db: boolean }> {
  let dbUp = false
  try {
    await sql`select 1`.execute(db)
    dbUp = true
  } catch {
    // swallow: db is unreachable
  }
  return { status: 'ok', db: dbUp }
}
