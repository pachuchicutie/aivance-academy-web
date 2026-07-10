-- Public batch seat status for the marketing site.
-- Counts reserved seats from guest/user payments (pending + confirmed).
-- Rejected / refunded payments free a seat.

create or replace function public.get_public_batch_seats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_limit int := 25;
  v_batch1 int := 0;
  v_batch2 int := 0;
begin
  select count(*)::int
  into v_batch1
  from public.payments
  where status in ('pending', 'confirmed')
    and batch is not null
    and (
      lower(trim(batch)) in ('batch 1', 'batch1', 'batch-1', '1')
      or lower(trim(batch)) like 'batch 1%'
    );

  select count(*)::int
  into v_batch2
  from public.payments
  where status in ('pending', 'confirmed')
    and batch is not null
    and (
      lower(trim(batch)) in ('batch 2', 'batch2', 'batch-2', '2')
      or lower(trim(batch)) like 'batch 2%'
    );

  return jsonb_build_object(
    'seat_limit', v_limit,
    'batches', jsonb_build_object(
      '1', jsonb_build_object(
        'filled', v_batch1,
        'remaining', greatest(v_limit - v_batch1, 0),
        'percent', least(round((v_batch1::numeric / v_limit) * 100), 100)
      ),
      '2', jsonb_build_object(
        'filled', v_batch2,
        'remaining', greatest(v_limit - v_batch2, 0),
        'percent', least(round((v_batch2::numeric / v_limit) * 100), 100)
      )
    )
  );
end;
$$;

grant execute on function public.get_public_batch_seats() to anon, authenticated;

comment on function public.get_public_batch_seats() is
  'Public seat occupancy for Batch 1/2 based on pending + confirmed payments.';
