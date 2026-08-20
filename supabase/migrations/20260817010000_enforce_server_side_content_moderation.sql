-- Client-side moderation is immediate UX feedback only. Enforce the same
-- baseline at the database boundary so modified clients cannot bypass it.
create or replace function public.contains_objectionable_content(input text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text;
begin
  normalized := trim(
    regexp_replace(
      translate(lower(coalesce(input, '')), 'çğıöşüâîû', 'cgiosuaiu'),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );

  if normalized = '' then
    return false;
  end if;

  return normalized ~
    '(^| )(a *m *k|a *n *a *n *i *s *i *k *e *y *i *m|a *s *s *h *o *l *e|b *i *t *c *h|f *u *c *k|n *i *g *g *a|n *i *g *g *e *r|o *r *o *s *p *u|p *i *c|p *o *r *n *o|p *o *r *n|s *e *x|s *h *i *t|s *i *k)( |$)';
end;
$$;

create or replace function public.enforce_safe_ugc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  blocked boolean := false;
begin
  if tg_table_name = 'profiles' then
    blocked :=
      public.contains_objectionable_content(new.name) or
      public.contains_objectionable_content(new.username) or
      public.contains_objectionable_content(new.bio);
  elsif tg_table_name = 'lists' then
    blocked :=
      public.contains_objectionable_content(new.name) or
      public.contains_objectionable_content(new.description);
  elsif tg_table_name = 'list_places' then
    blocked :=
      public.contains_objectionable_content(new.name) or
      public.contains_objectionable_content(new.title) or
      public.contains_objectionable_content(new.notes);
  elsif tg_table_name = 'list_place_comments' then
    blocked := public.contains_objectionable_content(new.content);
  end if;

  if blocked then
    raise exception using
      errcode = '22023',
      message = 'objectionable_content';
  end if;

  return new;
end;
$$;

revoke all on function public.contains_objectionable_content(text) from public, anon, authenticated;
revoke all on function public.enforce_safe_ugc() from public, anon, authenticated;

drop trigger if exists profiles_enforce_safe_ugc on public.profiles;
create trigger profiles_enforce_safe_ugc
before insert or update of name, username, bio on public.profiles
for each row execute function public.enforce_safe_ugc();

drop trigger if exists lists_enforce_safe_ugc on public.lists;
create trigger lists_enforce_safe_ugc
before insert or update of name, description on public.lists
for each row execute function public.enforce_safe_ugc();

drop trigger if exists list_places_enforce_safe_ugc on public.list_places;
create trigger list_places_enforce_safe_ugc
before insert or update of name, title, notes on public.list_places
for each row execute function public.enforce_safe_ugc();

drop trigger if exists list_place_comments_enforce_safe_ugc on public.list_place_comments;
create trigger list_place_comments_enforce_safe_ugc
before insert or update of content on public.list_place_comments
for each row execute function public.enforce_safe_ugc();
