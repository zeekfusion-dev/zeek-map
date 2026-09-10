begin;
create table if not exists public.z_giveaways(id uuid primary key default gen_random_uuid(),title text not null,description text not null default '',closes_at timestamptz not null,status text not null default 'draft' check(status in('draft','open','drawn','cancelled')),winner_id bigint,winner_username text,drawn_at timestamptz,created_at timestamptz default now());
create table if not exists public.z_giveaway_entries(giveaway_id uuid not null references public.z_giveaways,kick_user_id bigint not null,username text not null,created_at timestamptz default now(),primary key(giveaway_id,kick_user_id));
alter table public.z_giveaways enable row level security;
alter table public.z_giveaway_entries enable row level security;
revoke all on public.z_giveaways,public.z_giveaway_entries from anon,authenticated;
grant all on public.z_giveaways,public.z_giveaway_entries to service_role;
create or replace function public.z_enter_giveaway(p_id uuid,p_user bigint,p_name text) returns void language plpgsql security definer set search_path=public as $$declare g z_giveaways;begin
 select * into g from z_giveaways where id=p_id for update;
 if g.id is null or g.status<>'open' or g.closes_at<now() or p_user=20306616 then raise exception 'Entries are closed';end if;
 insert into z_giveaway_entries values(p_id,p_user,p_name,now()) on conflict do nothing;end$$;
create or replace function public.z_draw_giveaway(p_id uuid,p_actor bigint,p_index integer) returns jsonb language plpgsql security definer set search_path=public as $$declare g z_giveaways;e z_giveaway_entries;begin
 if p_actor<>20306616 then raise exception 'Owner required';end if;
 select * into g from z_giveaways where id=p_id for update;
 if g.status<>'open' or g.closes_at>now() then raise exception 'Giveaway must be closed for entries';end if;
 select * into e from z_giveaway_entries where giveaway_id=p_id order by kick_user_id offset p_index limit 1;
 if e.kick_user_id is null then raise exception 'No eligible entry';end if;
 update z_giveaways set status='drawn',winner_id=e.kick_user_id,winner_username=e.username,drawn_at=now() where id=p_id;
 insert into z_admin_log(actor,action,details) values(p_actor,'giveaway_draw',jsonb_build_object('id',p_id,'winner_id',e.kick_user_id));
 return jsonb_build_object('username',e.username);end$$;
create or replace function public.z_admin_adjust(p_actor bigint,p_user bigint,p_name text,p_amount numeric,p_reason text,p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$declare result jsonb;begin
 if p_actor<>20306616 or length(trim(p_reason))<3 then raise exception 'Owner and reason required';end if;
 result:=z_award(p_user,p_name,p_amount,p_reason,'admin:'||p_id);
 if (result->>'awarded')::boolean then insert into z_admin_log(actor,action,details) values(p_actor,'balance_adjustment',jsonb_build_object('user',p_user,'amount',p_amount,'reason',p_reason));end if;return result;end$$;
revoke all on function public.z_enter_giveaway(uuid,bigint,text),public.z_draw_giveaway(uuid,bigint,integer),public.z_admin_adjust(bigint,bigint,text,numeric,text,uuid) from public,anon,authenticated;
grant execute on function public.z_enter_giveaway(uuid,bigint,text),public.z_draw_giveaway(uuid,bigint,integer),public.z_admin_adjust(bigint,bigint,text,numeric,text,uuid) to service_role;
notify pgrst,'reload schema';
commit;
