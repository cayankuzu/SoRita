type EdgeLogLevel = 'info' | 'warn' | 'error';

const SENSITIVE_KEY_PATTERN = /authorization|token|secret|password|cookie|apikey|api[_-]?key|signature|email/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

function redactString(value: string) {
  return value.replace(EMAIL_PATTERN, '[redacted-email]');
}

function sanitizeDetails(value: unknown, depth = 0): unknown {
  if (value == null) {
    return undefined;
  }

  if (value instanceof Error) {
    return {
      message: redactString(value.message),
      name: value.name,
    };
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (depth >= 3) {
    return '[truncated]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDetails(item, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeDetails(nestedValue, depth + 1),
    ]),
  );
}

export function createEdgeRequestContext(request: Request, route: string) {
  const forwardedFor = request.headers.get('x-forwarded-for') ?? '';
  const clientIp = forwardedFor.split(',')[0]?.trim() || null;

  return {
    clientIp,
    method: request.method,
    origin: request.headers.get('Origin'),
    requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
    route,
    userAgent: request.headers.get('user-agent'),
  };
}

export function logEdgeEvent(
  level: EdgeLogLevel,
  message: string,
  context: ReturnType<typeof createEdgeRequestContext>,
  details?: unknown,
) {
  const payload = {
    context,
    details: sanitizeDetails(details),
    level,
    message,
    timestamp: new Date().toISOString(),
  };
  const line = JSON.stringify(payload);

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
