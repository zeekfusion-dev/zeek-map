begin;
alter table z_games drop constraint z_games_stake_check;
alter table z_games add constraint z_games_stake_check check(stake>=1 and stake=trunc(stake));
alter table z_games drop constraint z_games_kind_check;
alter table z_games add constraint z_games_kind_check check(kind in('coin','dice','rps','plinko','higher','mines'));
create table z_rps_secrets(game_id uuid primary key references z_games,choice text not null check(choice in('rock','paper','scissors')));
alter table z_rps_secrets enable row level security;
revoke all on z_rps_secrets from public,anon,authenticated;
grant all on z_rps_secrets to service_role;
create or replace function z_play(p_id uuid,p_user bigint,p_name text,p_kind text,p_stake numeric,p_side text default null,p_path jsonb default null) returns jsonb language plpgsql security definer set search_path=public as $$declare g z_games;slot integer;mult numeric;pay numeric;begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into g from z_games where id=p_id;
 if found then if g.creator<>p_user then raise exception 'Invalid request';end if;return to_jsonb(g);end if;
 if p_kind not in('coin','dice','plinko') or p_stake is null or p_stake<1 or (p_kind='plinko' and p_stake>10) or p_stake<>trunc(p_stake) then raise exception 'Invalid wager';end if;
 insert into z_users(kick_user_id,username) values(p_user,p_name) on conflict(kick_user_id) do nothing;
 perform 1 from z_users where kick_user_id=p_user for update;
 if exists(select 1 from z_games where creator=p_user and created_at>now()-interval '2 seconds') then raise exception 'Please wait a moment between games';end if;
 if p_kind in('coin','dice') then
  if p_side is null or (p_kind='coin' and p_side not in('heads','tails')) or (p_kind='dice' and p_side not in('high','low')) then raise exception 'Choose heads or tails';end if;
  if (select count(*) from z_games where creator=p_user and status='open')>=5 then raise exception 'Maximum five open challenges';end if;
  perform z_arcade_move(p_user,-p_stake,'Head-to-head stake reserved','stake:'||p_id);
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
create or replace function z_run_start(p_id uuid,p_user bigint,p_name text,p_kind text,p_stake numeric,p_card integer,p_mines integer[]) returns jsonb language plpgsql security definer set search_path=public as $$declare g z_games;begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));select * into g from z_games where id=p_id;
 if found then if g.creator<>p_user then raise exception 'Invalid request';end if;return to_jsonb(g);end if;
 if p_kind not in('higher','mines') or p_stake is null or p_stake not between 1 and 10 or p_stake<>trunc(p_stake) then raise exception 'Invalid wager';end if;
 if p_kind='higher' and (p_card is null or p_card not between 1 and 13) then raise exception 'Invalid card';end if;
 if p_kind='mines' and (p_mines is null or cardinality(p_mines) not between 1 and 20 or exists(select 1 from unnest(p_mines) v where v not between 0 and 24) or (select count(distinct v) from unnest(p_mines)v)<>cardinality(p_mines)) then raise exception 'Invalid mines';end if;
 insert into z_users(kick_user_id,username) values(p_user,p_name) on conflict do nothing;
 perform 1 from z_users where kick_user_id=p_user for update;
 if exists(select 1 from z_games where creator=p_user and kind=p_kind and status='playing') then raise exception 'Finish your active game first';end if;
 if exists(select 1 from z_games where creator=p_user and created_at>now()-interval '2 seconds') then raise exception 'Please wait a moment between games';end if;
 perform z_arcade_move(p_user,-p_stake,'Arcade stake','stake:'||p_id);
 insert into z_games(id,kind,creator,creator_name,stake,status,result,payout) values(p_id,p_kind,p_user,p_name,p_stake,'playing',jsonb_build_object('card',case when p_kind='higher' then p_card end,'mines',case when p_kind='mines' then cardinality(p_mines) end,'revealed','[]'::jsonb,'multiplier',1,'version',0,'turns',0),p_stake) returning * into g;
 if p_kind='mines' then insert into z_run_secrets values(p_id,p_mines);end if;
 return to_jsonb(g);end$$;

