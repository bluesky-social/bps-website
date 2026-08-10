import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { IncomingHttpHeaders } from 'node:http'
import type { GatekeeperSubjectKey } from './gatekeeper-client.ts'

export type RecordedRequest = {
  method: string
  path: string
  headers: IncomingHttpHeaders
  body: unknown
}

export type FakeGatekeeper = {
  url: string
  requests: RecordedRequest[]
  setHandler(h: (req: RecordedRequest) => { status: number; body?: unknown }): void
  close(): Promise<void>
}

// Minimal in-process stand-in for Gatekeeper's HTTP API: records every
// request and returns whatever the current handler dictates. Tests assert
// request shape (headers, body) and exercise response mapping.
export async function startFakeGatekeeper(): Promise<FakeGatekeeper> {
  const requests: RecordedRequest[] = []
  let handler: (req: RecordedRequest) => { status: number; body?: unknown } = () => ({
    status: 500,
    body: { title: 'no handler set' },
  })
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const raw = Buffer.concat(chunks).toString()
    const recorded: RecordedRequest = {
      method: req.method ?? '',
      path: req.url ?? '',
      headers: req.headers,
      body: raw ? JSON.parse(raw) : undefined,
    }
    requests.push(recorded)
    const out = handler(recorded)
    res.statusCode = out.status
    if (out.body !== undefined) {
      res.setHeader('content-type', 'application/problem+json')
      if (out.status >= 200 && out.status < 300) {
        res.setHeader('content-type', 'application/json')
      }
      res.end(JSON.stringify(out.body))
    } else {
      res.end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, () => resolve()))
  const port = (server.address() as AddressInfo).port
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    setHandler(h) {
      handler = h
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

// Defaults model a current (usable) key as returned by subject lookups.
// Creation responses carry no lifecycle booleans; tests for createKey may
// pass the same fixture — the extra fields are simply ignored there.
export function makeGatekeeperKey(
  overrides: Partial<GatekeeperSubjectKey> = {},
): GatekeeperSubjectKey {
  return {
    id: 'key_0123456789abcdefghijkl',
    subject: 'did:plc:gktest',
    name: 'ci-key abc12345',
    key: 'gk_' + 'a'.repeat(39) + 'wxyz',
    data: { version: 1 },
    valid_from: null,
    valid_until: null,
    revoked_at: null,
    created_at: '2026-08-04T00:00:00Z',
    revision: 1,
    database_revision: 1,
    fingerprint: 'sha256:0123456789abcdef',
    current: true,
    expired: false,
    revoked: false,
    future: false,
    ...overrides,
  }
}
