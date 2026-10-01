begin;
alter table public.z_blackjack_secrets add column if not exists hands jsonb;
create or replace function public.z_blackjack(p_id uuid,p_request uuid,p_user bigint,p_name text,p_action text,p_stake numeric default null,p_deck integer[] default null,p_version integer default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare g z_games;s z_blackjack_secrets;receipt z_game_steps;hs jsonb;h jsonb;cards integer[];pt integer;dt integer;idx integer:=0;j integer;version integer:=0;done boolean:=false;all_bust boolean;split_aces boolean:=false;is_natural boolean:=false;outcome text;pay numeric:=0;hand_pay numeric;bet numeric;extra numeric;available numeric;r jsonb;can_split boolean:=false;can_double boolean:=false;begin
 if p_action is null or p_action not in('start','hit','stand','split','double') then raise exception 'Invalid move';end if;
 if p_request is null or p_id is null then raise exception 'Invalid request';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,1));
 select * into receipt from z_game_steps where id=p_request;
 if found then if receipt.actor<>p_user or receipt.game_id<>p_id then raise exception 'Invalid request';end if;return receipt.response;end if;
 if p_action='start' then
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into g from z_games where id=p_id for update;
  if found then if g.creator<>p_user or g.kind<>'blackjack' then raise exception 'Invalid request';end if;select zs_balance-arcade_excluded into available from z_users where kick_user_id=p_user;return to_jsonb(g)||jsonb_build_object('availableZs',available);end if;
  if p_stake is null or p_stake not between 1 and 4000 or p_stake<>trunc(p_stake) then raise exception 'Invalid wager';end if;
  if p_deck is null or cardinality(p_deck)<>52 or (select count(distinct x) from unnest(p_deck)x)<>52 or exists(select 1 from unnest(p_deck)x where x not between 0 and 51 or x is null) then raise exception 'Invalid deck';end if;
  insert into z_users(kick_user_id,username) values(p_user,p_name) on conflict do nothing;
  perform 1 from z_users where kick_user_id=p_user for update;
  if exists(select 1 from z_games where creator=p_user and kind='blackjack' and status='playing') then raise exception 'Finish your active game first';end if;
  if exists(select 1 from z_games where creator=p_user and created_at>now()-interval '250 milliseconds') then raise exception 'Please wait a moment between games';end if;
  perform z_arcade_move(p_user,-p_stake,'Blackjack stake','stake:'||p_id);
  insert into z_games(id,kind,creator,creator_name,stake,status,result,payout) values(p_id,'blackjack',p_user,p_name,p_stake,'playing','{}',0) returning * into g;
  s.game_id:=p_id;s.player:=array[p_deck[1],p_deck[3]];s.dealer:=array[p_deck[2],p_deck[4]];s.deck:=p_deck[5:52];
  hs:=jsonb_build_array(jsonb_build_object('cards',s.player,'stake',p_stake,'status','playing','doubled',false));
  insert into z_blackjack_secrets(game_id,deck,player,dealer,hands) values(s.game_id,s.deck,s.player,s.dealer,hs);
  is_natural:=z_blackjack_total(s.player)=21 or z_blackjack_total(s.dealer)=21;
 else
  select * into g from z_games where id=p_id for update;
  if g.id is null or g.creator<>p_user or g.kind<>'blackjack' then raise exception 'Invalid request';end if;
  if g.status<>'playing' then raise exception 'Game already finished';end if;
  if p_version is null or p_version<>(g.result->>'version')::integer then raise exception 'Game changed; refresh and try again';end if;
  perform 1 from z_users where kick_user_id=p_user for update;
  version:=p_version+1;select * into s from z_blackjack_secrets where game_id=p_id;
  hs:=coalesce(s.hands,jsonb_build_array(jsonb_build_object('cards',s.player,'stake',g.stake,'status','playing','doubled',false)));
  idx:=coalesce((g.result->>'activeHand')::integer,0);h:=hs->idx;
  if h->>'status'<>'playing' then raise exception 'Invalid move';end if;
  select array_agg(value::integer order by ord) into cards from jsonb_array_elements_text(h->'cards') with ordinality a(value,ord);
  bet:=(h->>'stake')::numeric;
  if p_action in('split','double') then
   if cardinality(cards)<>2 or coalesce((h->>'doubled')::boolean,false) or z_blackjack_total(cards)>=21 then raise exception 'This hand is not eligible for that action.';end if;
   if p_action='split' and (jsonb_array_length(hs)<>1 or cards[1]%13<>cards[2]%13) then raise exception 'Split requires a matching pair on your first two cards.';end if;
   extra:=bet;
   if p_action='split' and g.stake+extra>4000 then raise exception 'Blackjack total wager cannot exceed 4,000 Zs.';end if;
   perform z_arcade_move(p_user,-extra,case when p_action='split' then 'Blackjack split stake' else 'Blackjack double stake' end,'blackjack-extra:'||p_request);
   g.stake:=g.stake+extra;
   if p_action='split' then
    split_aces:=cards[1]%13=0;
    hs:=jsonb_build_array(jsonb_build_object('cards',array[cards[1],s.deck[1]],'stake',bet,'status','playing','doubled',false),jsonb_build_object('cards',array[cards[2],s.deck[2]],'stake',bet,'status','playing','doubled',false));
    s.deck:=s.deck[3:cardinality(s.deck)];
    for j in 0..1 loop
     select array_agg(value::integer order by ord) into cards from jsonb_array_elements_text(hs->j->'cards') with ordinality a(value,ord);
     if split_aces or z_blackjack_total(cards)=21 then hs:=jsonb_set(hs,array[j::text,'status'],'"stood"');end if;
    end loop;
   else
    cards:=array_append(cards,s.deck[1]);s.deck:=s.deck[2:cardinality(s.deck)];
    h:=h||jsonb_build_object('cards',cards,'stake',bet*2,'doubled',true,'status',case when z_blackjack_total(cards)>21 then 'bust' else 'stood' end);
    hs:=jsonb_set(hs,array[idx::text],h);
   end if;
  elsif p_action='hit' then
   cards:=array_append(cards,s.deck[1]);s.deck:=s.deck[2:cardinality(s.deck)];pt:=z_blackjack_total(cards);
   h:=h||jsonb_build_object('cards',cards,'status',case when pt>21 then 'bust' when pt=21 then 'stood' else 'playing' end);hs:=jsonb_set(hs,array[idx::text],h);
  else hs:=jsonb_set(hs,array[idx::text,'status'],'"stood"');end if;
 end if;
 select min(ord::integer-1) into idx from jsonb_array_elements(hs) with ordinality a(value,ord) where value->>'status'='playing';
 done:=is_natural or idx is null;dt:=z_blackjack_total(s.dealer);
 if done then
  all_bust:=not exists(select 1 from jsonb_array_elements(hs) a where a->>'status'<>'bust');
  if not is_natural and not all_bust then
   while dt<17 loop s.dealer:=array_append(s.dealer,s.deck[1]);s.deck:=s.deck[2:cardinality(s.deck)];dt:=z_blackjack_total(s.dealer);end loop;
  end if;
  for j in 0..jsonb_array_length(hs)-1 loop
   h:=hs->j;select array_agg(value::integer order by ord) into cards from jsonb_array_elements_text(h->'cards') with ordinality a(value,ord);pt:=z_blackjack_total(cards);bet:=(h->>'stake')::numeric;
   outcome:=case when is_natural then case when pt=dt then 'push' when pt=21 then 'blackjack' else 'loss' end when pt>21 then 'bust' when dt>21 or pt>dt then 'win' when pt=dt then 'push' else 'loss' end;
   hand_pay:=case outcome when 'blackjack' then bet*2.5 when 'win' then bet*2 when 'push' then bet else 0 end;pay:=pay+hand_pay;
   hs:=jsonb_set(hs,array[j::text],h||jsonb_build_object('total',pt,'status','resolved','outcome',outcome,'payout',hand_pay));
  end loop;
  idx:=0;
 end if;
 for j in 0..jsonb_array_length(hs)-1 loop
  select array_agg(value::integer order by ord) into cards from jsonb_array_elements_text(hs->j->'cards') with ordinality a(value,ord);
  hs:=jsonb_set(hs,array[j::text,'total'],to_jsonb(z_blackjack_total(cards)));
 end loop;
 h:=hs->idx;select array_agg(value::integer order by ord) into s.player from jsonb_array_elements_text(h->'cards') with ordinality a(value,ord);
 select zs_balance-arcade_excluded into available from z_users where kick_user_id=p_user;
 bet:=(h->>'stake')::numeric;
 if not done and jsonb_array_length(h->'cards')=2 and not coalesce((h->>'doubled')::boolean,false) and (h->>'total')::integer<21 and available>=bet then
  can_double:=true;can_split:=g.stake+bet<=4000 and jsonb_array_length(hs)=1 and s.player[1]%13=s.player[2]%13;
 end if;
 r:=jsonb_build_object('player',s.player,'dealer',case when done then to_jsonb(s.dealer) else jsonb_build_array(s.dealer[1],null) end,'playerTotal',z_blackjack_total(s.player),'dealerTotal',case when done then dt else z_blackjack_total(array[s.dealer[1]]) end,'hands',hs,'activeHand',idx,'canSplit',can_split,'canDouble',can_double,'additionalWager',bet,'totalStake',g.stake,'version',version,'outcome',case when done then case when jsonb_array_length(hs)=1 then hs->0->>'outcome' when pay>g.stake then 'win' when pay=g.stake then 'push' else 'loss' end end,'tie',done and pay=g.stake);
 if done then
  if pay>0 then perform z_arcade_move(p_user,pay,'Blackjack return','payout:'||p_id,greatest(0,pay-g.stake));end if;
  update z_games set stake=g.stake,status='resolved',result=r,payout=pay,winner=case when pay>g.stake then creator end,winner_name=case when pay>g.stake then creator_name end,resolved_at=now() where id=p_id returning * into g;
  if pay>g.stake then insert into z_activity(username,kind,title,amount) values(g.creator_name,'blackjack',case when r->>'outcome'='blackjack' then 'Blackjack! · 3:2 win' else 'Beat the dealer · Blackjack' end,pay-g.stake);end if;
 else update z_games set stake=g.stake,result=r where id=p_id returning * into g;end if;
 update z_blackjack_secrets set deck=s.deck,player=s.player,dealer=s.dealer,hands=hs where game_id=p_id;
 r:=to_jsonb(g)||jsonb_build_object('availableZs',available+pay);
 insert into z_game_steps values(p_request,p_id,p_user,r);return r;
end$$;
revoke all on function public.z_blackjack(uuid,uuid,bigint,text,text,numeric,integer[],integer) from public,anon,authenticated;
grant execute on function public.z_blackjack(uuid,uuid,bigint,text,text,numeric,integer[],integer) to service_role;
commit;
