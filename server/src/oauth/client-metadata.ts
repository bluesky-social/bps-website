import type { OAuthClientMetadataInput } from '@atproto/oauth-client-node'
import type { AppConfig } from '../config.ts'

// The client_id IS this document's URL. Clean root path keeps the consent screen host-only.
export function buildClientMetadata(
  config: AppConfig,
): OAuthClientMetadataInput {
  const base = config.apiOrigin.replace(/\/$/, '')
  return {
    client_id: `${base}/oauth-client-metadata.json`,
    client_name: 'Bluesky Protocol Services',
    client_uri: base,
    redirect_uris: [`${base}/oauth-callback`],
    jwks_uri: `${base}/jwks.json`,
    scope: 'atproto account:email',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    application_type: 'web',
    token_endpoint_auth_method: 'private_key_jwt',
    token_endpoint_auth_signing_alg: 'ES256',
    dpop_bound_access_tokens: true,
  }
}
