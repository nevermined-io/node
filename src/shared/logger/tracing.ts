//OpenTelemetry
import * as opentelemetry from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

let otelSDK: opentelemetry.NodeSDK

if (process.env.TELEMETRY_URI) {
  console.log(`Starting with telemetry: ${process.env.TELEMETRY_URI}`)

  const exporterOptions = {
    url: process.env.TELEMETRY_URI,
  }
  const traceExporter = new OTLPTraceExporter(exporterOptions)
  otelSDK = new opentelemetry.NodeSDK({
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: process.env.TELEMETRY_SERVICE_NAME || 'node',
    }),
  })
} else {
  console.log(
    'Starting without telemetry: `TELEMETRY_URI` and `TELEMETRY_SERVICE_NAME` envs are not set',
  )
}

export default otelSDK

// Shutting down gracefully
process.on('SIGTERM', () => {
  otelSDK
    .shutdown()
    .then(
      () => console.log('otelSDK shut down successfully'),
      (err) => console.log('Error shutting down otelSDK', err),
    )
    .finally(() => process.exit(0))
})
