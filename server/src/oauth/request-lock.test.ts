import { test, before, after, describe } from 'node:test'
import assert from 'node:assert/strict'
import type pg from 'pg'
import { createLockPool, createRequestLock, lockKey } from './request-lock.ts'

const url =
  process.env.BPS_TEST_DATABASE_URL ??
  'postgres://bps:bps@localhost:5433/bps_account'

// Two pools stand in for two server replicas: an advisory lock only proves its
// worth if it excludes across connections, not just within one process's Map.
let poolA: pg.Pool
let poolB: pg.Pool

before(() => {
  poolA = createLockPool(url)
  poolB = createLockPool(url)
})
after(async () => {
  await poolA.end()
  await poolB.end()
})

function deferred<T = void>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Unique per test so a stuck lock in one can't cascade into the next.
let counter = 0
const uniqueName = () => `@atproto-oauth-client-did:plc:test${counter++}`

describe('lockKey', () => {
  test('derives a stable signed 64-bit key from the lock name', () => {
    // Oracle: first 8 bytes of sha256(name), big-endian, two's complement.
    assert.equal(
      lockKey('@atproto-oauth-client-did:plc:example'),
      -7923599705262150671n,
    )
  })

  test('is deterministic and distinct across names', () => {
    assert.equal(lockKey('one'), lockKey('one'))
    assert.notEqual(lockKey('one'), lockKey('two'))
  })

  test('stays within the range pg_advisory_xact_lock accepts', () => {
    for (const name of ['', 'a', 'ff'.repeat(64), '@atproto-oauth-client-x']) {
      const key = lockKey(name)
      assert.equal(BigInt.asIntN(64, key), key, `out of int64 range: ${name}`)
    }
  })
})

describe('createRequestLock', () => {
  test('returns the value the body produced', async () => {
    const lock = createRequestLock(poolA)
    assert.equal(await lock(uniqueName(), () => 'result'), 'result')
  })

  test('serializes bodies contending for the same name', { timeout: 15_000 }, async () => {
    const lock = createRequestLock(poolA)
    const name = uniqueName()
    const events: string[] = []
    const entered = deferred()
    const release = deferred()

    const first = lock(name, async () => {
      events.push('enter-1')
      entered.resolve()
      await release.promise
      events.push('exit-1')
    })
    await entered.promise

    const second = lock(name, () => {
      events.push('enter-2')
      events.push('exit-2')
    })
    await sleep(250) // long enough for an unlocked body to have run
    assert.deepEqual(events, ['enter-1'], 'second body ran before the first released')

    release.resolve()
    await Promise.all([first, second])
    assert.deepEqual(events, ['enter-1', 'exit-1', 'enter-2', 'exit-2'])
  })

  test('serializes across separate pools, as two replicas would', { timeout: 15_000 }, async () => {
    const lockA = createRequestLock(poolA)
    const lockB = createRequestLock(poolB)
    const name = uniqueName()
    const events: string[] = []
    const entered = deferred()
    const release = deferred()

    const onA = lockA(name, async () => {
      events.push('enter-a')
      entered.resolve()
      await release.promise
      events.push('exit-a')
    })
    await entered.promise

    const onB = lockB(name, () => {
      events.push('enter-b')
    })
    await sleep(250)
    assert.deepEqual(events, ['enter-a'], 'the other pool acquired the same lock')

    release.resolve()
    await Promise.all([onA, onB])
    assert.deepEqual(events, ['enter-a', 'exit-a', 'enter-b'])
  })

  test('lets different names run concurrently', { timeout: 15_000 }, async () => {
    const lock = createRequestLock(poolA)
    const enteredFirst = deferred()
    const enteredSecond = deferred()
    const release = deferred()

    const first = lock(uniqueName(), async () => {
      enteredFirst.resolve()
      await release.promise
    })
    await enteredFirst.promise
    const second = lock(uniqueName(), async () => {
      enteredSecond.resolve()
      await release.promise
    })
    // Hangs (and trips the timeout) if distinct names share a lock.
    await enteredSecond.promise

    release.resolve()
    await Promise.all([first, second])
  })

  test('releases the lock when the body throws, and rethrows', { timeout: 15_000 }, async () => {
    const name = uniqueName()
    await assert.rejects(
      async () =>
        createRequestLock(poolA)(name, async () => {
          throw new Error('boom')
        }),
      /boom/,
    )
    // Re-acquire from the *other* pool: a lock leaked onto a pooled connection
    // would be re-entrant for poolA and so invisible from there.
    const lockB = createRequestLock(poolB, { timeoutMs: 1_000 })
    assert.equal(await lockB(name, () => 'free'), 'free')
  })

  test('releases the lock once the body resolves', { timeout: 15_000 }, async () => {
    const name = uniqueName()
    await createRequestLock(poolA)(name, () => 'done')
    const lockB = createRequestLock(poolB, { timeoutMs: 1_000 })
    assert.equal(await lockB(name, () => 'free'), 'free')
  })

  test('fails loudly rather than running the body unlocked when the wait times out', { timeout: 15_000 }, async () => {
    const name = uniqueName()
    const entered = deferred()
    const release = deferred()
    const held = createRequestLock(poolA)(name, async () => {
      entered.resolve()
      await release.promise
    })
    await entered.promise

    let bodyRan = false
    await assert.rejects(async () =>
      createRequestLock(poolB, { timeoutMs: 100 })(name, async () => {
        bodyRan = true
      }),
    )
    assert.equal(bodyRan, false, 'body ran without holding the lock')

    release.resolve()
    await held
  })

  test('returns every connection it borrows to the pool', { timeout: 15_000 }, async () => {
    const lock = createRequestLock(poolA)
    for (let i = 0; i < 3; i++) await lock(uniqueName(), () => i)
    await assert.rejects(async () =>
      lock(uniqueName(), async () => {
        throw new Error('boom')
      }),
    )
    assert.equal(poolA.waitingCount, 0)
    assert.equal(
      poolA.idleCount,
      poolA.totalCount,
      'a connection was never released back to the pool',
    )
  })
})
