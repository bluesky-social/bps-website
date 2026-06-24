import { Kysely, sql } from 'kysely'

// Active-dev convention: this project has no production deployment yet, so
// schema changes are made by editing the relevant migration in place and
// recreating dev databases (`docker compose down -v && docker compose up -d &&
// npm run migrate`) rather than adding incremental ALTER migrations. Revisit
// (switch to additive migrations) once a durable/shared environment exists.

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('account')
    .addColumn('did', 'text', (c) => c.primaryKey())
    .addColumn('handle', 'text')
    .addColumn('email', 'text')
    .addColumn('created_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (c) => c.notNull().defaultTo(sql`now()`))
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('account').execute()
}
