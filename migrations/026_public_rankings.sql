begin;
create or replace function z_arcade_profile(p_user bigint) returns jsonb language sql security definer set search_path=public as $$
select jsonb_build_object('available',greatest(0,u.zs_balance-u.arcade_excluded),'excluded',u.arcade_excluded,'rank',case when u.kick_user_id=20306616 or lower(u.username)='zeekfusion' then null else 1+(select count(*) from z_users v where v.kick_user_id<>20306616 and lower(v.username)<>'zeekfusion' and (v.zs_balance>u.zs_balance or(v.zs_balance=u.zs_balance and v.username<u.username))) end,'lifetimeRank',case when u.kick_user_id=20306616 or lower(u.username)='zeekfusion' then null else 1+(select count(*) from z_users v where v.kick_user_id<>20306616 and lower(v.username)<>'zeekfusion' and (v.lifetime_zs>u.lifetime_zs or(v.lifetime_zs=u.lifetime_zs and v.username<u.username))) end,'locked',coalesce((select sum(stake) from z_games where creator=p_user and status='open'),0),'recent',(select coalesce(jsonb_agg(t),'[]') from(select id,kind,stake,side,status,winner_name,result,payout,created_at,resolved_at,creator=p_user as mine,winner=p_user as is_winner from z_games where creator=p_user or opponent=p_user order by created_at desc limit 20)t)) from z_users u where u.kick_user_id=p_user;
$$;
create or replace function z_rank_activity() returns trigger language plpgsql security definer set search_path=public as $$declare oldrank integer;newrank integer;begin
 if new.kick_user_id=20306616 or lower(new.username)='zeekfusion' or new.lifetime_zs<=old.lifetime_zs then return new;end if;
 select count(*)+1 into oldrank from z_users where kick_user_id<>20306616 and lower(username)<>'zeekfusion' and kick_user_id<>new.kick_user_id and (lifetime_zs>old.lifetime_zs or(lifetime_zs=old.lifetime_zs and username<old.username));
 select count(*)+1 into newrank from z_users where kick_user_id<>20306616 and lower(username)<>'zeekfusion' and kick_user_id<>new.kick_user_id and (lifetime_zs>new.lifetime_zs or(lifetime_zs=new.lifetime_zs and username<new.username));
 if newrank<oldrank then insert into z_activity(username,kind,title) values(new.username,'rank','Climbed to #'||newrank||' · up '||(oldrank-newrank)||' places');end if;return new;end$$;

notify pgrst,'reload schema';
commit;
