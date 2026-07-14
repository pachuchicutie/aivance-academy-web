-- Ensure guest identity columns exist and submit_guest_payment_proof
-- always persists full_name / email, returning the saved values for verification.

alter table public.payments
  alter column user_id drop not null;

alter table public.payments
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists contact_number text,
  add column if not exists batch text,
  add column if not exists payment_method_id uuid references public.payment_methods (id) on delete set null;

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

-- Return type changes from uuid -> jsonb; drop old signature first.
drop function if exists public.submit_guest_payment_proof(
  text, text, text, text, text, text, numeric, text, text, uuid
);

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
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text := trim(coalesce(p_full_name, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_reference text := trim(coalesce(p_reference_number, ''));
  v_proof text := trim(coalesce(p_proof_url, ''));
  v_method text := trim(coalesce(p_payment_method, ''));
  v_batch text := trim(coalesce(p_batch, ''));
  v_contact text := nullif(trim(coalesce(p_contact_number, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_row public.payments%rowtype;
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
  returning * into v_row;

  if v_row.full_name is null or length(trim(v_row.full_name)) = 0 then
    raise exception 'Failed to save full name on payment record.' using errcode = '23502';
  end if;

  if v_row.email is null or length(trim(v_row.email)) = 0 then
    raise exception 'Failed to save email on payment record.' using errcode = '23502';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'full_name', v_row.full_name,
    'email', v_row.email,
    'contact_number', v_row.contact_number,
    'batch', v_row.batch,
    'reference_number', v_row.reference_number,
    'status', v_row.status,
    'amount', v_row.amount,
    'tier', v_row.tier
  );
end;
$$;

grant execute on function public.submit_guest_payment_proof(
  text, text, text, text, text, text, numeric, text, text, uuid
) to anon, authenticated;

notify pgrst, 'reload schema';
