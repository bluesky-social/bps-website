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
  gatekeeper: {
    url: string
    bearerToken: string
    email: string
  } | null
  spacesPds: {
    url: string
    adminPassword: string
  } | null
  // Replaces the built-in default policy attached to newly created Jetstream
  // API keys; null means use the built-in (see apikeys/jetstream-policy.ts).
  // Deliberately untyped beyond "is a JSON object": Gatekeeper validates the
  // document against the service's own schema, and duplicating those rules here
  // would reject a policy the server would have accepted.
  jetstreamKeyPolicy: Record<string, unknown> | null
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

  // --- Gatekeeper-backed API keys (optional, all-or-nothing group) ---
  const gkUrl = env.BPS_GATEKEEPER_URL?.trim() || null
  const gkToken = env.BPS_GATEKEEPER_BEARER_TOKEN?.trim() || null
  const gkEmail = env.BPS_GATEKEEPER_EMAIL?.trim() || null
  let gatekeeper: AppConfig['gatekeeper'] = null
  if (gkUrl || gkToken || gkEmail) {
    if (!gkUrl) errors.push('BPS_GATEKEEPER_URL is required when other BPS_GATEKEEPER_* vars are set')
    if (!gkToken) errors.push('BPS_GATEKEEPER_BEARER_TOKEN is required when other BPS_GATEKEEPER_* vars are set')
    if (!gkEmail) errors.push('BPS_GATEKEEPER_EMAIL is required when other BPS_GATEKEEPER_* vars are set')
    if (gkUrl && gkToken && gkEmail) {
      gatekeeper = { url: gkUrl.replace(/\/$/, ''), bearerToken: gkToken, email: gkEmail }
    }
  }

  // --- ATProto Spaces invite authority (optional, all-or-nothing group) ---
  // This may point at a standalone PDS or at the Entryway that owns invites
  // for a PDS cluster. The admin credential never leaves this server.
  const spacesPdsUrl = env.BPS_SPACES_PDS_URL?.trim() || null
  const spacesPdsAdminPassword =
    env.BPS_SPACES_PDS_ADMIN_PASSWORD?.trim() || null
  let spacesPds: AppConfig['spacesPds'] = null
  if (spacesPdsUrl || spacesPdsAdminPassword) {
    if (!spacesPdsUrl) {
      errors.push(
        'BPS_SPACES_PDS_URL is required when BPS_SPACES_PDS_ADMIN_PASSWORD is set',
      )
    }
    if (!spacesPdsAdminPassword) {
      errors.push(
        'BPS_SPACES_PDS_ADMIN_PASSWORD is required when BPS_SPACES_PDS_URL is set',
      )
    }
    if (spacesPdsUrl && spacesPdsAdminPassword) {
      spacesPds = {
        url: spacesPdsUrl.replace(/\/$/, ''),
        adminPassword: spacesPdsAdminPassword,
      }
    }
  }

  // --- Default policy for new Jetstream API keys (optional) ---
  // Set it and it fully replaces the built-in default — nothing is inherited,
  // so the configured document is exactly what Gatekeeper receives. Only the
  // JSON parse and an is-it-an-object check happen here; the schema is
  // Gatekeeper's to enforce.
  const policyRaw = env.BPS_JETSTREAM_KEY_POLICY?.trim() || null
  let jetstreamKeyPolicy: AppConfig['jetstreamKeyPolicy'] = null
  if (policyRaw) {
    let parsed: unknown
    try {
      parsed = JSON.parse(policyRaw)
    } catch (err) {
      errors.push(
        `BPS_JETSTREAM_KEY_POLICY must be valid JSON (${(err as Error).message})`,
      )
      parsed = undefined
    }
    if (parsed !== undefined) {
      // Arrays and null are typeof 'object' too, and neither can be a policy.
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        errors.push('BPS_JETSTREAM_KEY_POLICY must be a JSON object')
      } else {
        jetstreamKeyPolicy = parsed as Record<string, unknown>
      }
    }
  }

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
    gatekeeper,
    spacesPds,
    jetstreamKeyPolicy,
  }
}
