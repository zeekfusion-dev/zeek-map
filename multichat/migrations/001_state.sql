begin;
-- Isolated multichat state; never shares website secrets or grants table access.
create table if not exists public.z_multichat_state (
  id integer primary key check (id=1),
  key_hash text not null check(length(key_hash)=64),
  cipher text,
  revision integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.z_multichat_state enable row level security;
revoke all on public.z_multichat_state from public,anon,authenticated;
grant all on public.z_multichat_state to service_role;

create or replace function public.z_multichat_read(p_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if length(p_key) < 43 or length(p_key)>128 then raise sqlstate '42501' using message='Invalid storage key'; end if;
 select jsonb_build_object('cipher',s.cipher,'revision',s.revision)
 into result from public.z_multichat_state s
 where s.id=1 and s.key_hash=encode(sha256(convert_to(p_key,'UTF8')),'hex');
 if result is null then raise sqlstate '42501' using message='Invalid storage key'; end if;
 return result;
end $$;

create or replace function public.z_multichat_write(p_key text,p_revision integer,p_cipher text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if length(p_key)<43 or length(p_key)>128 or p_cipher is null or length(p_cipher)>1500000 or p_cipher !~ '^[A-Za-z0-9_-]+$' then raise sqlstate '22023' using message='Invalid state'; end if;
 if not exists(select 1 from public.z_multichat_state where id=1 and key_hash=encode(sha256(convert_to(p_key,'UTF8')),'hex')) then raise sqlstate '42501' using message='Invalid storage key'; end if;
 update public.z_multichat_state set cipher=p_cipher,revision=revision+1,updated_at=now()
 where id=1 and revision=p_revision
 returning jsonb_build_object('revision',revision) into result;
 if result is null then raise sqlstate '23505' using message='State revision conflict'; end if;
 return result;
end $$;
revoke all on function public.z_multichat_read(text),public.z_multichat_write(text,integer,text) from public,anon,authenticated;
grant execute on function public.z_multichat_read(text),public.z_multichat_write(text,integer,text) to anon,service_role;
-- Provision the singleton with a random, dedicated key hash separately.
-- Never use a Supabase service-role key in Render.
notify pgrst,'reload schema';
commit;
