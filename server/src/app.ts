import express from 'express'
import { toRequestListener } from '@atproto/lex-server/nodejs'
import type { NodeOAuthClient } from '@atproto/oauth-client-node'
import type { DB } from './db/index.ts'
import type { AppConfig } from './config.ts'
import { buildRouter } from './router.ts'
import { mountOAuthRoutes } from './oauth/routes.ts'

export type AppDeps = { db: DB; config: AppConfig; client: NodeOAuthClient }

export function buildApp(deps: AppDeps): express.Express {
  const app = express()

  // Plain liveness route (no XRPC envelope) for infra probes.
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // Mount OAuth routes (callback, metadata, jwks) before the XRPC catch-all.
  mountOAuthRoutes(app, deps)

  // Mount the XRPC router. It owns the /xrpc/* surface.
  const router = buildRouter(deps)
  app.use(toRequestListener(router.fetch))

  return app
}
