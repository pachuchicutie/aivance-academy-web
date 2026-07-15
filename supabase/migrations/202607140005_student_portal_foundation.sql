-- Student portal foundation:
-- 1) Account status (active / suspended / deactivated) + batch on profiles
-- 2) Guest payment -> account linking (fixes invited students having no enrollment)
-- 3) Lesson progress with server-enforced access checks
-- 4) Announcements (+ read state), live sessions, communities, support requests
-- All with strict RLS. Canonical migration source: aivance-academy-admin.

begin;

-- ---------------------------------------------------------------------------
-- 1) Profile account status + batch
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists status text not null default 'active'
    check (status in ('active', 'suspended', 'deactivated')),
  add column if not exists batch text;

create or replace function public.is_portal_active(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.profiles
      where id = user_id
        and status = 'active'
    ),
    false
  );
$$;

grant execute on function public.is_portal_active(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Link guest payments to newly created accounts.
--    Guest flow: payment confirmed (no user yet) -> invite email -> account
--    created. This trigger claims the payment rows by email, applies the tier
--    and batch, and creates the enrollment that confirm_payment skipped.
-- ---------------------------------------------------------------------------
create or replace function public.link_guest_payments_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(new.email, '')));
  v_payment public.payments%rowtype;
  v_course_id uuid;
begin
  if v_email = '' then
    return new;
  end if;

  update public.payments
  set user_id = new.id,
      updated_at = now()
  where user_id is null
    and lower(trim(coalesce(email, ''))) = v_email;

  select *
  into v_payment
  from public.payments
  where user_id = new.id
    and status = 'confirmed'
  order by public.tier_rank(tier) desc, created_at desc
  limit 1;

  if not found then
    return new;
  end if;

  update public.profiles
  set
    tier = case
      when public.tier_rank(v_payment.tier) > public.tier_rank(tier)
        then v_payment.tier
      else coalesce(tier, v_payment.tier)
    end,
    batch = coalesce(batch, v_payment.batch),
    updated_at = now()
  where id = new.id;

  select id
  into v_course_id
  from public.courses
  where slug = 'ai-specialist-starter-bootcamp'
    and deleted_at is null
  order by created_at asc
  limit 1;

  if v_course_id is not null then
    insert into public.enrollments (
      user_id, course_id, tier, status, started_at, updated_at
    )
    values (new.id, v_course_id, v_payment.tier, 'active', now(), now())
    on conflict (user_id, course_id) do update
    set
      tier = case
        when public.tier_rank(excluded.tier) > public.tier_rank(public.enrollments.tier)
          then excluded.tier
        else public.enrollments.tier
      end,
      status = 'active',
      expires_at = null,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists on_profile_link_guest_payments on public.profiles;
create trigger on_profile_link_guest_payments
after insert or update of email on public.profiles
for each row execute function public.link_guest_payments_to_profile();

-- Backfill: claim guest payments for accounts that already exist.
do $$
declare
  v_profile record;
  v_payment public.payments%rowtype;
  v_course_id uuid;
begin
  select id
  into v_course_id
  from public.courses
  where slug = 'ai-specialist-starter-bootcamp'
    and deleted_at is null
  order by created_at asc
  limit 1;

  for v_profile in
    select p.id, lower(trim(coalesce(p.email, ''))) as email, p.tier, p.batch
    from public.profiles p
    where coalesce(p.email, '') <> ''
  loop
    update public.payments
    set user_id = v_profile.id,
        updated_at = now()
    where user_id is null
      and lower(trim(coalesce(email, ''))) = v_profile.email;

    select *
    into v_payment
    from public.payments
    where user_id = v_profile.id
      and status = 'confirmed'
    order by public.tier_rank(tier) desc, created_at desc
    limit 1;

    if not found then
      continue;
    end if;

    update public.profiles
    set
      tier = case
        when public.tier_rank(v_payment.tier) > public.tier_rank(tier)
          then v_payment.tier
        else coalesce(tier, v_payment.tier)
      end,
      batch = coalesce(batch, v_payment.batch),
      updated_at = now()
    where id = v_profile.id;

    if v_course_id is not null then
      insert into public.enrollments (
        user_id, course_id, tier, status, started_at, updated_at
      )
      values (v_profile.id, v_course_id, v_payment.tier, 'active', now(), now())
      on conflict (user_id, course_id) do update
      set
        tier = case
          when public.tier_rank(excluded.tier) > public.tier_rank(public.enrollments.tier)
            then excluded.tier
          else public.enrollments.tier
        end,
        status = 'active',
        expires_at = null,
        updated_at = now();
    end if;
  end loop;
end;
$$;

