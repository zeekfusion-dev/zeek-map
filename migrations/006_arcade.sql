begin;
-- Paid rewards are retired. Keep historic points, but conservatively exclude
-- every historic paid/converted credit from wagers until free-earned thereafter.
update z_config set settings=settings||'{"subscription_z":0,"gift_z":0,"renewal_z":0,"kicks_enabled":false,"botrix_enabled":true}';
alter table z_users add column if not exists arcade_excluded numeric(18,2) not null default 0;
update z_users u set arcade_excluded=greatest(arcade_excluded,least(zs_balance,coalesce((select sum(amount) from z_transactions t where t.kick_user_id=u.kick_user_id and amount>0 and (reason in('New subscription','Subscription renewal','BotRix conversion') or reason like 'Gifted %subscription%' or reason like 'Sent %KICKs' or metadata->>'event' in('channel.subscription.new','channel.subscription.renewal','channel.subscription.gifts','kicks.gifted'))),0)));
create table if not exists z_games(id uuid primary key,kind text not null check(kind in('coin','plinko')),creator bigint not null references z_users,creator_name text not null,opponent bigint references z_users,opponent_name text,stake numeric(18,2) not null check(stake between 1 and 100 and stake=trunc(stake)),side text check(side in('heads','tails')),status text not null check(status in('open','resolved','cancelled')),winner bigint,winner_name text,result jsonb,payout numeric(18,2),created_at timestamptz not null default now(),resolved_at timestamptz);
create index if not exists z_games_recent on z_games(created_at desc);
create table if not exists z_activity(id bigint generated always as identity primary key,username text not null,kind text not null,title text not null,amount numeric(18,2),created_at timestamptz not null default now());
create index if not exists z_activity_recent on z_activity(created_at desc);
create or replace function z_arcade_move(p_user bigint,p_amount numeric,p_reason text,p_event text,p_earned numeric default 0) returns void language plpgsql security definer set search_path=public as $$declare u z_users;begin
 select * into u from z_users where kick_user_id=p_user for update;
 if u.kick_user_id is null then raise exception 'Insufficient Zs';end if;
 if exists(select 1 from z_transactions where kick_event_id=p_event) then return;end if;
 if p_amount<0 and u.zs_balance+p_amount<u.arcade_excluded then raise exception 'Insufficient free-earned Zs';end if;
 insert into z_transactions(kick_user_id,amount,reason,kick_event_id,metadata) values(p_user,p_amount,p_reason,p_event,'{"arcade":true}');
 update z_users set zs_balance=zs_balance+p_amount,lifetime_zs=lifetime_zs+greatest(0,p_earned),updated_at=now() where kick_user_id=p_user;
end$$;
create or replace function z_play(p_id uuid,p_user bigint,p_name text,p_kind text,p_stake numeric,p_side text default null,p_path jsonb default null) returns jsonb language plpgsql security definer set search_path=public as $$declare g z_games;slot integer;mult numeric;pay numeric;begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into g from z_games where id=p_id;
 if found then if g.creator<>p_user then raise exception 'Invalid request';end if;return to_jsonb(g);end if;
 if p_kind not in('coin','plinko') or p_stake is null or p_stake<1 or p_stake>100 or p_stake<>trunc(p_stake) then raise exception 'Invalid wager';end if;
 insert into z_users(kick_user_id,username) values(p_user,p_name) on conflict(kick_user_id) do nothing;
 perform 1 from z_users where kick_user_id=p_user for update;
 if exists(select 1 from z_games where creator=p_user and created_at>now()-interval '2 seconds') then raise exception 'Please wait a moment between games';end if;
 if p_kind='coin' then
  if p_side is null or p_side not in('heads','tails') then raise exception 'Choose heads or tails';end if;
  if (select count(*) from z_games where creator=p_user and status='open')>=5 then raise exception 'Maximum five open challenges';end if;
  perform z_arcade_move(p_user,-p_stake,'Coin Flip stake reserved','stake:'||p_id);
  insert into z_games(id,kind,creator,creator_name,stake,side,status) values(p_id,p_kind,p_user,p_name,p_stake,p_side,'open') returning * into g;
 else
  if p_path is null or jsonb_typeof(p_path)<>'array' or jsonb_array_length(p_path)<>8 then raise exception 'Invalid path';end if;
  if exists(select 1 from jsonb_array_elements(p_path) e where e not in('0'::jsonb,'1'::jsonb)) then raise exception 'Invalid path';end if;
  select sum(value::integer) into slot from jsonb_array_elements_text(p_path);
  mult:=(array[8,2,1.5,.75,.5,.75,1.5,2,8]::numeric[])[slot+1];pay:=round(p_stake*mult,2);
  perform z_arcade_move(p_user,-p_stake,'Plinko drop','stake:'||p_id);
  perform z_arcade_move(p_user,pay,'Plinko return','payout:'||p_id,greatest(0,pay-p_stake));
  insert into z_games(id,kind,creator,creator_name,stake,status,winner,winner_name,result,payout,resolved_at) values(p_id,p_kind,p_user,p_name,p_stake,'resolved',case when pay>p_stake then p_user end,case when pay>p_stake then p_name end,jsonb_build_object('path',p_path,'slot',slot,'multiplier',mult),pay,now()) returning * into g;
  insert into z_activity(username,kind,title,amount) values(p_name,'plinko','Plinko · '||mult||'× return',pay-p_stake);
 end if;
 return to_jsonb(g);end$$;
