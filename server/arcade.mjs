import crypto from 'node:crypto';
import {cents} from './domain.mjs';
export const multipliers=[8,2,1.5,.75,.5,.75,1.5,2,8];
export function wager(value){const n=cents(value);if(n<100||n>10000||n%100)throw Object.assign(new Error('Choose a whole-number wager from 1 to 100 Zs.'),{status:400});return n/100;}
export function plinkoResult(){const path=Array.from({length:8},()=>crypto.randomInt(2));const slot=path.reduce((a,b)=>a+b,0);return {path,slot,multiplier:multipliers[slot]};}
export function coinResult(){return crypto.randomInt(2)?'tails':'heads';}
