import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import {
  NodeOAuthClient,
  buildAtprotoLoopbackClientMetadata,
} from '@atproto/oauth-client-node'
import { createOAuthFetch } from './fetch.ts'

// The fetch guards used on the login path. did:web of "localhost" is the one
// host the library maps to http, which lets these run without TLS.

async function startServer(
  handler: http.RequestListener,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      server.closeAllConnections?.()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}

test('enforces the response size limit', async () => {
  // 8 MiB, well past anything a document on this path needs.
  const chunk = 'A'.repeat(64 * 1024)
  const server = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    for (let i = 0; i < 128; i++) res.write(chunk)
    res.end()
  })
  try {
    const fetch = createOAuthFetch({ ssrfProtection: false })
    const started = Date.now()
    await assert.rejects(
      async () => {
        const res = await fetch(`${server.url}/.well-known/did.json`, {
          redirect: 'error',
        })
        await res.json()
      },
      // safeFetchWrap reports this as a 502 FetchResponseError.
      /too large/i,
    )
    // It should stop early rather than reading all of it.
    assert.ok(Date.now() - started < 5_000)
  } finally {
    await server.close()
  }
})

test('times out an unresponsive host', async () => {
  // Hold the request open and never write a byte.
  const server = await startServer(() => {})
  try {
    const fetch = createOAuthFetch({ ssrfProtection: false, timeoutMs: 250 })
    const started = Date.now()
    await assert.rejects(
      () => fetch(`${server.url}/.well-known/did.json`, { redirect: 'error' }),
      (err: Error) => /timeout|abort/i.test(`${err.name} ${err.message}`),
    )
    assert.ok(Date.now() - started < 5_000)
  } finally {
    await server.close()
  }
})

test('refuses private addresses and plain http', async () => {
  const fetch = createOAuthFetch()
  // https, so the rejection is the address check rather than the protocol one.
  await assert.rejects(
    () => fetch('https://127.0.0.1/.well-known/did.json', { redirect: 'error' }),
    (err: Error & { cause?: Error }) =>
      /non-unicast|not a public domain/i.test(`${err.message} ${err.cause?.message ?? ''}`),
  )
  // Plain http is refused outright.
  await assert.rejects(
    () => fetch('http://169.254.169.254/latest/meta-data/', { redirect: 'error' }),
    /forbidden protocol/i,
  )
})

test('applies the limits to the OAuth client', { timeout: 15_000 }, async () => {
  // Same construction as src/oauth/client.ts in dev mode: loopback client and
  // this fetch, no Postgres. The server streams the document indefinitely, so a
  // client without the cap never finishes (and the test's timeout fails it).
  const closing = new Set<import('node:http').ServerResponse>()
  const server = await startServer((_req, res) => {
    closing.add(res)
    res.writeHead(200, { 'content-type': 'application/did+ld+json' })
    res.write('{"id":"did:web:localhost","padding":"')
    const chunk = 'A'.repeat(64 * 1024)
    const timer = setInterval(() => {
      if (res.writableEnded || res.destroyed) {
        clearInterval(timer)
        return
      }
      res.write(chunk)
    }, 5)
    res.on('close', () => clearInterval(timer))
  })
  try {
    const store = {
      async get() {
        return undefined
      },
      async set() {},
      async del() {},
    }
    const port = server.url.split(':').pop()
    const client = new NodeOAuthClient({
      clientMetadata: buildAtprotoLoopbackClientMetadata({
        redirect_uris: ['http://127.0.0.1:8080/oauth-callback'],
        scope: 'atproto account:email',
      }),
      stateStore: store,
      sessionStore: store,
      handleResolver: 'https://bsky.social',
      fetch: createOAuthFetch({ ssrfProtection: false }),
    })

    const started = Date.now()
    await assert.rejects(() => client.authorize(`did:web:localhost%3A${port}`))
    // The cap stops this in milliseconds.
    assert.ok(Date.now() - started < 10_000)
  } finally {
    for (const res of closing) res.destroy()
    await server.close()
  }
})

test('does not follow a redirect for a caller that did not ask for one', async () => {
  // The shape @atproto/oauth-client uses for the PAR/token/revocation requests:
  // a Request, no init — and a Request's own redirect mode defaults to 'follow'.
  const seen: string[] = []
  const server = await startServer((req, res) => {
    seen.push(req.url ?? '')
    if (req.url === '/start') {
      res.writeHead(302, { location: '/next' })
      res.end()
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{"request_uri":"https://example.test/x"}')
  })
  try {
    const fetch = createOAuthFetch({ ssrfProtection: false })
    const res = await fetch(new Request(`${server.url}/start`, { method: 'POST' }))
    assert.equal(res.status, 302)
    assert.deepEqual(seen, ['/start'])
  } finally {
    await server.close()
  }
})

test('follows a redirect when the caller asks for it', async () => {
  const seen: string[] = []
  const server = await startServer((req, res) => {
    seen.push(req.url ?? '')
    if (req.url === '/start') {
      res.writeHead(302, { location: '/next' })
      res.end()
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{"ok":true}')
  })
  try {
    const fetch = createOAuthFetch({ ssrfProtection: false })
    const res = await fetch(`${server.url}/start`, { redirect: 'follow' })
    assert.equal(res.status, 200)
    assert.deepEqual(seen, ['/start', '/next'])
  } finally {
    await server.close()
  }
})
