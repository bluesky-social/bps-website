import { createHash } from 'node:crypto'
import pg from 'pg'
import type { RuntimeLock } from '@atproto/oauth-client-node'

// The OAuth client serializes token refresh per account (lock name
// `@atproto-oauth-client-<did>`). Without a cross-process lock it falls back to
// an in-process Map, so two replicas — which every rolling deploy produces —
// can refresh the same session concurrently and get the refresh token revoked.
// Postgres advisory locks give us that mutual exclusion with no new dependency.

// How long to wait for a contended lock before giving up. The client bounds its
// own lock body at 30s (see session-getter.ts), so a longer wait than that means
// something is genuinely stuck rather than merely busy.
const DEFAULT_TIMEOUT_MS = 30_000

// Advisory locks are keyed by a signed 64-bit integer, not a string, so fold the
// name into one: first 8 bytes of its sha256, big-endian two's complement.
// Collisions would only cost extra serialization, never correctness.
export function lockKey(name: string): bigint {
  return createHash('sha256').update(name).digest().readBigInt64BE(0)
}

// A pool of its own, kept separate from the Kysely pool on purpose: a lock is
// held across the body, and the body queries the session store. Sharing one pool
// would let N lock holders take every connection and then deadlock waiting for a
// connection to do their own work.
export function createLockPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl, max: 10 })
}

export function createRequestLock(
  pool: pg.Pool,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): RuntimeLock {
  return async (name, fn) => {
    const client = await pool.connect()
    try {
      // pg_advisory_xact_lock, not the session-level variant: the transaction
      // guarantees release. A session lock relies on our own bookkeeping, and
      // one leaked onto a pooled connection would wedge that name forever.
      await client.query('begin')
      // SET takes no bind parameters; set_config's third arg scopes it to the
      // transaction. On expiry Postgres raises 55P03 and we let it propagate —
      // running a refresh unlocked is the very thing this lock exists to stop.
      await client.query(`select set_config('lock_timeout', $1, true)`, [
        String(timeoutMs),
      ])
      await client.query('select pg_advisory_xact_lock($1::bigint)', [
        lockKey(name).toString(),
      ])
      return await fn()
    } finally {
      // Nothing here writes, so rollback is the right terminator; it releases
      // the lock. If it fails we cannot prove the lock is gone, so destroy the
      // connection — ending the session releases it — rather than hand a
      // possibly-still-locked connection back to the pool.
      try {
        await client.query('rollback')
        client.release()
      } catch (err) {
        client.release(err as Error)
      }
    }
  }
}