create function z_rps_create(p_id uuid,p_user bigint,p_name text,p_stake numeric,p_choice text) returns jsonb language plpgsql security definer set search_path=public as $$declare g z_games;begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into g from z_games where id=p_id;
 if found then if g.creator<>p_user or g.kind<>'rps' then raise exception 'Invalid request';end if;return to_jsonb(g);end if;
 if p_stake is null or p_stake<1 or p_stake<>trunc(p_stake) then raise exception 'Invalid wager';end if;
 if p_choice is null or p_choice not in('rock','paper','scissors') then raise exception 'Choose rock, paper or scissors';end if;
 insert into z_users(kick_user_id,username) values(p_user,p_name) on conflict do nothing;
 perform 1 from z_users where kick_user_id=p_user for update;
 if exists(select 1 from z_games where creator=p_user and created_at>now()-interval '2 seconds') then raise exception 'Please wait a moment between games';end if;
 if (select count(*) from z_games where creator=p_user and status='open')>=5 then raise exception 'Maximum five open challenges';end if;
 perform z_arcade_move(p_user,-p_stake,'RPS stake reserved','stake:'||p_id);
 insert into z_games(id,kind,creator,creator_name,stake,status) values(p_id,'rps',p_user,p_name,p_stake,'open') returning * into g;
 insert into z_rps_secrets values(p_id,p_choice);return to_jsonb(g);
end$$;
create function z_rps_action(p_id uuid,p_user bigint,p_name text,p_cancel boolean,p_choice text default null) returns jsonb language plpgsql security definer set search_path=public as $$declare g z_games;firstchoice text;win bigint;winname text;tied boolean;begin
 select * into g from z_games where id=p_id for update;
 if g.id is null or g.kind<>'rps' then raise exception 'Challenge unavailable';end if;
 if g.status<>'open' then
  if (p_cancel and g.creator=p_user and g.status='cancelled') or (not p_cancel and g.opponent=p_user and g.status='resolved') then return to_jsonb(g);end if;
  raise exception 'Challenge already closed';
 end if;
 if p_cancel then
  if g.creator<>p_user then raise exception 'Invalid request';end if;
  perform z_arcade_move(p_user,g.stake,'RPS stake returned','cancel:'||p_id);
  update z_games set status='cancelled',resolved_at=now() where id=p_id returning * into g;
 else
  if g.creator=p_user then raise exception 'You cannot accept your own challenge';end if;
  if p_choice is null or p_choice not in('rock','paper','scissors') then raise exception 'Choose rock, paper or scissors';end if;
  insert into z_users(kick_user_id,username) values(p_user,p_name) on conflict do nothing;
  perform 1 from z_users where kick_user_id in(p_user,g.creator) order by kick_user_id for update;
  perform z_arcade_move(p_user,-g.stake,'RPS stake reserved','accept:'||p_id);
  select choice into firstchoice from z_rps_secrets where game_id=p_id;
  tied:=firstchoice=p_choice;
  if tied then
   perform z_arcade_move(g.creator,g.stake,'RPS tie refund','tie-creator:'||p_id);
   perform z_arcade_move(p_user,g.stake,'RPS tie refund','tie-opponent:'||p_id);
  else
   win:=case when (firstchoice='rock' and p_choice='scissors') or(firstchoice='paper' and p_choice='rock') or(firstchoice='scissors' and p_choice='paper') then g.creator else p_user end;
   winname:=case when win=g.creator then g.creator_name else p_name end;
   perform z_arcade_move(win,g.stake*2,'RPS win','win:'||p_id,g.stake);
  end if;
  update z_games set status='resolved',opponent=p_user,opponent_name=p_name,winner=win,winner_name=winname,result=jsonb_build_object('choices',jsonb_build_array(firstchoice,p_choice),'tie',tied),payout=case when tied then stake else stake*2 end,resolved_at=now() where id=p_id returning * into g;
  insert into z_activity(username,kind,title,amount) values(coalesce(winname,g.creator_name),'rps',case when tied then 'RPS tie with @'||p_name||' · both wagers returned' else 'Won Rock Paper Scissors against @'||case when win=g.creator then p_name else g.creator_name end end,case when tied then 0 else g.stake end);
 end if;
 return to_jsonb(g);
