import {
  NodeOAuthClient,
  buildAtprotoLoopbackClientMetadata,
} from '@atproto/oauth-client-node'
import type { DB } from '../db/index.ts'
import type { AppConfig } from '../config.ts'
import { loadKeyset } from './keyset.ts'
import { buildClientMetadata } from './client-metadata.ts'
import { createStateStore } from './state-store.ts'
import { createSessionStore } from './session-store.ts'

// In dev mode, atproto requires the loopback client form:
//   client_id = 'http://localhost' (no hosted-metadata doc, no private_key_jwt auth)
// The redirect_uri must use a loopback IP (127.0.0.1 or [::1]), not hostname 'localhost'.
// We extract the port from apiOrigin so the callback matches the running dev server.
function buildDevClientMetadata(config: AppConfig) {
  const url = new URL(config.apiOrigin)
  const port = url.port || '80'
  const redirectUri = `http://127.0.0.1:${port}/oauth-callback`
  return buildAtprotoLoopbackClientMetadata({
    redirect_uris: [redirectUri],
    scope: 'atproto account:email',
  })
}

export async function createOAuthClient(
  db: DB,
  config: AppConfig,
): Promise<NodeOAuthClient> {
  if (config.devMode) {
    // Loopback/dev: no keyset needed (token_endpoint_auth_method = 'none')
    return new NodeOAuthClient({
      clientMetadata: buildDevClientMetadata(config),
      stateStore: createStateStore(db),
      sessionStore: createSessionStore(db),
      handleResolver: config.oauthHandleResolver,
    })
  }

  // Production: hosted-metadata form with private_key_jwt
  const keyset = await loadKeyset(config)
  return new NodeOAuthClient({
    clientMetadata: buildClientMetadata(config),
    keyset,
    stateStore: createStateStore(db),
    sessionStore: createSessionStore(db),
    handleResolver: config.oauthHandleResolver,
  })
}
