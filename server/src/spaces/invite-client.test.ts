import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { DidString } from '@atproto/syntax'
import { createSpacesInviteClient } from './invite-client.ts'

const did = 'did:plc:spaces-user' as DidString
const otherDid = 'did:plc:someone-else'
const requests: Array<{
  method: string
  url: URL
  authorization?: string
  body?: unknown
}> = []
let server: ReturnType<typeof createServer>
let base: string

function invite(overrides: Record<string, unknown> = {}) {
  return {
    code: 'spaces-example-code',
    available: 1,
    disabled: false,
    forAccount: did,
    createdBy: 'admin',
    createdAt: '2026-08-19T12:00:00.000Z',
    uses: [],
    ...overrides,
  }
}

before(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://local')
    let body: unknown
    if (req.method === 'POST') {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(Buffer.from(chunk))
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    }
    requests.push({
      method: req.method ?? 'GET',
      url,
      authorization: req.headers.authorization,
      body,
    })

    res.setHeader('content-type', 'application/json')
    if (url.pathname.endsWith('com.atproto.server.createInviteCode')) {
      res.end(JSON.stringify({ code: 'spaces-new-code' }))
      return
    }
    if (url.searchParams.get('cursor') === 'page-2') {
      res.end(
        JSON.stringify({
          codes: [
            invite({
              code: 'spaces-used-code',
              uses: [
                {
                  usedBy: 'did:plc:new-account',
                  usedAt: '2026-08-19T13:00:00.000Z',
                },
              ],
            }),
          ],
        }),
      )
      return
    }
    res.end(
      JSON.stringify({
        cursor: 'page-2',
        codes: [
          invite(),
          invite({ code: 'private-code', forAccount: otherDid }),
        ],
      }),
    )
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

beforeEach(() => {
  requests.length = 0
})

function client() {
  return createSpacesInviteClient({
    url: base,
    adminPassword: 'admin-secret',
  })
}

test('createInvite creates one use for the logged-in DID with admin auth', async () => {
  const result = await client().createInvite(did)
  assert.deepEqual(result, { code: 'spaces-new-code' })
  assert.equal(
    requests[0].url.pathname,
    '/xrpc/com.atproto.server.createInviteCode',
  )
  assert.equal(requests[0].method, 'POST')
  assert.equal(
    requests[0].authorization,
    `Basic ${Buffer.from('admin:admin-secret').toString('base64')}`,
  )
  assert.deepEqual(requests[0].body, { useCount: 1, forAccount: did })
})

test('listInvites paginates the admin endpoint and only returns the caller codes', async () => {
  const result = await client().listInvites(did)
  assert.deepEqual(result, [
    {
      code: 'spaces-example-code',
      available: 1,
      uses: 0,
      disabled: false,
      createdAt: '2026-08-19T12:00:00.000Z',
    },
    {
      code: 'spaces-used-code',
      available: 1,
      uses: 1,
      disabled: false,
      createdAt: '2026-08-19T12:00:00.000Z',
    },
  ])
  assert.equal(requests.length, 2)
  assert.equal(
    requests[0].url.pathname,
    '/xrpc/com.atproto.admin.getInviteCodes',
  )
  assert.equal(requests[0].url.searchParams.get('limit'), '500')
  assert.equal(requests[1].url.searchParams.get('cursor'), 'page-2')
  assert.ok(result.every((code) => code.code !== 'private-code'))
})
