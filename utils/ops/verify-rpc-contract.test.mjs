import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectPublicFunctionSignatures,
  isMissingResponse,
  parseParameterNames,
} from './verify-rpc-contract.mjs';

test('reads parameter names without their types or defaults', () => {
  assert.deepEqual(
    parseParameterNames('target_place_id uuid, p_limit integer default 20'),
    ['target_place_id', 'p_limit'],
  );
  assert.deepEqual(parseParameterNames(''), []);
});

test('collects callable public functions with their parameters', () => {
  const signatures = collectPublicFunctionSignatures([
    'create or replace function public.toggle_list_place_like(target_place_id uuid)\nreturns void\nlanguage plpgsql\nas $$ $$;',
  ]);

  assert.deepEqual([...signatures.entries()], [['toggle_list_place_like', ['target_place_id']]]);
});

test('skips trigger functions, which the API can never resolve', () => {
  const signatures = collectPublicFunctionSignatures([
    'create function public.touch_updated_at()\nreturns trigger\nlanguage plpgsql\nas $$ $$;',
    'create function public.profile_summary(p_user_id uuid)\nreturns table (id uuid)\nas $$ $$;',
  ]);

  assert.deepEqual([...signatures.keys()], ['profile_summary']);
});

test('a later drop removes a function from the expected contract', () => {
  const signatures = collectPublicFunctionSignatures([
    'create function public.legacy(p_id uuid) returns void as $$ $$;',
    'drop function if exists public.legacy(uuid);',
  ]);

  assert.equal(signatures.has('legacy'), false);
});

test('only PGRST202 means the deployed project cannot resolve the name', () => {
  assert.equal(isMissingResponse(404, 'PGRST202'), true);
  assert.equal(isMissingResponse(401, '42501'), false);
  assert.equal(isMissingResponse(400, 'P0001'), false);
  assert.equal(isMissingResponse(200, ''), false);
});
