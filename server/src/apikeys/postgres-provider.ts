import { ulid } from 'ulid'
import type { Selectable } from 'kysely'
import type { DidString } from '@atproto/syntax'
import type { DB } from '../db/index.ts'
import type { ApiKeyTable } from '../db/types.ts'
import type { ApiKeyProvider, ApiKeyMeta, CreatedKey, Consumer } from './provider.ts'
import { generateApiKey } from './key.ts'

type ApiKeyRow = Pick<Selectable<ApiKeyTable>, 'id' | 'label' | 'key_preview' | 'created_at' | 'expires_at'>

function toMeta(row: ApiKeyRow): ApiKeyMeta {
  return {
    id: row.id,
    label: row.label,
    preview: row.key_preview,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }
}

export function createPostgresApiKeyProvider(db: DB): ApiKeyProvider {
  return {
    async ensureConsumer(did: DidString): Promise<Consumer> {
      await db
        .insertInto('account')
        .values({ did, email: null })
        .onConflict((oc) => oc.column('did').doNothing())
        .execute()
      return { did }
    },

    async deleteConsumer(did: DidString): Promise<void> {
      // Wrap in a transaction so api_key + account are removed atomically.
      // api_key rows cascade via the FK, but delete explicitly for clarity/portability.
      await db.transaction().execute(async (trx) => {
        await trx.deleteFrom('api_key').where('did', '=', did).execute()
        await trx.deleteFrom('account').where('did', '=', did).execute()
      })
    },

    async createKey(did, opts): Promise<CreatedKey> {
      const { full, hash, preview } = generateApiKey()
      const id = ulid()
      const inserted = await db
        .insertInto('api_key')
        .values({
          id,
          did,
          label: opts.label,
          key_hash: hash,
          key_preview: preview,
          expires_at: opts.expiresAt,
          last_used_at: null,
        })
        .returning(['id', 'label', 'key_preview', 'created_at', 'expires_at'])
        .executeTakeFirstOrThrow()
      return { ...toMeta(inserted), full }
    },

    async listKeys(did): Promise<ApiKeyMeta[]> {
      const rows = await db
        .selectFrom('api_key')
        .select(['id', 'label', 'key_preview', 'created_at', 'expires_at'])
        .where('did', '=', did)
        .orderBy('created_at', 'desc')
        .execute()
      return rows.map(toMeta)
    },

    async deleteKey(did, keyId): Promise<void> {
      await db.deleteFrom('api_key').where('did', '=', did).where('id', '=', keyId).execute()
    },
  }
}
