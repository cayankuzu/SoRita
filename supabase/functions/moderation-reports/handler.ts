import { z } from 'zod';

import { createEdgeRequestContext, logEdgeEvent } from '../_shared/edgeLogger.ts';
import {
  type AuthClientLike,
  corsPreflightResponse,
  getBearerToken,
  HttpRequestError,
  isHttpRequestError,
  jsonResponse,
  parseJsonBody,
} from '../_shared/httpHelpers.ts';
import { enforceRateLimit, rateLimitHeaders, type RateLimitAdminClientLike } from '../_shared/rateLimit.ts';
import { verifySignedRequest } from '../_shared/requestSecurity.ts';

type ErrorLike = {
  code?: string;
  message: string;
};

type AdminClientLike = RateLimitAdminClientLike & {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data?: Record<string, unknown> | null; error?: ErrorLike | null }>;
      };
    };
    insert: (
      payload: Record<string, unknown>,
    ) => {
      select: (columns: string) => {
        maybeSingle: () => Promise<{ data?: Record<string, unknown> | null; error?: ErrorLike | null }>;
      };
    };
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error?: ErrorLike | null }>;
    };
    delete: () => {
      lt: (column: string, value: string) => Promise<{ error?: ErrorLike | null }>;
    };
  };
};

type EmailResult = {
  error?: string | null;
};

type ModerationReportsHandlerConfig = {
  allowedOrigins: string[];
  brevoApiKey?: string;
  reportEmailFrom?: string;
  reportEmailTo: string;
  resendApiKey?: string;
  supabasePublishableKey: string;
  supabaseServiceRoleKey: string;
  supabaseUrl: string;
};

type ModerationReportsHandlerDeps = {
  config: ModerationReportsHandlerConfig;
  createAdminClient: () => AdminClientLike;
  createAuthClient: (token: string) => AuthClientLike;
  createRequestId?: () => string;
  sendEmail?: (params: {
    from: string;
    subject: string;
    text: string;
    to: string;
  }) => Promise<EmailResult>;
};

const allowedOriginsFallback =
  'http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:3000';

const reportIdSchema = z.string().trim().min(1).max(120);
const reportReasonSchema = z.string().trim().min(1).max(160);
const reportDetailsSchema = z.string().trim().max(2000).optional();

const reportPayloadSchema = z.discriminatedUnion('targetType', [
  z.object({
    details: reportDetailsSchema,
    reason: reportReasonSchema,
    reporterUserId: reportIdSchema,
    targetType: z.literal('user'),
    targetUserId: reportIdSchema,
  }),
  z.object({
    details: reportDetailsSchema,
    listId: reportIdSchema,
    reason: reportReasonSchema,
    reporterUserId: reportIdSchema,
    targetType: z.literal('list'),
  }),
  z.object({
    details: reportDetailsSchema,
    placeId: reportIdSchema,
    reason: reportReasonSchema,
    reporterUserId: reportIdSchema,
    targetType: z.literal('place'),
  }),
  z.object({
    commentId: reportIdSchema,
    details: reportDetailsSchema,
    reason: reportReasonSchema,
    reporterUserId: reportIdSchema,
    targetType: z.literal('comment'),
  }),
]);

type ReportPayload = z.infer<typeof reportPayloadSchema>;

function assertConfigured(config: ModerationReportsHandlerConfig) {
  return Boolean(
    config.supabasePublishableKey.trim() &&
      config.supabaseServiceRoleKey.trim() &&
      config.supabaseUrl.trim(),
  );
}

function getSelectQuery(
  adminClient: AdminClientLike,
  table: string,
  columns: string,
  column: string,
  value: string,
) {
  return adminClient.from(table).select(columns).eq(column, value).maybeSingle();
}

async function getRequiredRow(
  adminClient: AdminClientLike,
  params: {
    column?: string;
    columns: string;
    errorMessage: string;
    table: string;
    value: string;
  },
) {
  const { data, error } = await getSelectQuery(
    adminClient,
    params.table,
    params.columns,
    params.column ?? 'id',
    params.value,
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new HttpRequestError(404, 'report_target_not_found', params.errorMessage);
  }

  return data;
}

async function getOptionalRow(
  adminClient: AdminClientLike,
  params: {
    column?: string;
    columns: string;
    table: string;
    value: string;
  },
) {
  const { data, error } = await getSelectQuery(
    adminClient,
    params.table,
    params.columns,
    params.column ?? 'id',
    params.value,
  );

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}

