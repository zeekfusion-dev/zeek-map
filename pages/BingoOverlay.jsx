import React,{useEffect,useState} from 'react';
import {bingoInitial} from '../data/bingoDefaults.js';
import './BingoOverlay.css';
const rows=[...Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>r*5+c)),...Array.from({length:5},(_,c)=>Array.from({length:5},(_,r)=>r*5+c)),[0,6,12,18,24],[4,8,12,16,20]];
export default function BingoOverlay(){
 const [board,setBoard]=useState(bingoInitial);
 useEffect(()=>{let active=true;async function poll(){try{const response=await fetch('/api/site?bingo=1',{cache:'no-store'});if(!response.ok)return;const data=await response.json();if(active&&data.board?.squares?.length===25)setBoard(data.board);}catch{}}poll();const timer=setInterval(poll,2500);return()=>{active=false;clearInterval(timer);};},[]);
 const total=board.squares.filter(s=>s.done).length,won=rows.some(line=>line.every(i=>board.squares[i]?.done));
 return <main className="zeek-obs-bingo"><div className="zeek-obs-heading"><strong>IMPOSSIBLE BINGO</strong><span>{won?'BINGO!':total+' / 25 DONE'}</span></div><div className="zeek-obs-grid">{board.squares.map((square,i)=><div key={square.id} className={'zeek-obs-cell'+(square.done?' done':'')+(i===12?' center':'')} title={square.title}><span className="zeek-obs-label">{square.title}</span>{square.done&&<span className="zeek-obs-x" aria-hidden="true">X</span>}</div>)}</div><div className="zeek-obs-footer">zeekfusion.com/bingo</div></main>;
}
