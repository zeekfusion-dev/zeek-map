-- Run after migration 026 in a rolled-back transaction.
do $$declare saved numeric;profile jsonb;expected bigint;begin
 select zs_balance into saved from z_users where kick_user_id=20306616;
 insert into z_users(kick_user_id,username,zs_balance,lifetime_zs) values(9999999031,'z_test_ranking_a',10,10),(9999999032,'z_test_ranking_b',20,20);
 select count(*)+1 into expected from z_users where kick_user_id<>20306616 and lower(username)<>'zeekfusion' and (zs_balance>10 or(zs_balance=10 and username<'z_test_ranking_a'));
 profile:=z_arcade_profile(9999999031);
 if (profile->>'rank')::bigint<>expected then raise exception 'Incorrect public rank';end if;
 profile:=z_arcade_profile(20306616);
 if profile->>'rank' is not null or profile->>'lifetimeRank' is not null then raise exception 'Owner has public rank';end if;
 if (select zs_balance from z_users where kick_user_id=20306616) is distinct from saved then raise exception 'Owner balance changed';end if;
end$$;
select 'PASS: public ranks exclude owner, owner is unranked, balance preserved' as result;
