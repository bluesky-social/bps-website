import type { ColumnType } from 'kysely'
import type { DidString } from '@atproto/syntax'

// ISO timestamp columns: selected as Date, insertable optionally (DB default now()), updatable by hand.
// The insert type is `Date | string | undefined` — undefined makes the column optional on insert,
// matching DB-default behaviour without needing the Generated<> wrapper.
type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>

export interface AccountTable {
  did: DidString
  handle: string | null
  email: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ApiKeyTable {
  id: string // ULID, application-generated
  did: DidString
  label: string
  key_hash: string
  key_preview: string
  expires_at: ColumnType<
    Date | null,
    Date | string | null,
    Date | string | null
  >
  created_at: Timestamp
  last_used_at: ColumnType<
    Date | null,
    Date | string | null,
    Date | string | null
  >
}

export interface OauthStateTable {
  key: string
  state: string // serialized NodeSavedState (JSON)
  created_at: Timestamp
}

export interface OauthSessionTable {
  did: DidString
  session: string // serialized NodeSavedSession (JSON)
  created_at: Timestamp
  updated_at: Timestamp
}

export interface Database {
  account: AccountTable
  api_key: ApiKeyTable
  oauth_state: OauthStateTable
  oauth_session: OauthSessionTable
}
