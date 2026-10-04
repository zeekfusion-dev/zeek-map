begin;
alter table public.z_runtime
 add column if not exists chat_subscription_checked_at timestamptz,
 add column if not exists chat_subscription_repaired_at timestamptz,
 add column if not exists chat_subscription_error text;
commit;
