import type { Express, Request, Response } from 'express'
import type { NodeOAuthClient } from '@atproto/oauth-client-node'
import type { DidString } from '@atproto/syntax'
import type { DB } from '../db/index.ts'
import type { AppConfig } from '../config.ts'
import { sql } from 'kysely'
import { setDid } from '../session/cookie.ts'
import { logger } from '../logger.ts'
import { safeGetSession } from '../account/get-session.ts'

type Deps = { client: NodeOAuthClient; config: AppConfig; db: DB }

export function mountOAuthRoutes(app: Express, deps: Deps): void {
  const { client, config, db } = deps

  app.get('/oauth-client-metadata.json', (_req: Request, res: Response) => {
    res.json(client.clientMetadata)
  })

  app.get('/jwks.json', (_req: Request, res: Response) => {
    res.json(client.jwks)
  })

  app.get('/oauth-callback', async (req: Request, res: Response) => {
    try {
      const params = new URLSearchParams(req.url.split('?')[1] ?? '')
      const { session } = await client.callback(params)
      const did = session.did as DidString

      // Capture handle + email from the user's PDS (getSession). Never throws.
      const { handle, email } = await safeGetSession(session)

      // Upsert: refresh the handle on every login; email also refreshes on every
      // login when the PDS shares one (excluded.email is non-NULL). When the PDS
      // does not share an email (excluded.email IS NULL / non-observation), the
      // existing stored value is kept — "keep last-known on NULL".
      await db
        .insertInto('account')
        .values({ did, handle: handle ?? null, email: email ?? null })
        .onConflict((oc) =>
          oc.column('did').doUpdateSet({
            handle: sql`coalesce(excluded.handle, account.handle)`,
            email: sql`coalesce(excluded.email, account.email)`, // PDS observation wins; keep last-known on NULL
            updated_at: sql`now()`,
          }),
        )
        .execute()

      await setDid(req, res, config, did)
      res.redirect(302, `${config.siteOrigin}/account`)
    } catch (err) {
      // Generic redirect for the user; log request context so abuse/probing of
      // the callback (vs. a user who simply took too long) is spottable. The
      // atproto client validates state/PKCE/DPoP internally, so a forged
      // callback fails closed here.
      logger.error(
        { err, ip: req.ip, userAgent: req.get('user-agent') },
        'oauth callback failed',
      )
      res.redirect(302, `${config.siteOrigin}/account?error=oauth`)
    }
  })
}
