import crypto from 'node:crypto';
export const multipliers=[8,2,1.5,.75,.5,.75,1.5,2,8];
export function wager(value,kind='plinko'){const n=typeof value==='number'?value:NaN;const duel=['coin','dice','rps'].includes(kind);if(!Number.isSafeInteger(n)||n<1||!Number.isSafeInteger(n*200)||(!duel&&n>10))throw Object.assign(new Error(duel?'Choose a positive whole-number wager.':'Choose a whole-number wager from 1 to 10 Zs.'),{status:400});return n;}
export function plinkoResult(){const path=Array.from({length:8},()=>crypto.randomInt(2));const slot=path.reduce((a,b)=>a+b,0);return {path,slot,multiplier:multipliers[slot]};}
export function coinResult(){return crypto.randomInt(2)?'tails':'heads';}
export function diceResult(){const first=crypto.randomInt(1,7);let second;do{second=crypto.randomInt(1,7)}while(first===second);return [first,second];}
export const nextCard=()=>crypto.randomInt(1,14);
export function mineBoard(count){if(!Number.isInteger(count)||count<1||count>20)throw Object.assign(new Error('Choose 1–20 mines.'),{status:400});const cells=Array.from({length:25},(_,i)=>i);for(let i=cells.length-1;i>0;i--){const j=crypto.randomInt(i+1);[cells[i],cells[j]]=[cells[j],cells[i]];}return cells.slice(0,count);}
export function blackjackDeck(){const deck=Array.from({length:52},(_,i)=>i);for(let i=51;i>0;i--){const j=crypto.randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]]}return deck;}
