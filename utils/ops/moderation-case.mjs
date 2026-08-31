import path from 'node:path';
import { pathToFileURL } from 'node:url';

const MUTATING_COMMANDS = new Set(['appeal', 'close', 'reopen', 'review', 'sanction', 'set-sla']);
const READ_COMMANDS = new Set(['events', 'list', 'show']);
const ALLOWED_STATUSES = new Set(['actioned', 'appealed', 'closed', 'in_review', 'open']);
const CONFIRMATION = 'MODERATION_CASE_TRANSITION';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const OPERATOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/u;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$/u;
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/#?=&+-]{0,239}$/u;

function fail(message) {
  throw new Error(`[moderation-ops] ${message}`);
}

function readValue(argv, index, option) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) fail(`${option} requires a value`);
  return value;
}

export function parseModerationArguments(argv) {
  const [command, ...rest] = argv;
  if (!command || (!MUTATING_COMMANDS.has(command) && !READ_COMMANDS.has(command))) {
    fail('command must be one of: list, show, events, review, sanction, close, appeal, reopen, set-sla');
  }

  const options = {
    caseId: null,
    command,
    confirm: null,
    idempotencyKey: null,
    limit: 50,
    operator: null,
    reason: null,
    reference: null,
    slaDueAt: null,
    status: null,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const option = rest[index];
    const value = readValue(rest, index, option);
    index += 1;
    switch (option) {
      case '--case-id':
        options.caseId = value;
        break;
      case '--confirm':
        options.confirm = value;
        break;
      case '--idempotency-key':
        options.idempotencyKey = value;
        break;
      case '--limit':
        options.limit = Number(value);
        break;
      case '--operator':
        options.operator = value;
        break;
      case '--reason':
        options.reason = value;
        break;
      case '--reference':
        options.reference = value;
        break;
      case '--sla-due-at':
        options.slaDueAt = value;
        break;
      case '--status':
        options.status = value;
        break;
      default:
        fail(`unknown option: ${option}`);
    }
  }

  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) {
    fail('--limit must be an integer from 1 to 100');
  }
  if (options.status && !ALLOWED_STATUSES.has(options.status)) {
    fail('--status is invalid');
  }
  if (['events', 'show', ...MUTATING_COMMANDS].includes(command)) {
    if (!options.caseId || !UUID_PATTERN.test(options.caseId)) fail('--case-id must be a UUID');
  }

  if (MUTATING_COMMANDS.has(command)) {
    if (options.confirm !== CONFIRMATION) {
      fail(`mutations require --confirm ${CONFIRMATION}`);
    }
    if (!OPERATOR_PATTERN.test(options.operator?.trim() ?? '')) {
      fail('--operator must be an opaque 1-120 character identifier');
    }
    if (!options.reason?.trim() || options.reason.trim().length > 500) {
      fail('--reason is required and must be at most 500 characters');
    }
    if (!IDEMPOTENCY_PATTERN.test(options.idempotencyKey?.trim() ?? '')) {
      fail('--idempotency-key must be an opaque 8-200 character identifier');
    }
    if (['appeal', 'sanction', 'set-sla'].includes(command) && !options.reference) {
      fail(`${command} requires --reference`);
    }
    if (options.reference && !REFERENCE_PATTERN.test(options.reference.trim())) {
      fail('--reference must be an opaque evidence or policy identifier');
    }
    if (command === 'set-sla') {
      const dueAt = Date.parse(options.slaDueAt ?? '');
      if (!Number.isFinite(dueAt)) fail('set-sla requires an ISO-8601 --sla-due-at');
      options.slaDueAt = new Date(dueAt).toISOString();
    } else if (options.slaDueAt) {
      fail('--sla-due-at is only valid with set-sla');
    }
  }

  return options;
}

export function buildTransitionPayload(options) {
  if (!MUTATING_COMMANDS.has(options.command)) fail('transition payload requires a mutating command');
  return {
    p_action: options.command,
    p_case_id: options.caseId,
    p_idempotency_key: options.idempotencyKey.trim(),
    p_operator_id: options.operator.trim(),
    p_reason: options.reason.trim(),
    p_reference: options.reference?.trim() || null,
    p_sla_due_at: options.command === 'set-sla' ? options.slaDueAt : null,
  };
}