function buildLegacyReportKey(payload: ReportPayload) {
  switch (payload.targetType) {
    case 'user':
      return `user:${payload.reporterUserId}:${payload.targetUserId}`;
    case 'list':
      return `list:${payload.reporterUserId}:${payload.listId}`;
    case 'place':
      return `place:${payload.reporterUserId}:${payload.placeId}`;
    case 'comment':
      return `comment:${payload.reporterUserId}:${payload.commentId}`;
  }
}

function trimDetails(details?: string) {
  const normalized = details?.trim();
  return normalized ? normalized : null;
}

function buildEmailSubject(payload: ReportPayload) {
  switch (payload.targetType) {
    case 'user':
      return '[SoRita] Yeni kullanici sikayeti';
    case 'list':
      return '[SoRita] Yeni liste sikayeti';
    case 'place':
      return '[SoRita] Yeni mekan karti sikayeti';
    case 'comment':
      return '[SoRita] Yeni yorum sikayeti';
  }
}

function buildEmailBody(payload: {
  details: string | null;
  reportId: string;
  snapshot: Record<string, unknown>;
  targetType: ReportPayload['targetType'];
}) {
  return [
    `SoRita moderation report`,
    `Report ID: ${payload.reportId}`,
    `Target Type: ${payload.targetType}`,
    '',
    'Reporter and target snapshot:',
    JSON.stringify(payload.snapshot, null, 2),
    '',
    'User supplied details:',
    payload.details ?? '(none)',
  ].join('\n');
}

async function sendEmailViaResend(
  config: ModerationReportsHandlerConfig,
  params: {
    from: string;
    subject: string;
    text: string;
    to: string;
  },
): Promise<EmailResult> {
  if (!config.resendApiKey?.trim()) {
    return {
      error: 'RESEND_API_KEY is missing',
    };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: params.from,
      subject: params.subject,
      text: params.text,
      to: [params.to],
    }),
  });

  if (response.ok) {
    return { error: null };
  }

  const bodyText = await response.text().catch(() => '');
  return {
    error: bodyText.trim() || `Resend API returned ${response.status}`,
  };
}

async function sendEmailViaBrevo(
  config: ModerationReportsHandlerConfig,
  params: {
    from: string;
    subject: string;
    text: string;
    to: string;
  },
): Promise<EmailResult> {
  if (!config.brevoApiKey?.trim()) {
    return {
      error: 'BREVO_API_KEY is missing',
    };
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': config.brevoApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        email: params.from,
        name: 'SoRita',
      },
      subject: params.subject,
      textContent: params.text,
      to: [{ email: params.to }],
    }),
  });

  if (response.ok) {
    return { error: null };
  }

  const bodyText = await response.text().catch(() => '');
  return {
    error: bodyText.trim() || `Brevo API returned ${response.status}`,
  };
}

async function buildReportSnapshot(adminClient: AdminClientLike, payload: ReportPayload) {
  const reporter = await getOptionalRow(adminClient, {
    columns: 'id, name, username, email, profile_photo_url, is_public_account',
    table: 'profiles',
    value: payload.reporterUserId,
  });

  if (payload.targetType === 'user') {
    const targetUser = await getRequiredRow(adminClient, {
      columns: 'id, name, username, email, profile_photo_url, is_public_account, bio',
      errorMessage: 'Sikayet edilen kullanici bulunamadi.',
      table: 'profiles',
      value: payload.targetUserId,
    });

    return {
      reporter,
      targetType: payload.targetType,
      targetUser,
    };
  }

  if (payload.targetType === 'list') {
    const list = await getRequiredRow(adminClient, {
      columns: 'id, owner_id, name, description, emoji, cover_image_url, is_public, created_at, updated_at',
      errorMessage: 'Sikayet edilen liste bulunamadi.',
      table: 'lists',
      value: payload.listId,
    });
    const ownerId = typeof list.owner_id === 'string' ? list.owner_id : null;
    const owner = ownerId
      ? await getOptionalRow(adminClient, {
          columns: 'id, name, username, email, profile_photo_url, is_public_account',
          table: 'profiles',
          value: ownerId,
        })
      : null;

    return {
      list,
      owner,
      reporter,
      targetType: payload.targetType,
    };
  }

  if (payload.targetType === 'place') {
    const place = await getRequiredRow(adminClient, {
      columns:
        'id, list_id, created_by, source_list_id, source_place_id, source_user_id, source_user_name, name, title, address, notes, lat, lng, rating, added_at, updated_at',
      errorMessage: 'Sikayet edilen mekan karti bulunamadi.',
      table: 'list_places',
      value: payload.placeId,
    });
    const listId = typeof place.list_id === 'string' ? place.list_id : null;
    const list = listId
      ? await getOptionalRow(adminClient, {
          columns: 'id, owner_id, name, description, emoji, cover_image_url, is_public',
          table: 'lists',
          value: listId,
        })
      : null;
    const ownerId =
      typeof list?.owner_id === 'string'
        ? list.owner_id
        : typeof place.created_by === 'string'
          ? place.created_by
          : null;
    const owner = ownerId
      ? await getOptionalRow(adminClient, {
          columns: 'id, name, username, email, profile_photo_url, is_public_account',
          table: 'profiles',
          value: ownerId,
        })
      : null;

    return {
      list,
      owner,
      place,
      reporter,
      targetType: payload.targetType,
    };
  }

  const comment = await getRequiredRow(adminClient, {
    columns: 'id, list_place_id, user_id, parent_comment_id, content, created_at, updated_at',
    errorMessage: 'Sikayet edilen yorum bulunamadi.',
    table: 'list_place_comments',
    value: payload.commentId,
  });
  const placeId = typeof comment.list_place_id === 'string' ? comment.list_place_id : null;
  const place = placeId
    ? await getOptionalRow(adminClient, {
        columns:
          'id, list_id, created_by, source_user_id, source_user_name, name, title, address, notes, lat, lng, rating, added_at, updated_at',
        table: 'list_places',
        value: placeId,
      })
    : null;
  const listId = typeof place?.list_id === 'string' ? place.list_id : null;
  const list = listId
    ? await getOptionalRow(adminClient, {
        columns: 'id, owner_id, name, description, emoji, cover_image_url, is_public',
        table: 'lists',
        value: listId,
      })
    : null;
  const commentAuthorId = typeof comment.user_id === 'string' ? comment.user_id : null;
  const commentAuthor = commentAuthorId
    ? await getOptionalRow(adminClient, {
        columns: 'id, name, username, email, profile_photo_url, is_public_account',
        table: 'profiles',
        value: commentAuthorId,
      })
    : null;

  return {
    comment,
    commentAuthor,
    list,
    place,
    reporter,
    targetType: payload.targetType,
  };
}

