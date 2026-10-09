-- Execute within BEGIN/ROLLBACK. No real user or alert records are changed.
DO $$
DECLARE a bigint:=922000981;b bigint:=922000982;g uuid:=gen_random_uuid();h uuid:=gen_random_uuid();before_balance numeric;x jsonb;deck integer[];
BEGIN
 IF EXISTS(SELECT 1 FROM z_users WHERE kick_user_id IN(a,b)) THEN RAISE EXCEPTION 'Fixture occupied';END IF;
 PERFORM z_award(a,'audit_a',100,'Audit fixture','audit-a');PERFORM z_award(b,'audit_b',100,'Audit fixture','audit-b');
 PERFORM z_rps_create(g,a,'audit_a',10,'rock');
 DELETE FROM z_rps_secrets WHERE game_id=g;
 SELECT zs_balance INTO before_balance FROM z_users WHERE kick_user_id=b;
 BEGIN
  PERFORM z_rps_action(g,b,'audit_b',false,'paper');RAISE EXCEPTION 'Missing RPS secret accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Invalid game state' THEN RAISE;END IF;END;
 IF (SELECT zs_balance FROM z_users WHERE kick_user_id=b)<>before_balance THEN RAISE EXCEPTION 'Failed move changed balance';END IF;
 -- A deterministic non-natural initial hand, with a complete distinct deck.
 SELECT array_agg(v ORDER BY ord) INTO deck FROM (SELECT v,row_number() OVER() ord FROM unnest(ARRAY[4,5,6,7]||(SELECT array_agg(i) FROM generate_series(0,51)i WHERE i NOT IN(4,5,6,7)))v)s;
 UPDATE z_games SET created_at=now()-interval '1 minute' WHERE id=g;
 PERFORM z_blackjack(h,h,a,'audit_a','start',10,deck,NULL);
 DELETE FROM z_blackjack_secrets WHERE game_id=h;
 BEGIN
  PERFORM z_blackjack(h,gen_random_uuid(),a,'audit_a','hit',NULL,NULL,0);RAISE EXCEPTION 'Missing Blackjack secret accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Invalid game state' THEN RAISE;END IF;END;
 UPDATE z_runtime SET security_health=NULL WHERE id=1;
 x:=z_security_health();IF (x->>'game_state_issues')::integer<2 OR (x->>'ok')::boolean THEN RAISE EXCEPTION 'Missing secrets not detected';END IF;
 UPDATE z_users SET zs_balance=zs_balance+1 WHERE kick_user_id=a;
 UPDATE z_runtime SET security_health=NULL WHERE id=1;
 x:=z_security_health();IF (x->>'ledger_mismatches')::integer<1 THEN RAISE EXCEPTION 'Ledger tamper not detected';END IF;
 IF has_function_privilege('anon','z_security_health()','execute') OR has_function_privilege('authenticated','z_security_health()','execute') THEN RAISE EXCEPTION 'Private monitoring exposed';END IF;
END $$;
SELECT 'PASS: missing secrets fail closed; failed actions roll back; private integrity alarms detect tampering' result;
