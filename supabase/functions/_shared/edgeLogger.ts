type EdgeLogLevel = 'info' | 'warn' | 'error';

const SENSITIVE_KEY_PATTERN = /authorization|token|secret|password|cookie|apikey|api[_-]?key|signature|email|error|message|body|payload|content|ip|user[_-]?agent|recipient|device|push/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/u;

function redactString(value: string) {
  return value.replace(EMAIL_PATTERN, '[redacted-email]');
}

function sanitizeDetails(value: unknown, depth = 0): unknown {
  if (value == null) {
    return undefined;
  }

  if (value instanceof Error) {
    return {
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
  const requestedId = request.headers.get('x-request-id')?.trim() ?? '';

  return {
    method: request.method,
    // Raw IP and user-agent values are intentionally excluded from logs.
    origin: normalizeOrigin(request.headers.get('Origin')),
    requestId: SAFE_REQUEST_ID_PATTERN.test(requestedId) ? requestedId : crypto.randomUUID(),
    route,
  };
}

function normalizeOrigin(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const origin = new URL(value).origin;
    return origin.length <= 255 ? origin : null;
  } catch {
    return null;
  }
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
