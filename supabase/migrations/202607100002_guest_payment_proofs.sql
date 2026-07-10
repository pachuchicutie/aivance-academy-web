-- Guest-friendly payment proofs for the public website (Basic tier bootcamp).
-- Allows submissions without a user account. Admin confirms later and sends
-- a registration invite link to the submitted email.

-- ---------------------------------------------------------------------------
-- Extend payments for guest identity + batch context
-- ---------------------------------------------------------------------------
alter table public.payments
  alter column user_id drop not null;

alter table public.payments
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists contact_number text,
  add column if not exists batch text,
  add column if not exists payment_method_id uuid references public.payment_methods (id) on delete set null;

-- Either a linked account or guest identity (name + email) must be present.
alter table public.payments
  drop constraint if exists payments_identity_check;

alter table public.payments
  add constraint payments_identity_check
  check (
    user_id is not null
    or (
      full_name is not null
      and length(trim(full_name)) > 0
      and email is not null
      and length(trim(email)) > 0
    )
  );

create index if not exists payments_email_idx on public.payments (email);
create index if not exists payments_batch_idx on public.payments (batch);
create index if not exists payments_payment_method_id_idx
  on public.payments (payment_method_id);

-- ---------------------------------------------------------------------------
-- Public can read active payment methods (display where to pay)
-- ---------------------------------------------------------------------------
drop policy if exists "Public can read active payment methods" on public.payment_methods;
create policy "Public can read active payment methods"
on public.payment_methods
for select
to anon, authenticated
using (is_active = true or public.is_admin(auth.uid()));

-- Keep the older authenticated-only policy if present, but public policy covers guests.
drop policy if exists "Authenticated users can read active payment methods" on public.payment_methods;

-- ---------------------------------------------------------------------------
-- Storage bucket for guest payment receipts / screenshots
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  true,
  8388608,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read payment proofs" on storage.objects;
create policy "Anyone can read payment proofs"
on storage.objects
for select
to public
using (bucket_id = 'payment-proofs');

drop policy if exists "Anyone can upload guest payment proofs" on storage.objects;
create policy "Anyone can upload guest payment proofs"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = 'guest'
);

drop policy if exists "Admins can manage payment proofs" on storage.objects;
create policy "Admins can manage payment proofs"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'payment-proofs'
  and public.is_admin(auth.uid())
)
with check (
  bucket_id = 'payment-proofs'
  and public.is_admin(auth.uid())
);

-- ---------------------------------------------------------------------------
-- Secure guest submit function (always status = pending, no access unlock)
-- ---------------------------------------------------------------------------
create or replace function public.submit_guest_payment_proof(
  p_full_name text,
  p_email text,
  p_reference_number text,
  p_proof_url text,
  p_payment_method text,
  p_batch text,
  p_amount numeric default 1999,
  p_contact_number text default null,
  p_notes text default null,
  p_payment_method_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_full_name text := trim(coalesce(p_full_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_reference text := trim(coalesce(p_reference_number, ''));
  v_proof text := trim(coalesce(p_proof_url, ''));
  v_method text := trim(coalesce(p_payment_method, ''));
  v_batch text := trim(coalesce(p_batch, ''));
  v_contact text := nullif(trim(coalesce(p_contact_number, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
begin
  if v_full_name = '' then
    raise exception 'Full name is required.' using errcode = '22023';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'A valid email address is required.' using errcode = '22023';
  end if;

  if v_reference = '' then
    raise exception 'Reference number is required.' using errcode = '22023';
  end if;

  if v_proof = '' then
    raise exception 'Payment receipt image is required.' using errcode = '22023';
  end if;

  if v_method = '' then
    raise exception 'Payment method is required.' using errcode = '22023';
  end if;

  if v_batch = '' then
    raise exception 'Batch selection is required.' using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero.' using errcode = '22023';
  end if;

  insert into public.payments (
    user_id,
    full_name,
    email,
    contact_number,
    batch,
    amount,
    tier,
    payment_method,
    payment_method_id,
    reference_number,
    proof_url,
    notes,
    status
  )
  values (
    null,
    v_full_name,
    v_email,
    v_contact,
    v_batch,
    p_amount,
    'basic',
    v_method,
    p_payment_method_id,
    v_reference,
    v_proof,
    v_notes,
    'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.submit_guest_payment_proof(
  text, text, text, text, text, text, numeric, text, text, uuid
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Confirm payment: skip tier/enrollment when no linked account yet
-- ---------------------------------------------------------------------------
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

  -- Guest payments have no user_id yet. Admin should email a registration link;
  -- access is granted when the account is created and linked later.
  if v_payment.user_id is null then
    return;
  end if;

  update public.profiles
  set
    tier = v_payment.tier,
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
      user_id,
      course_id,
      tier,
      status,
      started_at,
      updated_at
    )
    values (
      v_payment.user_id,
      v_course_id,
      v_payment.tier,
      'active',
      now(),
      now()
    )
    on conflict (user_id, course_id) do update
    set
      tier = excluded.tier,
      status = 'active',
      expires_at = null,
      updated_at = now();
  end if;
end;
$$;
