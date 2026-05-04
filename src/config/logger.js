const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const REDACT_KEYS = ['email', 'phone', 'note'];

function redactLead(value) {
  if (!value || typeof value !== 'object') return value;
  const out = { ...value };
  for (const k of REDACT_KEYS) {
    if (k in out) out[k] = '[redacted]';
  }
  return out;
}

const logger = pino({
  level: isDev ? 'debug' : 'info',
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
    : undefined,
  serializers: {
    lead: redactLead,
    err: pino.stdSerializers.err,
  },
  base: undefined,
});

module.exports = logger;