-- confirm_payment: also stamp the batch on the linked profile.
create or replace function public.confirm_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_course_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only admins can confirm payments.' using errcode = '42501';
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found.';
  end if;

  update public.payments
  set
    status = 'confirmed',
    confirmed_by = auth.uid(),
    confirmed_at = coalesce(v_payment.confirmed_at, now()),
    updated_at = now()
  where id = p_payment_id;

  -- Guest payments have no user_id yet. The invite/account-creation trigger
  -- links the payment and grants access once the account exists.
  if v_payment.user_id is null then
    return;
  end if;

  update public.profiles
  set
    tier = v_payment.tier,
    batch = coalesce(batch, v_payment.batch),
    updated_at = now()
  where id = v_payment.user_id;

  select id
  into v_course_id
  from public.courses
  where slug = 'ai-specialist-starter-bootcamp'
    and deleted_at is null
  order by created_at asc
  limit 1;

  if v_course_id is not null then
    insert into public.enrollments (
      user_id, course_id, tier, status, started_at, updated_at
    )
    values (v_payment.user_id, v_course_id, v_payment.tier, 'active', now(), now())
    on conflict (user_id, course_id) do update
    set
      tier = excluded.tier,
      status = 'active',
      expires_at = null,
      updated_at = now();
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Suspended / deactivated accounts lose content access (RLS level)
-- ---------------------------------------------------------------------------
create or replace function public.can_access_lesson(user_id uuid, lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(user_id)
    or (
      public.is_portal_active(user_id)
      and exists (
        select 1
        from public.lessons l
        join public.modules m on m.id = l.module_id
        join public.courses c on c.id = m.course_id
        join public.enrollments e on e.course_id = c.id
        where l.id = lesson_id
          and e.user_id = user_id
          and e.status = 'active'
          and (e.expires_at is null or e.expires_at > now())
          and c.is_active = true
          and c.deleted_at is null
          and m.is_active = true
          and m.deleted_at is null
          and l.is_active = true
          and l.deleted_at is null
          and public.can_access_tier(
            coalesce(e.tier, public.get_user_tier(user_id)),
            coalesce(l.required_tier, m.required_tier)
          )
      )
    );
$$;

drop policy if exists "Students can read enrolled active courses" on public.courses;
create policy "Students can read enrolled active courses"
on public.courses
for select
to authenticated
using (
  is_active = true
  and deleted_at is null
  and public.is_portal_active(auth.uid())
  and exists (
    select 1
    from public.enrollments e
    where e.course_id = courses.id
      and e.user_id = auth.uid()
      and e.status = 'active'
      and (e.expires_at is null or e.expires_at > now())
  )
);

drop policy if exists "Students can read accessible modules" on public.modules;
create policy "Students can read accessible modules"
on public.modules
for select
to authenticated
using (
  is_active = true
  and deleted_at is null
  and public.is_portal_active(auth.uid())
  and exists (
    select 1
    from public.enrollments e
    where e.course_id = modules.course_id
      and e.user_id = auth.uid()
      and e.status = 'active'
      and (e.expires_at is null or e.expires_at > now())
      and public.can_access_tier(e.tier, modules.required_tier)
  )
);

-- ---------------------------------------------------------------------------
-- 4) Lesson progress
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint lesson_progress_user_lesson_key unique (user_id, lesson_id)
);

create index if not exists lesson_progress_user_id_idx
  on public.lesson_progress (user_id);
create index if not exists lesson_progress_lesson_id_idx
  on public.lesson_progress (lesson_id);

alter table public.lesson_progress enable row level security;

drop policy if exists "Admins can manage lesson progress" on public.lesson_progress;
create policy "Admins can manage lesson progress"
on public.lesson_progress
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Students can read own lesson progress" on public.lesson_progress;
create policy "Students can read own lesson progress"
on public.lesson_progress
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Students can record own lesson progress" on public.lesson_progress;
create policy "Students can record own lesson progress"
on public.lesson_progress
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.can_access_lesson(auth.uid(), lesson_id)
);

drop policy if exists "Students can remove own lesson progress" on public.lesson_progress;
create policy "Students can remove own lesson progress"
on public.lesson_progress
for delete
to authenticated
using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5) Announcements + read state
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  body text,
  type text not null default 'general'
    check (type in ('general', 'update', 'event', 'reminder')),
  audience text not null default 'all'
    check (audience in ('all', 'tier', 'course', 'batch')),
  tier text check (tier is null or tier in ('basic', 'plus', 'pro')),
  course_id uuid references public.courses (id) on delete cascade,
  batch text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_published_idx
  on public.announcements (is_published, published_at desc);
create index if not exists announcements_course_id_idx
  on public.announcements (course_id);

drop trigger if exists set_announcements_updated_at on public.announcements;
create trigger set_announcements_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

alter table public.announcements enable row level security;

drop policy if exists "Admins can manage announcements" on public.announcements;
create policy "Admins can manage announcements"
on public.announcements
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Students can read visible announcements" on public.announcements;
create policy "Students can read visible announcements"
on public.announcements
for select
to authenticated
using (
  is_published = true
  and (published_at is null or published_at <= now())
  and public.is_portal_active(auth.uid())
  and (
    audience = 'all'
    or (
      audience = 'tier'
      and public.can_access_tier(public.get_user_tier(auth.uid()), tier)
    )
    or (
      audience = 'course'
      and course_id is not null
      and exists (
        select 1
        from public.enrollments e
        where e.course_id = announcements.course_id
          and e.user_id = auth.uid()
          and e.status = 'active'
          and (e.expires_at is null or e.expires_at > now())
      )
    )
    or (
      audience = 'batch'
      and batch is not null
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.batch is not null
          and lower(trim(p.batch)) = lower(trim(announcements.batch))
      )
    )
  )
);

