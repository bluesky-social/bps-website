import { Client, AtIdentifierString, DatetimeString } from '@atproto/lex'
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

export function buildClient(service: string) {
  const client = new Client({ service, fetchHandler: credFetch })
  return {
    whoami: () => client.call(internal.bps.account.whoami),
    profile: () => client.call(internal.bps.account.profile),
    oauthStart: (handle: string) =>
      client.call(internal.bps.oauth.start, {
        handle: handle as AtIdentifierString,
      }),
    logout: () => client.call(internal.bps.oauth.logout),
    apiKeyList: () => client.call(internal.bps.apiKey.list),
    apiKeyCreate: ({
      label,
      expiresAt,
    }: {
      label: string
      expiresAt?: string
    }) =>
      client.call(internal.bps.apiKey.create, {
        label,
        ...(expiresAt ? { expiresAt: expiresAt as DatetimeString } : {}),
      }),
    apiKeyDelete: (id: string) =>
      client.call(internal.bps.apiKey.delete, { id }),
    accountDelete: () => client.call(internal.bps.account.delete),
  }
}

export type AccountClient = ReturnType<typeof buildClient>
