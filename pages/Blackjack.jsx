import React,{useEffect,useState} from 'react';
export const blackjackDuration=(game,previous)=>Math.max(1600,((game?.result?.player?.length||2)+(game?.result?.dealer?.length||2)-(previous?.status==='playing'?(previous.result.player.length+1):0))*420+550);
const rank=c=>({1:'A',11:'J',12:'Q',13:'K'}[c%13+1]||c%13+1);
export default function Blackjack({game,visual,animating}){
 const [hands,setHands]=useState({player:[],dealer:[]});
 useEffect(()=>{if(!animating){setHands(game?.result||{player:[],dealer:[]});return}const timers=[];const next=visual.result;let player=game?.status==='playing'?[...game.result.player]:[];let dealer=game?.status==='playing'?[...game.result.dealer]:[];setHands({player:[...player],dealer:[...dealer]});let step=0;const schedule=fn=>timers.push(setTimeout(()=>{fn();setHands({player:[...player],dealer:[...dealer]})},++step*420));
 if(!player.length){schedule(()=>player.push(next.player[0]));schedule(()=>dealer.push(next.dealer[0]));schedule(()=>player.push(next.player[1]));schedule(()=>dealer.push(null));}
 else for(let i=player.length;i<next.player.length;i++)schedule(()=>player.push(next.player[i]));
 if(visual.status==='resolved'){schedule(()=>dealer[1]=next.dealer[1]);for(let i=2;i<next.dealer.length;i++)schedule(()=>dealer.push(next.dealer[i]));}
 return()=>timers.forEach(clearTimeout);
 },[animating,visual,game]);
 const total=cards=>{let n=cards.filter(c=>c!==null).reduce((sum,c)=>sum+Math.min(c%13+1,10),0);return cards.some(c=>c!==null&&c%13===0)&&n+10<=21?n+10:n};
 return <div className="bj-table"><span className="bj-felt-mark" aria-hidden="true">Z</span>{['dealer','player'].map(who=><div className="bj-hand" key={who}><div className="bj-hand-label">{who==='dealer'?'DEALER':'YOUR HAND'} <span>{hands[who]?.length?total(hands[who]):'—'}</span></div><div className="bj-cards">{(hands[who]?.length?hands[who]:[null,null]).map((c,i)=><div key={i+'-'+(c===null?'hidden':c)} className={`bj-card ${c===null?'bj-back':[1,2].includes(Math.floor(c/13))?'bj-red':''}`}><span>{c===null?'Z':rank(c)}</span><b>{c===null?'✦':['♠','♥','♦','♣'][Math.floor(c/13)]}</b><small>{c===null?'VAULT':rank(c)}</small></div>)}</div></div>)}<p className="bj-rules">BLACKJACK PAYS 3:2 · DEALER STANDS ON 17</p></div>
}
