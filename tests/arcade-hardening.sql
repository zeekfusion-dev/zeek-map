-- Caller wraps BEGIN / ROLLBACK; fixtures never persist.
DO $$
DECLARE u bigint:=922000991; g uuid:=gen_random_uuid(); request uuid:=gen_random_uuid(); x jsonb;y jsonb;before_balance numeric;
BEGIN
 IF EXISTS(SELECT 1 FROM z_users WHERE kick_user_id=u) THEN RAISE EXCEPTION 'Fixture ID occupied'; END IF;
 PERFORM z_award(u,'security_fixture',100,'Test credit','security-fixture-credit');
 x:=z_run_start(g,u,'security_fixture','mines',10,NULL,ARRAY[24]);
 x:=z_run_step(g,request,u,0,'reveal',0,NULL);
 y:=z_run_step(g,request,u,0,'reveal',0,NULL);
 IF x<>y THEN RAISE EXCEPTION 'Duplicate reveal changed state'; END IF;
 BEGIN
  PERFORM z_run_step(g,gen_random_uuid(),u,0,'reveal',1,NULL);
  RAISE EXCEPTION 'Stale version accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Game changed; refresh and try again' THEN RAISE; END IF; END;
 BEGIN
  PERFORM z_run_step(g,gen_random_uuid(),u+1,1,'cashout',NULL,NULL);
  RAISE EXCEPTION 'Other user accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Invalid request' THEN RAISE; END IF; END;
 DELETE FROM z_run_secrets WHERE game_id=g;
 BEGIN
  PERFORM z_run_step(g,gen_random_uuid(),u,1,'cashout',NULL,NULL);
  RAISE EXCEPTION 'Missing board accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Invalid game state' THEN RAISE; END IF; END;
 INSERT INTO z_run_secrets(game_id,tiles) VALUES(g,ARRAY[24]);
 request:=gen_random_uuid();x:=z_run_step(g,request,u,1,'cashout',NULL,NULL);
 SELECT zs_balance INTO before_balance FROM z_users WHERE kick_user_id=u;
 y:=z_run_step(g,request,u,1,'cashout',NULL,NULL);
 IF x<>y OR (SELECT zs_balance FROM z_users WHERE kick_user_id=u)<>before_balance THEN RAISE EXCEPTION 'Duplicate payout'; END IF;
 IF before_balance<>100.10 THEN RAISE EXCEPTION 'Incorrect one-mine payout: %',before_balance; END IF;
 BEGIN
  PERFORM z_arcade_move(u,999,'Arcade return','payout:'||g,0);
  RAISE EXCEPTION 'Conflicting transaction accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Invalid request' THEN RAISE; END IF; END;
 BEGIN
  PERFORM z_arcade_move(u,'NaN'::numeric,'Test','nan-test',0);
  RAISE EXCEPTION 'NaN accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Invalid request' THEN RAISE; END IF; END;
 BEGIN
  UPDATE z_users SET zs_balance='NaN'::numeric WHERE kick_user_id=u;
  RAISE EXCEPTION 'NaN balance accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF has_function_privilege('anon','z_run_step(uuid,uuid,bigint,integer,text,integer,integer)','execute') OR has_table_privilege('authenticated','z_run_secrets','select') THEN RAISE EXCEPTION 'Private game access'; END IF;
END $$;
SELECT 'security database checks passed; fixtures rolled back' AS result;
