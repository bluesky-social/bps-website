// Minimal client for Gatekeeper's v1 API (bluesky-social/gatekeeper, PR #5
// subject support). Direct-auth mode: every request carries the shared
// bearer secret plus the X-Beyond-Email identity assertion.

export type GatekeeperKey = {
  id: string
  subject: string
  name: string
  key: string // secret, gk_...
  data: unknown
  valid_from: string | null
  valid_until: string | null
  revoked_at: string | null
  created_at: string
  revision: number
  database_revision: number
  fingerprint: string
}

type Problem = { type?: string; title?: string; detail?: string }

export class GatekeeperError extends Error {
  readonly status: number
  readonly problem: Problem

  constructor(status: number, problem: Problem) {
    super(
      `gatekeeper responded ${status}` +
        (problem.title ? `: ${problem.title}` : '') +
        (problem.detail ? ` — ${problem.detail}` : ''),
    )
    this.name = 'GatekeeperError'
    this.status = status
    this.problem = problem
  }
}

export type GatekeeperClient = {
  createKey(
    service: string,
    input: {
      subject: string
      name: string
      data: unknown
      validUntil: Date | null
      idempotencyKey: string
    },
  ): Promise<GatekeeperKey>
  listSubjectKeys(subject: string): Promise<Record<string, GatekeeperKey[]>>
  revokeKey(service: string, keyId: string): Promise<void>
}

export function createGatekeeperClient(cfg: {
  url: string
  bearerToken: string
  email: string
}): GatekeeperClient {
  const request = async (
    method: string,
    path: string,
    opts: { body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<unknown> => {
    const headers: Record<string, string> = {
      authorization: `Bearer ${cfg.bearerToken}`,
      'x-beyond-email': cfg.email,
      ...opts.headers,
    }
    if (opts.body !== undefined) headers['content-type'] = 'application/json'
    const res = await fetch(`${cfg.url}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
    if (!res.ok) {
      const problem = (await res.json().catch(() => ({}))) as Problem
      throw new GatekeeperError(res.status, problem)
    }
    if (res.status === 204) return undefined
    return res.json()
  }

  return {
    async createKey(service, input) {
      const body: Record<string, unknown> = {
        subject: input.subject,
        name: input.name,
        data: input.data,
      }
      if (input.validUntil !== null) {
        body.valid_until = input.validUntil.toISOString()
      }
      return (await request(
        'POST',
        `/v1/services/${encodeURIComponent(service)}/keys`,
        { body, headers: { 'idempotency-key': input.idempotencyKey } },
      )) as GatekeeperKey
    },

    async listSubjectKeys(subject) {
      return (await request(
        'GET',
        `/v1/subjects/${encodeURIComponent(subject)}/keys`,
      )) as Record<string, GatekeeperKey[]>
    },

    async revokeKey(service, keyId) {
      await request(
        'DELETE',
        `/v1/services/${encodeURIComponent(service)}/keys/${encodeURIComponent(keyId)}`,
      )
    },
  }
}
