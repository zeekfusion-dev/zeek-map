begin;
-- Preserve the deployed functions, locks, permissions and all existing balances.
-- Fail closed if a prior migration changed the expected wager guards.
do $$declare f text; signature text; old_guard text; new_guard text;begin
 for signature,old_guard,new_guard in select * from (values
 ('z_play(uuid,bigint,text,text,numeric,text,jsonb)','p_stake>10)','p_stake>10000)'),
 ('z_run_start(uuid,bigint,text,text,numeric,integer,integer[])','p_stake not between 1 and 10 or','p_stake not between 1 and 10000 or'),
 ('z_blackjack(uuid,uuid,bigint,text,text,numeric,integer[],integer)','p_stake not between 1 and 10 or','p_stake not between 1 and 10000 or')) t loop
 select pg_get_functiondef(signature::regprocedure) into f;
 if strpos(f,old_guard)=0 then raise exception 'Unexpected wager definition: %',signature;end if;
 execute replace(f,old_guard,new_guard);
 end loop;
end$$;
update z_config set settings=settings||'{"botrix_points_per_z":1,"question_z":100}'::jsonb where id=1;
-- Owner-edited help text uses the existing revision-checked, owner-only content store.
update z_site_content set content=content||jsonb_build_object('howItWorks',$help${"title":"SHOW UP. STACK Zs. JOIN IN.","intro":"Win trivia, play games, and unlock your next stream interaction.","sections":[{"title":"Answer trivia questions in Zeek’s chat to earn Zs.","body":"The first correct trivia answer wins {triviaReward}. Questions run every {triviaMinutes} minutes while live, with {answerSeconds} seconds to answer.\n\nType !zs in Kick chat to see your balance."},{"title":"Use Zs to unlock stream interactions and forfeits.","body":"Spend Zs on stream interactions.\n\nA moderator deducts your BotRix points and approves the conversion.\n\n{conversion}"},{"title":"Play Arcade games to risk your Zs and win more.","body":"Coin Flip reserves your wager until another player accepts or you cancel. Both sides have a 50% chance. The winner receives the full pot, including their stake.\n\nPlinko uses eight independent turns generated on the server. Check every multiplier and its odds in the Arcade before playing."}]}$help$::jsonb),revision=revision+1,updated_at=now() where id=1 and not(content ? 'howItWorks');
-- Separate scheduler health from chat-delivery errors. Do not clear failed messages.
alter table z_runtime add column if not exists tick_error text;
update z_runtime set tick_error=bot_error,bot_error=null where id=1 and bot_error is not null and not exists(select 1 from z_outbox where status in('failed','sending'));
do $$declare f text;needle text:='if receipt is null then return false;end if;';begin
 select pg_get_functiondef('z_process_chat(text,bigint,text,text,text,timestamptz,boolean)'::regprocedure) into f;
 if strpos(f,needle)=0 then raise exception 'Unexpected chat receipt definition';end if;
 execute replace(f,needle,needle||' update z_runtime set last_webhook_at=now() where id=1;');
end$$;
notify pgrst,'reload schema';
commit;
