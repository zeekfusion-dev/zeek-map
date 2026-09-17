-- Run after migration 023 in the same transaction and roll back all fixtures.
do $$begin
 perform z_process_command('test-help',9999999010,'z_test_help','test-help',now(),'help','Z Commands: registry-generated help | Visit zeekfusion.com/#/market');
 if not exists(select 1 from z_outbox where dedupe='help:test-help' and content like '%/#/market') then raise exception 'Missing help reply';end if;
 if z_process_command('test-help',9999999010,'z_test_help','test-help',now(),'help','repeat') then raise exception 'Repeated event processed';end if;
 if z_process_command('test-help-envelope',9999999010,'z_test_help','test-help',now(),'help','repeat') then raise exception 'Repeated message processed';end if;
 perform z_process_command('test-help-limit',9999999010,'z_test_help','test-help-limit',now(),'help','repeat');
 if exists(select 1 from z_outbox where dedupe='help:test-help-limit') then raise exception 'Help rate limit failed';end if;
 perform z_process_command('test-new-link',9999999011,'z_test_link','test-new-link',now(),'balance','');
 if not exists(select 1 from z_outbox where dedupe='command:test-new-link' and content like '%/#/market' and content not like '%/#/vault') then raise exception 'Wrong balance URL';end if;
 if has_function_privilege('authenticated','z_process_command(text,bigint,text,text,timestamptz,text,text)','EXECUTE') then raise exception 'Commands exposed';end if;
end$$;
select 'PASS: help reply, event/message dedupe, rate limit, Market balance link, private permissions' as result;
