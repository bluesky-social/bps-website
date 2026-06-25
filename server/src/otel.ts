import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { logger } from './logger.ts'

// OTel reads OTEL_* env vars (OTEL_SERVICE_NAME, OTEL_EXPORTER_OTLP_ENDPOINT,
// OTEL_SDK_DISABLED, ...) by convention. We do not rename these to BPS_*.
export async function startOtel(): Promise<{ shutdown: () => Promise<void> }> {
  if (process.env.OTEL_SDK_DISABLED === 'true') {
    logger.info('OTel disabled via OTEL_SDK_DISABLED')
    return { shutdown: async () => {} }
  }

  const sdk = new NodeSDK({
    instrumentations: [getNodeAutoInstrumentations()],
  })
  sdk.start()
  logger.info('OTel started')

  return {
    shutdown: async () => {
      await sdk.shutdown()
    },
  }
}
