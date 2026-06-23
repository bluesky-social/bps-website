import { xrpc } from '@atproto/lex'
import * as internal from '@site/src/lexicons/internal'

// All calls go cross-origin to the API and must carry the session cookie.
//
// @atproto/lex's xrpc() first arg is AgentOptions; passing { service, fetch }
// injects a custom fetch that forces credentials: 'include' on every request.
// The xrpc() options accept `params` (query string) and `body` (procedure body)
// at the top level — NOT nested under `input`.
const credFetch = (input, init = {}) =>
  fetch(input, { ...init, credentials: 'include' })

async function call(apiOrigin, schema, opts = {}) {
  try {
    const res = await xrpc({ service: apiOrigin, fetch: credFetch }, schema, opts)
    return res.body
  } catch (err) {
    // Normalize to { status, error, message }.
    // XrpcResponseError has .status (via response.status), .error (LexError field), .message.
    // XrpcInternalError / XrpcFetchError extend LexError and have .error, .message but status 0.
    const status = err?.status ?? err?.response?.status ?? 0
    const error = err?.error ?? 'RequestFailed'
    const message = err?.message ?? 'Request failed'
    throw { status, error, message }
  }
}

export function buildClient(apiOrigin) {
  return {
    whoami: () =>
      call(apiOrigin, internal.bps.account.whoami.main),
    profile: () =>
      call(apiOrigin, internal.bps.account.profile.main),
    oauthStart: (handle) =>
      call(apiOrigin, internal.bps.oauth.start.main, { params: { handle } }),
    logout: () =>
      call(apiOrigin, internal.bps.oauth.logout.main),
    apiKeyList: () =>
      call(apiOrigin, internal.bps.apiKey.list.main),
    apiKeyCreate: ({ label, expiresAt }) =>
      call(apiOrigin, internal.bps.apiKey.create.main, {
        body: { label, ...(expiresAt ? { expiresAt } : {}) },
      }),
    apiKeyDelete: (id) =>
      call(apiOrigin, internal.bps.apiKey.delete.main, { body: { id } }),
    accountSetEmail: (email) =>
      call(apiOrigin, internal.bps.account.setEmail.main, { body: { email } }),
    accountDelete: () =>
      call(apiOrigin, internal.bps.account.delete.main),
  }
}
