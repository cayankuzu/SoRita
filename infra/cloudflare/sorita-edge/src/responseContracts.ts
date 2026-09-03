import { z } from 'zod';

import type { RouteDefinition } from './contracts';

export const ORIGIN_ERROR_RESPONSE_MAX_BYTES = 8 * 1024;

export type OriginSuccessResponseContract = {
  maximumBytes: number;
  schema: z.ZodType;
};

export const originErrorResponseSchema = z
  .object({
    code: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
    error: z.string().min(1).max(2_048),
  });

const successResponseSchema = z.object({ success: z.literal(true) });
const authAvailabilityResponseSchema = z.object({
  emailAvailable: z.boolean(),
  usernameAvailable: z.boolean(),
});
const authLoginResponseSchema = z.object({
  session: z.object({
    accessToken: z.string().min(1).max(16 * 1024).regex(/^[\x21-\x7e]+$/),
    refreshToken: z.string().min(1).max(16 * 1024).regex(/^[\x21-\x7e]+$/),
  }),
});
const mapSearchResultSchema = z.object({
  address: z.string().max(1_024),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  name: z.string().min(1).max(256),
  placeId: z.string().min(1).max(512),
});
const mapSearchResponseSchema = z.object({
  results: z.array(mapSearchResultSchema).max(20),
});
const mapReverseResponseSchema = z.object({
  result: z.object({
    address: z.string().min(1).max(1_024).optional(),
    isPointOfInterest: z.boolean(),
    lat: z.number().gte(-90).lte(90),
    lng: z.number().gte(-180).lte(180),
    name: z.string().min(1).max(256).optional(),
  }),
});
const moderationResponseSchema = z.object({
  deliveryStatus: z.enum(['failed', 'sent']),
  reportId: z.string().min(1).max(120),
  success: z.literal(true),
});
const storagePathSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9/_.,-]{1,512}$/)
  .refine((value) => !value.includes('..'));

function safeSupabaseStorageUrlSchema(
  supabaseOrigin: string,
  allowedPathPrefixes: readonly string[],
): z.ZodType<string> {
  return z.string().min(1).max(8 * 1024).regex(/^[\x21-\x7e]+$/).refine((value) => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:'
        && !url.username
        && !url.password
        && !url.hash
        && url.origin === supabaseOrigin
        && allowedPathPrefixes.some((prefix) => url.pathname.startsWith(prefix))
      );
    } catch {
      return false;
    }
  });
}

function createMediaResponseSchemas(supabaseOrigin: string) {
  const uploadUrlSchema = safeSupabaseStorageUrlSchema(
    supabaseOrigin,
    ['/storage/v1/object/upload/sign/place-media-private/'],
  );
  const privateReadUrlSchema = safeSupabaseStorageUrlSchema(
    supabaseOrigin,
    ['/storage/v1/object/sign/place-media-private/'],
  );
  const publicUrlSchema = safeSupabaseStorageUrlSchema(
    supabaseOrigin,
    [
      '/storage/v1/object/public/place-media/',
      '/storage/v1/object/public/profile-media/',
    ],
  );

  return {
    completeUpload: z
      .object({
        objectPath: storagePathSchema,
        publicUrl: publicUrlSchema.optional(),
        storageUri: z
          .string()
          .regex(/^sorita-storage:\/\/place-media-private\/[a-zA-Z0-9%/_.,-]{1,768}$/)
          .optional(),
        uploadSessionId: z.string().uuid(),
        verified: z.literal(true),
      })
      .refine((value) => Boolean(value.publicUrl) !== Boolean(value.storageUri)),
    createReadUrl: z.object({
      expiresInSeconds: z.number().int().positive().max(3_600),
      signedUrl: privateReadUrlSchema,
    }),
    createReadUrls: z.object({
      expiresInSeconds: z.number().int().positive().max(3_600),
      items: z
        .array(
          z.object({
            path: storagePathSchema,
            signedUrl: privateReadUrlSchema,
          }),
        )
        .max(64),
    }),
    createUploadUrl: z.object({
      objectPath: storagePathSchema,
      signedUrl: uploadUrlSchema,
      uploadSessionId: z.string().uuid(),
    }),
  } as const;
}

export function getOriginSuccessResponseContract(params: {
  action: string;
  route: RouteDefinition;
  supabaseOrigin: string;
}): OriginSuccessResponseContract | undefined {
  if (params.route.path === '/v1/auth-gateway') {
    if (params.action === 'check-availability') {
      return { maximumBytes: 4 * 1024, schema: authAvailabilityResponseSchema };
    }

    if (params.action === 'login') {
      return { maximumBytes: 48 * 1024, schema: authLoginResponseSchema };
    }

    return { maximumBytes: 4 * 1024, schema: successResponseSchema };
  }

  if (params.route.path === '/v1/maps-geocoding') {
    if (params.action === 'search') {
      return { maximumBytes: 128 * 1024, schema: mapSearchResponseSchema };
    }

    if (params.action === 'reverse') {
      return { maximumBytes: 8 * 1024, schema: mapReverseResponseSchema };
    }

    return undefined;
  }

  if (params.route.path === '/v1/moderation-reports') {
    return { maximumBytes: 4 * 1024, schema: moderationResponseSchema };
  }

  if (params.route.path === '/v1/media-assets') {
    const mediaSchemas = createMediaResponseSchemas(params.supabaseOrigin);

    if (params.action === 'create-upload-url') {
      return { maximumBytes: 24 * 1024, schema: mediaSchemas.createUploadUrl };
    }

    if (params.action === 'complete-upload') {
      return { maximumBytes: 24 * 1024, schema: mediaSchemas.completeUpload };
    }

    if (params.action === 'create-read-url') {
      return { maximumBytes: 24 * 1024, schema: mediaSchemas.createReadUrl };
    }

    if (params.action === 'create-read-urls') {
      return { maximumBytes: 640 * 1024, schema: mediaSchemas.createReadUrls };
    }

    if (params.action === 'delete') {
      return { maximumBytes: 4 * 1024, schema: successResponseSchema };
    }

    return undefined;
  }

  if (params.route.path === '/v1/delete-user' && params.action === 'delete-user') {
    return { maximumBytes: 4 * 1024, schema: successResponseSchema };
  }

  return undefined;
}
