begin;
do $$declare f text; signature text; old_guard text; new_guard text;begin
 for signature,old_guard,new_guard in select * from (values
 ('z_play(uuid,bigint,text,text,numeric,text,jsonb)','p_stake>5000)','p_stake>4000)'),
 ('z_run_start(uuid,bigint,text,text,numeric,integer,integer[])','p_stake not between 1 and 5000 or','p_stake not between 1 and 4000 or'),
 ('z_blackjack(uuid,uuid,bigint,text,text,numeric,integer[],integer)','p_stake not between 1 and 5000 or','p_stake not between 1 and 4000 or')) t loop
 select pg_get_functiondef(signature::regprocedure) into f;
 if strpos(f,old_guard)>0 then execute replace(f,old_guard,new_guard);
 elsif strpos(f,new_guard)=0 then raise exception 'Unexpected wager definition: %',signature;end if;
 end loop;
end$$;
commit;
