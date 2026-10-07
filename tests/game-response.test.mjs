import test from 'node:test';
import assert from 'node:assert/strict';
import {publicGame} from '../server/game-response.mjs';
import {validateGame} from '../server/security.mjs';
test('active Mines responses cannot expose boards or future private fields',()=>{
 const g=publicGame({id:'x',kind:'mines',status:'playing',creator:123,secret:'private',result:{board:[2],deck:[9],mines:1,revealed:[0],version:1,multiplier:1.01}});
 assert.equal(g.creator,undefined);assert.equal(g.secret,undefined);assert.equal(g.result.board,undefined);assert.equal(g.result.deck,undefined);assert.deepEqual(g.result.revealed,[0]);
 assert.deepEqual(publicGame({kind:'mines',status:'resolved',result:{board:[2]}}).result.board,[2]);
});
test('RPS choices are hidden until settlement',()=>{
 for(const status of ['open','playing','cancelled'])assert.equal(publicGame({kind:'rps',status,result:{choices:['rock','paper'],choice:'rock'}}).result.choices,undefined);
 assert.deepEqual(publicGame({kind:'rps',status:'resolved',result:{choices:['rock','paper'],tie:false}}).result.choices,['rock','paper']);
});
test('Blackjack independently hides the dealer hole card and deck',()=>{
 const g=publicGame({kind:'blackjack',status:'playing',result:{dealer:[0,10],dealerTotal:21,deck:[1,2],hands:[{cards:[3,4],stake:10,deck:[5]}]}});
 assert.deepEqual(g.result.dealer,[0,null]);assert.notEqual(g.result.dealerTotal,21);assert.equal(g.result.deck,undefined);assert.equal(g.result.hands[0].deck,undefined);
});
test('client cannot supply outcomes, identities, payouts, or another game action',()=>{
 for(const key of ['payout','board','path','deck','userId','winner','result'])assert.throws(()=>validateGame({action:'move',kind:'mines',version:0,move:'reveal',cell:0,[key]:123}));
 assert.throws(()=>validateGame({action:'move',kind:'mines',version:0,move:'hit'}));
 validateGame({action:'move',kind:'mines',version:0,move:'reveal',cell:0});
});
