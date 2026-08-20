-- Do not pin remote Expo notifications to one Android channel version.
-- Existing installs have used both v3 and v4; omitting channelId lets each
-- native build select its configured default channel (or Expo's fallback).
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
        if new.recipient_user_id is null
          or new.read = true
          or (
            new.actor_user_id is not null
            and new.actor_user_id = new.recipient_user_id
          ) then
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
        if new.recipient_user_id is null
          or new.read = true
          or (
            new.actor_user_id is not null
            and new.actor_user_id = new.recipient_user_id
          ) then
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
