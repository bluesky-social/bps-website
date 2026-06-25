export type AppConfig = {
  port: number
  databaseUrl: string
  siteOrigin: string
  apiOrigin: string
  cookieDomain: string
  ironSessionPassword: string
  nodeEnv: string
  oauthHandleResolver: string
  oauthKeyId: string
  oauthPrivateKey: string | null
  cookieSecure: boolean
  cookieSameSite: 'lax' | 'none'
  devMode: boolean
  appViewUrl: string
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const errors: string[] = []

  const str = (key: string): string => {
    const v = env[key]
    if (!v || v.trim() === '') {
      errors.push(`${key} is required`)
      return ''
    }
    return v
  }

  const databaseUrl = str('BPS_DATABASE_URL')
  const siteOrigin = str('BPS_SITE_ORIGIN')
  const apiOrigin = str('BPS_API_ORIGIN')
  const cookieDomain = str('BPS_COOKIE_DOMAIN')

  const password = env.BPS_IRON_SESSION_PASSWORD ?? ''
  if (password.length < 32) {
    errors.push('BPS_IRON_SESSION_PASSWORD must be at least 32 characters')
  }

  const portRaw = env.BPS_PORT ?? '8080'
  const port = Number(portRaw)
  if (!Number.isInteger(port) || port <= 0) {
    errors.push(`BPS_PORT must be a positive integer (got "${portRaw}")`)
  }

  // --- OAuth + cookie settings (Phase 2) ---
  const oauthHandleResolver = str('BPS_OAUTH_HANDLE_RESOLVER')
  const oauthKeyId = env.BPS_OAUTH_KEY_ID?.trim() || 'bps1'
  const oauthPrivateKey = env.BPS_OAUTH_PRIVATE_KEY?.trim() || null

  const nodeEnvResolved = env.NODE_ENV ?? 'development'
  const isProd = nodeEnvResolved === 'production'
  const apiIsHttp = (env.BPS_API_ORIGIN ?? '').startsWith('http://')

  if (isProd && !oauthPrivateKey) {
    errors.push('BPS_OAUTH_PRIVATE_KEY is required in production')
  }

  const cookieSecure = isProd || !apiIsHttp
  const cookieSameSite: 'lax' | 'none' = isProd ? 'none' : 'lax'

  const appViewUrl = (
    env.BPS_APPVIEW_URL?.trim() || 'https://public.api.bsky.app'
  ).replace(/\/$/, '')

  if (errors.length > 0) {
    throw new Error(`Invalid configuration:\n  - ${errors.join('\n  - ')}`)
  }

  return {
    port,
    databaseUrl,
    siteOrigin,
    apiOrigin,
    cookieDomain,
    ironSessionPassword: password,
    nodeEnv: env.NODE_ENV ?? 'development',
    oauthHandleResolver,
    oauthKeyId,
    oauthPrivateKey,
    cookieSecure,
    cookieSameSite,
    devMode: !isProd,
    appViewUrl,
  }
}
