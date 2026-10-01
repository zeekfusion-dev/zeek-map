import React,{useEffect,useState} from 'react';
import {blackjackFrames,visibleHands,BLACKJACK_CARD_MS} from './blackjack-animation.mjs';
import {handTotal} from '../server/blackjack-odds.mjs';
export {blackjackDuration} from './blackjack-animation.mjs';
const rank=c=>({1:'A',11:'J',12:'Q',13:'K'}[c%13+1]||c%13+1);
const zs=n=>`${Number(n).toLocaleString()} ${Number(n)===1?'Z':'Zs'}`;
function Cards({cards}){return <div className="bj-cards">{(cards.length?cards:[null,null]).map((c,i)=><div key={i+'-'+(c===null?'hidden':c)} className={`bj-card ${c===null?'bj-back':[1,2].includes(Math.floor(c/13))?'bj-red':''}`}><span>{c===null?'Z':rank(c)}</span><b>{c===null?'✦':['♠','♥','♦','♣'][Math.floor(c/13)]}</b><small>{c===null?'MARKET':rank(c)}</small></div>)}</div>}
export default function Blackjack({game,visual,animating}){
 const [frame,setFrame]=useState({hands:[{cards:[]}],dealer:[],activeHand:0});
 useEffect(()=>{
  if(!animating){setFrame({hands:visibleHands(game?.result),dealer:game?.result?.dealer||[],activeHand:game?.result?.activeHand||0});return}
  const frames=blackjackFrames(visual,game);setFrame(frames[1]||frames[0]);
  const timers=frames.slice(2).map((f,i)=>setTimeout(()=>setFrame(f),(i+1)*BLACKJACK_CARD_MS));
  return()=>timers.forEach(clearTimeout);
 },[animating,visual,game]);
 return <div className="bj-table"><span className="bj-felt-mark" aria-hidden="true">Z</span><div className="bj-hand"><div className="bj-hand-label">DEALER <span>{frame.dealer.length?handTotal(frame.dealer.filter(c=>c!==null)):'—'}</span></div><Cards cards={frame.dealer}/></div><div className={'bj-player-hands '+(frame.hands.length>1?'bj-split':'')}>{frame.hands.map((h,i)=><div className={'bj-hand '+(game?.status==='playing'&&frame.activeHand===i?'bj-active':'')} key={i}><div className="bj-hand-label">{frame.hands.length>1?`HAND ${i+1}`:'YOUR HAND'} <span>{h.cards.length?handTotal(h.cards):'—'}</span></div><Cards cards={h.cards}/>{h.stake>0&&<p className="bj-hand-stake">{zs(h.stake)}{!animating&&h.doubled?' · Doubled':''}</p>}{!animating&&h.outcome&&<div className={'bj-hand-result '+h.outcome}>{h.outcome.toUpperCase()} · {zs(h.payout)} returned</div>}{!animating&&game?.status==='playing'&&frame.hands.length>1&&<small>{i===frame.activeHand?'Playing this hand':h.status==='playing'?'Up next':'Standing'}</small>}</div>)}</div><p className="bj-rules">ORIGINAL BLACKJACK PAYS 3:2 · DEALER STANDS ON 17</p></div>
}
