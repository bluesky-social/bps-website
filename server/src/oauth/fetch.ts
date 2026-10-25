import { safeFetchWrap } from '@atproto-labs/fetch-node'

// Bounds for the fetch handed to NodeOAuthClient. The URLs on the login path
// (DID document, resource metadata, authorization-server metadata, PAR) follow
// whatever the user typed into the login form, so apply the same guards the
// handle resolver already uses: a timeout, a response size limit and no private
// addresses. Redirects are made explicit because the client's DPoP-bound
// requests otherwise follow them, and the checks only apply to the first URL.
export const OAUTH_FETCH_TIMEOUT_MS = 10_000

// 512 KiB is safeFetchWrap's own default, and ~300x the largest document on
// this path (a did:plc resolution measures ~550 B).
export const OAUTH_FETCH_MAX_RESPONSE_BYTES = 512 * 1024

export type OAuthFetchOptions = {
  timeoutMs?: number
  maxResponseBytes?: number
  ssrfProtection?: boolean
}

/**
 * The fetch used by the OAuth client. `ssrfProtection` is off in dev only,
 * where the loopback client form talks to a PDS on localhost.
 */
export function createOAuthFetch({
  timeoutMs = OAUTH_FETCH_TIMEOUT_MS,
  maxResponseBytes = OAUTH_FETCH_MAX_RESPONSE_BYTES,
  ssrfProtection = true,
}: OAuthFetchOptions = {}): typeof fetch {
  const safe = safeFetchWrap({
    // safeFetchWrap rejects a request whose redirect mode was left implicit, so
    // allow that here and set one below instead.
    allowImplicitRedirect: true,
    timeout: timeoutMs,
    ssrfProtection,
    responseMaxSize: maxResponseBytes,
  })

  return (input, init) => {
    const redirect =
      init?.redirect ??
      (input instanceof Request ? input.redirect : 'manual')
    return safe(input, { ...init, redirect })
  }
}
