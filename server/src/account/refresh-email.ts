import { sql } from 'kysely'
import type { OAuthSession } from '@atproto/oauth-client-node'
import type { DidString } from '@atproto/syntax'
import type { DB } from '../db/index.ts'
import { logger } from '../logger.ts'
import { safeGetSession } from './get-session.ts'

// The stored account.email is a read-through mirror of the PDS email. We re-observe
// it opportunistically inside whoami, throttled by account.updated_at acting as the
// "last successfully checked" clock. TTL is 8 hours.
export const EMAIL_REFRESH_TTL_MS = 8 * 60 * 60 * 1000

// What we need from the current account row to decide + report.
type AccountRow = { email: string | null; updated_at: Date }

// Injectable session restorer so this is unit-testable without a live PDS / client.restore.
// In production router.ts pass `() => client.restore(did)`. The returned object must expose
// `fetchHandler` (exactly what safeGetSession accepts) — client.restore's OAuthSession does.
type RestoreSession = () => Promise<Pick<OAuthSession, 'fetchHandler'>>

// Best-effort, throttled refresh of the stored email from the PDS. Returns the email value
// that whoami should report (the freshly-observed value if it changed, otherwise the stored
// value). NEVER throws — every failure is swallowed and warn-logged so whoami never 5xx.
//
// updated_at-as-clock: there is no separate email_checked_at column; account.updated_at IS
// the throttle clock. So on ANY successful observation we bump updated_at = now(), even when
// the email is unchanged or the PDS shared none — otherwise the clock never advances and we'd
// re-probe the PDS on every whoami past the TTL forever. On a non-observation (restore throws
// or getSession non-ok/throws) we touch nothing at all, so the next request retries.
//
// Concurrency: two concurrent whoami requests past the TTL may both refresh. That's harmless —
// the UPDATE is idempotent (same observed value) — so no locking is used here intentionally.
//
// Keep-last-known: we never write a NULL/empty email; only a non-empty observation can change
// the stored value. PII: the email address is never logged (warn logs carry only the error).
export async function refreshEmailIfStale(
  db: DB,
  did: DidString,
  row: AccountRow,
  restoreSession: RestoreSession,
): Promise<string | null> {
  const stale = Date.now() - row.updated_at.getTime() >= EMAIL_REFRESH_TTL_MS
  if (!stale) return row.email

  let observed: { handle?: string; email?: string }
  try {
    const session = await restoreSession()
    observed = await safeGetSession(session)
  } catch (err) {
    // restore can reject (no session, revoked, network). Non-observation: leave the row
    // untouched and serve the stored value. whoami must not fail because of this.
    logger.warn({ err, did }, 'whoami email refresh: restore failed')
    return row.email
  }

  // safeGetSession never throws; it signals a failed call (restore-ok but getSession non-ok or
  // threw) by returning {}. getSession ALWAYS includes `handle` on success (it's required by the
  // lexicon), so a present handle is our "observation succeeded" signal. A successful observation
  // with no email means the PDS shared none (keep last-known); a missing handle means the call
  // failed → NON-observation, touch nothing, retry next request.
  if (!observed.handle) {
    return row.email
  }
  const email = observed.email
  try {
    if (email && email !== row.email) {
      await db
        .updateTable('account')
        .set({ email, updated_at: sql`now()` })
        .where('did', '=', did)
        .execute()
      return email
    }
    // Unchanged email, or no email observed (keep last-known): bump the clock only.
    await db
      .updateTable('account')
      .set({ updated_at: sql`now()` })
      .where('did', '=', did)
      .execute()
    return row.email
  } catch (err) {
    // The UPDATE failed, so nothing was persisted: report the stored value to stay
    // consistent with the DB. The next whoami still sees the stale row and retries.
    logger.warn({ err, did }, 'whoami email refresh: update failed')
    return row.email
  }
}
