import express from 'express'
import { toRequestListener } from '@atproto/lex-server/nodejs'
import type { NodeOAuthClient } from '@atproto/oauth-client-node'
import type { DB } from './db/index.ts'
import type { AppConfig } from './config.ts'
import type { ApiKeyProvider } from './apikeys/provider.ts'
import { buildRouter } from './router.ts'
import { mountOAuthRoutes } from './oauth/routes.ts'
import { corsMiddleware } from './cors.ts'

export type AppDeps = { db: DB; config: AppConfig; client: NodeOAuthClient; apiKeys: ApiKeyProvider }

export function buildApp(deps: AppDeps): express.Express {
  const app = express()

  // Credentialed CORS for the static site origin must be the first middleware
  // so preflight and headers apply to every route including /_health and XRPC.
  app.use(corsMiddleware(deps.config))

  // Plain liveness route (no XRPC envelope) for infra probes.
  app.get('/_health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // Mount OAuth routes (callback, metadata, jwks) before the XRPC catch-all.
  mountOAuthRoutes(app, deps)

  // Mount the XRPC router. It owns the /xrpc/* surface.
  const router = buildRouter(deps)
  app.use(toRequestListener(router.fetch))

  return app
}
