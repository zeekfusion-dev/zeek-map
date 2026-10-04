begin;
do $$
declare test_round uuid:=gen_random_uuid();u bigint:=936169801;
begin
 if exists(select 1 from z_users where kick_user_id in(u,u+1)) then raise exception 'Test user collision';end if;
 if exists(select 1 from z_rounds where status in('open','pending')) then raise exception 'Wait until no live question is active';end if;
 insert into z_rounds(id,question,answers,reward,status,opened_at,expires_at)
 values(test_round,'What is 7 + 8?',array['15','fifteen'],100,'open',now()-interval '5 seconds',now()+interval '55 seconds');
 perform z_process_chat('health-wrong',u,'trivia_health_test','health-wrong','16',now(),false);
 assert not exists(select 1 from z_users where kick_user_id=u);
 assert z_process_chat('health-correct',u,'trivia_health_test','health-correct','15',now(),false);
 assert (select zs_balance from z_users where kick_user_id=u)=100;
 assert (select winner_id from z_rounds where id=test_round)=u;
 assert exists(select 1 from z_outbox where dedupe='winner:'||test_round and content like '%100 Zs%');
 assert not z_process_chat('health-correct',u,'trivia_health_test','health-correct','15',now(),false);
 assert not z_process_chat('health-second',u+1,'trivia_health_second','health-second','15',now(),false);
 assert (select zs_balance from z_users where kick_user_id=u)=100;
 assert not exists(select 1 from z_users where kick_user_id=u+1);
end$$;
rollback;
