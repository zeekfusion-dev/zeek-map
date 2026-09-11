begin;
create or replace function z_arcade_profile(p_user bigint) returns jsonb language sql security definer set search_path=public as $$
select jsonb_build_object('available',greatest(0,u.zs_balance-u.arcade_excluded),'excluded',u.arcade_excluded,'rank',1+(select count(*) from z_users v where v.lifetime_zs>u.lifetime_zs or (v.lifetime_zs=u.lifetime_zs and v.username<u.username)),'locked',coalesce((select sum(stake) from z_games where creator=p_user and status='open'),0),'recent',(select coalesce(jsonb_agg(t),'[]') from(select id,kind,stake,side,status,winner_name,result,payout,created_at,resolved_at,creator=p_user as mine,winner=p_user as is_winner from z_games where creator=p_user or opponent=p_user order by created_at desc limit 20)t)) from z_users u where u.kick_user_id=p_user;
$$;
revoke all on function z_arcade_profile(bigint) from public,anon,authenticated;grant execute on function z_arcade_profile(bigint) to service_role;
create or replace function z_rank_activity() returns trigger language plpgsql security definer set search_path=public as $$declare oldrank integer;newrank integer;begin
 if new.lifetime_zs<=old.lifetime_zs then return new;end if;
 select count(*)+1 into oldrank from z_users where kick_user_id<>new.kick_user_id and (lifetime_zs>old.lifetime_zs or(lifetime_zs=old.lifetime_zs and username<old.username));
 select count(*)+1 into newrank from z_users where kick_user_id<>new.kick_user_id and (lifetime_zs>new.lifetime_zs or(lifetime_zs=new.lifetime_zs and username<new.username));
 if newrank<oldrank then insert into z_activity(username,kind,title) values(new.username,'rank','Climbed to #'||newrank||' · up '||(oldrank-newrank)||' places');end if;return new;end$$;
drop trigger if exists z_rank_movement on z_users;create trigger z_rank_movement after update of lifetime_zs on z_users for each row execute function z_rank_activity();
create or replace function z_streak_activity() returns trigger language plpgsql security definer set search_path=public as $$declare n integer;begin
 if new.status<>'resolved' or new.winner is null then return new;end if;
 select count(*) into n from(select winner from z_games where status='resolved' and (creator=new.winner or opponent=new.winner) order by resolved_at desc,id desc limit 3)t where winner=new.winner;
 if n=3 then insert into z_activity(username,kind,title) values(new.winner_name,'streak','Won their last 3 Arcade games');end if;return new;end$$;
drop trigger if exists z_game_streak on z_games;create trigger z_game_streak after insert or update on z_games for each row execute function z_streak_activity();
revoke all on function z_rank_activity(),z_streak_activity() from public,anon,authenticated;grant execute on function z_rank_activity(),z_streak_activity() to service_role;
notify pgrst,'reload schema';commit;
