import test from 'node:test';import assert from 'node:assert/strict';
import {wager,plinkoResult,multipliers,coinResult} from '../server/arcade.mjs';
import api from '../api/arcade.js';
process.env.KICK_REDIRECT_URI='https://www.zeekfusion.com/api/kick/callback';
const response=()=>({statusCode:200,setHeader(){},status(s){this.statusCode=s;return this},json(b){this.body=b;return this},end(){return this}});
test('wager bounds reject fractions, coercion, overflows and invalid amounts',()=>{for(const x of [0,-1,.5,1.01,101,NaN,Infinity,'1e2',null,{},''])assert.throws(()=>wager(x));assert.equal(wager(1),1);assert.equal(wager(100),100);});
test('all 256 Plinko paths produce the published distribution and exact expected return',()=>{const counts=Array(9).fill(0);for(let i=0;i<256;i++)counts[i.toString(2).split('').filter(b=>b==='1').length]++;assert.deepEqual(counts,[1,8,28,56,70,56,28,8,1]);assert.equal(counts.reduce((sum,n,i)=>sum+n*multipliers[i],0)/256,251/256);});
test('server outcomes always match their paths and known slots',()=>{for(let i=0;i<200;i++){const r=plinkoResult();assert.equal(r.path.length,8);assert(r.path.every(x=>x===0||x===1));assert.equal(r.slot,r.path.reduce((a,b)=>a+b,0));assert.equal(r.multiplier,multipliers[r.slot]);assert(['heads','tails'].includes(coinResult()));}});
test('Arcade rejects anonymous and cross-origin writes before database access',async()=>{for(const action of ['create','plinko','accept','cancel']){let r=response();await api({method:'POST',headers:{origin:'https://www.zeekfusion.com'},body:{action}},r);assert.equal(r.statusCode,401);r=response();await api({method:'POST',headers:{origin:'https://evil.example'},body:{action}},r);assert.equal(r.statusCode,403);}});
