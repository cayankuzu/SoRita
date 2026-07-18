alter table public.notifications
  add column if not exists push_title text;

do $$
declare
  notifications_constraint_name text;
begin
  select con.conname
  into notifications_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace ns on ns.oid = rel.relnamespace
  where ns.nspname = 'public'
    and rel.relname = 'notifications'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%type in%';

  if notifications_constraint_name is not null then
    execute format(
      'alter table public.notifications drop constraint %I',
      notifications_constraint_name
    );
  end if;
end
$$;

alter table public.notifications
drop constraint if exists notifications_type_check;

alter table public.notifications
add constraint notifications_type_check
check (
  type in (
    'like',
    'follow',
    'follow_request',
    'comment',
    'place_added',
    'place_quote',
    'list_liked',
    'comment_like',
    'comment_reply',
    'system_announcement'
  )
);

do $$
begin
  if to_regprocedure('public.dispatch_push_notification()') is not null then
    execute $function$
      create or replace function public.dispatch_push_notification()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $body$
      declare
        target_actor_name text;
        target_push_title text;
        target_token text;
        unread_badge_count integer := 0;
      begin
        if new.recipient_user_id is null then
          return new;
        end if;

        select name
        into target_actor_name
        from public.profiles
        where id = new.actor_user_id;

        target_push_title := nullif(trim(coalesce(new.push_title, '')), '');

        select count(*)
        into unread_badge_count
        from public.notifications
        where recipient_user_id = new.recipient_user_id
          and read = false;

        for target_token in
          select expo_push_token
          from public.user_push_tokens
          where user_id = new.recipient_user_id
            and is_active = true
        loop
          perform net.http_post(
            url := 'https://exp.host/--/api/v2/push/send',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Accept', 'application/json'
            ),
            body := jsonb_build_object(
              'to', target_token,
              'title', coalesce(target_push_title, target_actor_name, 'SoRita'),
              'body', new.message,
              'sound', 'default',
              'priority', 'high',
              'badge', greatest(unread_badge_count, 1),
              'interruptionLevel', 'active',
              'channelId', 'sorita-alerts-v3',
              'data', jsonb_build_object(
                'notificationId', new.id,
                'type', new.type,
                'userId', new.actor_user_id,
                'listId', new.list_id,
                'placeId', new.list_place_id
              )
            )
          );
        end loop;

        return new;
      end;
      $body$;
    $function$;

    revoke all on function public.dispatch_push_notification() from public;
  end if;
end;
$$;

do $$
begin
  if to_regnamespace('private') is not null
    and to_regprocedure('private.dispatch_push_notification()') is not null then
    execute $function$
      create or replace function private.dispatch_push_notification()
      returns trigger
      language plpgsql
      security definer
      set search_path = pg_catalog, public, private
      as $body$
      declare
        target_actor_name text;
        target_push_title text;
        target_token text;
        unread_badge_count integer := 0;
      begin
        if new.recipient_user_id is null then
          return new;
        end if;

        select name
        into target_actor_name
        from public.profiles
        where id = new.actor_user_id;

        target_push_title := nullif(trim(coalesce(new.push_title, '')), '');

        select count(*)
        into unread_badge_count
        from public.notifications
        where recipient_user_id = new.recipient_user_id
          and read = false;

        for target_token in
          select expo_push_token
          from public.user_push_tokens
          where user_id = new.recipient_user_id
            and is_active = true
        loop
          perform net.http_post(
            url := 'https://exp.host/--/api/v2/push/send',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Accept', 'application/json'
            ),
            body := jsonb_build_object(
              'to', target_token,
              'title', coalesce(target_push_title, target_actor_name, 'SoRita'),
              'body', new.message,
              'sound', 'default',
              'priority', 'high',
              'badge', greatest(unread_badge_count, 1),
              'interruptionLevel', 'active',
              'channelId', 'sorita-alerts-v3',
              'data', jsonb_build_object(
                'notificationId', new.id,
                'type', new.type,
                'userId', new.actor_user_id,
                'listId', new.list_id,
                'placeId', new.list_place_id
              )
            )
          );
        end loop;

        return new;
      end;
      $body$;
    $function$;

    revoke all on function private.dispatch_push_notification() from public;
  end if;
end;
$$;
