begin;
do $$
declare d text:=repeat('a',64); e text:=repeat('b',64); f text:=repeat('c',64); r jsonb; req uuid:=gen_random_uuid();
begin
 r:=public.z_travel_vote(d,null,req,'states','Florida');
 if (r->>'used')::integer<>1 then raise exception 'first vote failed';end if;
 r:=public.z_travel_vote(d,null,req,'states','Florida');
 if (r->>'used')::integer<>1 then raise exception 'duplicate counted';end if;
 r:=public.z_travel_vote(d,null,req,'countries','Austria');
 if r->>'error' is null then raise exception 'changed retry accepted';end if;
 r:=public.z_travel_vote(d,null,gen_random_uuid(),'countries','Austria');
 r:=public.z_travel_vote(d,null,gen_random_uuid(),'states','Alaska');
 r:=public.z_travel_vote(d,null,gen_random_uuid(),'countries','Japan');
 if r->>'error' is null or (r->>'used')::integer<>3 then raise exception 'cap failed';end if;
 r:=public.z_travel_vote(d,999999999001);
 r:=public.z_travel_vote(e,999999999001,gen_random_uuid(),'countries','Japan');
 if r->>'error' is null or (r->>'remaining')::integer<>0 then raise exception 'account across devices failed';end if;
 r:=public.z_travel_vote(e,null,gen_random_uuid(),'countries','Japan');
 if r->>'error' is null then raise exception 'logout bypass';end if;
 r:=public.z_travel_vote(f,null,gen_random_uuid(),'countries','Japan');
 r:=public.z_travel_vote(f,999999999001);
 if (r->>'used')::integer<>4 or (r->>'remaining')::integer<>0 then raise exception 'merge failed';end if;
 r:=public.z_travel_vote(repeat('d',64),null,gen_random_uuid(),'countries','Not a country');
 if r->>'error' is null or (r->>'used')::integer<>0 then raise exception 'invalid destination';end if;
 if has_function_privilege('anon','public.z_travel_vote(text,bigint,uuid,text,text)','execute') then raise exception 'anon bypass';end if;
 if has_table_privilege('authenticated','public.z_travel_votes','select') then raise exception 'private identities exposed';end if;
end $$;
rollback;
