begin;
create or replace function z_label(p_amount numeric) returns text language sql immutable as $$select trim_scale(p_amount)::text||case when p_amount=1 then ' Z' else ' Zs' end$$;
revoke all on function z_label(numeric) from public,anon,authenticated;grant execute on function z_label(numeric) to service_role;
create or replace function public.z_start_round() returns uuid language plpgsql security definer set search_path=public as $$
declare c jsonb;r z_runtime;q z_questions;n uuid;begin
 perform pg_advisory_xact_lock(20306616,1);
 select settings into c from z_config where id=1;select * into r from z_runtime where id=1 for update;
 update z_rounds set status='expired' where status='open' and expires_at<now();
 update z_rounds set status='cancelled' where status='pending' and created_at<now()-interval '5 minutes';
 if not r.is_live or not (c->>'questions_enabled')::boolean or r.next_question_at>now() or exists(select 1 from z_rounds where status in('pending','open')) then return null;end if;
 select * into q from z_questions where enabled order by last_used_at nulls first,random() limit 1;
 if q.id is null then return null;end if;
 insert into z_rounds(question_id,question,answers,reward) values(q.id,q.question,q.answers,(c->>'question_z')::numeric) returning id into n;
 update z_questions set last_used_at=now() where id=q.id;
 insert into z_outbox(dedupe,content,round_id) values('question:'||n,'⚡ Z QUESTION: '||q.question||' | First correct answer wins '||z_label((c->>'question_z')::numeric)||'. You have '||(c->>'answer_seconds')||' seconds!',n);
 update z_runtime set next_question_at=now()+make_interval(mins=>(c->>'question_interval_minutes')::integer) where id=1;
 return n;end$$;
create or replace function public.z_open_round(p_round uuid) returns void language plpgsql security definer set search_path=public as $$declare secs integer;begin
 select (settings->>'answer_seconds')::integer into secs from z_config where id=1;
 update z_rounds set status='open',opened_at=now(),expires_at=now()+make_interval(secs=>secs) where id=p_round and status='pending';end$$;
create or replace function public.z_answer(p_user bigint,p_name text,p_answer text,p_message text,p_created timestamptz) returns jsonb language plpgsql security definer set search_path=public as $$
declare r z_rounds;result jsonb;begin
 select * into r from z_rounds where status='open' order by created_at desc limit 1 for update;
 if r.id is null or r.expires_at<now() or p_created<r.opened_at or p_created>r.expires_at or not(p_answer=any(r.answers)) or p_user=20306616 then return null;end if;
 update z_rounds set status='won',winner_id=p_user,winner_username=p_name where id=r.id;
 if r.reward>0 then result:=z_award(p_user,p_name,r.reward,'Z Question winner','question:'||r.id,jsonb_build_object('message_id',p_message));end if;
 insert into z_outbox(dedupe,content) values('winner:'||r.id,'🏆 @'||p_name||' got it! +'||z_label(r.reward)||'. Your balance: '||z_label(coalesce((result->>'balance')::numeric,0))||'.');
 return jsonb_build_object('won',true,'reward',r.reward);end$$;
create or replace function public.z_balance_command(p_user bigint,p_name text,p_message text) returns void language plpgsql security definer set search_path=public as $$declare b numeric;ok bigint;begin
 insert into z_command_limits values(p_user,now()) on conflict(kick_user_id) do update set last_at=now() where z_command_limits.last_at<now()-interval '30 seconds' returning kick_user_id into ok;
 if ok is null then return;end if;
 select zs_balance into b from z_users where kick_user_id=p_user;
 insert into z_outbox(dedupe,content) values('command:'||p_message,'⚡ @'||p_name||' — '||z_label(coalesce(b,0))||'. Visit zeekfusion.com/#/vault') on conflict(dedupe) do nothing;end$$;

notify pgrst,'reload schema';commit;