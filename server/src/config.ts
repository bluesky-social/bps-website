export type AppConfig = {
  port: number
  databaseUrl: string
  siteOrigin: string
  apiOrigin: string
  cookieDomain: string
  ironSessionPassword: string
  nodeEnv: string
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
  }
}
