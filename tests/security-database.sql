do $$declare k text:=repeat('a',64);begin
 if not z_rate_limit(k,2,60) or not z_rate_limit(k,2,60) or z_rate_limit(k,2,60) then raise exception 'Rate limit failed';end if;
 update z_rate_limits set expires_at=now()-interval '1 second' where key=k;
 if not z_rate_limit(k,2,60) then raise exception 'Rate limit reset failed';end if;
 if not z_process_chat('audit-event',99999,'test_viewer','audit-message','',now(),true) then raise exception 'First event failed';end if;
 if z_process_chat('audit-event',99999,'test_viewer','audit-message','',now(),true) then raise exception 'Duplicate event allowed';end if;
 if (select count(*) from z_outbox where dedupe='command:audit-message')<>1 then raise exception 'Duplicate command';end if;
 if exists(select 1 from pg_tables where schemaname='public' and tablename like 'z\_%' escape '\' and (not rowsecurity or has_table_privilege('anon','public.'||tablename,'SELECT') or has_table_privilege('authenticated','public.'||tablename,'UPDATE'))) then raise exception 'Unsafe table access';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'z\_%' escape '\' and has_function_privilege('anon',p.oid,'EXECUTE')) then raise exception 'Unsafe RPC access';end if;
end$$;
