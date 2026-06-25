import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('api_key')
    .addColumn('id', 'text', (c) => c.primaryKey())
    .addColumn('did', 'text', (c) =>
      c.notNull().references('account.did').onDelete('cascade'),
    )
    .addColumn('label', 'text', (c) => c.notNull())
    .addColumn('key_hash', 'text', (c) => c.notNull().unique())
    .addColumn('key_preview', 'text', (c) => c.notNull())
    .addColumn('expires_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('last_used_at', 'timestamptz')
    .execute()

  await db.schema
    .createIndex('api_key_did_idx')
    .on('api_key')
    .column('did')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('api_key').execute()
}
