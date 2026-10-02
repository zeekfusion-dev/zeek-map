export const BLACKJACK_CARD_MS=500;
export const BLACKJACK_SETTLE_MS=350;
export const visibleHands = result => result?.hands || [{cards:result?.player||[],stake:0}];
export function blackjackFrames(next,previous){
 const target=next.result, frames=[];
 const old=previous?.status==='playing'?previous.result:null;
 let hands=visibleHands(old).map(h=>({...h,cards:[...h.cards]})),dealer=[...(old?.dealer||[])],activeHand=old?.activeHand||0;
 const push=()=>frames.push({hands:hands.map(h=>({...h,cards:[...h.cards]})),dealer:[...dealer],activeHand});
 push();
 const wanted=visibleHands(target);
 if(!old){
  hands=[{cards:[],stake:wanted[0].stake}];
  hands[0].cards.push(wanted[0].cards[0]);push();
  dealer.push(target.dealer[0]);push();
  hands[0].cards.push(wanted[0].cards[1]);push();
  dealer.push(null);push();
 }else if(wanted.length>hands.length){
  hands=wanted.map((h,i)=>({cards:[old.player[i]],stake:h.stake}));
  push();
 }
 for(let i=0;i<wanted.length;i++){
  for(let j=hands[i].cards.length;j<wanted[i].cards.length;j++){
   activeHand=i;hands[i].cards.push(wanted[i].cards[j]);push();
  }
  hands[i].stake=wanted[i].stake;
 }
 if(next.status==='resolved'){
  // A stand starts the dealer turn with a brief pause before the hole-card reveal.
  if(frames.length===1)push();
  dealer[1]=target.dealer[1];push();
  for(let j=2;j<target.dealer.length;j++){dealer.push(target.dealer[j]);push();}
 }
 frames[frames.length-1].activeHand=target.activeHand||0;
 return frames;
}
export const blackjackDuration=(next,previous)=>Math.max(0,blackjackFrames(next,previous).length-2)*BLACKJACK_CARD_MS+BLACKJACK_SETTLE_MS;

export function canDoubleHand(game,available){
 if(game?.status!=='playing')return false;
 const hand=visibleHands(game.result)[game.result.activeHand||0];
 return hand?.cards.length===2&&!hand.doubled&&Number(available)>=Number(hand.stake||game.stake)&&(hand.status===undefined||hand.status==='playing');
}
