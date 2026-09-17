-- Execute in a transaction and roll back; never flush test chat replies.
do $$declare r uuid:=gen_random_uuid();begin
 insert into z_users(kick_user_id,username,zs_balance,lifetime_zs) values(9999999020,'z_test_command',10,10);
 insert into z_rewards(id,title,command_name,description,cost,stock,enabled,image_url,audio_url) values(r,'Hydrate','drink water','Test',2,10,true,'https://example.com/a.gif','https://example.com/a.mp3');
 perform z_process_command('cmd-test-title',9999999020,'z_test_command','cmd-test-title',now(),'buy','Hydrate');
 if (select zs_balance from z_users where kick_user_id=9999999020)<>10 then raise exception 'Display name incorrectly matched';end if;
 perform z_process_command('cmd-test-buy',9999999020,'z_test_command','cmd-test-buy',now(),'buy','DRINK WATER');
 if (select zs_balance from z_users where kick_user_id=9999999020)<>8 then raise exception 'Custom command failed';end if;
 if not exists(select 1 from z_reward_alerts where redemption_id=md5('kick-reward:cmd-test-buy')::uuid and title='Hydrate' and image_url='https://example.com/a.gif') then raise exception 'Shared reward alert missing';end if;
 perform z_process_command('cmd-test-duplicate',9999999020,'z_test_command','cmd-test-buy',now(),'buy','drink water');
 if (select zs_balance from z_users where kick_user_id=9999999020)<>8 then raise exception 'Duplicate charged';end if;
 begin
 insert into z_rewards(title,command_name,cost,stock,enabled) values('Other','DRINK WATER',1,null,true);
 raise exception 'Duplicate command accepted';
 exception when unique_violation then null;end;
 update z_rewards set title='Drink time',command_name='hydrate now' where id=r;
 perform z_process_command('cmd-test-old',9999999020,'z_test_command','cmd-test-old',now(),'buy','drink water');
 if (select zs_balance from z_users where kick_user_id=9999999020)<>8 then raise exception 'Old command still matched';end if;
 perform z_process_command('cmd-test-new',9999999020,'z_test_command','cmd-test-new',now(),'buy','hydrate now');
 if (select zs_balance from z_users where kick_user_id=9999999020)<>6 then raise exception 'Edited command failed';end if;
end$$;
select 'PASS: independent command, mixed case/spaces, duplicate protection, unique names, renamed command, same reward alerts' as result;
