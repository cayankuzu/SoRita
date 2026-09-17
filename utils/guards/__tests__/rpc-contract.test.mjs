import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectCalledRpcNames,
  collectExposedRpcNames,
  findUnexposedRpcNames,
} from '../check-rpc-contract.mjs';

test('collects every RPC name the app calls', () => {
  const names = collectCalledRpcNames([
    "const { error } = await supabase.rpc('toggle_list_place_like', { target_place_id: placeId });",
    "supabase.rpc(\n  'feed_page_complete',\n  { p_limit: 20 },\n);",
    "await supabase.rpc('feed_page_complete');",
  ]);

  assert.deepEqual([...names].sort(), ['feed_page_complete', 'toggle_list_place_like']);
});

test('treats the last migration statement as the truth about a name', () => {
  const exposed = collectExposedRpcNames([
    'create function public.alpha(id uuid) returns void as $$ $$;',
    'drop function if exists public.alpha(uuid);',
    'create or replace function public.beta() returns void as $$ $$;',
  ]);

  assert.deepEqual([...exposed].sort(), ['beta']);
});

test('a name dropped and re-created in one migration stays exposed', () => {
  const exposed = collectExposedRpcNames([
    [
      'drop function if exists public.gamma(uuid);',
      'create function public.gamma(target_id uuid) returns void as $$ $$;',
    ].join('\n'),
  ]);

  assert.deepEqual([...exposed], ['gamma']);
});

test('reports exactly the calls no migration exposes', () => {
  const missing = findUnexposedRpcNames(
    new Set(['toggle_list_place_like', 'feed_page_complete']),
    new Set(['feed_page_complete']),
  );

  assert.deepEqual(missing, ['toggle_list_place_like']);
});
