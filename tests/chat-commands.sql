-- Append to migration 022 before ROLLBACK. Never flush these test replies to Kick.
do $$declare reward uuid:=gen_random_uuid();other uuid:=gen_random_uuid();b numeric;result boolean;begin
 insert into z_users(kick_user_id,username,zs_balance,lifetime_zs) values(9999999002,'z_test_buyer',10,10),(9999999003,'z_test_empty',0,0);
 insert into z_rewards(id,title,description,cost,stock,enabled,image_url,audio_url,alert_duration,alert_volume) values(reward,'Scary Sound','Command test',2,10,true,'https://example.com/test.gif','https://example.com/test.mp3',4,30);
 perform z_process_command('test-balance',9999999002,'z_test_buyer','test-balance',now(),'balance','');
 if not exists(select 1 from z_outbox where dedupe='command:test-balance' and content like '%10 Zs%') then raise exception 'Balance command failed';end if;
 perform z_process_command('test-buy',9999999002,'z_test_buyer','test-buy',now(),'buy','sCaRy SoUnD');
 if (select zs_balance from z_users where kick_user_id=9999999002)<>8 then raise exception 'Purchase debit failed';end if;
 if not exists(select 1 from z_reward_alerts where redemption_id=md5('kick-reward:test-buy')::uuid and image_url='https://example.com/test.gif' and audio_url='https://example.com/test.mp3' and duration=4 and volume=30) then raise exception 'Shared overlay settings missing';end if;
 if not exists(select 1 from z_outbox where dedupe='buy:test-buy' and content like '%Redeemed Scary Sound for 2 Zs%') then raise exception 'Confirmation missing';end if;
 if z_process_command('test-buy',9999999002,'z_test_buyer','test-buy',now(),'buy','Scary Sound') then raise exception 'Duplicate event processed';end if;
 if z_process_command('test-buy-new-envelope',9999999002,'z_test_buyer','test-buy',now(),'buy','Scary Sound') then raise exception 'Duplicate message processed';end if;
 -- Even if short-lived receipts expire, the deterministic purchase ID still prevents a second charge.
 delete from z_webhook_receipts where id in('test-buy','chat-command:test-buy');
 perform z_process_command('test-buy',9999999002,'z_test_buyer','test-buy',now(),'buy','Scary Sound');
 if (select zs_balance from z_users where kick_user_id=9999999002)<>8 or (select count(*) from z_reward_alerts where username='z_test_buyer')<>1 then raise exception 'Permanent purchase dedupe failed';end if;
 perform z_process_command('test-empty',9999999003,'z_test_empty','test-empty',now(),'buy','Scary Sound');
 perform z_process_command('test-invalid',9999999002,'z_test_buyer','test-invalid',now(),'buy','Missing reward');
 perform z_process_command('test-usage',9999999002,'z_test_buyer','test-usage',now(),'buy','');
 if (select zs_balance from z_users where kick_user_id=9999999002)<>8 or exists(select 1 from z_reward_alerts where username='z_test_empty') then raise exception 'Rejected command changed balance/alerts';end if;
 if not exists(select 1 from z_outbox where dedupe='buy:test-empty' and content like '%Not enough%') or not exists(select 1 from z_outbox where dedupe='buy:test-invalid' and content like '%not found%') then raise exception 'Error reply missing';end if;
 update z_rewards set cooldown_seconds=60 where id=reward;
 perform z_process_command('test-cooldown',9999999002,'z_test_buyer','test-cooldown',now(),'buy','Scary Sound');
 if (select zs_balance from z_users where kick_user_id=9999999002)<>8 then raise exception 'Cooldown charged';end if;
 update z_rewards set cooldown_seconds=0,stock=0 where id=reward;
 perform z_process_command('test-stock',9999999002,'z_test_buyer','test-stock',now(),'buy','Scary Sound');
 if (select zs_balance from z_users where kick_user_id=9999999002)<>8 then raise exception 'Sold out charged';end if;
 insert into z_rewards(id,title,cost,stock,enabled) values(other,'scary sound',1,null,true);
 perform z_process_command('test-ambiguous',9999999002,'z_test_buyer','test-ambiguous',now(),'buy','Scary Sound');
 if not exists(select 1 from z_outbox where dedupe='buy:test-ambiguous' and content like '%unique names%') then raise exception 'Ambiguous match guessed';end if;
 if has_function_privilege('anon','z_process_command(text,bigint,text,text,timestamptz,text,text)','EXECUTE') then raise exception 'Command function exposed';end if;
end$$;
select 'PASS: balance, multiword/case-insensitive buy, atomic debit, shared alert settings, confirmation, duplicates, empty balance, invalid reward, cooldown, stock, ambiguity, grants' as result;
