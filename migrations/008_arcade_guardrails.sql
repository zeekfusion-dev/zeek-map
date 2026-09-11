begin;
create index if not exists z_users_ranking on z_users(lifetime_zs desc,username asc);
create or replace function z_clamp_excluded() returns trigger language plpgsql as $$begin new.arcade_excluded:=least(new.arcade_excluded,greatest(new.zs_balance,0));return new;end$$;
drop trigger if exists z_clamp_legacy on z_users;create trigger z_clamp_legacy before update of zs_balance on z_users for each row execute function z_clamp_excluded();
create or replace function z_verify_free_conversion() returns trigger language plpgsql as $$begin
 if new.status='approved' and old.status='pending' and coalesce(new.proof,'') not like 'FREE-EARNED VERIFIED: %' then raise exception 'Verify free-earned BotRix provenance before approval';end if;return new;end$$;
drop trigger if exists z_free_conversion_only on z_conversion_tickets;create trigger z_free_conversion_only before update of status on z_conversion_tickets for each row execute function z_verify_free_conversion();
revoke all on function z_clamp_excluded(),z_verify_free_conversion() from public,anon,authenticated;
notify pgrst,'reload schema';commit;
