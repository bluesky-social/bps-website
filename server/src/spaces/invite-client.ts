import { xrpc, type DatetimeString } from '@atproto/lex'
import type { DidString } from '@atproto/syntax'
import * as com from '../lexicons/com.ts'

export type SpacesInvite = {
  code: string
  available: number
  uses: number
  disabled: boolean
  createdAt: DatetimeString
}

export type SpacesInviteClient = {
  createInvite(forAccount: DidString): Promise<{ code: string }>
  listInvites(forAccount: DidString): Promise<SpacesInvite[]>
}

export function createSpacesInviteClient(config: {
  url: string
  adminPassword: string
  timeoutMs?: number
}): SpacesInviteClient {
  const authorization = `Basic ${Buffer.from(
    `admin:${config.adminPassword}`,
  ).toString('base64')}`
  const timeoutMs = config.timeoutMs ?? 10_000
  const agent = {
    service: config.url,
    headers: { authorization },
    fetch: (input: string | URL | Request, init?: RequestInit) =>
      fetch(input, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
      }),
  }

  return {
    async createInvite(forAccount) {
      const { body } = await xrpc(agent, com.atproto.server.createInviteCode, {
        body: { useCount: 1, forAccount },
      })
      return { code: body.code }
    },

    async listInvites(forAccount) {
      const invites: SpacesInvite[] = []
      const seenCursors = new Set<string>()
      let cursor: string | undefined

      // The admin endpoint has no account filter. Walk every page on the
      // server, and discard other users' codes before this method returns.
      do {
        const { body } = await xrpc(agent, com.atproto.admin.getInviteCodes, {
          params: { sort: 'recent', limit: 500, ...(cursor ? { cursor } : {}) },
        })
        for (const invite of body.codes) {
          if (invite.forAccount !== forAccount) continue
          invites.push({
            code: invite.code,
            available: invite.available,
            uses: invite.uses.length,
            disabled: invite.disabled,
            createdAt: invite.createdAt,
          })
        }

        cursor = body.cursor
        if (cursor) {
          if (seenCursors.has(cursor)) {
            throw new Error('Spaces PDS returned a repeated invite cursor')
          }
          seenCursors.add(cursor)
        }
      } while (cursor)

      return invites
    },
  }
}
