-- Hardening only: preserve account balances, history, credentials and grants.
ALTER FUNCTION public.z_clamp_excluded() SET search_path=pg_catalog,public;
ALTER FUNCTION public.z_verify_free_conversion() SET search_path=pg_catalog,public;
ALTER FUNCTION public.z_block_paid() SET search_path=pg_catalog,public;
ALTER FUNCTION public.z_label(numeric) SET search_path=pg_catalog,public;
ALTER FUNCTION public.z_free_settings() SET search_path=pg_catalog,public;
DO $patch$
DECLARE d text; marker text;
BEGIN
 marker:='select choice into firstchoice from z_rps_secrets where game_id=p_id;';
 SELECT pg_get_functiondef('public.z_rps_action(uuid,bigint,text,boolean,text)'::regprocedure) INTO d;
 IF position(marker IN d)=0 THEN RAISE EXCEPTION 'Unexpected RPS implementation'; END IF;
 EXECUTE replace(d,marker,marker||' if firstchoice is null or firstchoice not in(''rock'',''paper'',''scissors'') then raise exception ''Invalid game state'';end if;');
 marker:='version:=p_version+1;select * into s from z_blackjack_secrets where game_id=p_id;';
 SELECT pg_get_functiondef('public.z_blackjack(uuid,uuid,bigint,text,text,numeric,integer[],integer)'::regprocedure) INTO d;
 IF position(marker IN d)=0 THEN RAISE EXCEPTION 'Unexpected Blackjack implementation'; END IF;
 EXECUTE replace(d,marker,marker||' if s.game_id is null or s.deck is null or cardinality(s.deck)<1 or s.dealer is null or cardinality(s.dealer)<2 then raise exception ''Invalid game state'';end if;');
END $patch$;
ALTER TABLE public.z_runtime ADD COLUMN IF NOT EXISTS security_health jsonb;
CREATE OR REPLACE FUNCTION public.z_security_health() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE h jsonb; ledger bigint; payout bigint; secrets bigint;
BEGIN
 IF NOT pg_try_advisory_xact_lock(hashtextextended('z-security-health',0)) THEN RETURN NULL; END IF;
 SELECT security_health INTO h FROM public.z_runtime WHERE id=1;
 IF h IS NOT NULL AND (h->>'checked_at')::timestamptz>now()-interval '15 minutes' THEN RETURN h; END IF;
 SELECT count(*) INTO ledger FROM public.z_users u LEFT JOIN
 (SELECT kick_user_id,sum(amount) amount FROM public.z_transactions GROUP BY kick_user_id) t USING(kick_user_id)
 WHERE u.zs_balance<>coalesce(t.amount,0) OR u.zs_balance<0;
 SELECT count(*) INTO payout FROM public.z_games g LEFT JOIN public.z_transactions t ON t.kick_event_id='payout:'||g.id
 WHERE g.status='resolved' AND g.kind IN('mines','higher','blackjack','plinko') AND
 ((g.payout>0 AND (t.id IS NULL OR t.amount<>g.payout OR t.kick_user_id<>g.creator)) OR (g.payout=0 AND t.id IS NOT NULL));
 SELECT count(*) INTO secrets FROM public.z_games g WHERE
 (g.status='playing' AND ((g.kind='mines' AND (g.result ? 'board' OR NOT EXISTS(SELECT 1 FROM public.z_run_secrets s WHERE s.game_id=g.id)))
 OR (g.kind='blackjack' AND NOT EXISTS(SELECT 1 FROM public.z_blackjack_secrets s WHERE s.game_id=g.id))))
 OR (g.status='open' AND g.kind='rps' AND NOT EXISTS(SELECT 1 FROM public.z_rps_secrets s WHERE s.game_id=g.id));
 h:=jsonb_build_object('checked_at',now(),'ok',ledger=0 AND payout=0 AND secrets=0,'ledger_mismatches',ledger,'payout_mismatches',payout,'game_state_issues',secrets);
 UPDATE public.z_runtime SET security_health=h WHERE id=1;
 RETURN h;
END $$;
-- New monitoring function is private from creation; existing permissions unchanged.
REVOKE ALL ON FUNCTION public.z_security_health() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.z_security_health() TO service_role;
