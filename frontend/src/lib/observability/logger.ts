import pino, { type Logger, type DestinationStream } from 'pino';

export interface LoggerOptions {
  /** Custom write sink for testing; defaults to process.stdout. */
  write?: (line: string) => void;
}

const PII_PATHS = [
  'email',
  '*.email',
  'password',
  '*.password',
  'token',
  '*.token',
  'secret',
  '*.secret',
  'api_key',
  '*.api_key',
  'authorization',
  '*.authorization',
];

function getNodeStdout(): DestinationStream | undefined {
  const g = globalThis as typeof globalThis & {
    process?: { stdout?: DestinationStream };
  };
  return g.process?.stdout;
}

const noopDestination = { write: () => {} } as unknown as DestinationStream;

export function createLogger(options: LoggerOptions = {}): Logger {
  const destination: DestinationStream = options.write
    ? ({ write: options.write } as unknown as DestinationStream)
    : (getNodeStdout() ?? noopDestination);

  return pino(
    {
      name: 'pymepilot',
      messageKey: 'message',
      level: process.env.LOG_LEVEL ?? 'info',
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      formatters: {
        log: (object: Record<string, unknown>) => {
          const { context, ...rest } = object;
          const flattened =
            context && typeof context === 'object' ? { ...rest, ...(context as Record<string, unknown>) } : rest;
          return {
            logger: 'pymepilot',
            ...flattened,
          };
        },
      },
      redact: {
        paths: PII_PATHS,
        censor: '***REDACTED***',
        remove: false,
      },
    },
    destination
  );
}

export function getLogger(): Logger {
  return createLogger();
}
