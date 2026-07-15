-- Support tickets system (additive evolution of support_requests).
-- Canonical source: aivance-academy-admin.
-- Safe: no drops of user data; expands statuses/categories; adds messages + RLS.

begin;

-- ---------------------------------------------------------------------------
-- 1) Expand support_requests for ticket lifecycle
-- ---------------------------------------------------------------------------
alter table public.support_requests
  add column if not exists reference_code text,
  add column if not exists priority text not null default 'normal',
  add column if not exists assigned_to uuid references public.profiles (id) on delete set null,
  add column if not exists student_last_read_at timestamptz,
  add column if not exists admin_last_read_at timestamptz,
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists resolved_at timestamptz,
  add column if not exists closed_at timestamptz;

-- Priority check (additive constraint via drop/create if needed)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'support_requests_priority_check'
      and conrelid = 'public.support_requests'::regclass
  ) then
    alter table public.support_requests
      add constraint support_requests_priority_check
      check (priority in ('normal', 'high', 'urgent'));
  end if;
end $$;

-- Expand category + status checks by replacing constraints
alter table public.support_requests drop constraint if exists support_requests_category_check;
alter table public.support_requests
  add constraint support_requests_category_check
  check (
    category in (
      'general',
      'account',
      'course_access',
      'payment',
      'content',
      'live_session',
      'technical',
      'community',
      'ai_assistant',
      'other',
      -- legacy values still accepted
      'course'
    )
  );

alter table public.support_requests drop constraint if exists support_requests_status_check;
alter table public.support_requests
  add constraint support_requests_status_check
  check (
    status in (
      'open',
      'in_progress',
      'waiting_for_student',
      'resolved',
      'closed'
    )
  );

-- Ticket reference generator: AIV-SUP-YYYYMMDD-XXXX
create or replace function public.generate_support_reference()
returns text
language plpgsql
as $$
declare
  v_date text := to_char(timezone('UTC', now()), 'YYYYMMDD');
  v_suffix text;
  v_code text;
  v_tries int := 0;
begin
  loop
    v_suffix := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
    v_code := 'AIV-SUP-' || v_date || '-' || v_suffix;
    exit when not exists (
      select 1 from public.support_requests where reference_code = v_code
    );
    v_tries := v_tries + 1;
    exit when v_tries > 8;
  end loop;
  return v_code;
end;
$$;

create or replace function public.support_requests_before_insert()
returns trigger
language plpgsql
as $$
begin
  if new.reference_code is null or btrim(new.reference_code) = '' then
    new.reference_code := public.generate_support_reference();
  end if;
  if new.last_activity_at is null then
    new.last_activity_at := now();
  end if;
  if new.student_last_read_at is null then
    new.student_last_read_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists support_requests_before_insert on public.support_requests;
create trigger support_requests_before_insert
before insert on public.support_requests
for each row execute function public.support_requests_before_insert();

-- Backfill references for any existing rows
update public.support_requests
set reference_code = public.generate_support_reference()
where reference_code is null;

create unique index if not exists support_requests_reference_code_uidx
  on public.support_requests (reference_code);

create index if not exists support_requests_last_activity_idx
  on public.support_requests (last_activity_at desc);

create index if not exists support_requests_assigned_to_idx
  on public.support_requests (assigned_to)
  where assigned_to is not null;

