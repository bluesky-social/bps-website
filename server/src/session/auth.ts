import { LexServerAuthError } from '@atproto/lex-server'
import type { DidString } from '@atproto/syntax'
import type { AppConfig } from '../config.ts'
import { unsealDidFromCookieHeader } from './cookie.ts'

export type SessionCredentials = { did: DidString }

export function makeRequireSession(config: AppConfig) {
  return async ({ request }: { request: Request }): Promise<SessionCredentials> => {
    const did = await unsealDidFromCookieHeader(request.headers.get('cookie'), config)
    if (!did) {
      throw new LexServerAuthError('AuthenticationRequired', 'Login required', {
        Bearer: { realm: 'account' },
      })
    }
    return { did }
  }
}
