import { captureAppMessage } from '@/mobile/app/platform/observability/sentry';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDevMode = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const sensitiveKeyPattern = /access[_-]?token|refresh[_-]?token|authorization|apikey|api[_-]?key|password|secret|cookie|session|email/i;

function redactString(value: string) {
  return value.replace(emailPattern, '[redacted-email]');
}

function sanitizeMeta(meta: unknown, depth = 0): unknown {
  if (meta == null) {
    return undefined;
  }

  if (meta instanceof Error) {
    return {
      name: meta.name,
      message: redactString(meta.message),
    };
  }

  if (typeof meta === 'string') {
    return redactString(meta);
  }

  if (typeof meta !== 'object') {
    return meta;
  }

  if (depth >= 3) {
    return '[truncated-meta]';
  }

  if (Array.isArray(meta)) {
    return meta.map((item) => sanitizeMeta(item, depth + 1));
  }

  const sanitizedEntries = Object.entries(meta).map(([key, value]) => [
    key,
    sensitiveKeyPattern.test(key) ? '[redacted]' : sanitizeMeta(value, depth + 1),
  ]);

  return Object.fromEntries(sanitizedEntries);
}

function formatMeta(meta?: unknown) {
  const sanitizedMeta = sanitizeMeta(meta);

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
  const sanitizedMeta = sanitizeMeta(meta);
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

  if (level === 'warn') {
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
