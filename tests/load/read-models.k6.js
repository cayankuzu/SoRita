/* global __ENV, __ITER, __VU */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errors = new Rate('read_model_errors');
const latency = new Trend('read_model_latency', true);
const targetVUs = Number.parseInt(__ENV.SORITA_LOAD_TARGET_VUS || '10000', 10);
const thinkTimeSeconds = Number.parseFloat(__ENV.SORITA_LOAD_THINK_TIME_SECONDS || '1');

if (!Number.isInteger(targetVUs) || targetVUs < 1 || targetVUs > 10000) {
  throw new Error('SORITA_LOAD_TARGET_VUS must be an integer between 1 and 10000.');
}

if (!Number.isFinite(thinkTimeSeconds) || thinkTimeSeconds < 0) {
  throw new Error('SORITA_LOAD_THINK_TIME_SECONDS must be zero or greater.');
}

export const options = {
  scenarios: {
    read_models: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: Math.ceil(targetVUs * 0.1) },
        { duration: '2m', target: Math.ceil(targetVUs * 0.5) },
        { duration: '2m', target: targetVUs },
        { duration: '5m', target: targetVUs },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.005'],
    read_model_errors: ['rate<0.005'],
    read_model_latency: ['p(95)<600', 'p(99)<1200'],
    'http_req_duration{read_model:feed_page_complete}': ['p(95)<600'],
    'http_req_duration{read_model:explore_page_complete}': ['p(95)<600'],
    'http_req_duration{read_model:profile_content_page_complete}': ['p(95)<600'],
    'http_req_duration{read_model:notifications_page}': ['p(95)<600'],
  },
};

const baseUrl = __ENV.SORITA_SUPABASE_URL?.replace(/\/+$/, '');
const publishableKey = __ENV.SORITA_SUPABASE_PUBLISHABLE_KEY;
let identities;

try {
  identities = JSON.parse(__ENV.SORITA_LOAD_TEST_IDENTITIES || '[]');
} catch {
  throw new Error('SORITA_LOAD_TEST_IDENTITIES must be valid JSON.');
}

if (!baseUrl || !publishableKey || !Array.isArray(identities) || identities.length === 0) {
  throw new Error(
    'Set SORITA_SUPABASE_URL, SORITA_SUPABASE_PUBLISHABLE_KEY and SORITA_LOAD_TEST_IDENTITIES.',
  );
}

if (targetVUs >= 10000 && identities.length < 20) {
  throw new Error('The 10000-VU profile requires at least 20 isolated load-test identities.');
}

for (const identity of identities) {
  if (!identity?.accessToken || !identity?.userId) {
    throw new Error('Every load-test identity requires accessToken and userId.');
  }
}

const endpoints = [
  {
    name: 'feed_page_complete',
    payload: () => ({ p_cursor_id: null, p_cursor_published_at: null, p_limit: 20 }),
  },
  {
    name: 'explore_page_complete',
    payload: () => ({
      p_cursor_id: null,
      p_cursor_rank: null,
      p_kind: 'all',
      p_limit: 20,
      p_query: '',
    }),
  },
  {
    name: 'profile_content_page_complete',
    payload: (identity) => ({
      p_cursor: null,
      p_cursor_id: null,
      p_limit: 20,
      p_tab: 'lists',
      p_user_id: identity.userId,
    }),
  },
  {
    name: 'notifications_page',
    payload: () => ({ p_cursor_created_at: null, p_cursor_id: null, p_limit: 20 }),
  },
];

export default function readModelLoad() {
  const identity = identities[(__VU - 1) % identities.length];
  const endpoint = endpoints[__ITER % endpoints.length];
  const response = http.post(
    `${baseUrl}/rest/v1/rpc/${endpoint.name}`,
    JSON.stringify(endpoint.payload(identity)),
    {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${identity.accessToken}`,
        'Content-Type': 'application/json',
      },
      tags: { read_model: endpoint.name },
      timeout: '5s',
    },
  );
  const succeeded = check(response, {
    'read model returned 2xx': (value) => value.status >= 200 && value.status < 300,
    'read model returned JSON': (value) =>
      (value.headers['Content-Type'] || '').toLowerCase().includes('application/json'),
  });

  errors.add(!succeeded);
  latency.add(response.timings.duration, { read_model: endpoint.name });
  sleep(thinkTimeSeconds);
}