export function createModerationReportsHandler({
  config,
  createAdminClient,
  createAuthClient,
  createRequestId = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `moderation-report-${Date.now()}`,
  sendEmail,
}: ModerationReportsHandlerDeps) {
  const normalizedAllowedOrigins = (config.allowedOrigins.length
    ? config.allowedOrigins
    : allowedOriginsFallback.split(','))
    .map((origin) => origin.trim())
    .filter(Boolean);

  const sendReportEmail = sendEmail
    ? sendEmail
    : (params: { from: string; subject: string; text: string; to: string }) =>
        config.brevoApiKey?.trim()
          ? sendEmailViaBrevo(config, params)
          : sendEmailViaResend(config, params);

  return async (request: Request) => {
    const requestContext = createEdgeRequestContext(request, 'moderation-reports');
    const requestId = requestContext.requestId || createRequestId();

    if (request.method === 'OPTIONS') {
      return corsPreflightResponse(request, normalizedAllowedOrigins, requestId);
    }

    if (request.method !== 'POST') {
      return jsonResponse(
        request,
        normalizedAllowedOrigins,
        405,
        { code: 'method_not_allowed', error: 'Method not allowed' },
        { requestId },
      );
    }

    if (!assertConfigured(config)) {
      return jsonResponse(
        request,
        normalizedAllowedOrigins,
        500,
        { code: 'misconfigured', error: 'Sikayet servisi su anda kullanilamiyor.' },
        { requestId },
      );
    }

    try {
      const token = getBearerToken(request.headers.get('Authorization'));

      if (!token) {
        return jsonResponse(
          request,
          normalizedAllowedOrigins,
          401,
          { code: 'missing_authorization', error: 'Missing authorization header' },
          { requestId },
        );
      }

      const adminClient = createAdminClient();
      const authClient = createAuthClient(token);
      const claimsResult = await authClient.auth.getClaims(token);
      const authenticatedUserId = claimsResult.data?.claims?.sub?.trim();

      if (claimsResult.error || !authenticatedUserId) {
        return jsonResponse(
          request,
          normalizedAllowedOrigins,
          401,
          { code: 'invalid_token', error: claimsResult.error?.message ?? 'Invalid token' },
          { requestId },
        );
      }

      const securityResult = await verifySignedRequest({
        adminClient,
        functionName: 'moderation-reports',
        request,
        token,
        userId: authenticatedUserId,
      });

      if (!securityResult.ok) {
        return jsonResponse(
          request,
          normalizedAllowedOrigins,
          securityResult.status,
          { code: 'invalid_signature', error: securityResult.error },
          { requestId },
        );
      }

      const parsedPayload = reportPayloadSchema.safeParse(parseJsonBody(securityResult.bodyText ?? ''));

      if (!parsedPayload.success) {
        return jsonResponse(
          request,
          normalizedAllowedOrigins,
          400,
          {
            code: 'invalid_input',
            error: parsedPayload.error.issues[0]?.message ?? 'Invalid report payload',
          },
          { requestId },
        );
      }

      const payload = parsedPayload.data;

      if (payload.reporterUserId !== authenticatedUserId) {
        return jsonResponse(
          request,
          normalizedAllowedOrigins,
          403,
          { code: 'reporter_mismatch', error: 'Kimlik dogrulamasi basarisiz.' },
          { requestId },
        );
      }

      const rateLimitResult = await enforceRateLimit({
        adminClient,
        identifier: `${authenticatedUserId}:${request.headers.get('x-device-id') ?? 'unknown-device'}`,
        maxRequests: 12,
        scope: 'moderation:report',
        windowMs: 10 * 60_000,
      });

      if (!rateLimitResult.allowed) {
        return jsonResponse(
          request,
          normalizedAllowedOrigins,
          429,
          {
            code: 'rate_limited',
            error: 'Sikayet limiti asildi. Lutfen biraz sonra tekrar deneyin.',
          },
          {
            extraHeaders: rateLimitHeaders(rateLimitResult, 12),
            requestId,
          },
        );
      }

      const snapshot = await buildReportSnapshot(adminClient, payload);
      const { data: insertedReport, error: insertError } = await adminClient
        .from('moderation_reports')
        .insert({
          comment_id: payload.targetType === 'comment' ? payload.commentId : null,
          details: trimDetails(payload.details),
          email_delivery_status: 'pending',
          legacy_report_key: buildLegacyReportKey(payload),
          list_id: payload.targetType === 'list' ? payload.listId : null,
          list_place_id: payload.targetType === 'place' ? payload.placeId : null,
          reason: payload.reason,
          report_type: payload.targetType,
          reporter_user_id: payload.reporterUserId,
          snapshot,
          target_user_id: payload.targetType === 'user' ? payload.targetUserId : null,
        })
        .select('id')
        .maybeSingle();

      if (insertError?.code === '23505') {
        return jsonResponse(
          request,
          normalizedAllowedOrigins,
          409,
          { code: 'duplicate_report', error: 'Bu icerik zaten sikayet edildi.' },
          { requestId },
        );
      }

      if (insertError || !insertedReport?.id || typeof insertedReport.id !== 'string') {
        throw new Error(insertError?.message ?? 'Moderation report insert failed');
      }

      const emailText = buildEmailBody({
        details: trimDetails(payload.details),
        reportId: insertedReport.id,
        snapshot,
        targetType: payload.targetType,
      });
      const emailDeliveryError = !config.reportEmailFrom?.trim()
        ? 'REPORTS_EMAIL_FROM is missing'
        : (await sendReportEmail({
            from: config.reportEmailFrom,
            subject: buildEmailSubject(payload),
            text: emailText,
            to: config.reportEmailTo,
          })).error ?? null;

      const { error: updateError } = await adminClient.from('moderation_reports').update({
        email_delivery_error: emailDeliveryError,
        email_delivery_status: emailDeliveryError ? 'failed' : 'sent',
      }).eq('id', insertedReport.id);

      if (updateError) {
        logEdgeEvent('warn', 'Moderation report email status update failed', requestContext, {
          message: updateError.message,
          reportId: insertedReport.id,
        });
      }

      if (emailDeliveryError) {
        logEdgeEvent('warn', 'Moderation report email delivery failed', requestContext, {
          message: emailDeliveryError,
          reportId: insertedReport.id,
        });
      }

      return jsonResponse(
        request,
        normalizedAllowedOrigins,
        200,
        {
          deliveryStatus: emailDeliveryError ? 'failed' : 'sent',
          reportId: insertedReport.id,
          success: true,
        },
        {
          extraHeaders: rateLimitHeaders(rateLimitResult, 12),
          requestId,
        },
      );
    } catch (error) {
      if (isHttpRequestError(error)) {
        return jsonResponse(
          request,
          normalizedAllowedOrigins,
          error.status,
          { code: error.code, error: error.message },
          { requestId },
        );
      }

      logEdgeEvent('error', 'Unhandled moderation-reports error', requestContext, {
        error: error instanceof Error ? error.message : 'Unknown moderation report error',
      });
      return jsonResponse(
        request,
        normalizedAllowedOrigins,
        500,
        { code: 'internal_error', error: error instanceof Error ? error.message : 'Internal server error' },
        { requestId },
      );
    }
  };
}
