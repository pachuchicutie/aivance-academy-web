-- Restrict student ticket updates: mark-read via RPC only (no free-form column edits).

begin;

drop policy if exists "Students can update own support requests" on public.support_requests;

create or replace function public.mark_support_ticket_read(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.support_requests
  set student_last_read_at = greatest(coalesce(student_last_read_at, 'epoch'::timestamptz), now()),
      updated_at = now()
  where id = p_ticket_id
    and user_id = auth.uid();
end;
$$;

grant execute on function public.mark_support_ticket_read(uuid) to authenticated;

create or replace function public.admin_mark_support_ticket_read(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not authorized';
  end if;

  update public.support_requests
  set admin_last_read_at = greatest(coalesce(admin_last_read_at, 'epoch'::timestamptz), now()),
      updated_at = now()
  where id = p_ticket_id;
end;
$$;

grant execute on function public.admin_mark_support_ticket_read(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
