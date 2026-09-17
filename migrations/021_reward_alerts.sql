begin;
alter table z_rewards add column thumbnail_url text not null default '',add column image_url text not null default '',add column audio_url text not null default '',add column alert_duration numeric not null default 8 check(alert_duration between 2 and 120),add column alert_volume numeric not null default 80 check(alert_volume between 0 and 100),add column cooldown_seconds integer not null default 0 check(cooldown_seconds between 0 and 86400),add column last_redeemed_at timestamptz;
create table z_overlay_settings(id integer primary key check(id=1),nonce uuid not null default gen_random_uuid(),publishable_key text);
insert into z_overlay_settings(id) values(1);
create table z_reward_alerts(id uuid primary key default gen_random_uuid(),sequence bigint generated always as identity unique,redemption_id uuid unique references z_redemptions,username text not null,title text not null,image_url text not null,audio_url text not null,duration numeric not null check(duration between 2 and 120),volume numeric not null check(volume between 0 and 100),status text not null default 'pending' check(status in('pending','playing','played','failed','cancelled')),claimed_by uuid,lease_until timestamptz,created_at timestamptz not null default now(),finished_at timestamptz,is_test boolean not null default false);
create index z_alert_pending on z_reward_alerts(sequence) where status in('pending','playing');
create function z_alert_wakeup() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 -- A wake-up carries no user information and cannot authorize an alert.
 perform realtime.send('{"changed":true}'::jsonb,'changed','zeek-reward-alerts',false);return new;
end$$;
create trigger z_reward_alert_signal after insert on z_reward_alerts for each row execute function z_alert_wakeup();
create or replace function z_redeem(p_user bigint,p_name text,p_reward uuid,p_request uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare r z_rewards;x z_redemptions;begin
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 select * into x from z_redemptions where id=p_request;
 if x.id is not null then if x.kick_user_id<>p_user or x.reward_id<>p_reward then raise exception 'Invalid request';end if;return to_jsonb(x);end if;
 select * into r from z_rewards where id=p_reward for update;
 if r.id is null or not r.enabled or r.stock=0 then raise exception 'Reward unavailable';end if;
 if r.last_redeemed_at+make_interval(secs=>r.cooldown_seconds)>clock_timestamp() then raise exception 'Reward is cooling down. Please try again shortly.';end if;
 perform z_award(p_user,p_name,-r.cost,'Redeemed: '||r.title,'redeem:'||p_request);
 insert into z_redemptions(id,kick_user_id,reward_id,title,cost) values(p_request,p_user,r.id,r.title,r.cost) returning * into x;
 update z_rewards set stock=case when stock is null then null else stock-1 end,last_redeemed_at=clock_timestamp() where id=r.id;
 -- Snapshot the settings so later edits cannot alter an already purchased alert.
 insert into z_reward_alerts(redemption_id,username,title,image_url,audio_url,duration,volume) values(p_request,p_name,r.title,r.image_url,r.audio_url,r.alert_duration,r.alert_volume);
 return to_jsonb(x);
end$$;
create function z_claim_alert(p_client uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$declare a z_reward_alerts;begin
 if p_client is null then raise exception 'Invalid client';end if;
 perform pg_advisory_xact_lock(hashtextextended('z-reward-alert-queue',0));
 select * into a from z_reward_alerts where status='playing' order by sequence limit 1 for update;
 if found and a.lease_until>clock_timestamp() then
  if a.claimed_by=p_client then return jsonb_build_object('alert',to_jsonb(a));end if;
  return jsonb_build_object('retryAfter',greatest(1,ceil(extract(epoch from a.lease_until-clock_timestamp()))));
 end if;
 if found then update z_reward_alerts set status='pending',claimed_by=null,lease_until=null where id=a.id;end if;
 select * into a from z_reward_alerts where status='pending' order by sequence limit 1 for update;
 if not found then return jsonb_build_object('alert',null);end if;
 update z_reward_alerts set status='playing',claimed_by=p_client,lease_until=clock_timestamp()+make_interval(secs=>duration::double precision+30) where id=a.id returning * into a;
 return jsonb_build_object('alert',to_jsonb(a));
end$$;
create function z_finish_alert(p_id uuid,p_client uuid,p_failed boolean default false) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$begin
 perform pg_advisory_xact_lock(hashtextextended('z-reward-alert-queue',0));
 update z_reward_alerts set status=case when p_failed then 'failed' else 'played' end,finished_at=clock_timestamp(),lease_until=null where id=p_id and claimed_by=p_client and status='playing';
 return found or exists(select 1 from z_reward_alerts where id=p_id and claimed_by=p_client and status in('played','failed'));
end$$;
-- Refund before playback cancels that alert; already-playing alerts finish normally.
create function z_cancel_refunded_alert() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$begin
 if new.status='refunded' and old.status<>'refunded' then update z_reward_alerts set status='cancelled',finished_at=now() where redemption_id=new.id and status='pending';end if;return new;
end$$;
create trigger z_refunded_alert after update of status on z_redemptions for each row execute function z_cancel_refunded_alert();
-- Uploaded assets are intended for public reward cards/stream display; only the server signs uploads.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('z-reward-media','z-reward-media',true,20971520,array['image/png','image/jpeg','image/gif','image/webp','audio/mpeg','audio/wav','audio/x-wav','audio/ogg','audio/mp4']);
do $$declare t text;f regprocedure;begin
 foreach t in array array['z_overlay_settings','z_reward_alerts'] loop execute format('alter table %I enable row level security',t);execute format('revoke all on %I from public,anon,authenticated',t);execute format('grant all on %I to service_role',t);end loop;
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('z_alert_wakeup','z_claim_alert','z_finish_alert','z_cancel_refunded_alert','z_redeem') loop execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to service_role',f);end loop;
end$$;
grant usage,select on sequence z_reward_alerts_sequence_seq to service_role;
-- Primary rank is current balance. Keep lifetime rank available alongside it.
create or replace function z_arcade_profile(p_user bigint) returns jsonb language sql security definer set search_path=public as $$
select jsonb_build_object('available',greatest(0,u.zs_balance-u.arcade_excluded),'excluded',u.arcade_excluded,'rank',1+(select count(*) from z_users v where v.zs_balance>u.zs_balance or(v.zs_balance=u.zs_balance and v.username<u.username)),'lifetimeRank',1+(select count(*) from z_users v where v.lifetime_zs>u.lifetime_zs or(v.lifetime_zs=u.lifetime_zs and v.username<u.username)),'locked',coalesce((select sum(stake) from z_games where creator=p_user and status='open'),0),'recent',(select coalesce(jsonb_agg(t),'[]') from(select id,kind,stake,side,status,winner_name,result,payout,created_at,resolved_at,creator=p_user as mine,winner=p_user as is_winner from z_games where creator=p_user or opponent=p_user order by created_at desc limit 20)t)) from z_users u where u.kick_user_id=p_user;
$$;
notify pgrst,'reload schema';
commit;
