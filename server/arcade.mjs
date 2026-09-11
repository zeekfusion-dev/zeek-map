import crypto from 'node:crypto';
import {cents} from './domain.mjs';
export const multipliers=[8,2,1.5,.75,.5,.75,1.5,2,8];
export function wager(value){const n=cents(value);if(n<100||n>10000||n%100)throw Object.assign(new Error('Choose a whole-number wager from 1 to 100 Zs.'),{status:400});return n/100;}
export function plinkoResult(){const path=Array.from({length:8},()=>crypto.randomInt(2));const slot=path.reduce((a,b)=>a+b,0);return {path,slot,multiplier:multipliers[slot]};}
export function coinResult(){return crypto.randomInt(2)?'tails':'heads';}
export function diceResult(){const first=crypto.randomInt(1,7);let second;do{second=crypto.randomInt(1,7)}while(first===second);return [first,second];}
export const nextCard=()=>crypto.randomInt(1,14);
export function mineBoard(count){if(!Number.isInteger(count)||count<1||count>20)throw Object.assign(new Error('Choose 1–20 mines.'),{status:400});const cells=Array.from({length:25},(_,i)=>i);for(let i=cells.length-1;i>0;i--){const j=crypto.randomInt(i+1);[cells[i],cells[j]]=[cells[j],cells[i]];}return cells.slice(0,count);}
