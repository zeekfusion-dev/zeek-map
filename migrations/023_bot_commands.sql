begin;
create or replace function public.z_balance_command(p_user bigint,p_name text,p_message text) returns void language plpgsql security definer set search_path=public as $$declare b numeric;ok bigint;begin
 insert into z_command_limits values(p_user,now()) on conflict(kick_user_id) do update set last_at=now() where z_command_limits.last_at<now()-interval '30 seconds' returning kick_user_id into ok;
 if ok is null then return;end if;
 select zs_balance into b from z_users where kick_user_id=p_user;
 insert into z_outbox(dedupe,content) values('command:'||p_message,'⚡ @'||p_name||' — '||z_label(coalesce(b,0))||'. Visit zeekfusion.com/#/market') on conflict(dedupe) do nothing;end$$;


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
 if length(btrim(p_argument)) not between 1 and 80 then reply:='Use !buy <reward name>, for example !buy Airhorn.';
 else
  select count(*),(array_agg(id order by id))[1] into matches,reward from z_rewards where enabled and lower(title)=lower(btrim(p_argument));
  if matches=0 then reply:='Reward not found. Find available rewards at zeekfusion.com/#/market';
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
