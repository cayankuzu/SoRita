import type { Breadcrumb, ErrorEvent } from '@sentry/react-native';

// What must never leave the device in a log line or a crash report: e-mail
// addresses, session tokens (JWTs), and secrets carried in URL query strings
// such as the token on a signed storage URL.

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const SECRET_QUERY_PATTERN =
  /([?&](?:token|access_token|refresh_token|apikey|api_key|signature|x-amz-signature|code)=)[^&#\s]+/gi;

export const SENSITIVE_KEY_PATTERN =
  /access[_-]?token|refresh[_-]?token|authorization|apikey|api[_-]?key|password|secret|cookie|session|email/i;

const MAX_DEPTH = 3;

export function redactString(value: string) {
  return value
    .replace(EMAIL_PATTERN, '[redacted-email]')
    .replace(JWT_PATTERN, '[redacted-token]')
    .replace(SECRET_QUERY_PATTERN, '$1[redacted]');
}

// Copies a value for logging with strings redacted and sensitive keys blanked.
export function redactValue(value: unknown, depth = 0): unknown {
  if (value == null) {
    return undefined;
  }

  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (depth >= MAX_DEPTH) {
    return '[truncated-meta]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : redactValue(item, depth + 1),
    ]),
  );
}

// Breadcrumbs carry request URLs, whose query can hold a signed-URL token,
// and log lines; both pass the same redaction as the app's own logger.
export function redactBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    message: breadcrumb.message ? redactString(breadcrumb.message) : breadcrumb.message,
    data: breadcrumb.data ? (redactValue(breadcrumb.data) as Breadcrumb['data']) : breadcrumb.data,
  };
}

// An error's message can quote an address, a token or a signed URL; so can
// the extras a caller attaches.
export function redactEvent<TEvent extends ErrorEvent>(event: TEvent): TEvent {
  return {
    ...event,
    message: event.message ? redactString(event.message) : event.message,
    exception: event.exception
      ? {
          ...event.exception,
          values: event.exception.values?.map((value) => ({
            ...value,
            value: value.value ? redactString(value.value) : value.value,
          })),
        }
      : event.exception,
    extra: event.extra ? (redactValue(event.extra) as TEvent['extra']) : event.extra,
    request: event.request?.url
      ? { ...event.request, url: redactString(event.request.url) }
      : event.request,
    breadcrumbs: event.breadcrumbs?.map(redactBreadcrumb),
  };
}
