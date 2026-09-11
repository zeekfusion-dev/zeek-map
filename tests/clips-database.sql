do $$declare s jsonb;l uuid:='80000000-0000-4000-8000-000000000001';begin
 update z_social_connections set token_cipher='fixture',app_cipher='fixture' where platform='instagram';
 s:=z_claim_social('instagram',l);if s is null then raise exception 'Lease missing';end if;
 if z_claim_social('instagram',gen_random_uuid()) is not null then raise exception 'Concurrent sync accepted';end if;
 if not z_finish_social('instagram',l,'[{"id":"one","title":"First","url":"https://www.instagram.com/reel/one/","views":10000},{"id":"two","title":"Second","url":"https://www.instagram.com/reel/two/","views":10001}]','{"after":"second-page"}','fixture') then raise exception 'Page save failed';end if;
 if (select count(*) from z_clips where views>10000)<>1 then raise exception 'Popular boundary';end if;
 if (select last_sync from z_social_connections where platform='instagram') is not null then raise exception 'Incomplete sync called complete';end if;
 s:=z_claim_social('instagram',l);perform z_finish_social('instagram',l,'[{"id":"three","title":"Third","url":"https://www.instagram.com/reel/three/","views":3000}]',null,'fixture');
 if (select count(*) from z_clips)<>3 then raise exception 'Earlier pages lost';end if;
 if (select last_sync from z_social_connections where platform='instagram') is null then raise exception 'Sync completion missing';end if;
 if z_finish_social('instagram',gen_random_uuid(),'[]',null,'fixture') then raise exception 'Stale worker accepted';end if;
 s:=z_claim_social('instagram',l);perform z_finish_social('instagram',l,'[{"id":"two","title":"Second","url":"https://www.instagram.com/reel/two/","views":5000}]',null,'fixture');
 if (select count(*) from z_clips)<>1 then raise exception 'Deleted platform videos not removed';end if;
 if has_table_privilege('anon','z_social_connections','select') or has_function_privilege('authenticated','z_claim_social(text,uuid)','execute') then raise exception 'Social tokens exposed';end if;
end$$;
