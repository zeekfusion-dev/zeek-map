begin;
alter table z_games drop constraint z_games_kind_check;
alter table z_games add constraint z_games_kind_check check(kind in('coin','dice','rps','plinko','higher','mines','blackjack'));
create table z_blackjack_secrets(game_id uuid primary key references z_games,deck integer[] not null,player integer[] not null,dealer integer[] not null);
alter table z_blackjack_secrets enable row level security;
revoke all on z_blackjack_secrets from public,anon,authenticated;
grant all on z_blackjack_secrets to service_role;
create function z_blackjack_total(cards integer[]) returns integer language plpgsql immutable set search_path=public as $$declare total integer:=0;aces integer:=0;c integer;r integer;begin
 foreach c in array cards loop r:=c%13+1;total:=total+least(r,10);if r=1 then aces:=aces+1;end if;end loop;
 if aces>0 and total+10<=21 then total:=total+10;end if;return total;
end$$;
create function z_blackjack(p_id uuid,p_request uuid,p_user bigint,p_name text,p_action text,p_stake numeric default null,p_deck integer[] default null,p_version integer default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare g z_games;s z_blackjack_secrets;receipt z_game_steps;pt integer;dt integer;done boolean:=false;outcome text;pay numeric:=0;r jsonb;version integer:=0;begin
 if p_action is null or p_action not in('start','hit','stand') then raise exception 'Invalid move';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,1));
 select * into receipt from z_game_steps where id=p_request;
 if found then if receipt.actor<>p_user or receipt.game_id<>p_id then raise exception 'Invalid request';end if;return receipt.response;end if;
 if p_action='start' then
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into g from z_games where id=p_id for update;
  if found then if g.creator<>p_user or g.kind<>'blackjack' then raise exception 'Invalid request';end if;return to_jsonb(g);end if;
  if p_stake is null or p_stake not between 1 and 10 or p_stake<>trunc(p_stake) then raise exception 'Invalid wager';end if;
  if p_deck is null or cardinality(p_deck)<>52 or (select count(distinct x) from unnest(p_deck)x)<>52 or exists(select 1 from unnest(p_deck)x where x not between 0 and 51 or x is null) then raise exception 'Invalid deck';end if;
  insert into z_users(kick_user_id,username) values(p_user,p_name) on conflict do nothing;
  perform 1 from z_users where kick_user_id=p_user for update;
  if exists(select 1 from z_games where creator=p_user and kind='blackjack' and status='playing') then raise exception 'Finish your active game first';end if;
  if exists(select 1 from z_games where creator=p_user and created_at>now()-interval '2 seconds') then raise exception 'Please wait a moment between games';end if;
  perform z_arcade_move(p_user,-p_stake,'Blackjack stake','stake:'||p_id);
  insert into z_games(id,kind,creator,creator_name,stake,status,result,payout) values(p_id,'blackjack',p_user,p_name,p_stake,'playing','{}',0) returning * into g;
  s.game_id:=p_id;s.player:=array[p_deck[1],p_deck[3]];s.dealer:=array[p_deck[2],p_deck[4]];s.deck:=p_deck[5:52];
  insert into z_blackjack_secrets values(s.game_id,s.deck,s.player,s.dealer);
 else
  select * into g from z_games where id=p_id for update;
  if g.id is null or g.creator<>p_user or g.kind<>'blackjack' then raise exception 'Invalid request';end if;
  if g.status<>'playing' then raise exception 'Game already finished';end if;
  if p_version is null or p_version<>(g.result->>'version')::integer then raise exception 'Game changed; refresh and try again';end if;
  version:=p_version+1;select * into s from z_blackjack_secrets where game_id=p_id;
  if p_action='hit' then s.player:=array_append(s.player,s.deck[1]);s.deck:=s.deck[2:cardinality(s.deck)];end if;
 end if;
 pt:=z_blackjack_total(s.player);dt:=z_blackjack_total(s.dealer);
 if p_action='start' and (pt=21 or dt=21) then
  done:=true;outcome:=case when pt=dt then 'push' when pt=21 then 'blackjack' else 'loss' end;
 elsif pt>21 then done:=true;outcome:='bust';
 elsif p_action='stand' or pt=21 then
  while dt<17 loop s.dealer:=array_append(s.dealer,s.deck[1]);s.deck:=s.deck[2:cardinality(s.deck)];dt:=z_blackjack_total(s.dealer);end loop;
  done:=true;outcome:=case when dt>21 or pt>dt then 'win' when pt=dt then 'push' else 'loss' end;
 end if;
 r:=jsonb_build_object('player',s.player,'dealer',case when done then to_jsonb(s.dealer) else jsonb_build_array(s.dealer[1],null) end,'playerTotal',pt,'dealerTotal',case when done then dt else z_blackjack_total(array[s.dealer[1]]) end,'version',version,'outcome',outcome,'tie',outcome='push');
 if done then
  pay:=case outcome when 'blackjack' then g.stake*2.5 when 'win' then g.stake*2 when 'push' then g.stake else 0 end;
  if pay>0 then perform z_arcade_move(p_user,pay,'Blackjack return','payout:'||p_id,greatest(0,pay-g.stake));end if;
  update z_games set status='resolved',result=r,payout=pay,winner=case when pay>stake then creator end,winner_name=case when pay>stake then creator_name end,resolved_at=now() where id=p_id returning * into g;
  if pay>g.stake then insert into z_activity(username,kind,title,amount) values(g.creator_name,'blackjack',case when outcome='blackjack' then 'Blackjack! · 3:2 win' else 'Beat the dealer · Blackjack' end,pay-g.stake);end if;
 else
  update z_games set result=r where id=p_id returning * into g;
  update z_blackjack_secrets set deck=s.deck,player=s.player,dealer=s.dealer where game_id=p_id;
 end if;
 insert into z_game_steps values(p_request,p_id,p_user,to_jsonb(g));return to_jsonb(g);
end$$;
-- The generic run endpoint must never cash out a Blackjack hand.
do $$declare definition text;begin
 select pg_get_functiondef('z_run_step(uuid,uuid,bigint,integer,text,integer,integer)'::regprocedure) into definition;
 if position('r:=g.result;' in definition)=0 then raise exception 'Run guard insertion failed';end if;
 execute replace(definition,'r:=g.result;','if g.kind not in(''higher'',''mines'') then raise exception ''Invalid move'';end if;r:=g.result;');
end$$;
revoke all on function z_blackjack(uuid,uuid,bigint,text,text,numeric,integer[],integer),z_blackjack_total(integer[]) from public,anon,authenticated;
grant execute on function z_blackjack(uuid,uuid,bigint,text,text,numeric,integer[],integer),z_blackjack_total(integer[]) to service_role;
notify pgrst,'reload schema';commit;
