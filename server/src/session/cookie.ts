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
  const session = await getIronSession<SessionData>(req, res, ironOptions(config))
  session.did = did
  await session.save()
}

export async function readDid(
  req: IncomingMessage,
  res: ServerResponse,
  config: AppConfig,
): Promise<DidString | null> {
  const session = await getIronSession<SessionData>(req, res, ironOptions(config))
  return session.did ?? null
}

export async function clearDid(
  req: IncomingMessage,
  res: ServerResponse,
  config: AppConfig,
): Promise<void> {
  const session = await getIronSession<SessionData>(req, res, ironOptions(config))
  session.destroy()
  await session.save()
}

// For contexts with only a Web Request (lex-server auth fn): parse + unseal directly.
export async function unsealDidFromCookieHeader(
  cookieHeader: string | null,
  config: AppConfig,
): Promise<DidString | null> {
  if (!cookieHeader) return null
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
  if (!match) return null
  const sealed = match.slice(SESSION_COOKIE_NAME.length + 1)
  try {
    const data = await unsealData<SessionData>(sealed, { password: config.ironSessionPassword })
    return data.did ?? null
  } catch {
    return null
  }
}

// Re-export for tests/usage symmetry.
export { sealData }
