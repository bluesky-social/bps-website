import express from 'express'
import { toRequestListener } from '@atproto/lex-server/nodejs'
import type { DB } from './db/index.ts'
import { buildRouter } from './router.ts'

export function buildApp(db: DB): express.Express {
  const app = express()

  // Plain liveness route (no XRPC envelope) for infra probes.
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // Mount the XRPC router. It owns the /xrpc/* surface.
  const router = buildRouter(db)
  app.use(toRequestListener(router.fetch))

  return app
}
