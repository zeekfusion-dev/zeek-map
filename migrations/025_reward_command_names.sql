begin;
alter table z_rewards add column command_name text;
-- Seed existing rewards from their current names; disambiguate collisions without deleting rewards.
do $$declare r record;candidate text;base text;n integer;begin
 for r in select id,title from z_rewards order by created_at,id loop
  base:=left(lower(btrim(regexp_replace(r.title,'[[:space:]]+',' ','g'))),80);if base='' then base:='reward';end if;candidate:=base;n:=1;
  while exists(select 1 from z_rewards where lower(command_name)=candidate) loop n:=n+1;candidate:=left(base,70)||' '||n::text;end loop;
  update z_rewards set command_name=candidate where id=r.id;
 end loop;
end$$;
alter table z_rewards alter column command_name set not null;
alter table z_rewards add constraint z_rewards_command_name_valid check(length(command_name) between 1 and 80 and command_name=btrim(regexp_replace(command_name,'[[:space:]]+',' ','g')) and command_name !~ '[[:cntrl:]]' and command_name !~* '^!buy([[:space:]]|$)');
create unique index z_rewards_command_name_unique on z_rewards(lower(command_name));
-- Both website purchases and chat commands call z_redeem. No second ledger or alert path.
create or replace function z_process_command(p_event text,p_user bigint,p_name text,p_message text,p_created timestamptz,p_command text,p_argument text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare receipt text;reward uuid;matches integer;purchase jsonb;reply text;request_id uuid;begin
 if p_event is null or length(p_event) not between 1 and 200 or p_message is null or length(p_message) not between 1 and 200 or p_user is null or p_user<=0 or p_name is null or length(p_name) not between 1 and 100 or p_created is null or abs(extract(epoch from now()-p_created))>300 or p_command is null or p_command not in('balance','buy','help') or p_argument is null or length(p_argument)>5000 then raise exception 'Invalid event';end if;
 insert into z_webhook_receipts(id) values(p_event) on conflict do nothing returning id into receipt;
 if receipt is null then return false;end if;
 update z_runtime set last_webhook_at=now() where id=1;
 receipt:=null;
 insert into z_webhook_receipts(id) values('chat-command:'||p_message) on conflict do nothing returning id into receipt;
 if receipt is null then return false;end if;
 if p_command='help' then
  if length(p_argument)>490 or not z_rate_limit(encode(sha256(convert_to('chat-help:'||p_user::text,'UTF8')),'hex'),1,30) then return false;end if;
  insert into z_outbox(dedupe,content) values('help:'||p_message,p_argument) on conflict(dedupe) do nothing;
  return true;
 end if;
 if p_command='balance' then perform z_balance_command(p_user,p_name,p_message);return true;end if;
 if not z_rate_limit(encode(sha256(convert_to('chat-buy:'||p_user::text,'UTF8')),'hex'),10,60) then return false;end if;
 if length(btrim(p_argument)) not between 1 and 80 then reply:='Use !buy <command name>, for example !buy hydrate.';
 else
  select count(*),(array_agg(id order by id))[1] into matches,reward from z_rewards where enabled and lower(command_name)=lower(btrim(regexp_replace(p_argument,'[[:space:]]+',' ','g')));
  if matches=0 then reply:='Reward not found. Find available rewards at https://www.zeekfusion.com/#/market';
  elsif matches>1 then reply:='More than one reward has that name. Please ask Zeek to give them unique names.';
  else
   request_id:=md5('kick-reward:'||p_message)::uuid;
   begin
    purchase:=z_redeem(p_user,p_name,reward,request_id);
    reply:='Redeemed '||(purchase->>'title')||' for '||z_label((purchase->>'cost')::numeric)||'. Your stream alert is queued!';
   exception when raise_exception then
    if sqlerrm='Insufficient Zs' then reply:='Not enough Zs for that reward. Use !z to check your balance.';
    elsif sqlerrm='Reward unavailable' then reply:='That reward is unavailable or sold out.';
    elsif sqlerrm='Reward is cooling down. Please try again shortly.' then reply:=sqlerrm;
    else raise;end if;
   end;
  end if;
 end if;
 insert into z_outbox(dedupe,content) values('buy:'||p_message,'@'||p_name||' — '||reply) on conflict(dedupe) do nothing;
 return true;
end$$;
revoke all on function z_process_command(text,bigint,text,text,timestamptz,text,text) from public,anon,authenticated;
grant execute on function z_process_command(text,bigint,text,text,timestamptz,text,text) to service_role;
notify pgrst,'reload schema';
commit;
