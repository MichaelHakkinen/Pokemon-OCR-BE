import { randomUUID } from 'crypto';
import { IncomingMessage } from 'http';
import { Params } from 'nestjs-pino';

// HTTP access log, separate from the DB-persisted business audit trail
// (LogActions/Log table). Every request gets a correlation id — reused from
// the incoming x-request-id header when present — so a single request can be
// traced across log lines even though it isn't tied to a specific admin/module.
export const buildLoggerConfig = (appEnv: string): Params => ({
  pinoHttp: {
    genReqId: (req: IncomingMessage) =>
      (req.headers['x-request-id'] as string) || randomUUID(),
    autoLogging: {
      ignore: (req: IncomingMessage) => req.url === '/healthz',
    },
    redact: {
      paths: ['req.headers.authorization', 'req.body.password'],
      censor: '[REDACTED]',
    },
    // Human-readable logs everywhere except production (plain JSON there).
    transport:
      appEnv !== 'production'
        ? { target: 'pino-pretty', options: { singleLine: true } }
        : undefined,
  },
});
