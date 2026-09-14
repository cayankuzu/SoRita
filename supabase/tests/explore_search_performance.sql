begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

create function pg_temp.explain_text(input_query text)
returns text
language plpgsql
as $$
declare
  plan_line text;
  plan_text text := '';
begin
  for plan_line in execute 'explain (costs off) ' || input_query loop
    plan_text := plan_text || E'\n' || plan_line;
  end loop;
  return plan_text;
end;
$$;

select ok(
  exists (select 1 from pg_extension where extname = 'pg_trgm'),
  'trigram search support is installed'
);

select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'idx_profiles_explore_search_trgm',
        'idx_profiles_identity_search_trgm',
        'idx_lists_explore_search_trgm',
        'idx_lists_name_search_trgm',
        'idx_list_places_explore_search_trgm',
        'idx_profiles_public_updated_keyset',
        'idx_lists_public_updated_keyset'
      )
  ),
  7,
  'Explore search and keyset indexes all exist'
);

select is(
  (
    select count(*)::integer
    from pg_indexes
    where schemaname = 'public'
      and indexname like 'idx_%_search_trgm'
      and indexdef like '%USING gin%'
      and indexdef like '%gin_trgm_ops%'
      and indexdef like '%normalize_search_text%'
  ),
  5,
  'all Explore text indexes use normalized trigram expressions'
);

set local enable_seqscan = off;
select ok(
  pg_temp.explain_text($query$
    select id from public.profiles
    where private.normalize_search_text(
      coalesce(name, '') || ' ' || coalesce(username, '') || ' ' || coalesce(bio, '')
    ) like '%kahve%'
  $query$) like '%idx_profiles_explore_search_trgm%',
  'profile substring search has an index-backed plan'
);
select ok(
  pg_temp.explain_text($query$
    select id from public.lists
    where private.normalize_search_text(
      coalesce(name, '') || ' ' || coalesce(description, '')
    ) like '%kahve%'
  $query$) like '%idx_lists_explore_search_trgm%',
  'list substring search has an index-backed plan'
);
select ok(
  pg_temp.explain_text($query$
    select id from public.list_places
    where private.normalize_search_text(
      coalesce(name, '') || ' ' || coalesce(address, '') || ' ' || coalesce(notes, '')
    ) like '%kahve%'
  $query$) like '%idx_list_places_explore_search_trgm%',
  'place substring search has an index-backed plan'
);

select ok(
  pg_get_functiondef(
    'public.explore_page(text,text,double precision,uuid,integer)'::regprocedure
  ) not like '%strpos(%',
  'Explore no longer forces non-indexable strpos scans'
);

select ok(
  pg_get_functiondef(
    'public.explore_page(text,text,double precision,uuid,integer)'::regprocedure
  ) like '%like_pattern%',
  'Explore uses one escaped literal pattern per request'
);

select ok(
  lower(pg_get_functiondef(
    'public.explore_page(text,text,double precision,uuid,integer)'::regprocedure
  )) like '%char_length(coalesce(p_query, '''')) <= 120%',
  'Explore rejects unbounded search input before scanning content'
);

select ok(
  lower(pg_get_functiondef(
    'public.explore_page(text,text,double precision,uuid,integer)'::regprocedure
  )) like '%char_length(normalized_input.q) >= 3%',
  'Explore rejects one- and two-character normalized substring scans'
);

select ok(
  lower(pg_get_functiondef(
    'public.explore_page(text,text,double precision,uuid,integer)'::regprocedure
  )) like '%selected as%'
  and lower(pg_get_functiondef(
    'public.explore_page(text,text,double precision,uuid,integer)'::regprocedure
  )) like '%case selected.kind%',
  'card JSON hydration happens only for the selected page'
);

select is(
  (
    select proconfig
    from pg_proc
    where oid = 'public.explore_page(text,text,double precision,uuid,integer)'::regprocedure
  ),
  array['search_path=pg_catalog, public, private, extensions']::text[],
  'Explore pins all schemas needed by its indexed search contract'
);

select * from finish();
rollback;
