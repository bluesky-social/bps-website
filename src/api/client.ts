import { xrpc, type Query, type Procedure, type Main } from '@atproto/lex'
import * as internal from '@site/src/lexicons/internal'

// All calls go cross-origin to the API and must carry the session cookie.
//
// @atproto/lex's xrpc() first arg is AgentOptions; passing { service, fetch }
// injects a custom fetch that forces credentials: 'include' on every request.
//
// We deliberately do NOT catch/re-wrap errors: xrpc throws standardized
// XrpcError instances (real Errors subclassing LexError) that already carry
// `.message`, `.status`, and `.error`, plus `instanceof XrpcResponseError` for
// narrowing. Callers handle those directly — we never throw a plain object.
const credFetch: typeof fetch = (input, init = {}) =>
  fetch(input, { ...init, credentials: 'include' })

// Thin typed wrapper over xrpc. The public methods below carry fully-typed
// inputs; this helper localizes the one rough edge — xrpc's overload uses a
// conditional type to decide whether `options` is required, and that condition
// does not narrow through a generic pass-through under the site's `bundler`
// module resolution (it resolves cleanly under the server's `nodenext`). We
// cast the method arg here, in exactly one place, rather than at every call.
// `options` is loosely typed (params/body as plain records): the lexicon params
// carry branded string formats (at-identifier, datetime) that our callers supply
// as plain strings, and the server re-validates them against the schema anyway.
function call(
  apiOrigin: string,
  method: Main<Query | Procedure>,
  options?: { params?: Record<string, unknown>; body?: Record<string, unknown> },
): Promise<unknown> {
  const agent = { service: apiOrigin, fetch: credFetch }
  return xrpc(agent, method as never, (options ?? {}) as never).then((r) => r.body)
}

export function buildClient(apiOrigin: string) {
  return {
    whoami: () => call(apiOrigin, internal.bps.account.whoami),
    profile: () => call(apiOrigin, internal.bps.account.profile),
    oauthStart: (handle: string) =>
      call(apiOrigin, internal.bps.oauth.start, { params: { handle } }),
    logout: () => call(apiOrigin, internal.bps.oauth.logout),
    apiKeyList: () => call(apiOrigin, internal.bps.apiKey.list),
    apiKeyCreate: ({ label, expiresAt }: { label: string; expiresAt?: string }) =>
      call(apiOrigin, internal.bps.apiKey.create, {
        body: { label, ...(expiresAt ? { expiresAt } : {}) },
      }),
    apiKeyDelete: (id: string) =>
      call(apiOrigin, internal.bps.apiKey.delete, { body: { id } }),
    accountDelete: () => call(apiOrigin, internal.bps.account.delete),
  }
}

export type AccountClient = ReturnType<typeof buildClient>
