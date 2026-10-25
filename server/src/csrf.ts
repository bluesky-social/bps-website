import type { RequestHandler } from 'express'
import type { AppConfig } from './config.ts'

// CSRF guard for the XRPC surface.
//
// The session cookie is SameSite=None (site on bsky.network, API on
// bps-api.bsky.network), and lex-server only enforces a request's content type
// when the method declares an `input`. Procedures without one — account.delete,
// oauth.logout, spacesAlpha.createInvite — therefore accept a POST carrying
// anything a cross-site form can send, and the handler runs. Require the site
// Origin instead, falling back to JSON for Origin-less callers; the generated
// client sends no content type for those methods, so content type cannot be the
// gate.
export function csrfGuard(config: AppConfig): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'POST' || !req.path.startsWith('/xrpc/')) {
      next()
      return
    }

    const origin = req.headers.origin
    if (origin !== undefined) {
      if (origin !== config.siteOrigin) {
        res.status(403).json({
          error: 'InvalidRequest',
          message: 'Cross-origin request refused',
        })
        return
      }
      next()
      return
    }

    const contentType = (req.headers['content-type'] ?? '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase()
    if (contentType !== 'application/json') {
      res.status(415).json({
        error: 'InvalidRequest',
        message: 'POST requests without an Origin must be sent as application/json',
      })
      return
    }

    next()
  }
}
