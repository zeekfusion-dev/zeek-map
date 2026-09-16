do $$declare g jsonb;again jsonb;deck integer[];start_balance numeric;u bigint:=700001;i integer;req uuid;begin
 insert into z_users(kick_user_id,username,zs_balance,lifetime_zs) values(u,'BlackjackTest',100,100);
 -- A + K natural; dealer 9 + 7. The first four cards alternate seats.
 select array[0,8,12,6]||array_agg(x) into deck from generate_series(0,51)x where x not in(0,8,12,6);
 g:=z_blackjack('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',u,'BlackjackTest','start',10,deck);
 if g->>'status'<>'resolved' or (g->>'payout')::numeric<>25 or g->'result'->>'outcome'<>'blackjack' then raise exception 'Natural payout failed';end if;
 again:=z_blackjack('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',u,'BlackjackTest','start',10,deck);
 if again<>g or (select zs_balance from z_users where kick_user_id=u)<>115 then raise exception 'Duplicate payment';end if;
 update z_games set created_at=now()-interval '3 seconds' where creator=u;
 select array[9,8,5,6,4]||array_agg(x) into deck from generate_series(0,51)x where x not in(9,8,5,6,4);
 g:=z_blackjack('70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000002',u,'BlackjackTest','start',1,deck);
 if g->'result'->'dealer'->1<>'null'::jsonb or g->'result'?'deck' then raise exception 'Private cards exposed';end if;
 begin perform z_run_step('70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000099',u,0,'cashout',null,1);raise exception 'Generic cashout accepted';exception when raise_exception then if sqlerrm<>'Invalid move' then raise;end if;end;
 begin perform z_blackjack('70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000098',u+1,'Other','stand',null,null,0);raise exception 'Wrong user accepted';exception when raise_exception then if sqlerrm<>'Invalid request' then raise;end if;end;
 g:=z_blackjack('70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000003',u,'BlackjackTest','stand',null,null,0);
 if g->'result'->>'dealerTotal'<>'21' or (g->>'payout')::numeric<>0 then raise exception 'Dealer drawing failed';end if;
 again:=z_blackjack('70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000003',u,'BlackjackTest','stand',null,null,0);
 if again<>g then raise exception 'Step retry mismatch';end if;
 if z_blackjack_total(array[0,13,9])<>12 or z_blackjack_total(array[0,5])<>17 then raise exception 'Ace totals wrong';end if;
 if has_table_privilege('anon','z_blackjack_secrets','select') or has_function_privilege('authenticated','z_blackjack(uuid,uuid,bigint,text,text,numeric,integer[],integer)','execute') then raise exception 'Private access exposed';end if;
 -- Both naturals push.
 update z_games set created_at=now()-interval '3 seconds' where creator=u;
 select array[0,13,12,25]||array_agg(x) into deck from generate_series(0,51)x where x not in(0,13,12,25);
 g:=z_blackjack('70000000-0000-4000-8000-000000000004','70000000-0000-4000-8000-000000000004',u,'BlackjackTest','start',2,deck);
 if g->'result'->>'outcome'<>'push' or (g->>'payout')::numeric<>2 then raise exception 'Push failed';end if;
 raise notice 'Blackjack natural, push, dealer draws, privacy, ownership, replay, alternate endpoint guards passed';
end$$;
do $$declare g jsonb;deck integer[];u bigint:=700002;begin
 insert into z_users(kick_user_id,username,zs_balance,lifetime_zs) values(u,'HitTest',20,20);
 select array[9,0,6,5,12]||array_agg(x) into deck from generate_series(0,51)x where x not in(9,0,6,5,12);
 g:=z_blackjack('70000000-0000-4000-8000-000000000010','70000000-0000-4000-8000-000000000010',u,'HitTest','start',1,deck);
 begin perform z_blackjack('70000000-0000-4000-8000-000000000010',gen_random_uuid(),u,'HitTest','hit',null,null,1);raise exception 'Stale version accepted';exception when raise_exception then if sqlerrm<>'Game changed; refresh and try again' then raise;end if;end;
 g:=z_blackjack('70000000-0000-4000-8000-000000000010','70000000-0000-4000-8000-000000000011',u,'HitTest','hit',null,null,0);
 if g->'result'->>'outcome'<>'bust' or (g->>'payout')::numeric<>0 then raise exception 'Bust failed';end if;
 update z_games set created_at=now()-interval '3 seconds' where creator=u;
 select array[9,0,7,5,12]||array_agg(x) into deck from generate_series(0,51)x where x not in(9,0,7,5,12);
 g:=z_blackjack('70000000-0000-4000-8000-000000000012','70000000-0000-4000-8000-000000000012',u,'HitTest','start',2,deck);
 g:=z_blackjack('70000000-0000-4000-8000-000000000012','70000000-0000-4000-8000-000000000013',u,'HitTest','stand',null,null,0);
 if g->'result'->>'outcome'<>'win' or (g->>'payout')::numeric<>4 or jsonb_array_length(g->'result'->'dealer')<>2 then raise exception 'Soft 17 must stand';end if;
 begin perform z_blackjack(gen_random_uuid(),gen_random_uuid(),u,'HitTest','start',10001,deck);raise exception 'Wager cap bypassed';exception when raise_exception then if sqlerrm<>'Invalid wager' then raise;end if;end;
end$$;
