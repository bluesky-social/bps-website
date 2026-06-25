import type {
  NodeSavedSession,
  NodeSavedSessionStore,
} from '@atproto/oauth-client-node'
import type { DidString } from '@atproto/syntax'
import { sql } from 'kysely'
import type { DB } from '../db/index.ts'

// SimpleStore<string, NodeSavedSession> backed by oauth_session, keyed by DID (the OAuth `sub`).
export function createSessionStore(db: DB): NodeSavedSessionStore {
  return {
    async get(sub) {
      const row = await db
        .selectFrom('oauth_session')
        .select('session')
        .where('did', '=', sub as DidString)
        .executeTakeFirst()
      if (!row) return undefined
      return JSON.parse(row.session) as NodeSavedSession
    },
    async set(sub, value) {
      const session = JSON.stringify(value)
      await db
        .insertInto('oauth_session')
        .values({ did: sub as DidString, session })
        .onConflict((oc) =>
          oc.column('did').doUpdateSet({ session, updated_at: sql`now()` }),
        )
        .execute()
    },
    async del(sub) {
      await db
        .deleteFrom('oauth_session')
        .where('did', '=', sub as DidString)
        .execute()
    },
  }
}
