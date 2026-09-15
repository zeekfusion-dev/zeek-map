do $$
declare r jsonb;
begin
 if has_table_privilege('anon','public.z_site_content','SELECT') then raise exception 'Public content table exposed'; end if;
 if has_function_privilege('authenticated','public.z_save_site_content(bigint,integer,jsonb)','EXECUTE') then raise exception 'Editor RPC exposed'; end if;
 begin perform z_save_site_content(99,0,'{}');raise exception 'Unauthorized save succeeded';exception when others then if sqlerrm='Unauthorized save succeeded' then raise;end if;end;
 select z_save_site_content(20306616,revision,content) into r from z_site_content where id=1;
 if r is null then raise exception 'Save failed';end if;
 if z_save_site_content(20306616,(r->>'revision')::int-1,r->'content') is not null then raise exception 'Stale edit overwrote content';end if;
end $$;
