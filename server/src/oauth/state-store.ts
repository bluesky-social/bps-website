import type { NodeSavedState, NodeSavedStateStore } from '@atproto/oauth-client-node'
import type { DB } from '../db/index.ts'

// SimpleStore<string, NodeSavedState> backed by the oauth_state table.
// NodeSavedState is JSON-serializable; we store it as text in `state`.
export function createStateStore(db: DB): NodeSavedStateStore {
  return {
    async get(key) {
      const row = await db
        .selectFrom('oauth_state')
        .select('state')
        .where('key', '=', key)
        .executeTakeFirst()
      if (!row) return undefined
      return JSON.parse(row.state) as NodeSavedState
    },
    async set(key, value) {
      const state = JSON.stringify(value)
      await db
        .insertInto('oauth_state')
        .values({ key, state })
        .onConflict((oc) => oc.column('key').doUpdateSet({ state }))
        .execute()
    },
    async del(key) {
      await db.deleteFrom('oauth_state').where('key', '=', key).execute()
    },
  }
}
