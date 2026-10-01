import test from 'node:test';
import assert from 'node:assert/strict';
import {blackjackFrames,blackjackDuration} from '../pages/blackjack-animation.mjs';
import {validateGame} from '../server/security.mjs';
import {hitOdds} from '../server/blackjack-odds.mjs';
test('split and double accepted only for blackjack',()=>{
 for(const move of ['split','double']){
  assert.doesNotThrow(()=>validateGame({action:'move',kind:'blackjack',move,version:0}));
  assert.throws(()=>validateGame({action:'move',kind:'mines',move,version:0}));
 }
});
test('split animation separates original cards then deals each new card, keeps dealer hidden',()=>{
 const prev={status:'playing',result:{player:[7,20],dealer:[9,null]}};
 const next={status:'playing',result:{hands:[{cards:[7,1],stake:100},{cards:[20,2],stake:100}],dealer:[9,null],activeHand:0}};
 const frames=blackjackFrames(next,prev);
 assert.deepEqual(frames[1].hands.map(h=>h.cards),[[7],[20]]);
 assert.deepEqual(frames.at(-1).hands.map(h=>h.cards),[[7,1],[20,2]]);
 assert.ok(frames.every(f=>f.dealer[1]===null));
 assert.ok(blackjackDuration(next,prev)>(frames.length-1)*420);
});
test('double animation adds one card before revealing dealer and never exposes payouts early',()=>{
 const prev={status:'playing',result:{hands:[{cards:[4,5],stake:100}],dealer:[9,null],activeHand:0}};
 const next={status:'resolved',result:{hands:[{cards:[4,5,10],stake:200,outcome:'win',payout:400}],dealer:[9,6],activeHand:0}};
 const frames=blackjackFrames(next,prev);
 const card=frames.findIndex(f=>f.hands[0].cards.length===3);
 const reveal=frames.findIndex(f=>f.dealer[1]!==null);
 assert.ok(card<reveal);
 assert.ok(frames.every(f=>f.hands.every(h=>!h.outcome&&!h.payout)));
});
test('hit odds count exposed cards in both split hands',()=>{
 const odds=hitOdds([7,8],[9,null],[7,8,20,2]);
 assert.ok(Number.isFinite(odds.safe)&&Math.abs(odds.safe+odds.bust-1)<1e-10);
 assert.notEqual(odds.safe,hitOdds([7,8],[9,null]).safe);
});
