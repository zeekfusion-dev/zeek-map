do $$declare a bigint:=934000001;b bigint:=934000002;c bigint:=934000003;g uuid;req uuid;result jsonb;again jsonb;beforea numeric;beforeb numeric;i integer;j integer;choices text[]:=array['rock','paper','scissors'];begin
 perform z_award(a,'duel_test_a',5000,'test','duel-test-a');perform z_award(b,'duel_test_b',5000,'test','duel-test-b');perform z_award(c,'duel_test_c',1,'test','duel-test-c');
 for i in 1..3 loop for j in 1..3 loop
  update z_games set created_at=now()-interval '1 minute' where creator=a;
  g:=gen_random_uuid();select zs_balance into beforea from z_users where kick_user_id=a;select zs_balance into beforeb from z_users where kick_user_id=b;
  result:=z_rps_create(g,a,'duel_test_a',200,choices[i]);
  if result->>'side' is not null or result->>'result' is not null or (select zs_balance from z_users where kick_user_id=a)<>beforea-200 then raise exception 'RPS leaked choice or failed escrow';end if;
  begin perform z_rps_action(g,c,'duel_test_c',false,choices[j]);raise exception 'Overdraft accepted';exception when others then if sqlerrm not in('Insufficient free-earned Zs','Insufficient Zs') then raise;end if;end;
  if (select status from z_games where id=g)<>'open' then raise exception 'Failed accept closed game';end if;
  result:=z_rps_action(g,b,'duel_test_b',false,choices[j]);again:=z_rps_action(g,b,'duel_test_b',false,choices[1]);if result<>again then raise exception 'Retry changed result';end if;
  if i=j then
   if (select zs_balance from z_users where kick_user_id=a)<>beforea or (select zs_balance from z_users where kick_user_id=b)<>beforeb then raise exception 'Tie failed to refund both';end if;
  else
   if (result->>'winner')::bigint<>(case when (i=1 and j=3) or(i=2 and j=1) or(i=3 and j=2) then a else b end) then raise exception 'Wrong RPS winner';end if;
   if (select sum(zs_balance) from z_users where kick_user_id in(a,b))<>beforea+beforeb then raise exception 'RPS minted balance';end if;
  end if;
 end loop;end loop;
 update z_games set created_at=now()-interval '1 minute' where creator=a;
 g:=gen_random_uuid();result:=z_rps_create(g,a,'duel_test_a',150,'rock');result:=z_rps_action(g,a,'duel_test_a',true);again:=z_rps_action(g,a,'duel_test_a',true);if result<>again then raise exception 'Cancel retry failed';end if;
 update z_games set created_at=now()-interval '1 minute' where creator=a;
 perform z_play(gen_random_uuid(),a,'duel_test_a','dice',200,'high');
 begin perform z_play(gen_random_uuid(),b,'duel_test_b','plinko',10001,null,'[0,0,0,0,0,0,0,0]');raise exception 'Plinko exceeded max';exception when others then if sqlerrm<>'Invalid wager' then raise;end if;end;
 begin perform z_run_start(gen_random_uuid(),b,'duel_test_b','higher',10001,7,null);raise exception 'Higher exceeded max';exception when others then if sqlerrm<>'Invalid wager' then raise;end if;end;
 begin perform z_run_start(gen_random_uuid(),b,'duel_test_b','mines',10001,null,array[0]);raise exception 'Mines exceeded max';exception when others then if sqlerrm<>'Invalid wager' then raise;end if;end;
 req:=gen_random_uuid();result:=z_admin_adjust(20306616,c,'wrong-name',1000001.25,'Test correction',req);again:=z_admin_adjust(20306616,c,'wrong-name',1000001.25,'Test correction',req);
 if result<>again or result->>'username'<>'duel_test_c' or (result->>'zs_balance')::numeric<>1000002.25 then raise exception 'Admin adjustment failed';end if;
 result:=z_admin_adjust(20306616,c,'wrong-name',-1.25,'Test subtraction',gen_random_uuid());if (result->>'lifetime_zs')::numeric<>1000002.25 then raise exception 'Subtraction changed lifetime';end if;
 begin perform z_admin_adjust(20306616,c,'duel_test_c',1,'',gen_random_uuid());raise exception 'Reasonless adjustment accepted';exception when others then if sqlerrm<>'Owner and reason required' then raise;end if;end;
 begin perform z_manage_users(a,'');raise exception 'User lookup permitted nonadmin';exception when others then if sqlerrm<>'Owner required' then raise;end if;end;
 begin perform z_manage_history(null,'');raise exception 'History permitted null admin';exception when others then if sqlerrm<>'Owner required' then raise;end if;end;
 if jsonb_array_length(z_manage_users(20306616,'duel_test_c'))<>1 or jsonb_array_length(z_manage_history(20306616,'Test correction'))<>1 then raise exception 'Search failed';end if;
 if has_table_privilege('anon','z_rps_secrets','select') or has_function_privilege('authenticated','z_manage_users(bigint,text,integer)','execute') then raise exception 'Public secret/admin access';end if;
end$$;
select 'PASS: nine RPS matchups, escrow, ties, retries, cancellation, solo limits, large duels, owner search, adjustments and history' as result;
