begin;
create table z_social_connections(platform text primary key check(platform in('youtube','tiktok','instagram')),app_cipher text,token_cipher text,account text,cursor jsonb,generation uuid,last_sync timestamptz,error text,lease uuid,lease_until timestamptz);
insert into z_social_connections(platform) values('youtube'),('tiktok'),('instagram');
create table z_clips(platform text not null references z_social_connections,id text not null,title text not null,url text not null,thumbnail text,views bigint check(views>=0),published_at timestamptz,generation uuid,primary key(platform,id));
create index z_clips_popular on z_clips(views desc,platform,id) where views>2000;
create index z_clips_latest on z_clips(published_at desc);
alter table z_social_connections enable row level security;alter table z_clips enable row level security;
revoke all on z_social_connections,z_clips from public,anon,authenticated;
grant all on z_social_connections,z_clips to service_role;
create function z_claim_social(p_platform text,p_lease uuid) returns jsonb language plpgsql security definer set search_path=public as $$declare s z_social_connections;begin
 select * into s from z_social_connections where platform=p_platform for update;
 if s.token_cipher is null or s.lease_until>now() then return null;end if;
 update z_social_connections set lease=p_lease,lease_until=now()+interval '90 seconds',generation=coalesce(generation,gen_random_uuid()) where platform=p_platform returning * into s;return to_jsonb(s);
end$$;
create function z_finish_social(p_platform text,p_lease uuid,p_clips jsonb,p_cursor jsonb,p_token text) returns boolean language plpgsql security definer set search_path=public as $$declare s z_social_connections;begin
 select * into s from z_social_connections where platform=p_platform for update;if s.lease is distinct from p_lease then return false;end if;
 insert into z_clips(platform,id,title,url,thumbnail,views,published_at,generation)
 select p_platform,x.id,x.title,x.url,x.thumbnail,x.views,x.published_at,s.generation from jsonb_to_recordset(p_clips) as x(id text,title text,url text,thumbnail text,views bigint,published_at timestamptz)
 on conflict(platform,id) do update set title=excluded.title,url=excluded.url,thumbnail=excluded.thumbnail,views=excluded.views,published_at=excluded.published_at,generation=excluded.generation;
 if p_cursor is null then delete from z_clips where platform=p_platform and generation is distinct from s.generation;end if;
 update z_social_connections set cursor=p_cursor,generation=case when p_cursor is null then null else generation end,token_cipher=p_token,last_sync=case when p_cursor is null then now() else last_sync end,error=null,lease=null,lease_until=null where platform=p_platform;return true;
end$$;
revoke all on function z_claim_social(text,uuid),z_finish_social(text,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function z_claim_social(text,uuid),z_finish_social(text,uuid,jsonb,jsonb,text) to service_role;
notify pgrst,'reload schema';commit;
