import { LexRouter } from '@atproto/lex-server'
import { upgradeWebSocket } from '@atproto/lex-server/nodejs'
import type { DB } from './db/index.ts'
import { checkHealth } from './health.ts'
import { logger } from './logger.ts'
import * as internal from './lexicons/internal.ts'

export function buildRouter(db: DB): LexRouter {
  const router = new LexRouter({
    upgradeWebSocket,
    onHandlerError: ({ error, method }) => {
      logger.error({ err: error, method: method.nsid }, 'handler error')
    },
  })

  router.add(internal.bps.health.main, async () => {
    const body = await checkHealth(db)
    return { body }
  })

  return router
}
