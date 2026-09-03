import { z } from 'zod';

const edgeCutoverModes = ['direct', 'gateway'] as const;
const releaseEnvironments = ['development', 'preview', 'production'] as const;
const edgeApiUrlRequiredIssue =
  'Edge API URL is required when gateway cutover mode is enabled.';

const trimmedString = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z.string(),
);

function normalizeOptionalEnumValue(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toLowerCase() || undefined;
}

const optionalHttpsBaseUrl = trimmedString
  .refine((value) => {
    if (!value) {
      return true;
    }

    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        url.pathname === '/' &&
        !url.search &&
        !url.hash
      );
    } catch {
      return false;
    }
  }, 'Edge API URL must be an HTTPS origin without credentials, path, query, or fragment.')
  .transform((value) => (value ? new URL(value).origin : value));

export const publicRuntimeConfigSchema = z
  .object({
    edgeApiUrl: optionalHttpsBaseUrl.default(''),
    edgeCutoverMode: z.preprocess(
      normalizeOptionalEnumValue,
      z.enum(edgeCutoverModes).default('direct'),
    ),
    releaseEnvironment: z.preprocess(
      normalizeOptionalEnumValue,
      z.enum(releaseEnvironments).default('development'),
    ),
  })
  .superRefine((value, context) => {
    if (value.edgeCutoverMode === 'gateway' && !value.edgeApiUrl) {
      context.addIssue({
        code: 'custom',
        message: edgeApiUrlRequiredIssue,
        path: ['edgeApiUrl'],
      });
    }
  });

export function getPublicRuntimeConfigIssueEnvNames(error: z.ZodError) {
  const names = new Set<string>();

  error.issues.forEach((issue) => {
    switch (issue.path[0]) {
      case 'edgeApiUrl':
        names.add('EXPO_PUBLIC_EDGE_API_URL');
        break;
      case 'edgeCutoverMode':
        names.add('EXPO_PUBLIC_EDGE_CUTOVER_MODE');
        break;
      case 'releaseEnvironment':
        names.add('EXPO_PUBLIC_RELEASE_ENVIRONMENT');
        break;
      default:
        names.add('EXPO_PUBLIC_RUNTIME_CONFIG');
    }
  });

  return [...names];
}
