begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create or replace function public.z_dispatch_tick() returns void language plpgsql security definer set search_path=public as $$declare t uuid;begin
 delete from z_tick_tokens where expires_at<now();
 delete from z_sessions where expires_at<now();
 if not exists(select 1 from z_bot where id=1) then return;end if;
 insert into z_tick_tokens default values returning token into t;
 perform net.http_post(url:='https://www.zeekfusion.com/api/z/tick',headers:=jsonb_build_object('Content-Type','application/json','x-z-tick',t::text),body:='{}',timeout_milliseconds:=60000);
end$$;
revoke all on function public.z_dispatch_tick() from public,anon,authenticated;
grant execute on function public.z_dispatch_tick() to service_role;
select cron.schedule('zeek-z-question-tick','* * * * *','select public.z_dispatch_tick()');
commit;
