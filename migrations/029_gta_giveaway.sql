begin;
create table public.gta_campaign (
 id integer primary key check(id=1),
 opened_at timestamptz not null,
 closed_at timestamptz,
 check(closed_at is null or closed_at>=opened_at)
);
create table public.gta_streams (
 started_at timestamptz primary key,
 ended_at timestamptz,
 verified_through timestamptz not null,
 skipped_blocks integer[] not null default '{}',
 offline boolean not null default false,
 checkpoint_seed uuid not null default gen_random_uuid(),
 check(ended_at is null or ended_at>=started_at)
);
create table public.gta_checkins (
 stream_at timestamptz not null references public.gta_streams,
 block integer not null check(block>=0),
 user_id bigint not null check(user_id>0),
 username text not null check(char_length(username) between 1 and 100),
 last_chat_at timestamptz not null,
 primary key(stream_at,block,user_id)
);
create table public.gta_passes (
 user_id bigint primary key check(user_id>0)
);
create table public.gta_bonuses (
 stream_at timestamptz not null references public.gta_streams,
 place smallint not null check(place between 1 and 3),
 user_id bigint not null check(user_id>0),
 username text not null check(char_length(username) between 1 and 100),
 primary key(stream_at,place),
 unique(stream_at,user_id)
);
alter table public.gta_bonuses enable row level security;
revoke all on public.gta_bonuses from public,anon,authenticated;
grant select,insert on public.gta_bonuses to service_role;

-- A private, durable seed gives each block one unpredictable time in its final
-- ten minutes. Never expose seed or upcoming times through the public API.
create function public.gta_checkpoint(start_at timestamptz,seed uuid,b integer)
returns timestamptz language sql stable strict set search_path='' as $$
 select start_at+(b::bigint*1800+1200+
   (('x'||substr(md5(seed::text||':'||b::text),1,8))::bit(32)::bigint % 600))*interval '1 second'
$$;
create function public.gta_bucket(start_at timestamptz,seed uuid,at_time timestamptz)
returns integer language sql stable strict set search_path='' as $$
 select b+(at_time>=public.gta_checkpoint(start_at,seed,b))::int
 from (select greatest(0,floor(extract(epoch from (at_time-start_at))/1800)::int) i) n(b)