-- ---------------------------------------------------------------------------
-- 2) Messages / conversation thread
-- ---------------------------------------------------------------------------
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_requests (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  author_role text not null
    check (author_role in ('student', 'admin', 'support_agent', 'system')),
  body text not null check (length(trim(body)) between 1 and 8000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_ticket_id_idx
  on public.support_messages (ticket_id, created_at asc);

create index if not exists support_messages_public_idx
  on public.support_messages (ticket_id, created_at asc)
  where is_internal = false;

alter table public.support_messages enable row level security;

-- Seed initial student message from legacy support_requests.message for old rows
insert into public.support_messages (ticket_id, author_id, author_role, body, is_internal, created_at)
select
  sr.id,
  sr.user_id,
  'student',
  sr.message,
  false,
  sr.created_at
from public.support_requests sr
where not exists (
  select 1 from public.support_messages sm where sm.ticket_id = sr.id
)
and length(trim(sr.message)) >= 1;

-- Keep last_activity_at in sync when public messages are added
create or replace function public.support_messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_requests
  set
    last_activity_at = new.created_at,
    updated_at = now(),
    -- student public reply on waiting_for_student -> in_progress
    status = case
      when new.author_role = 'student'
        and new.is_internal = false
        and status = 'waiting_for_student'
        then 'in_progress'
      when new.author_role = 'student'
        and new.is_internal = false
        and status = 'resolved'
        then 'open'
      else status
    end,
    resolved_at = case
      when new.author_role = 'student'
        and new.is_internal = false
        and status in ('resolved', 'waiting_for_student')
        then null
      else resolved_at
    end,
    student_last_read_at = case
      when new.author_role = 'student' and new.is_internal = false
        then new.created_at
      else student_last_read_at
    end,
    admin_last_read_at = case
      when new.author_role in ('admin', 'support_agent') and new.is_internal = false
        then new.created_at
      else admin_last_read_at
    end
  where id = new.ticket_id;

  return new;
end;
$$;

drop trigger if exists support_messages_after_insert on public.support_messages;
create trigger support_messages_after_insert
after insert on public.support_messages
for each row execute function public.support_messages_after_insert();

-- ---------------------------------------------------------------------------
-- 3) RLS — support_requests (students + admins)
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can manage support requests" on public.support_requests;
create policy "Admins can manage support requests"
on public.support_requests
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Students can read own support requests" on public.support_requests;
create policy "Students can read own support requests"
on public.support_requests
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Students can submit support requests" on public.support_requests;
create policy "Students can submit support requests"
on public.support_requests
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_portal_active(auth.uid())
);

-- Students may update limited fields on own tickets (read cursor / reopen via reply path)
drop policy if exists "Students can update own support requests" on public.support_requests;
create policy "Students can update own support requests"
on public.support_requests
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4) RLS — support_messages
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can manage support messages" on public.support_messages;
create policy "Admins can manage support messages"
on public.support_messages
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Students can read public messages on own tickets" on public.support_messages;
create policy "Students can read public messages on own tickets"
on public.support_messages
for select
to authenticated
using (
  is_internal = false
  and exists (
    select 1
    from public.support_requests sr
    where sr.id = support_messages.ticket_id
      and sr.user_id = auth.uid()
  )
);

drop policy if exists "Students can reply on own open tickets" on public.support_messages;
create policy "Students can reply on own open tickets"
on public.support_messages
for insert
to authenticated
with check (
  author_id = auth.uid()
  and author_role = 'student'
  and is_internal = false
  and public.is_portal_active(auth.uid())
  and exists (
    select 1
    from public.support_requests sr
    where sr.id = ticket_id
      and sr.user_id = auth.uid()
      and sr.status in ('open', 'in_progress', 'waiting_for_student', 'resolved')
  )
);

-- ---------------------------------------------------------------------------
-- 5) Unread helpers
-- ---------------------------------------------------------------------------
create or replace function public.student_support_unread_count(p_user_id uuid default auth.uid())
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(*)::int, 0)
  from public.support_requests sr
  where sr.user_id = p_user_id
    and sr.status in ('open', 'in_progress', 'waiting_for_student', 'resolved')
    and exists (
      select 1
      from public.support_messages sm
      where sm.ticket_id = sr.id
        and sm.is_internal = false
        and sm.author_role in ('admin', 'support_agent', 'system')
        and sm.created_at > coalesce(sr.student_last_read_at, 'epoch'::timestamptz)
    );
$$;

grant execute on function public.student_support_unread_count(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
