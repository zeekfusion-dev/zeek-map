begin;
update z_config set settings=settings-'botrix_weekly_cap_z';
alter table z_games drop constraint z_games_kind_check;
alter table z_games add constraint z_games_kind_check check(kind in('coin','dice','plinko','higher','mines'));
alter table z_games drop constraint z_games_side_check;
alter table z_games add constraint z_games_side_check check(side in('heads','tails','high','low'));
alter table z_games drop constraint z_games_status_check;
alter table z_games add constraint z_games_status_check check(status in('open','playing','resolved','cancelled'));
create unique index z_one_active_game on z_games(creator,kind) where status='playing';
create table z_run_secrets(game_id uuid primary key references z_games,tiles integer[] not null);
create table z_game_steps(id uuid primary key,game_id uuid not null references z_games,actor bigint not null,response jsonb not null);
alter table z_run_secrets enable row level security;alter table z_game_steps enable row level security;
revoke all on z_run_secrets,z_game_steps from anon,authenticated;grant all on z_run_secrets,z_game_steps to service_role;
create or replace function z_play(p_id uuid,p_user bigint,p_name text,p_kind text,p_stake numeric,p_side text default null,p_path jsonb default null) returns jsonb language plpgsql security definer set search_path=public as $$declare g z_games;slot integer;mult numeric;pay numeric;begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into g from z_games where id=p_id;
 if found then if g.creator<>p_user then raise exception 'Invalid request';end if;return to_jsonb(g);end if;
 if p_kind not in('coin','dice','plinko') or p_stake is null or p_stake<1 or p_stake>100 or p_stake<>trunc(p_stake) then raise exception 'Invalid wager';end if;
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
create or replace function z_coin_action(p_id uuid,p_user bigint,p_name text,p_cancel boolean,p_result text default null) returns jsonb language plpgsql security definer set search_path=public as $$declare g z_games;win bigint;winname text;dice jsonb;outcome jsonb;begin
 select * into g from z_games where id=p_id for update;
 if g.id is null or g.kind not in('coin','dice') then raise exception 'Challenge unavailable';end if;
 if g.status<>'open' then
  if (p_cancel and g.creator=p_user and g.status='cancelled') or (not p_cancel and g.opponent=p_user and g.status='resolved') then return to_jsonb(g);end if;
  raise exception 'Challenge already closed';
 end if;
 if p_cancel then
  if g.creator<>p_user then raise exception 'Invalid request';end if;
  perform z_arcade_move(p_user,g.stake,'Head-to-head stake returned','cancel:'||p_id);
  update z_games set status='cancelled',resolved_at=now() where id=p_id returning * into g;
 else
  if g.creator=p_user then raise exception 'You cannot accept your own challenge';end if;
  if g.kind='dice' then dice:=p_result::jsonb;if jsonb_array_length(dice)<>2 or (dice->>0)::integer not between 1 and 6 or (dice->>1)::integer not between 1 and 6 or dice->>0=dice->>1 then raise exception 'Invalid result';end if;outcome:=jsonb_build_object('dice',dice);p_result:=case when (dice->>0)::integer>(dice->>1)::integer then 'high' else 'low' end;else if p_result is null or p_result not in('heads','tails') then raise exception 'Invalid result';end if;outcome:=jsonb_build_object('side',p_result);end if;
  insert into z_users(kick_user_id,username) values(p_user,p_name) on conflict(kick_user_id) do nothing;
  -- Stable account lock order prevents crossed challenges deadlocking.
  perform 1 from z_users where kick_user_id in(p_user,g.creator) order by kick_user_id for update;
  perform z_arcade_move(p_user,-g.stake,'Head-to-head stake reserved','accept:'||p_id);
  win:=case when p_result=g.side then g.creator else p_user end;winname:=case when win=g.creator then g.creator_name else p_name end;
  perform z_arcade_move(win,g.stake*2,'Head-to-head win','win:'||p_id,g.stake);
  update z_games set status='resolved',opponent=p_user,opponent_name=p_name,winner=win,winner_name=winname,result=outcome,payout=stake*2,resolved_at=now() where id=p_id returning * into g;
  insert into z_activity(username,kind,title,amount) values(winname,g.kind,'Won '||case when g.kind='dice' then 'Dice Duel' else 'Coin Flip' end||' against @'||case when win=g.creator then p_name else g.creator_name end,g.stake);
 end if;return to_jsonb(g);end$$;