create or replace function z_coin_action(p_id uuid,p_user bigint,p_name text,p_cancel boolean,p_result text default null) returns jsonb language plpgsql security definer set search_path=public as $$declare g z_games;win bigint;winname text;begin
 select * into g from z_games where id=p_id for update;
 if g.id is null or g.kind<>'coin' then raise exception 'Challenge unavailable';end if;
 if g.status<>'open' then
  if (p_cancel and g.creator=p_user and g.status='cancelled') or (not p_cancel and g.opponent=p_user and g.status='resolved') then return to_jsonb(g);end if;
  raise exception 'Challenge already closed';
 end if;
 if p_cancel then
  if g.creator<>p_user then raise exception 'Invalid request';end if;
  perform z_arcade_move(p_user,g.stake,'Coin Flip stake returned','cancel:'||p_id);
  update z_games set status='cancelled',resolved_at=now() where id=p_id returning * into g;
 else
  if g.creator=p_user then raise exception 'You cannot accept your own challenge';end if;
  if p_result is null or p_result not in('heads','tails') then raise exception 'Invalid result';end if;
  insert into z_users(kick_user_id,username) values(p_user,p_name) on conflict(kick_user_id) do nothing;
  -- Stable account lock order prevents crossed challenges deadlocking.
  perform 1 from z_users where kick_user_id in(p_user,g.creator) order by kick_user_id for update;
  perform z_arcade_move(p_user,-g.stake,'Coin Flip stake reserved','accept:'||p_id);
  win:=case when p_result=g.side then g.creator else p_user end;winname:=case when win=g.creator then g.creator_name else p_name end;
  perform z_arcade_move(win,g.stake*2,'Coin Flip win','win:'||p_id,g.stake);
  update z_games set status='resolved',opponent=p_user,opponent_name=p_name,winner=win,winner_name=winname,result=jsonb_build_object('side',p_result),payout=stake*2,resolved_at=now() where id=p_id returning * into g;
  insert into z_activity(username,kind,title,amount) values(winname,'coin','Won Coin Flip against @'||case when win=g.creator then p_name else g.creator_name end,g.stake);
 end if;return to_jsonb(g);end$$;
-- Publish real earning/redemption events; game stakes and refunds are not wins.
create or replace function z_publish_activity() returns trigger language plpgsql security definer set search_path=public as $$declare n text;begin
 if coalesce((new.metadata->>'arcade')::boolean,false) then return new;end if;
 select username into n from z_users where kick_user_id=new.kick_user_id;
 if new.reason='Z Question winner' or new.reason like 'Redeemed:%' or new.reason='BotRix conversion' then
 insert into z_activity(username,kind,title,amount) values(coalesce(n,'Viewer'),case when new.reason='Z Question winner' then 'trivia' when new.amount<0 then 'redemption' else 'earning' end,new.reason,new.amount);
 end if;return new;end$$;
drop trigger if exists z_activity_ledger on z_transactions;
create trigger z_activity_ledger after insert on z_transactions for each row execute function z_publish_activity();
-- Prevent paid legacy webhooks from granting credits, including old deployments.
create or replace function z_block_paid() returns trigger language plpgsql as $$begin
 if new.amount>0 and (new.reason in('New subscription','Subscription renewal') or new.reason like 'Gifted %subscription%' or new.reason like 'Sent %KICKs' or new.metadata->>'event' in('channel.subscription.new','channel.subscription.renewal','channel.subscription.gifts','kicks.gifted')) then raise exception 'Paid activity cannot award Zs';end if;return new;end$$;
drop trigger if exists z_no_paid_credits on z_transactions;
create trigger z_no_paid_credits before insert on z_transactions for each row execute function z_block_paid();
alter table z_games enable row level security;alter table z_activity enable row level security;
revoke all on z_games,z_activity from anon,authenticated;
grant all on z_games,z_activity to service_role;
grant usage,select on sequence z_activity_id_seq to service_role;
do $$declare f record;begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('z_arcade_move','z_play','z_coin_action','z_publish_activity','z_block_paid') loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);end loop;end$$;
notify pgrst,'reload schema';
commit;
