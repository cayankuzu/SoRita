import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errors = new Rate('read_model_errors');
const latency = new Trend('read_model_latency', true);

export const options = {
  scenarios: {
    read_models: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '90s', target: 1000 },
        { duration: '2m', target: 1000 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    read_model_errors: ['rate<0.01'],
    read_model_latency: ['p(95)<600', 'p(99)<1200'],
  },
};

const baseUrl = __ENV.SORITA_SUPABASE_URL;
const publishableKey = __ENV.SORITA_SUPABASE_PUBLISHABLE_KEY;
const accessToken = __ENV.SORITA_LOAD_TEST_ACCESS_TOKEN;
const userId = __ENV.SORITA_LOAD_TEST_USER_ID;

if (!baseUrl || !publishableKey || !accessToken || !userId) {
  throw new Error(
    'Set SORITA_SUPABASE_URL, SORITA_SUPABASE_PUBLISHABLE_KEY, SORITA_LOAD_TEST_ACCESS_TOKEN and SORITA_LOAD_TEST_USER_ID.',
  );
}

const endpoints = [
  { name: 'feed_page', payload: { p_limit: 20 } },
  { name: 'notifications_page', payload: { p_limit: 20 } },
  { name: 'profile_summary', payload: { p_user_id: userId } },
];

export default function readModelLoad() {
  const endpoint = endpoints[__ITER % endpoints.length];
  const response = http.post(
    `${baseUrl}/rest/v1/rpc/${endpoint.name}`,
    JSON.stringify(endpoint.payload),
    {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      tags: { read_model: endpoint.name },
      timeout: '5s',
    },
  );
  const succeeded = check(response, {
    'read model returned 2xx': (value) => value.status >= 200 && value.status < 300,
  });

  errors.add(!succeeded);
  latency.add(response.timings.duration, { read_model: endpoint.name });
}
