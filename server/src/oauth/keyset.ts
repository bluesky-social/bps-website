import { JoseKey } from '@atproto/oauth-client-node'
import type { AppConfig } from '../config.ts'
import { logger } from '../logger.ts'

// ES256 signing key for private_key_jwt client auth (published at /jwks.json).
export async function loadKeyset(config: AppConfig): Promise<JoseKey[]> {
  if (config.oauthPrivateKey) {
    const key = await JoseKey.fromImportable(
      config.oauthPrivateKey,
      config.oauthKeyId,
    )
    return [key]
  }
  if (!config.devMode) {
    throw new Error('No BPS_OAUTH_PRIVATE_KEY set outside dev mode')
  }
  logger.warn(
    'No BPS_OAUTH_PRIVATE_KEY — generating an EPHEMERAL ES256 key (dev only; sessions reset on restart)',
  )
  const key = await JoseKey.generate(['ES256'], config.oauthKeyId)
  return [key]
}
