import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureRewardSubscription} from '../server/reward-subscription.mjs';
const good={broadcaster_user_id:20306616,event:'channel.reward.redemption.updated',version:1};
test('healthy reward subscription is not duplicated',async()=>{
 let calls=0;assert.deepEqual(await ensureRewardSubscription('test',async()=>{calls++;return {ok:true,json:async()=>({data:[good]})}}),{repaired:false});assert.equal(calls,1);
});
test('missing reward subscription is added without touching other subscriptions',async()=>{
 const calls=[];let lists=0;
 const result=await ensureRewardSubscription('test',async(url,o)=>{calls.push({url,o});return {ok:true,json:async()=>({data:++lists===1?[{broadcaster_user_id:20306616,event:'chat.message.sent',version:1}]:[good]})}});
 assert.equal(result.repaired,true);assert.equal(calls.length,3);
 assert.deepEqual(JSON.parse(calls[1].o.body),{broadcaster_user_id:20306616,events:[{name:'channel.reward.redemption.updated',version:1}],method:'webhook'});
});
test('reward subscription failure is surfaced to caller',async()=>{
 await assert.rejects(()=>ensureRewardSubscription('test',async()=>({ok:false,status:403})),/403/);
});
