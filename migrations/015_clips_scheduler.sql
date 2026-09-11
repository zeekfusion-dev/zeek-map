-- Run after 014 on Supabase, where pg_cron and pg_net are already installed.
begin;
create table z_social_tick_tokens(token uuid primary key default gen_random_uuid(),expires_at timestamptz not null default now()+interval '2 minutes');
alter table z_social_tick_tokens enable row level security;
revoke all on z_social_tick_tokens from public,anon,authenticated;
grant all on z_social_tick_tokens to service_role;
create function z_consume_social_tick(p_token uuid) returns boolean language plpgsql security definer set search_path=public as $$declare t uuid;begin delete from z_social_tick_tokens where token=p_token and expires_at>now() returning token into t;return t is not null;end$$;
create function z_dispatch_social_tick() returns void language plpgsql security definer set search_path=public as $$declare t uuid;begin
 delete from z_social_tick_tokens where expires_at<now();
 if not exists(select 1 from z_social_connections where token_cipher is not null and (cursor is not null or last_sync is null or last_sync<now()-interval '6 hours')) then return;end if;
 insert into z_social_tick_tokens default values returning token into t;
 perform net.http_post(url:='https://www.zeekfusion.com/api/clips?job=sync',headers:=jsonb_build_object('Content-Type','application/json','x-clips-tick',t::text),body:='{}',timeout_milliseconds:=60000);
end$$;
revoke all on function z_consume_social_tick(uuid),z_dispatch_social_tick() from public,anon,authenticated;
grant execute on function z_consume_social_tick(uuid) to service_role;
select cron.schedule('zeek-clips-sync','*/5 * * * *','select public.z_dispatch_social_tick()');
notify pgrst,'reload schema';commit;
