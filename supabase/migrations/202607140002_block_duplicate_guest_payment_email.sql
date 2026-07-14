-- Reject guest payment proofs when the email already has an active payment
-- (pending/confirmed) or an existing student account.

create or replace function public.get_guest_payment_email_status(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_existing_status text;
  v_profile_exists boolean := false;
begin
  if v_email = '' or position('@' in v_email) = 0 then
    return jsonb_build_object(
      'available', false,
      'code', 'invalid_email',
      'message', 'A valid email address is required.'
    );
  end if;

  select exists (
    select 1
    from public.profiles p
    where lower(trim(coalesce(p.email, ''))) = v_email
  )
  into v_profile_exists;

  if v_profile_exists then
    return jsonb_build_object(
      'available', false,
      'code', 'account_exists',
      'message',
        'This email already has an account. Please sign in instead of submitting another payment proof.'
    );
  end if;

  select pay.status
  into v_existing_status
  from public.payments pay
  where lower(trim(coalesce(pay.email, ''))) = v_email
    and pay.status in ('pending', 'confirmed')
  order by
    case pay.status
      when 'confirmed' then 0
      when 'pending' then 1
      else 2
    end,
    pay.created_at desc
  limit 1;

  if found then
    if v_existing_status = 'confirmed' then
      return jsonb_build_object(
        'available', false,
        'code', 'payment_confirmed',
        'message',
          'A payment for this email was already confirmed. You cannot submit another payment with the same email.'
      );
    end if;

    return jsonb_build_object(
      'available', false,
      'code', 'payment_pending',
      'message',
        'A payment proof for this email is already pending review. Please wait for confirmation instead of submitting again.'
    );
  end if;

  return jsonb_build_object(
    'available', true,
    'code', 'ok',
    'message', null
  );
end;
$$;

grant execute on function public.get_guest_payment_email_status(text)
to anon, authenticated;

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
  v_existing_status text;
  v_profile_exists boolean := false;
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

  -- Already registered as a student/admin account
  select exists (
    select 1
    from public.profiles p
    where lower(trim(coalesce(p.email, ''))) = v_email
  )
  into v_profile_exists;

  if v_profile_exists then
    raise exception
      'This email already has an account. Please sign in instead of submitting another payment proof.'
      using errcode = '23505';
  end if;

  -- Already has an active payment proof (pending review or confirmed)
  select pay.status
  into v_existing_status
  from public.payments pay
  where lower(trim(coalesce(pay.email, ''))) = v_email
    and pay.status in ('pending', 'confirmed')
  order by
    case pay.status
      when 'confirmed' then 0
      when 'pending' then 1
      else 2
    end,
    pay.created_at desc
  limit 1;

  if found then
    if v_existing_status = 'confirmed' then
      raise exception
        'A payment for this email was already confirmed. You cannot submit another payment with the same email.'
        using errcode = '23505';
    end if;

    raise exception
      'A payment proof for this email is already pending review. Please wait for confirmation instead of submitting again.'
      using errcode = '23505';
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