create table if not exists public.announcement_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

alter table public.announcement_reads enable row level security;

drop policy if exists "Students can read own announcement reads" on public.announcement_reads;
create policy "Students can read own announcement reads"
on public.announcement_reads
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Students can record own announcement reads" on public.announcement_reads;
create policy "Students can record own announcement reads"
on public.announcement_reads
for insert
to authenticated
with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6) Live sessions
-- ---------------------------------------------------------------------------
create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  description text,
  mentor_name text,
  session_type text not null default 'live_class'
    check (session_type in ('live_class', 'qna', 'workshop', 'orientation', 'other')),
  audience text not null default 'all'
    check (audience in ('all', 'tier', 'course', 'batch')),
  tier text check (tier is null or tier in ('basic', 'plus', 'pro')),
  course_id uuid references public.courses (id) on delete set null,
  batch text,
  starts_at timestamptz not null,
  duration_minutes int not null default 60
    check (duration_minutes > 0 and duration_minutes <= 1440),
  meeting_url text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled', 'completed')),
  is_published boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_sessions_starts_at_idx
  on public.live_sessions (starts_at);

drop trigger if exists set_live_sessions_updated_at on public.live_sessions;
create trigger set_live_sessions_updated_at
before update on public.live_sessions
for each row execute function public.set_updated_at();

alter table public.live_sessions enable row level security;

drop policy if exists "Admins can manage live sessions" on public.live_sessions;
create policy "Admins can manage live sessions"
on public.live_sessions
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Students can read visible live sessions" on public.live_sessions;
create policy "Students can read visible live sessions"
on public.live_sessions
for select
to authenticated
using (
  is_published = true
  and public.is_portal_active(auth.uid())
  and (
    audience = 'all'
    or (
      audience = 'tier'
      and public.can_access_tier(public.get_user_tier(auth.uid()), tier)
    )
    or (
      audience = 'course'
      and course_id is not null
      and exists (
        select 1
        from public.enrollments e
        where e.course_id = live_sessions.course_id
          and e.user_id = auth.uid()
          and e.status = 'active'
          and (e.expires_at is null or e.expires_at > now())
      )
    )
    or (
      audience = 'batch'
      and batch is not null
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.batch is not null
          and lower(trim(p.batch)) = lower(trim(live_sessions.batch))
      )
    )
  )
);

-- ---------------------------------------------------------------------------
-- 7) Communities
-- ---------------------------------------------------------------------------
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  description text,
  platform text not null default 'facebook'
    check (platform in ('facebook', 'messenger', 'discord', 'whatsapp', 'other')),
  external_url text,
  mentor_name text,
  audience text not null default 'all'
    check (audience in ('all', 'tier', 'course', 'batch')),
  tier text check (tier is null or tier in ('basic', 'plus', 'pro')),
  course_id uuid references public.courses (id) on delete set null,
  batch text,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_communities_updated_at on public.communities;
create trigger set_communities_updated_at
before update on public.communities
for each row execute function public.set_updated_at();

alter table public.communities enable row level security;

drop policy if exists "Admins can manage communities" on public.communities;
create policy "Admins can manage communities"
on public.communities
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Students can read assigned communities" on public.communities;
create policy "Students can read assigned communities"
on public.communities
for select
to authenticated
using (
  is_active = true
  and public.is_portal_active(auth.uid())
  and (
    audience = 'all'
    or (
      audience = 'tier'
      and public.can_access_tier(public.get_user_tier(auth.uid()), tier)
    )
    or (
      audience = 'course'
      and course_id is not null
      and exists (
        select 1
        from public.enrollments e
        where e.course_id = communities.course_id
          and e.user_id = auth.uid()
          and e.status = 'active'
          and (e.expires_at is null or e.expires_at > now())
      )
    )
    or (
      audience = 'batch'
      and batch is not null
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.batch is not null
          and lower(trim(p.batch)) = lower(trim(communities.batch))
      )
    )
  )
);

-- ---------------------------------------------------------------------------
-- 8) Support requests
-- ---------------------------------------------------------------------------
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null check (length(trim(subject)) between 3 and 200),
  category text not null default 'general'
    check (category in ('general', 'course', 'payment', 'technical', 'account')),
  message text not null check (length(trim(message)) between 10 and 5000),
  course_id uuid references public.courses (id) on delete set null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_requests_user_id_idx
  on public.support_requests (user_id, created_at desc);
create index if not exists support_requests_status_idx
  on public.support_requests (status);

drop trigger if exists set_support_requests_updated_at on public.support_requests;
create trigger set_support_requests_updated_at
before update on public.support_requests
for each row execute function public.set_updated_at();

alter table public.support_requests enable row level security;

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

commit;

notify pgrst, 'reload schema';
