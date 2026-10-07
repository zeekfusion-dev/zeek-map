import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeRewardReceipt,parseNativeRewardReceipt} from '../server/native-reward.mjs';
const body={id:'01KBHE78QE4HZY1617DK5FC7YD',status:'pending',redeemed_at:'2026-10-07T03:30:00.000Z',
 reward:{id:'01KBHE7RZNHB0SKDV1H86CD4F3'},broadcaster:{user_id:20306616}};
test('native reward receipt round-trips without user data',()=>{
 const id=nativeRewardReceipt({type:'channel.reward.redemption.updated',version:'1',body});
 assert.equal(id,'native-reward:01KBHE7RZNHB0SKDV1H86CD4F3:01KBHE78QE4HZY1617DK5FC7YD:pending:1791343800000');
 assert.deepEqual(parseNativeRewardReceipt(id,'2026-10-07T03:30:01.000Z'),{reward_id:'01KBHE7RZNHB0SKDV1H86CD4F3',
  redemption_id:'01KBHE78QE4HZY1617DK5FC7YD',status:'pending',redeemed_at:'2026-10-07T03:30:00.000Z',received_at:'2026-10-07T03:30:01.000Z'});
});
test('other events are ignored and malformed rewards are rejected',()=>{
 assert.equal(nativeRewardReceipt({type:'chat.message.sent',version:'1',body}),null);
 assert.throws(()=>nativeRewardReceipt({type:'channel.reward.redemption.updated',version:'2',body}),/version/);
 assert.throws(()=>nativeRewardReceipt({type:'channel.reward.redemption.updated',version:'1',body:{...body,status:'wat'}}),/Invalid/);
 assert.equal(parseNativeRewardReceipt('chat:abc',new Date().toISOString()),null);
});
