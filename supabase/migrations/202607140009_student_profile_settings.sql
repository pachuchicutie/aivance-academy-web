-- Student account settings: allow safe self-service profile updates.
-- Students may only change full_name (and sync email after Auth confirmation).
-- Role, tier, status, and permissions remain admin-controlled.

begin;

-- Guarded update: only full_name (and optional email sync after Auth change).
create or replace function public.update_own_profile(
  p_full_name text default null,
  p_sync_email text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_row public.profiles;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_full_name is not null then
    v_name := btrim(p_full_name);
    if char_length(v_name) < 2 or char_length(v_name) > 80 then
      raise exception 'Full name must be between 2 and 80 characters' using errcode = '22023';
    end if;
    if v_name ~ '[<>{}]' then
      raise exception 'Full name contains invalid characters' using errcode = '22023';
    end if;
  end if;

  update public.profiles
  set
    full_name = coalesce(v_name, full_name),
    email = case
      when p_sync_email is not null and btrim(p_sync_email) <> ''
        then lower(btrim(p_sync_email))
      else email
    end,
    updated_at = now()
  where id = v_uid
  returning * into v_row;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

grant execute on function public.update_own_profile(text, text) to authenticated;

-- Optional student notification preferences (additive JSON blob).
alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

create or replace function public.update_own_preferences(p_prefs jsonb)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.profiles;
  v_safe jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Only allow known boolean keys; ignore everything else.
  v_safe := jsonb_build_object(
    'email_announcements', coalesce((p_prefs->>'email_announcements')::boolean, true),
    'email_support_replies', coalesce((p_prefs->>'email_support_replies')::boolean, true),
    'email_session_reminders', coalesce((p_prefs->>'email_session_reminders')::boolean, true),
    'reduce_motion', coalesce((p_prefs->>'reduce_motion')::boolean, false)
  );

  update public.profiles
  set preferences = coalesce(preferences, '{}'::jsonb) || v_safe,
      updated_at = now()
  where id = v_uid
  returning * into v_row;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

grant execute on function public.update_own_preferences(jsonb) to authenticated;

commit;

notify pgrst, 'reload schema';
