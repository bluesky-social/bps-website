import type { OAuthClientMetadataInput } from '@atproto/oauth-client-node'

// Types for the plain-JS builder shared with the site build; see
// client-metadata-doc.mjs for why that file is untyped .mjs.
export declare function buildClientMetadataDoc(origins: {
  siteOrigin: string
  apiOrigin: string
}): OAuthClientMetadataInput
