begin;
-- Retire the old fractional KICKs path, even if a stale caller supplies events.
create or replace function public.z_award_kicks(p_user bigint,p_name text,p_kicks bigint,p_event text) returns jsonb language sql security definer set search_path=public as $$select null::jsonb$$;
create or replace function z_free_settings() returns trigger language plpgsql as $$begin new.settings:=new.settings||'{"subscription_z":0,"gift_z":0,"renewal_z":0,"kicks_enabled":false}';return new;end$$;
drop trigger if exists z_force_free_settings on z_config;create trigger z_force_free_settings before insert or update on z_config for each row execute function z_free_settings();
revoke all on function z_free_settings() from public,anon,authenticated;
notify pgrst,'reload schema';commit;
