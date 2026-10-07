import {handTotal} from './blackjack-odds.mjs';
const pick=(value,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(value||{},k)).map(k=>[k,value[k]]));
// Defense in depth: future database fields never become public automatically.
export function publicGame(game){
 if(!game)return game;
 const g=pick(game,['id','kind','stake','side','status','creator_name','opponent_name','winner_name','payout','created_at','resolved_at','availableZs','mine','is_winner']);
 const r=game.result||{},done=game.status==='resolved';
 const fields={mines:['mines','revealed','multiplier','version','turns','lastTile','hit'],higher:['card','previous','revealed','multiplier','version','turns'],blackjack:['player','dealer','playerTotal','dealerTotal','activeHand','canSplit','canDouble','additionalWager','totalStake','version'],plinko:[],coin:[],dice:[],rps:[]};
 g.result=pick(r,fields[g.kind]||[]);
 if(done)Object.assign(g.result,pick(r,{mines:['board'],higher:[],blackjack:['outcome','tie'],plinko:['path','slot','multiplier'],coin:['side'],dice:['dice'],rps:['choices','tie']}[g.kind]||[]));
 if(g.kind==='blackjack'){
  if(Array.isArray(r.hands))g.result.hands=r.hands.map(h=>pick(h,['cards','stake','status','doubled','total',...(done?['outcome','payout']:[])]));
  if(!done){g.result.dealer=[r.dealer?.[0]??null,null];g.result.dealerTotal=r.dealer?.[0]!=null?handTotal([r.dealer[0]]):0;}
 }
 return g;
}
