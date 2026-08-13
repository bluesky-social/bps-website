// The OAuth client_id IS the URL this document is published at, and the
// authorization server rejects any document whose client_id does not match the
// URL it fetched it from ("client_id does not match", @atproto/oauth-provider
// client-manager). So the document is published as a static file by the site
// build — giving client_id the site's public domain, which is what users see on
// the consent screen — while redirect_uri and jwks_uri point at the API service
// that actually implements them. That split origin is legal: the provider only
// constrains client_uri (same origin as client_id, and a parent of its path).
//
// Two callers build the document from this one function, and drift between them
// breaks login outright: the server sends redirect_uri in its PAR request, and
// the authorization server validates it against the published copy.
//
//   - docusaurus.config.js (oauth-client-metadata plugin) writes the published
//     document into the static build output.
//   - client-metadata.ts feeds the server's own NodeOAuthClient.
//
// Plain dependency-free .mjs on purpose: the site builds on Node 22, which does
// not strip TypeScript types, and this file has to be loadable by both builds.
// Types live in client-metadata-doc.d.mts.

/**
 * @param {{ siteOrigin: string, apiOrigin: string }} origins
 */
export function buildClientMetadataDoc({ siteOrigin, apiOrigin }) {
  if (!siteOrigin) throw new Error('buildClientMetadataDoc: siteOrigin is required')
  if (!apiOrigin) throw new Error('buildClientMetadataDoc: apiOrigin is required')

  // Normalized here rather than at each call site: the site build passes
  // Docusaurus's `url` (trailing slash) and the server passes BPS_SITE_ORIGIN
  // (usually none). A one-character difference in client_id fails the match.
  const site = siteOrigin.replace(/\/+$/, '')
  const api = apiOrigin.replace(/\/+$/, '')

  return {
    client_id: `${site}/oauth-client-metadata.json`,
    client_name: 'Bluesky Protocol Services',
    client_uri: site,
    redirect_uris: [`${api}/oauth-callback`],
    jwks_uri: `${api}/jwks.json`,
    scope: 'atproto account:email',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    application_type: 'web',
    token_endpoint_auth_method: 'private_key_jwt',
    token_endpoint_auth_signing_alg: 'ES256',
    dpop_bound_access_tokens: true,
  }
}
