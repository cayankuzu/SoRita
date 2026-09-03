import { z } from 'zod';

export const PROXY_PATHS = [
  '/v1/auth-gateway',
  '/v1/maps-geocoding',
  '/v1/moderation-reports',
  '/v1/media-assets',
  '/v1/delete-user',
] as const;

export type ProxyPath = (typeof PROXY_PATHS)[number];

export type RouteDefinition = {
  functionName:
    | 'auth-gateway'
    | 'delete-user'
    | 'maps-geocoding'
    | 'media-assets'
    | 'moderation-reports';
  limiter: 'api' | 'auth';
  maxBodyBytes: number;
  path: ProxyPath;
};

export const ROUTE_DEFINITIONS: Readonly<Record<ProxyPath, RouteDefinition>> = {
  '/v1/auth-gateway': {
    functionName: 'auth-gateway',
    limiter: 'auth',
    maxBodyBytes: 32 * 1024,
    path: '/v1/auth-gateway',
  },
  '/v1/maps-geocoding': {
    functionName: 'maps-geocoding',
    limiter: 'api',
    maxBodyBytes: 4 * 1024,
    path: '/v1/maps-geocoding',
  },
  '/v1/moderation-reports': {
    functionName: 'moderation-reports',
    limiter: 'api',
    maxBodyBytes: 8 * 1024,
    path: '/v1/moderation-reports',
  },
  '/v1/media-assets': {
    functionName: 'media-assets',
    limiter: 'api',
    maxBodyBytes: 64 * 1024,
    path: '/v1/media-assets',
  },
  '/v1/delete-user': {
    functionName: 'delete-user',
    limiter: 'api',
    maxBodyBytes: 1024,
    path: '/v1/delete-user',
  },
};

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const MAX_MEDIA_FILE_BYTES = 140_313_800;
const MAX_PROFILE_MEDIA_BYTES = 5 * 1024 * 1024;
const MAX_MEDIA_DURATION_SECONDS = 183;
const MAX_MEDIA_PATHS = 64;
const mediaExtensionValues = [
  '3gp',
  'heic',
  'jpg',
  'jpeg',
  'm4v',
  'mov',
  'mp4',
  'png',
  'webm',
  'webp',
] as const;
const mediaExtensionSet = new Set<string>(mediaExtensionValues);

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/);
const displayNameSchema = z.string().trim().min(2).max(60);
const redirectUrlSchema = z.string().trim().url().max(400);
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH)
  .refine(
    (value) =>
      /[a-z]/.test(value) &&
      /[A-Z]/.test(value) &&
      /\d/.test(value) &&
      /[^a-zA-Z0-9]/.test(value),
  );

const authGatewayPayloadSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('check-availability'),
      email: emailSchema.optional(),
      excludeUserId: z.string().uuid().optional(),
      username: usernameSchema.optional(),
    })
    .strict()
    .refine((value) => Boolean(value.email || value.username)),
  z
    .object({
      action: z.literal('login'),
      email: emailSchema,
      password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    })
    .strict(),
  z
    .object({
      action: z.literal('register'),
      bio: z.string().trim().max(150).optional(),
      coverPhoto: z.string().trim().url().max(500).optional(),
      email: emailSchema,
      interests: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
      legalConsent: z
        .object({
          acceptedAt: z.string().datetime(),
          documentsAccepted: z.array(z.string().trim().min(1).max(32)).min(1).max(10),
          version: z.string().trim().min(1).max(32),
        })
        .strict(),
      name: displayNameSchema,
      password: passwordSchema,
      profilePhoto: z.string().trim().url().max(500).optional(),
      redirectUrl: redirectUrlSchema,
      username: usernameSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('resend-confirmation'),
      email: emailSchema,
      redirectUrl: redirectUrlSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('request-password-reset'),
      email: emailSchema,
      redirectUrl: redirectUrlSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('prepare-password-reset'),
      email: emailSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('request-password-reset-authenticated'),
      currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
      redirectUrl: redirectUrlSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('prepare-password-reset-authenticated'),
      currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    })
    .strict(),
]);

const geocodingPayloadSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('search'),
      query: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      action: z.literal('reverse'),
      latitude: z.number().gte(-90).lte(90),
      longitude: z.number().gte(-180).lte(180),
    })
    .strict(),
]);

const reportIdSchema = z.string().trim().min(1).max(120);
const reportReasonSchema = z.string().trim().min(1).max(160);
const reportDetailsSchema = z.string().trim().max(2000).optional();
const moderationReportPayloadSchema = z.discriminatedUnion('targetType', [
  z
    .object({
      details: reportDetailsSchema,
      reason: reportReasonSchema,
      reporterUserId: reportIdSchema,
      targetType: z.literal('user'),
      targetUserId: reportIdSchema,
    })
    .strict(),
  z
    .object({
      details: reportDetailsSchema,
      listId: reportIdSchema,
      reason: reportReasonSchema,
      reporterUserId: reportIdSchema,
      targetType: z.literal('list'),
    })
    .strict(),
  z
    .object({
      details: reportDetailsSchema,
      placeId: reportIdSchema,
      reason: reportReasonSchema,
      reporterUserId: reportIdSchema,
      targetType: z.literal('place'),
    })
    .strict(),
  z
    .object({
      commentId: reportIdSchema,
      details: reportDetailsSchema,
      reason: reportReasonSchema,
      reporterUserId: reportIdSchema,
      targetType: z.literal('comment'),
    })
    .strict(),
]);

const mediaContentTypes = [
  'image/heic',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/3gpp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
] as const;
const mediaBucketSchema = z.enum(['profile-media', 'place-media', 'place-media-private']);
const privateMediaBucketSchema = z.literal('place-media-private');
const mediaPathSchema = z.string().trim().min(1).max(512);
const mediaPrefixSchema = z
  .string()
  .trim()
  .refine((value) => {
    const normalized = value.replace(/^\/+|\/+$/g, '');
    return /^[a-zA-Z0-9/_-]{1,160}$/.test(normalized) && !normalized.includes('..');
  });
const mediaExtensionSchema = z
  .string()
  .trim()
  .max(8)
  .refine((value) => mediaExtensionSet.has(value.toLowerCase()));
const mediaControlPayloadSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('create-upload-url'),
      bucket: mediaBucketSchema,
      contentType: z.enum(mediaContentTypes),
      extension: mediaExtensionSchema.optional(),
      fileSizeBytes: z.number().int().positive().max(MAX_MEDIA_FILE_BYTES),
      prefix: mediaPrefixSchema,
      uploadSessionId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal('create-read-url'),
      bucket: privateMediaBucketSchema,
      path: mediaPathSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal('create-read-urls'),
      bucket: privateMediaBucketSchema,
      paths: z.array(mediaPathSchema).min(1).max(MAX_MEDIA_PATHS),
    })
    .strict(),
  z
    .object({
      action: z.literal('complete-upload'),
      bucket: mediaBucketSchema,
      contentType: z.enum(mediaContentTypes),
      durationSeconds: z.number().nonnegative().max(MAX_MEDIA_DURATION_SECONDS).optional(),
      fileSizeBytes: z.number().int().positive().max(MAX_MEDIA_FILE_BYTES),
      height: z.number().int().positive().max(8192).optional(),
      mediaType: z.enum(['photo', 'video']),
      objectPath: mediaPathSchema,
      uploadSessionId: z.string().uuid(),
      width: z.number().int().positive().max(8192).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal('delete'),
      bucket: mediaBucketSchema,
      paths: z.array(mediaPathSchema).max(MAX_MEDIA_PATHS),
      uploadSessionId: z.string().uuid().optional(),
    })
    .strict(),
]).superRefine((payload, context) => {
  if (payload.action === 'create-upload-url' || payload.action === 'complete-upload') {
    const maximumBytes = payload.bucket === 'profile-media'
      ? MAX_PROFILE_MEDIA_BYTES
      : MAX_MEDIA_FILE_BYTES;

    if (payload.fileSizeBytes > maximumBytes) {
      context.addIssue({
        code: 'custom',
        message: 'File size exceeds the bucket limit.',
        path: ['fileSizeBytes'],
      });
    }

    if (payload.bucket !== 'place-media-private' && !payload.contentType.startsWith('image/')) {
      context.addIssue({
        code: 'custom',
        message: 'Public media uploads must be images.',
        path: ['contentType'],
      });
    }
  }

  if (payload.action !== 'complete-upload') {
    return;
  }

  const expectsVideo = payload.mediaType === 'video';

  if (payload.bucket !== 'place-media-private' && payload.mediaType !== 'photo') {
    context.addIssue({
      code: 'custom',
      message: 'Public media uploads must be photos.',
      path: ['mediaType'],
    });
  }

  if (expectsVideo !== payload.contentType.startsWith('video/')) {
    context.addIssue({
      code: 'custom',
      message: 'Media type does not match content type.',
      path: ['mediaType'],
    });
  }

  if (expectsVideo && payload.durationSeconds === undefined) {
    context.addIssue({
      code: 'custom',
      message: 'Video duration is required.',
      path: ['durationSeconds'],
    });
  }

  if ((payload.width === undefined) !== (payload.height === undefined)) {
    context.addIssue({
      code: 'custom',
      message: 'Media dimensions must be provided together.',
      path: ['width'],
    });
  }
});