end$$;
create function z_manage_users(p_actor bigint,p_query text,p_offset integer default 0) returns jsonb language plpgsql security definer set search_path=public as $$begin
 if p_actor is distinct from 20306616::bigint then raise exception 'Owner required';end if;
 if p_offset<0 then raise exception 'Invalid page';end if;
 return (select coalesce(jsonb_agg(t),'[]') from(select kick_user_id,username,zs_balance,lifetime_zs from z_users where strpos(lower(username),lower(left(coalesce(p_query,''),100)))>0 order by lower(username),kick_user_id limit 25 offset p_offset)t);
end$$;
create function z_manage_history(p_actor bigint,p_query text,p_offset integer default 0) returns jsonb language plpgsql security definer set search_path=public as $$begin
 if p_actor is distinct from 20306616::bigint then raise exception 'Owner required';end if;
 if p_offset<0 then raise exception 'Invalid page';end if;
 return (select coalesce(jsonb_agg(t),'[]') from(select l.id,l.created_at,u.username,l.details->>'amount' as amount,l.details->>'reason' as reason,l.details->>'balance_after' as balance_after from z_admin_log l left join z_users u on u.kick_user_id=(l.details->>'user')::bigint where l.action='balance_adjustment' and strpos(lower(coalesce(u.username,'')||' '||coalesce(l.details->>'reason','')),lower(left(coalesce(p_query,''),100)))>0 order by l.id desc limit 25 offset p_offset)t);
end$$;
create or replace function z_admin_adjust(p_actor bigint,p_user bigint,p_name text,p_amount numeric,p_reason text,p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$declare result jsonb;u z_users;begin
 if p_actor is distinct from 20306616::bigint or p_reason is null or length(trim(p_reason))<3 then raise exception 'Owner and reason required';end if;
 if p_amount is null or p_amount=0 or p_amount<>round(p_amount,2) then raise exception 'Invalid adjustment';end if;
 perform pg_advisory_xact_lock(hashtextextended('admin:'||p_id,0));
 if exists(select 1 from z_transactions where kick_event_id='admin:'||p_id and kick_user_id<>p_user) then raise exception 'Invalid request';end if;
 select * into u from z_users where kick_user_id=p_user for update;
 if not found then raise exception 'User not found';end if;
 if not exists(select 1 from z_transactions where kick_event_id='admin:'||p_id) then
  if u.zs_balance+p_amount<0 then raise exception 'Insufficient Zs';end if;
  insert into z_transactions(kick_user_id,amount,reason,kick_event_id,metadata) values(p_user,p_amount,p_reason,'admin:'||p_id,jsonb_build_object('manual',true));
  update z_users set zs_balance=zs_balance+p_amount,lifetime_zs=lifetime_zs+greatest(p_amount,0),arcade_excluded=least(arcade_excluded,zs_balance+p_amount),updated_at=now() where kick_user_id=p_user;
  result:='{"awarded":true}';else result:='{"awarded":false}';end if;
 if (result->>'awarded')::boolean then insert into z_admin_log(actor,action,details) values(p_actor,'balance_adjustment',jsonb_build_object('user',p_user,'username',u.username,'amount',p_amount,'reason',p_reason,'balance_before',u.zs_balance,'balance_after',(select zs_balance from z_users where kick_user_id=p_user)));end if;
 return (select jsonb_build_object('kick_user_id',kick_user_id,'username',username,'zs_balance',zs_balance,'lifetime_zs',lifetime_zs) from z_users where kick_user_id=p_user);
end$$;
do $$declare f record;begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('z_rps_create','z_rps_action','z_manage_users','z_manage_history','z_admin_adjust') loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);end loop;end$$;
notify pgrst,'reload schema';commit;
