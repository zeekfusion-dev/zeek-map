do $test$
declare u bigint:=936169701; test_game_id uuid; req uuid; r jsonb; again jsonb; deck integer[]; prefix integer[]; initial numeric; v integer;
begin
 begin
  if exists(select 1 from z_users where kick_user_id=u) then raise exception 'Test ID collision';end if;
  perform z_award(u,'blackjack_actions_test',100000,'test','blackjack-actions-seed');
  -- Pair of eights, dealer 17; split into 10 and 11, then double each.
  prefix:=array[7,9,20,6,1,2,10,11];
  select prefix||array_agg(i order by i) into deck from generate_series(0,51)i where not i=any(prefix);
  test_game_id:=gen_random_uuid();
  r:=z_blackjack(test_game_id,gen_random_uuid(),u,'blackjack_actions_test','start',100,deck);
  assert (r#>>'{result,canSplit}')::boolean;
  assert (r#>>'{result,canDouble}')::boolean;
  req:=gen_random_uuid();
  r:=z_blackjack(test_game_id,req,u,'blackjack_actions_test','split',null,null,0);
  again:=z_blackjack(test_game_id,req,u,'blackjack_actions_test','split',null,null,0);
  assert r=again,'Split replay changed response';
  assert (r->>'stake')::numeric=200;
  assert jsonb_array_length(r#>'{result,hands}')=2;
  assert r#>'{result,dealer,1}'='null'::jsonb,'Dealer leaked';
  assert not (r#>>'{result,canSplit}')::boolean;
  begin
   perform z_blackjack(test_game_id,gen_random_uuid(),u,'blackjack_actions_test','split',null,null,1);
   raise exception 'Resplit accepted';
  exception when others then if sqlerrm<>'Split requires a matching pair on your first two cards.' then raise;end if;end;
  begin
   perform z_blackjack(test_game_id,gen_random_uuid(),u,'blackjack_actions_test','double',null,null,0);
   raise exception 'Stale action accepted';
  exception when others then if sqlerrm<>'Game changed; refresh and try again' then raise;end if;end;
  req:=gen_random_uuid();
  r:=z_blackjack(test_game_id,req,u,'blackjack_actions_test','double',null,null,1);
  again:=z_blackjack(test_game_id,req,u,'blackjack_actions_test','double',null,null,1);
  assert r=again,'Double replay changed response';
  assert r->>'status'='playing';
  assert (r#>>'{result,activeHand}')::integer=1;
  assert jsonb_array_length(r#>'{result,hands,0,cards}')=3;
  assert r#>>'{result,hands,0,status}'='stood';
  r:=z_blackjack(test_game_id,gen_random_uuid(),u,'blackjack_actions_test','double',null,null,2);
  assert r->>'status'='resolved';
  assert (r->>'stake')::numeric=400;
  assert (r->>'payout')::numeric=800;
  assert (select zs_balance from z_users where kick_user_id=u)=100400,'Incorrect split/double settlement';
  assert not (r#>>'{result,canDouble}')::boolean;
  assert not (r->'result' ? 'deck');
  -- Split aces: one final card per hand, never a 3:2 natural.
  update z_games set created_at=now()-interval '1 minute' where creator=u;
  prefix:=array[0,9,13,6,10,11];
  select prefix||array_agg(i order by i) into deck from generate_series(0,51)i where not i=any(prefix);
  test_game_id:=gen_random_uuid();r:=z_blackjack(test_game_id,gen_random_uuid(),u,'blackjack_actions_test','start',100,deck);
  r:=z_blackjack(test_game_id,gen_random_uuid(),u,'blackjack_actions_test','split',null,null,0);
  assert r->>'status'='resolved';
  assert (r->>'payout')::numeric=400;
  assert jsonb_array_length(r#>'{result,hands,0,cards}')=2;
  assert r#>>'{result,hands,0,outcome}'='win';
  -- Total exposure cap and atomic rejection.
  update z_games set created_at=now()-interval '1 minute' where creator=u;
  prefix:=array[7,9,20,6,1,2,3];
  select prefix||array_agg(i order by i) into deck from generate_series(0,51)i where not i=any(prefix);
  test_game_id:=gen_random_uuid();r:=z_blackjack(test_game_id,gen_random_uuid(),u,'blackjack_actions_test','start',3000,deck);
  select zs_balance into initial from z_users where kick_user_id=u;
  assert not (r#>>'{result,canSplit}')::boolean;
  begin
   perform z_blackjack(test_game_id,gen_random_uuid(),u,'blackjack_actions_test','split',null,null,0);
   raise exception 'Cap bypass';
  exception when others then if sqlerrm<>'Blackjack total wager cannot exceed 4,000 Zs.' then raise;end if;end;
  assert (select zs_balance from z_users where kick_user_id=u)=initial;
  r:=z_blackjack(test_game_id,gen_random_uuid(),u,'blackjack_actions_test','stand',null,null,0);
  -- Every unresolved initial two-card hand can double, even a 4,000-Z starting bet.
  update z_games set created_at=now()-interval '1 minute' where creator=u;
  test_game_id:=gen_random_uuid();r:=z_blackjack(test_game_id,gen_random_uuid(),u,'blackjack_actions_test','start',4000,deck);
  assert (r#>>'{result,canDouble}')::boolean;
  req:=gen_random_uuid();
  r:=z_blackjack(test_game_id,req,u,'blackjack_actions_test','double',null,null,0);
  assert r->>'status'='resolved';
  assert (r->>'stake')::numeric=8000;
  assert jsonb_array_length(r#>'{result,hands,0,cards}')=3;
  assert (r->>'availableZs')::numeric=(select zs_balance-arcade_excluded from z_users where kick_user_id=u);
  again:=z_blackjack(test_game_id,req,u,'blackjack_actions_test','double',null,null,0);
  assert again=r;
  -- Legacy in-progress hand, no new hands field.
  update z_games set created_at=now()-interval '1 minute' where creator=u;
  test_game_id:=gen_random_uuid();r:=z_blackjack(test_game_id,gen_random_uuid(),u,'blackjack_actions_test','start',100,deck);
  update z_blackjack_secrets set hands=null where game_id=test_game_id;
  update z_games set result=result-'hands'-'activeHand' where z_games.id=test_game_id;
  r:=z_blackjack(test_game_id,gen_random_uuid(),u,'blackjack_actions_test','split',null,null,0);
  assert jsonb_array_length(r#>'{result,hands}')=2;
  r:=z_blackjack(test_game_id,gen_random_uuid(),u,'blackjack_actions_test','hit',null,null,1);
  assert not (r#>>'{result,canDouble}')::boolean;
  begin
   perform z_blackjack(test_game_id,gen_random_uuid(),u,'blackjack_actions_test','double',null,null,2);
   raise exception 'Double after hit accepted';
  exception when others then if sqlerrm<>'This hand is not eligible for that action.' then raise;end if;end;
  -- No available balance: hide the action and reject a forged extra wager.
  if exists(select 1 from z_users where kick_user_id=u+1) then raise exception 'Test ID collision';end if;
  perform z_award(u+1,'blackjack_poor_test',100,'test','blackjack-poor-seed');
  test_game_id:=gen_random_uuid();
  r:=z_blackjack(test_game_id,gen_random_uuid(),u+1,'blackjack_poor_test','start',100,deck);
  assert not (r#>>'{result,canDouble}')::boolean;
  assert not (r#>>'{result,canSplit}')::boolean;
  begin
   perform z_blackjack(test_game_id,gen_random_uuid(),u+1,'blackjack_poor_test','double',null,null,0);
   raise exception 'Insufficient balance accepted';
  exception when others then if sqlerrm not in('Insufficient free-earned Zs','Insufficient Zs') then raise;end if;end;
  assert (select zs_balance from z_users where kick_user_id=u+1)=0;
  assert (select stake from z_games where z_games.id=test_game_id)=100;
  assert not has_function_privilege('anon','z_blackjack(uuid,uuid,bigint,text,text,numeric,integer[],integer)','EXECUTE');
  raise exception 'BLACKJACK_TEST_ROLLBACK';
 exception when others then
  if sqlerrm<>'BLACKJACK_TEST_ROLLBACK' then raise;end if;
 end;
end
$test$;
