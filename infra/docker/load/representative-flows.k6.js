/* global __ENV */

import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

const baseUrl = (__ENV.VERIFICATION_MOCK_BASE_URL || '').replace(/\/+$/u, '');
const vus = Number.parseInt(__ENV.SORITA_LOAD_VUS || '5', 10);
const duration = __ENV.SORITA_LOAD_DURATION || '10s';
const p95Budget = Number.parseInt(__ENV.SORITA_LOAD_P95_MS || '250', 10);
const contractErrors = new Rate('representative_contract_errors');
const durationMatch = /^(\d+)(ms|s|m)$/u.exec(duration);

if (baseUrl !== 'http://maps-mock:8789') {
  throw new Error('Docker load smoke may target only the internal deterministic verification mock.');
}
if (!Number.isInteger(vus) || vus < 1 || vus > 25) {
  throw new Error('SORITA_LOAD_VUS must be an integer between 1 and 25 for Docker smoke.');
}
if (!durationMatch) {
  throw new Error('SORITA_LOAD_DURATION must be a bounded k6 duration.');
}
const durationAmount = Number.parseInt(durationMatch[1], 10);
const durationUnit = durationMatch[2];
if (
  durationAmount < 1 ||
  (durationUnit === 'ms' && durationAmount > 60_000) ||
  (durationUnit === 's' && durationAmount > 60) ||
  (durationUnit === 'm' && durationAmount > 1)
) {
  throw new Error('SORITA_LOAD_DURATION must be between 1ms and 60s.');
}
if (!Number.isInteger(p95Budget) || p95Budget < 1 || p95Budget > 2_000) {
  throw new Error('SORITA_LOAD_P95_MS must be between 1 and 2000.');
}

const flows = [
  {
    contract: (response) => response.json('items.0.id') === 'synthetic-discovery-item',
    method: 'GET',
    name: 'discovery',
    path: '/verification/discovery?limit=20',
  },
  {
    contract: (response) => response.json('items.0.id') === 'synthetic-list',
    method: 'GET',
    name: 'lists',
    path: '/verification/lists?limit=20',
  },
  {
    contract: (response) => response.json('items.0.id') === 'synthetic-activity',
    method: 'GET',
    name: 'social',
    path: '/verification/social?limit=20',
  },
  {
    body: JSON.stringify({ operation: 'refresh' }),
    contract: (response) =>
      response.json('ok') === true && response.json('session.expiresIn') === 3_600,
    method: 'POST',
    name: 'auth-gateway',
    path: '/functions/v1/auth-gateway',
  },
  {
    contract: (response) =>
      response.json('ok') === true && response.json('policy') === 'no-store',
    method: 'GET',
    name: 'edge',
    path: '/verification/edge',
  },
];

const perFlowThresholds = Object.fromEntries(
  flows.flatMap(({ name }) => [
    [`http_req_failed{flow:${name}}`, ['rate==0']],
    [`http_req_duration{flow:${name}}`, [`p(95)<${p95Budget}`]],
  ]),
);

export const options = {
  scenarios: {
    representative_user_flows: {
      duration,
      executor: 'constant-vus',
      gracefulStop: '2s',
      vus,
    },
  },
  thresholds: {
    ...perFlowThresholds,
    http_req_failed: ['rate==0'],
    http_req_duration: [`p(95)<${p95Budget}`],
    representative_contract_errors: ['rate==0'],
  },
};

export default function representativeFlowSmoke() {
  const responses = http.batch(
    flows.map(({ body, method, name, path }) => ({
      body,
      method,
      params: {
        headers: body ? { 'content-type': 'application/json' } : undefined,
        tags: { flow: name },
        timeout: '2s',
      },
      url: `${baseUrl}${path}`,
    })),
  );

  for (const [index, response] of responses.entries()) {
    const flow = flows[index];
    const passed = check(
      response,
      {
        [`${flow.name}: response is 200`]: (value) => value.status === 200,
        [`${flow.name}: response is JSON`]: (value) =>
          (value.headers['Content-Type'] || '').toLowerCase().includes('application/json'),
        [`${flow.name}: response is no-store`]: (value) =>
          (value.headers['Cache-Control'] || '').toLowerCase().includes('no-store'),
        [`${flow.name}: representative contract matches`]: flow.contract,
      },
      { flow: flow.name },
    );
    contractErrors.add(!passed, { flow: flow.name });
  }
}
