import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureChatSubscription} from '../server/chat-subscription.mjs';
const good={broadcaster_user_id:20306616,event:'chat.message.sent',version:1};
test('healthy chat subscription is not duplicated',async()=>{
 let calls=0;assert.deepEqual(await ensureChatSubscription('test',async()=>{calls++;return {ok:true,json:async()=>({data:[good]})}}),{repaired:false});assert.equal(calls,1);
});
test('missing chat subscription is restored and then verified',async()=>{
 const calls=[];let lists=0;
 const result=await ensureChatSubscription('test',async(url,o)=>{calls.push(o);return {ok:true,json:async()=>({data:++lists===1?[{...good,broadcaster_user_id:99}]:[good]})}});
 assert.equal(result.repaired,true);assert.equal(calls.length,3);
 assert.deepEqual(JSON.parse(calls[1].body),{broadcaster_user_id:20306616,events:[{name:'chat.message.sent',version:1}],method:'webhook'});
});
test('failed or unconfirmed subscription never reports a working connection',async()=>{
 await assert.rejects(()=>ensureChatSubscription('test',async()=>({ok:false,status:403})),/403/);
 await assert.rejects(()=>ensureChatSubscription('test',async()=>({ok:true,json:async()=>({data:[]})})),/not confirmed/);
});
