do $$declare u bigint:=936160001;id uuid;r jsonb;again jsonb;before_balance numeric;kind text;deck integer[];begin
 if exists(select 1 from z_users where kick_user_id=u) then raise exception 'Test ID collision';end if;
 perform z_award(u,'economy_test',1000000,'test','economy-test-seed');
 select array_agg(i) into deck from generate_series(0,51)i;
 foreach kind in array array['plinko','higher','mines','blackjack'] loop
  id:=gen_random_uuid();select zs_balance into before_balance from z_users where kick_user_id=u;
  begin
   if kind='plinko' then perform z_play(id,u,'economy_test',kind,10001,null,'[0,0,0,0,0,0,0,0]');
   elsif kind='blackjack' then perform z_blackjack(id,gen_random_uuid(),u,'economy_test','start',10001,deck);
   else perform z_run_start(id,u,'economy_test',kind,10001,7,array[0]);end if;
   raise exception 'Accepted over-limit wager';
  exception when others then if sqlerrm<>'Invalid wager' then raise;end if;end;
  if (select zs_balance from z_users where kick_user_id=u)<>before_balance then raise exception 'Rejected wager changed balance';end if;
  update z_games set created_at=now()-interval '1 minute' where creator=u;
  if kind='plinko' then r:=z_play(id,u,'economy_test',kind,10000,null,'[0,0,0,0,0,0,0,0]');again:=z_play(id,u,'economy_test',kind,10000,null,'[1,1,1,1,1,1,1,1]');
  elsif kind='blackjack' then r:=z_blackjack(id,gen_random_uuid(),u,'economy_test','start',10000,deck);again:=z_blackjack(id,gen_random_uuid(),u,'economy_test','start',10000,deck);
  else r:=z_run_start(id,u,'economy_test',kind,10000,7,array[0]);again:=z_run_start(id,u,'economy_test',kind,10000,7,array[0]);end if;
  if (r->>'stake')::numeric<>10000 or r<>again then raise exception 'Cap or retry failed';end if;
 end loop;
 update z_games set created_at=now()-interval '1 minute' where creator=u;
 r:=z_play(gen_random_uuid(),u,'economy_test','coin',10001,'heads');if r->>'status'<>'open' then raise exception 'Large duel failed';end if;
 r:=z_conversion(u,'economy_test',1000,gen_random_uuid());
 if (select zs from z_conversion_tickets where kick_user_id=u and status='pending')<>1000 then raise exception 'Conversion ratio failed';end if;
 if (select (settings->>'question_z')::numeric from z_config where z_config.id=1)<>100 then raise exception 'Trivia rate failed';end if;
 update z_runtime set last_webhook_at=null where z_runtime.id=1;
 perform z_process_chat('economy-test-receipt',u,'economy_test','economy-test-message','unmatched',now(),false);
 if (select last_webhook_at from z_runtime where z_runtime.id=1) is null then raise exception 'Chat activity timestamp missing';end if;
 if z_process_chat('economy-test-receipt',u,'economy_test','economy-test-message','unmatched',now(),false) then raise exception 'Duplicate chat accepted';end if;
 if has_function_privilege('anon','z_play(uuid,bigint,text,text,numeric,text,jsonb)','EXECUTE') then raise exception 'Public game RPC';end if;
end$$;
select 'PASS: 10000 accepted by all solo games; 10001 rejected without debit; retries unchanged; larger duels accepted; 1:1 conversions; 100 trivia reward' as result;
