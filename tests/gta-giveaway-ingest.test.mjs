import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recordGiveawayChat,observeGiveawayStream,isEligible} from '../server/gta-giveaway.mjs';
import {BROADCASTER} from '../server/domain.mjs';
const sender={user_id:9,username:'Viewer'};
test('trusted event forwards the timestamp and identity, not message contents',async()=>{
 let actual; await recordGiveawayChat({created_at:'2026-11-19T20:59:59.999Z',sender,content:'Nice jump'},(name,p)=>{actual=[name,p];});
 assert.deepEqual(actual,['gta_record_chat',{p_user:9,p_name:'Viewer',p_at:'2026-11-19T20:59:59.999Z'}]);
});
test('host, known bot, commands and anonymous entries are excluded',()=>{
 assert.equal(isEligible({...sender,user_id:BROADCASTER},'hey'),false);
 assert.equal(isEligible({...sender,username:'ZeekBot'},'hey'),false);
 assert.equal(isEligible({...sender,is_anonymous:true},'hey'),false);
 assert.equal(isEligible(sender,'  !spam'),false);
 assert.equal(isEligible(sender,'  '),false);
});
test('unknown Kick start is not treated as a live interval',async()=>{
 assert.equal(await observeGiveawayStream({live:true,observed:'2026-11-19T21:00:00Z'},()=>assert.fail()),false);
});
test('explicit Kick end remains distinct from an offline polling observation',async()=>{
 let actual;await observeGiveawayStream({live:false,start:'2026-11-19T20:00:00Z',ended:'2026-11-19T21:00:01Z',observed:'2026-11-19T21:00:07Z'},(name,p)=>{actual=[name,p];});
 assert.deepEqual(actual,['gta_observe',{p_live:false,p_start:'2026-11-19T20:00:00.000Z',p_at:'2026-11-19T21:00:07.000Z',p_end:'2026-11-19T21:00:01.000Z'}]);
});
