import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // JSON to stdout. No pretty transport in prod; pipe through `pino-pretty` in dev if desired.
})
