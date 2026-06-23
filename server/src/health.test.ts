// server/src/health.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkHealth } from './health.ts'

function fakeDbWhereSqlExecute(behavior: 'ok' | 'throw') {
  // kysely's sql`...`.execute(db) uses db.getExecutor() internally.
  // The executor needs transformQuery, compileQuery, and executeQuery.
  return {
    getExecutor: () => ({
      transformQuery: (q: unknown) => q,
      compileQuery: (_q: unknown) => ({ sql: 'select 1', parameters: [] }),
      executeQuery: async () => {
        if (behavior === 'throw') throw new Error('connection refused')
        return { rows: [{ '?column?': 1 }] }
      },
    }),
  } as any
}

test('checkHealth reports db:true when the query succeeds', async () => {
  const result = await checkHealth(fakeDbWhereSqlExecute('ok'))
  assert.deepEqual(result, { status: 'ok', db: true })
})

test('checkHealth reports db:false when the query throws', async () => {
  const result = await checkHealth(fakeDbWhereSqlExecute('throw'))
  assert.deepEqual(result, { status: 'ok', db: false })
})
