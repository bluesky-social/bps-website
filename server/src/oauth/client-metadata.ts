import type { OAuthClientMetadataInput } from '@atproto/oauth-client-node'
import type { AppConfig } from '../config.ts'
import { buildClientMetadataDoc } from './client-metadata-doc.mjs'

// The document itself is published by the site build, not served here — this is
// the server's copy of the same bytes. Both come from buildClientMetadataDoc so
// they cannot drift; see that file for the split-origin rationale.
export function buildClientMetadata(
  config: AppConfig,
): OAuthClientMetadataInput {
  return buildClientMetadataDoc({
    siteOrigin: config.siteOrigin,
    apiOrigin: config.apiOrigin,
  })
}
