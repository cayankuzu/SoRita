type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatMeta(meta?: unknown) {
  if (meta == null) {
    return '';
  }

  if (meta instanceof Error) {
    return ` ${meta.name}: ${meta.message}`;
  }

  if (typeof meta === 'string') {
    return ` ${meta}`;
  }

  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return ' [unserializable-meta]';
  }
}

function write(level: LogLevel, scope: string, message: string, meta?: unknown) {
  const line = `[SoRita][${scope}][${level.toUpperCase()}] ${message}${formatMeta(meta)}`;

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
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

