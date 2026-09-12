begin;
create table z_rate_limits(key text primary key,window_start timestamptz not null,hits integer not null,expires_at timestamptz not null);
create function z_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path=public as $$declare hits integer;begin
 if p_key is null or length(p_key)<>64 or p_limit not between 1 and 10000 or p_seconds not between 1 and 3600 then raise exception 'Invalid limit';end if;
 insert into z_rate_limits values(p_key,clock_timestamp(),1,clock_timestamp()+make_interval(secs=>p_seconds))
 on conflict(key) do update set hits=case when z_rate_limits.expires_at<=clock_timestamp() then 1 else least(z_rate_limits.hits+1,p_limit+1) end,window_start=case when z_rate_limits.expires_at<=clock_timestamp() then clock_timestamp() else z_rate_limits.window_start end,expires_at=case when z_rate_limits.expires_at<=clock_timestamp() then clock_timestamp()+make_interval(secs=>p_seconds) else z_rate_limits.expires_at end returning z_rate_limits.hits into hits;
 if random()<0.01 then delete from z_rate_limits where key in(select key from z_rate_limits where expires_at<now()-interval '1 hour' limit 100);delete from z_webhook_receipts where id in(select id from z_webhook_receipts where created_at<now()-interval '1 day' limit 100);delete from z_sessions where token_hash in(select token_hash from z_sessions where expires_at<now() limit 100);end if;
 return hits<=p_limit;end$$;
create table z_webhook_receipts(id text primary key,created_at timestamptz not null default now());
create function z_process_chat(p_event text,p_user bigint,p_name text,p_message text,p_answer text,p_created timestamptz,p_balance boolean) returns boolean language plpgsql security definer set search_path=public as $$declare receipt text;won jsonb;begin
 if p_event is null or length(p_event)>200 or p_message is null or length(p_message)>200 or p_user is null or p_user<=0 or p_name is null or length(p_name)>100 or length(p_answer)>5000 or p_created is null or abs(extract(epoch from now()-p_created))>300 then raise exception 'Invalid event';end if;
 insert into z_webhook_receipts(id) values(p_event) on conflict do nothing returning id into receipt;if receipt is null then return false;end if;
 if p_balance then perform z_balance_command(p_user,p_name,p_message);return true;end if;
 won:=z_answer(p_user,p_name,p_answer,p_message,p_created);return won is not null;
end$$;
-- Defend the balance invariants even if a future function bypasses existing helpers.
alter table z_users add constraint z_nonnegative_balances check(zs_balance>=0 and lifetime_zs>=0) not valid;
alter table z_users validate constraint z_nonnegative_balances;
-- Refunds and redemptions must acquire reward locks before user locks.
do $$declare def text;begin
 select pg_get_functiondef('z_resolve_redemption(uuid,text,bigint)'::regprocedure) into def;
 if position('if p_status=''refunded'' then' in def)=0 then raise exception 'Refund function changed';end if;
 execute replace(def,'if p_status=''refunded'' then','if p_status=''refunded'' then perform 1 from z_rewards where id=r.reward_id for update;');
end$$;
-- Deny direct access, including old PUBLIC grants and legacy helpers.
do $$declare t record;f record;begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'z\_%' escape '\' loop
 execute format('alter table public.%I enable row level security',t.tablename);
 execute format('revoke all on public.%I from public,anon,authenticated',t.tablename);
 execute format('grant all on public.%I to service_role',t.tablename);
 end loop;
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and (p.proname like 'z\_%' escape '\' or p.proname='award_z') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end$$;
notify pgrst,'reload schema';
commit;