create or replace function public.z_conversion(p_user bigint,p_name text,p_points integer,p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$declare c jsonb;amount numeric;x z_conversion_tickets;begin
 perform pg_advisory_xact_lock(p_user);
 select * into x from z_conversion_tickets where id=p_id;if x.id is not null then if x.kick_user_id<>p_user then raise exception 'Invalid request';end if;return to_jsonb(x);end if;
 select settings into c from z_config where id=1;
 if not(c->>'botrix_enabled')::boolean or p_points<=0 or p_points%(c->>'botrix_points_per_z')::integer<>0 then raise exception 'Conversions unavailable or invalid amount';end if;
 amount:=p_points/(c->>'botrix_points_per_z')::numeric;
 insert into z_users(kick_user_id,username) values(p_user,p_name) on conflict(kick_user_id) do nothing;
 insert into z_conversion_tickets(id,kick_user_id,points,zs) values(p_id,p_user,p_points,amount) returning * into x;return to_jsonb(x);end$$;
create or replace function z_run_start(p_id uuid,p_user bigint,p_name text,p_kind text,p_stake numeric,p_card integer,p_mines integer[]) returns jsonb language plpgsql security definer set search_path=public as $$declare g z_games;begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));select * into g from z_games where id=p_id;
 if found then if g.creator<>p_user then raise exception 'Invalid request';end if;return to_jsonb(g);end if;
 if p_kind not in('higher','mines') or p_stake is null or p_stake not between 1 and 100 or p_stake<>trunc(p_stake) then raise exception 'Invalid wager';end if;
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
create or replace function z_run_step(p_id uuid,p_request uuid,p_user bigint,p_version integer,p_action text,p_cell integer default null,p_card integer default null) returns jsonb language plpgsql security definer set search_path=public as $$declare g z_games;receipt z_game_steps;r jsonb;tiles integer[];k integer;countwin integer;mult numeric;pay numeric;lost boolean:=false;finish boolean:=false;begin
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,1));select * into receipt from z_game_steps where id=p_request;
 if found then if receipt.actor<>p_user or receipt.game_id<>p_id then raise exception 'Invalid request';end if;return receipt.response;end if;
 select * into g from z_games where id=p_id for update;
 if g.id is null or g.creator<>p_user then raise exception 'Invalid request';end if;
 if g.status<>'playing' then raise exception 'Game already finished';end if;
 r:=g.result;if p_version is null or (r->>'version')::integer<>p_version then raise exception 'Game changed; refresh and try again';end if;
 mult:=(r->>'multiplier')::numeric;pay:=g.payout;
 if p_action='cashout' then finish:=true;
 elsif g.kind='higher' and p_action in('higher','lower') then
  if p_card is null or p_card not between 1 and 13 then raise exception 'Invalid card';end if;
  countwin:=case when p_action='higher' then 13-(r->>'card')::integer else (r->>'card')::integer-1 end;
  if countwin=0 then raise exception 'Choose the other direction';end if;
  lost:=case when p_action='higher' then p_card<=(r->>'card')::integer else p_card>=(r->>'card')::integer end;
  mult:=least(1000,mult*0.97*13/countwin);r:=r||jsonb_build_object('previous',r->'card','card',p_card,'turns',(r->>'turns')::integer+1);
  finish:=lost or mult=1000 or (r->>'turns')::integer>=50;
 elsif g.kind='mines' and p_action='reveal' then
  if p_cell is null or p_cell not between 0 and 24 or (r->'revealed')@>jsonb_build_array(p_cell) then raise exception 'Choose an unrevealed tile';end if;
  select s.tiles into tiles from z_run_secrets s where game_id=p_id;
  lost:=p_cell=any(tiles);k:=jsonb_array_length(r->'revealed');
  if not lost then mult:=case when k=0 then .97 else mult end*(25-k)/(25-cardinality(tiles)-k);end if;
  r:=r||jsonb_build_object('revealed',(r->'revealed')||jsonb_build_array(p_cell),'lastTile',p_cell,'hit',lost);
  finish:=lost or k+1=25-cardinality(tiles);
 else raise exception 'Invalid move';end if;
 if p_action<>'cashout' then pay:=case when lost then 0 else floor(g.stake*mult*100)/100 end;end if;
 r:=r||jsonb_build_object('multiplier',mult,'version',p_version+1);
 if finish then
  if g.kind='mines' then select s.tiles into tiles from z_run_secrets s where game_id=p_id;r:=r||jsonb_build_object('board',to_jsonb(tiles));end if;
  if pay>0 then perform z_arcade_move(p_user,pay,'Arcade return','payout:'||p_id,greatest(0,pay-g.stake));end if;
  update z_games set status='resolved',winner=case when pay>stake then creator end,winner_name=case when pay>stake then creator_name end,result=r,payout=pay,resolved_at=now() where id=p_id returning * into g;
  if pay>g.stake then insert into z_activity(username,kind,title,amount) values(g.creator_name,g.kind,case when g.kind='higher' then 'Higher or Lower' else 'Mines' end||' · collected '||round(mult,2)||'×',pay-g.stake);end if;
 else update z_games set result=r,payout=pay where id=p_id returning * into g;end if;
 insert into z_game_steps values(p_request,p_id,p_user,to_jsonb(g));return to_jsonb(g);
end$$;
do $$declare f record;begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('z_run_start','z_run_step') loop execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);end loop;end$$;
notify pgrst,'reload schema';commit;
