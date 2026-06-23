import type { RequestHandler } from 'express'
import type { AppConfig } from './config.ts'

// Credentialed CORS for the static site origin only. Never '*' (incompatible
// with credentials), only an exact match against the configured site origin.
export function corsMiddleware(config: AppConfig): RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin
    if (origin && origin === config.siteOrigin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    }
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    next()
  }
}