const deleteUserPayloadSchema = z.object({}).strict();
const publicAuthActions = [
  'check-availability',
  'login',
  'prepare-password-reset',
  'register',
  'request-password-reset',
  'resend-confirmation',
] as const;

type ContractSuccess = {
  action: string;
  authRequired: boolean;
  expectedUserId?: string;
  success: true;
};

type ContractFailure = {
  code: 'invalid_request' | 'media_body_proxy_forbidden';
  success: false;
};

export type ContractResult = ContractFailure | ContractSuccess;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function findRoute(pathname: string): RouteDefinition | undefined {
  const matchedPath = PROXY_PATHS.find((candidate) => candidate === pathname);
  return matchedPath ? ROUTE_DEFINITIONS[matchedPath] : undefined;
}

export function validatePayload(route: RouteDefinition, payload: unknown): ContractResult {
  if (route.path === '/v1/auth-gateway') {
    const result = authGatewayPayloadSchema.safeParse(payload);

    if (!result.success) {
      return { code: 'invalid_request', success: false };
    }

    const authRequired =
      !publicAuthActions.some((publicAction) => publicAction === result.data.action) ||
      (result.data.action === 'check-availability' && Boolean(result.data.excludeUserId));

    return {
      action: result.data.action,
      authRequired,
      expectedUserId:
        result.data.action === 'check-availability' ? result.data.excludeUserId : undefined,
      success: true,
    };
  }

  if (route.path === '/v1/maps-geocoding') {
    const result = geocodingPayloadSchema.safeParse(payload);
    return result.success
      ? { action: result.data.action, authRequired: true, success: true }
      : { code: 'invalid_request', success: false };
  }

  if (route.path === '/v1/moderation-reports') {
    const result = moderationReportPayloadSchema.safeParse(payload);
    return result.success
      ? {
          action: result.data.targetType,
          authRequired: true,
          expectedUserId: result.data.reporterUserId,
          success: true,
        }
      : { code: 'invalid_request', success: false };
  }

  if (route.path === '/v1/media-assets') {
    if (
      isRecord(payload) &&
      (payload.action === 'upload' || Object.hasOwn(payload, 'fileBase64'))
    ) {
      return { code: 'media_body_proxy_forbidden', success: false };
    }

    const result = mediaControlPayloadSchema.safeParse(payload);
    if (!result.success) {
      return { code: 'invalid_request', success: false };
    }

    return { action: result.data.action, authRequired: true, success: true };
  }

  const result = deleteUserPayloadSchema.safeParse(payload);
  return result.success
    ? { action: 'delete-user', authRequired: true, success: true }
    : { code: 'invalid_request', success: false };
}
