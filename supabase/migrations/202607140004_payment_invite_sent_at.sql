-- Track when guest registration invite emails were sent after payment confirm.

alter table public.payments
  add column if not exists invite_sent_at timestamptz;

comment on column public.payments.invite_sent_at is
  'Last time a registration invite email was sent for this guest payment.';