export function sanitizeCaseRecord(record) {
  return {
    assignedOperatorId: record.assigned_operator_id ?? null,
    closedAt: record.closed_at ?? null,
    createdAt: record.created_at,
    id: record.id,
    lastEventAt: record.last_event_at,
    reportId: record.report_id,
    revision: record.revision,
    sanctionReference: record.sanction_reference ?? null,
    slaDueAt: record.sla_due_at ?? null,
    slaPolicyVersion: record.sla_policy_version ?? null,
    status: record.status,
    updatedAt: record.updated_at,
  };
}

export function sanitizeEventRecord(record) {
  return {
    caseId: record.case_id,
    createdAt: record.created_at,
    eventType: record.event_type,
    fromStatus: record.from_status ?? null,
    id: record.id,
    operatorId: record.operator_id,
    reason: record.reason,
    reference: record.reference ?? null,
    toStatus: record.to_status,
  };
}

function configuredEndpoint(environment) {
  const rawUrl = environment.SUPABASE_URL?.trim();
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !serviceRoleKey) {
    fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in the process environment');
  }
  const url = new URL(rawUrl);
  const isLocal = ['127.0.0.1', 'localhost'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
    fail('SUPABASE_URL must use HTTPS except for localhost');
  }
  return { serviceRoleKey, url };
}

function casesUrl(baseUrl, options) {
  const url = new URL('/rest/v1/moderation_cases', baseUrl);
  url.searchParams.set(
    'select',
    'id,report_id,status,assigned_operator_id,sla_due_at,sla_policy_version,sanction_reference,closed_at,revision,last_event_at,created_at,updated_at',
  );
  url.searchParams.set('order', 'last_event_at.asc,id.asc');
  url.searchParams.set('limit', String(options.command === 'show' ? 1 : options.limit));
  if (options.caseId) url.searchParams.set('id', `eq.${options.caseId}`);
  if (options.status) url.searchParams.set('status', `eq.${options.status}`);
  return url;
}

function eventsUrl(baseUrl, options) {
  const url = new URL('/rest/v1/moderation_case_events', baseUrl);
  url.searchParams.set(
    'select',
    'id,case_id,event_type,from_status,to_status,operator_id,reason,reference,created_at',
  );
  url.searchParams.set('case_id', `eq.${options.caseId}`);
  url.searchParams.set('order', 'created_at.asc,id.asc');
  url.searchParams.set('limit', String(options.limit));
  return url;
}

async function requestJson(url, init, serviceRoleKey, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchImpl(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) fail(`Supabase operation failed with HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function runModerationCommand(options, { environment = process.env, fetchImpl = fetch } = {}) {
  const { serviceRoleKey, url: baseUrl } = configuredEndpoint(environment);
  if (options.command === 'list' || options.command === 'show') {
    const rows = await requestJson(casesUrl(baseUrl, options), { method: 'GET' }, serviceRoleKey, fetchImpl);
    return rows.map(sanitizeCaseRecord);
  }
  if (options.command === 'events') {
    const rows = await requestJson(eventsUrl(baseUrl, options), { method: 'GET' }, serviceRoleKey, fetchImpl);
    return rows.map(sanitizeEventRecord);
  }

  const rpcUrl = new URL('/rest/v1/rpc/moderation_transition_case', baseUrl);
  const result = await requestJson(
    rpcUrl,
    {
      body: JSON.stringify(buildTransitionPayload(options)),
      headers: { Prefer: 'return=representation' },
      method: 'POST',
    },
    serviceRoleKey,
    fetchImpl,
  );
  const record = Array.isArray(result) ? result[0] : result;
  if (!record) fail('Supabase returned no moderation case');
  return sanitizeCaseRecord(record);
}

async function main() {
  const options = parseModerationArguments(process.argv.slice(2));
  const result = await runModerationCommand(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : '[moderation-ops] Unexpected failure');
    process.exitCode = 1;
  });
}
