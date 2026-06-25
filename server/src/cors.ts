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
      // `atproto-*` headers are added by the @atproto/lex Client on every XRPC
      // call (atproto-accept-labelers always; atproto-proxy for service-proxied
      // calls). They are non-simple, so the browser preflights them — allow them
      // or the preflight fails and the real request never goes out.
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, atproto-accept-labelers, atproto-proxy',
      )
    }
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }
    next()
  }
}
