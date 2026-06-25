import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('oauth_state')
    .addColumn('key', 'text', (c) => c.primaryKey())
    .addColumn('state', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', (c) =>
      c.notNull().defaultTo(sql`now()`),
    )
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('oauth_state').execute()
}
