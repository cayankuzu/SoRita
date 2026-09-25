import { redactValue } from '@/mobile/app/platform/observability/redaction';
import { captureAppMessage } from '@/mobile/app/platform/observability/sentry';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDevMode = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
function formatMeta(meta?: unknown) {
  const sanitizedMeta = redactValue(meta);

  if (sanitizedMeta == null) {
    return '';
  }

  if (typeof sanitizedMeta === 'string') {
    return ` ${sanitizedMeta}`;
  }

  try {
    return ` ${JSON.stringify(sanitizedMeta)}`;
  } catch {
    return ' [unserializable-meta]';
  }
}

function write(level: LogLevel, scope: string, message: string, meta?: unknown) {
  const sanitizedMeta = redactValue(meta);
  const line = `[SoRita][${scope}][${level.toUpperCase()}] ${message}${formatMeta(meta)}`;

  if (isDevMode) {
    if (level === 'error') {
      console.error(line);
      return;
    }

    if (level === 'warn') {
      console.warn(line);
      return;
    }

    console.log(line);
    return;
  }

  // Release builds used to send warnings and errors to Sentry alone, so a
  // device under a cable told us nothing and a whole class of bug could only
  // be guessed at. `line` is already redacted, and Android keeps an app's log
  // to itself, so mirroring it to the console costs nothing and makes a
  // release build diagnosable from logcat or the Xcode console.
  if (level === 'warn') {
    console.warn(line);
    captureAppMessage(`[${scope}] ${message}`, {
      extras: sanitizedMeta && typeof sanitizedMeta === 'object'
        ? (sanitizedMeta as Record<string, unknown>)
        : sanitizedMeta
          ? { meta: sanitizedMeta }
          : undefined,
      level: 'warning',
    });
    return;
  }

  if (level === 'error') {
    console.error(line);
    captureAppMessage(`[${scope}] ${message}`, {
      extras: sanitizedMeta && typeof sanitizedMeta === 'object'
        ? (sanitizedMeta as Record<string, unknown>)
        : sanitizedMeta
          ? { meta: sanitizedMeta }
          : undefined,
      level: 'error',
    });
  }
}

export const logger = {
  debug(scope: string, message: string, meta?: unknown) {
    write('debug', scope, message, meta);
  },
  info(scope: string, message: string, meta?: unknown) {
    write('info', scope, message, meta);
  },
  warn(scope: string, message: string, meta?: unknown) {
    write('warn', scope, message, meta);
  },
  error(scope: string, message: string, meta?: unknown) {
    write('error', scope, message, meta);
  },
};
