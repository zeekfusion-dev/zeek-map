begin;
create or replace function public.z_balance_command(p_user bigint,p_name text,p_message text) returns void language plpgsql security definer set search_path=public as $$declare b numeric;ok bigint;begin
 insert into z_command_limits values(p_user,now()) on conflict(kick_user_id) do update set last_at=now() where z_command_limits.last_at<now()-interval '30 seconds' returning kick_user_id into ok;
 if ok is null then return;end if;
 select zs_balance into b from z_users where kick_user_id=p_user;
 insert into z_outbox(dedupe,content) values('command:'||p_message,'⚡ @'||p_name||' — '||z_label(coalesce(b,0))||'. Visit https://www.zeekfusion.com/#/market') on conflict(dedupe) do nothing;end$$;



notify pgrst,'reload schema';
commit;
