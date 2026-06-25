import { parse, serialize } from 'cookie'
import { getIronSession, sealData, unsealData } from 'iron-session'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DidString } from '@atproto/syntax'
import type { AppConfig } from '../config.ts'

export const SESSION_COOKIE_NAME = 'bps_session'

type SessionData = { did?: DidString }

function ironOptions(config: AppConfig) {
  return {
    cookieName: SESSION_COOKIE_NAME,
    password: config.ironSessionPassword,
    cookieOptions: {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: config.cookieSameSite,
      domain: config.devMode ? undefined : config.cookieDomain,
      path: '/',
    },
  }
}

export async function setDid(
  req: IncomingMessage,
  res: ServerResponse,
  config: AppConfig,
  did: DidString,
): Promise<void> {
  const session = await getIronSession<SessionData>(
    req,
    res,
    ironOptions(config),
  )
  session.did = did
  await session.save()
}

// For contexts with only a Web Request (lex-server auth fn): parse + unseal directly.
export async function unsealDidFromCookieHeader(
  cookieHeader: string | null,
  config: AppConfig,
): Promise<DidString | null> {
  if (!cookieHeader) return null
  const sealed = parse(cookieHeader)[SESSION_COOKIE_NAME]
  if (!sealed) return null
  try {
    const data = await unsealData<SessionData>(sealed, {
      password: config.ironSessionPassword,
    })
    return data.did ?? null
  } catch {
    return null
  }
}

// Build a Set-Cookie header value that immediately expires the session cookie.
// Used by lex-server handlers that return a raw Web Response (not Express res).
export function clearCookieHeader(config: AppConfig): string {
  return serialize(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    domain: config.devMode ? undefined : config.cookieDomain,
    path: '/',
    maxAge: 0,
  })
}

// Re-export for tests/usage symmetry.
export { sealData }