$$;
revoke all on function public.gta_checkpoint(timestamptz,uuid,integer),public.gta_bucket(timestamptz,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.gta_checkpoint(timestamptz,uuid,integer),public.gta_bucket(timestamptz,uuid,timestamptz) to service_role;
alter table public.gta_campaign enable row level security;
alter table public.gta_streams enable row level security;
alter table public.gta_checkins enable row level security;
alter table public.gta_passes enable row level security;
revoke all on public.gta_campaign,public.gta_streams,public.gta_checkins,public.gta_passes from public,anon,authenticated;
grant select,insert,update on public.gta_campaign,public.gta_streams,public.gta_checkins to service_role;
grant select,insert,delete on public.gta_passes to service_role;

-- Serializes stream observations and check-ins for a single channel. A missing poll does
-- not count an unverified interval; resume only from a subsequent healthy full block.
create function public.gta_observe(p_live boolean,p_start timestamptz,p_at timestamptz,p_end timestamptz default null)
returns void language plpgsql set search_path='' as $$
declare campaign public.gta_campaign%rowtype; s public.gta_streams%rowtype;
        baseline timestamptz; first_block integer; last_block integer; seed uuid;
begin
 select * into campaign from public.gta_campaign where id=1 and closed_at is null for update;
 if not found then return; end if;
 if p_at>now()+interval '15 seconds' or p_at<campaign.opened_at then return; end if;
 if p_live then
  if p_start is null or p_start>p_at then return; end if;
  -- An obsolete start for an earlier broadcast must not affect a newer stream.
  if exists(select 1 from public.gta_streams where started_at>p_start) then return; end if;
  update public.gta_streams set offline=true where started_at<p_start and not offline;
  select * into s from public.gta_streams where started_at=p_start;
  baseline:=greatest(p_start,campaign.opened_at);
  if not found then
   seed:=gen_random_uuid();
   first_block:=public.gta_bucket(p_start,seed,baseline);
   last_block:=public.gta_bucket(p_start,seed,p_at);
   insert into public.gta_streams(started_at,verified_through,checkpoint_seed,skipped_blocks)
     values(p_start,p_at,seed,case when p_at-baseline>interval '150 seconds' then array(select generate_series(first_block,last_block)) else '{}'::integer[] end);
  elsif s.ended_at is null and p_at>s.verified_through then
   first_block:=public.gta_bucket(p_start,s.checkpoint_seed,s.verified_through);
   last_block:=public.gta_bucket(p_start,s.checkpoint_seed,p_at);
   update public.gta_streams set offline=false,verified_through=p_at,
    skipped_blocks=case when s.offline or p_at-s.verified_through>interval '150 seconds'
     then array(select distinct x from unnest(s.skipped_blocks||array(select generate_series(first_block,last_block))) x)
     else s.skipped_blocks end where started_at=p_start;
  end if;
 elsif p_start is not null and p_end is not null and p_end>=p_start and p_end<=p_at then
  -- Signed end events carry the actual end time. Delayed delivery is not an extra live block.
  update public.gta_streams set offline=true,ended_at=p_end,
   verified_through=case when p_end-verified_through<=interval '150 seconds'
    then greatest(p_end,verified_through) else verified_through end
   where started_at=p_start and ended_at is null;
 else
  -- A channel poll saying "offline" doesn't tell us the time it ended.
  update public.gta_streams set offline=true where not offline and verified_through<=p_at;
 end if;
end$$;

create function public.gta_record_chat(p_user bigint,p_name text,p_at timestamptz)
returns boolean language plpgsql set search_path='' as $$
declare c public.gta_campaign%rowtype; s public.gta_streams%rowtype; b integer;
begin
 if p_user<=0 or char_length(p_name) not between 1 and 100 or p_at>now()+interval '15 seconds' then return false; end if;
 select * into c from public.gta_campaign where id=1 and closed_at is null for update;
 if not found or p_at<c.opened_at then return false; end if;
 select * into s from public.gta_streams where started_at<=p_at order by started_at desc limit 1;
 if not found or (s.ended_at is not null and p_at>=s.ended_at)
    or (s.offline and p_at>s.verified_through) or p_at>s.verified_through+interval '150 seconds' then return false; end if;
 b:=public.gta_bucket(s.started_at,s.checkpoint_seed,p_at);

 insert into public.gta_checkins values(s.started_at,b,p_user,p_name,p_at)
 on conflict(stream_at,block,user_id) do update set username=excluded.username,last_chat_at=excluded.last_chat_at
 where excluded.last_chat_at>gta_checkins.last_chat_at;
 return true;
end$$;

-- Award an explicitly named top three, atomically and only once for an ended
-- broadcast. Match only captured eligible handles, never accept raw IDs from UI.
create function public.gta_award_bonus(p_stream timestamptz,p_names text[])
returns text language plpgsql set search_path='' as $$
declare ids bigint[]:='{}'; names text[]:='{}'; candidate record; n integer;
 c public.gta_campaign%rowtype; s public.gta_streams%rowtype;
begin
 select * into c from public.gta_campaign where id=1 and closed_at is null for update;
 if not found then return 'campaign_closed'; end if;
 if coalesce(cardinality(p_names),0)<>3 or array_lower(p_names,1)<>1 then return 'invalid_names'; end if;
 select * into s from public.gta_streams where started_at=p_stream;
 if not found or s.ended_at is null then return 'stream_not_ended'; end if;
 for n in 1..3 loop
  if p_names[n] is null or p_names[n]!~'^[a-zA-Z0-9_-]{1,100}$' then return 'invalid_names'; end if;
  select count(distinct a.user_id) as matches,min(a.user_id) as id,
     (array_agg(a.username order by a.last_chat_at desc))[1] as handle into candidate
  from public.gta_checkins a
  where a.stream_at=p_stream and a.last_chat_at<s.ended_at and lower(a.username)=lower(p_names[n]);
  if candidate.matches<>1 then return 'unmatched_handle'; end if;
  if candidate.id=any(ids) then return 'duplicate_handle'; end if;
  ids:=array_append(ids,candidate.id);
  names:=array_append(names,candidate.handle);
 end loop;
 if exists(select 1 from public.gta_bonuses where stream_at=p_stream) then
  if ids=(select array_agg(user_id order by place) from public.gta_bonuses where stream_at=p_stream) then return 'unchanged'; end if;
  return 'already_awarded';
 end if;
 insert into public.gta_bonuses(stream_at,place,user_id,username)
 select p_stream,i,ids[i],names[i] from generate_series(1,3) i;
 return 'awarded';
end$$;
revoke all on function public.gta_award_bonus(timestamptz,text[]) from public,anon,authenticated;
grant execute on function public.gta_award_bonus(timestamptz,text[]) to service_role;

create function public.gta_standings()
returns jsonb language sql stable set search_path='' as $$
 with live as (
  select s.* from public.gta_streams s order by started_at desc limit 1
 ), qualifying as (
  select a.user_id,a.username,a.last_chat_at,1 as points from public.gta_checkins a join public.gta_streams s on s.started_at=a.stream_at
  cross join public.gta_campaign c
  where not a.block=any(s.skipped_blocks)
    and public.gta_checkpoint(a.stream_at,s.checkpoint_seed,a.block)
      <=least(s.verified_through,coalesce(s.ended_at,'infinity'),coalesce(c.closed_at,'infinity'),now())
  union all
  select b.user_id,b.username,s.ended_at,4-b.place
  from public.gta_bonuses b join public.gta_streams s on s.started_at=b.stream_at
 ), ranked as (
  select (array_agg(username order by last_chat_at desc))[1] as username,sum(points) xp
  from qualifying q
  where not exists(select 1 from public.gta_passes p where p.user_id=q.user_id) group by q.user_id
 ), top_rows as (
  select rank() over(order by xp desc) as rank,username,xp from ranked order by xp desc,lower(username) asc limit 100
 )
 select jsonb_build_object(
  'status',coalesce((select case when c.closed_at is not null then 'closed'
    when live.offline or live.started_at is null then 'paused'
    when live.verified_through<now()-interval '150 seconds' then 'stale'
    else 'live' end from public.gta_campaign c left join live on true),'preview'),
  'skippedWindows',coalesce((select sum(cardinality(skipped_blocks)) from public.gta_streams),0),
  'entries',coalesce((select jsonb_agg(to_jsonb(top_rows) order by rank,lower(username)) from top_rows),'[]'::jsonb)
 );
$$;
revoke all on function public.gta_observe(boolean,timestamptz,timestamptz,timestamptz),public.gta_record_chat(bigint,text,timestamptz),public.gta_standings() from public,anon,authenticated;
grant execute on function public.gta_observe(boolean,timestamptz,timestamptz,timestamptz),public.gta_record_chat(bigint,text,timestamptz),public.gta_standings() to service_role;
commit;
