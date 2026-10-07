-- Defense in depth. No economic rules or existing balances are changed.
ALTER TABLE public.z_users ADD CONSTRAINT z_users_finite_balances CHECK (
 zs_balance::text NOT IN ('NaN','Infinity','-Infinity') AND
 lifetime_zs::text NOT IN ('NaN','Infinity','-Infinity') AND
 arcade_excluded::text NOT IN ('NaN','Infinity','-Infinity'));
ALTER TABLE public.z_transactions ADD CONSTRAINT z_transactions_finite_amount CHECK (amount::text NOT IN ('NaN','Infinity','-Infinity'));
ALTER TABLE public.z_games ADD CONSTRAINT z_games_finite_money CHECK (
 stake::text NOT IN ('NaN','Infinity','-Infinity') AND
 (payout IS NULL OR (payout >= 0 AND payout::text NOT IN ('NaN','Infinity','-Infinity'))));

CREATE OR REPLACE FUNCTION public.z_arcade_move(p_user bigint,p_amount numeric,p_reason text,p_event text,p_earned numeric DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u z_users; prior z_transactions;
BEGIN
 IF p_user IS NULL OR p_amount IS NULL OR p_earned IS NULL OR
 p_amount::text IN ('NaN','Infinity','-Infinity') OR p_earned::text IN ('NaN','Infinity','-Infinity') OR
 p_earned<0 OR p_event IS NULL OR length(p_event) NOT BETWEEN 1 AND 200 OR
 p_reason IS NULL OR length(p_reason) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid request'; END IF;
 SELECT * INTO u FROM z_users WHERE kick_user_id=p_user FOR UPDATE;
 IF u.kick_user_id IS NULL THEN RAISE EXCEPTION 'Insufficient Zs'; END IF;
 SELECT * INTO prior FROM z_transactions WHERE kick_event_id=p_event;
 IF FOUND THEN
  IF prior.kick_user_id<>p_user OR prior.amount<>p_amount OR prior.reason<>p_reason THEN RAISE EXCEPTION 'Invalid request'; END IF;
  RETURN;
 END IF;
 IF p_amount<0 AND u.zs_balance+p_amount<u.arcade_excluded THEN RAISE EXCEPTION 'Insufficient free-earned Zs'; END IF;
 INSERT INTO z_transactions(kick_user_id,amount,reason,kick_event_id,metadata) VALUES(p_user,p_amount,p_reason,p_event,'{"arcade":true}');
 UPDATE z_users SET zs_balance=zs_balance+p_amount,lifetime_zs=lifetime_zs+p_earned,updated_at=now() WHERE kick_user_id=p_user;
END $$;
REVOKE ALL ON FUNCTION public.z_arcade_move(bigint,numeric,text,text,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.z_arcade_move(bigint,numeric,text,text,numeric) TO service_role;

-- Fail closed if a secret board is missing/corrupt, including on cashout.
DO $migration$
DECLARE definition text; marker text := 'mult:=(r->>''multiplier'')::numeric;pay:=g.payout;';
BEGIN
 SELECT pg_get_functiondef('public.z_run_step(uuid,uuid,bigint,integer,text,integer,integer)'::regprocedure) INTO definition;
 IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Unexpected z_run_step definition'; END IF;
 definition:=replace(definition,marker,$guard$
 IF g.kind='mines' THEN
  SELECT s.tiles INTO tiles FROM z_run_secrets s WHERE game_id=p_id;
  IF tiles IS NULL OR array_ndims(tiles)<>1 OR cardinality(tiles) NOT BETWEEN 1 AND 20 OR
   cardinality(tiles)<>(r->>'mines')::integer OR
   EXISTS(SELECT 1 FROM unnest(tiles) t WHERE t IS NULL OR t NOT BETWEEN 0 AND 24) OR
   (SELECT count(DISTINCT t) FROM unnest(tiles) t)<>cardinality(tiles)
  THEN RAISE EXCEPTION 'Invalid game state'; END IF;
 END IF;
 mult:=(r->>'multiplier')::numeric;pay:=g.payout;
$guard$);
 EXECUTE definition;
END $migration$;
