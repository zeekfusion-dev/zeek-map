import React,{useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import useOwnerAccess from '../components/useOwnerAccess';
import {bingoInitial} from '../data/bingoDefaults.js';
import './Bingo.css';
const lines=[...Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>r*5+c)),...Array.from({length:5},(_,c)=>Array.from({length:5},(_,r)=>r*5+c)),[0,6,12,18,24],[4,8,12,16,20]];
export default function Bingo(){
 const [draft,setDraft]=useState(null); const [board,setBoard]=useState(bingoInitial),[revision,setRevision]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState(false);
 const {isOwner,loading}=useOwnerAccess();
 async function refresh(){try{const r=await fetch('/api/site?bingo=1',{cache:'no-store'});if(!r.ok)throw Error('Unable to load live bingo.');const j=await r.json();if(j.board?.squares?.length===25){setBoard(j.board);setRevision(j.revision);setError('');}}catch(e){setError(e.message);}}
 useEffect(()=>{refresh();const t=setInterval(()=>{if(!editing&&!busy)refresh();},3000);return()=>clearInterval(t);},[editing,busy]);
 const wins=useMemo(()=>lines.filter(line=>line.every(i=>board.squares[i]?.done)),[board]);
 const count=board.squares.filter(s=>s.done).length;
 async function save(next){if(!isOwner||busy)return false;setBusy(true);setError('');setMessage('');try{const r=await fetch('/api/site',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'bingo',bingo:next,revision})});const j=await r.json();if(!r.ok)throw Error(j.error||'Could not save. Refresh and try again.');setBoard(j.content.bingo);setRevision(j.revision);return true;}catch(e){setError(e.message);return false;}finally{setBusy(false);}}
 function mark(i){if(!isOwner||editing||busy)return;save({...board,squares:board.squares.map((s,n)=>n===i?{...s,done:!s.done}:s)});}
 function shuffle(){if(!isOwner||!window.confirm('Shuffle the entire board? Current progress will be reset.'))return;const center=board.squares.find(s=>s.id===12)||board.squares[12];const other=board.squares.filter(s=>s!==center).map(s=>({...s,done:false}));for(let i=other.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[other[i],other[j]]=[other[j],other[i]];}other.splice(12,0,{...center,done:false});save({...board,squares:other});}
 return <main className="bingo-page"><div className="bingo-head"><p>ZEEKFUSION · LIVE STREAM CHALLENGE</p><h1>{board.title}</h1><div className="bingo-progress">{count} / 25 COMPLETED <span>{wins.length?' · BINGO COMPLETED':' · COMPLETE 5 IN A ROW'}</span></div></div>
 <div className="bingo-grid" aria-label="Impossible Bingo board">{board.squares.map((s,i)=><button key={s.id} type="button" disabled={!isOwner||busy||editing} className={'bingo-tile'+(s.done?' is-done':'')+(wins.some(l=>l.includes(i))?' is-winning':'')} onClick={()=>mark(i)} aria-label={s.title+(s.done?', completed':', incomplete')} aria-pressed={s.done}><span className="bingo-tile-text">{s.title}</span>{s.done&&<span className="bingo-x" aria-hidden="true">X</span>}</button>)}</div>
 <p className="bingo-info">{isOwner?'Creator mode: click a square to add or remove its X. Everyone sees your saved changes.':'Live viewer board: only ZeekFusion can mark or edit challenges.'}</p>
 {isOwner&&<div className="bingo-bottom-owner"><button type="button" disabled={busy} className="bingo-edit-toggle" onClick={()=>{setEditing(x=>!x);setDraft({...board,squares:board.squares.map(s=>({...s}))});}}>{editing?'Cancel Editing':'Edit'}</button>{!editing&&<><button disabled={busy} onClick={shuffle}>Shuffle</button><button disabled={busy} onClick={()=>{if(window.confirm('Clear all completed squares?'))save({...board,squares:board.squares.map(s=>({...s,done:false}))});}}>Reset Xs</button></>}</div>}
 {editing&&isOwner&&draft&&<section className="bingo-editor"><h2>Edit Bingo</h2><label>Board title<input maxLength={90} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><div className="bingo-edit-grid">{draft.squares.map((s,i)=><label key={s.id}>Square {i+1}<input maxLength={100} value={s.title} onChange={e=>setDraft({...draft,squares:draft.squares.map((v,k)=>k===i?{...v,title:e.target.value}:v)})}/></label>)}</div><button type="button" className="bingo-confirm" disabled={busy||!draft.title.trim()||draft.squares.some(s=>!s.title.trim())} onClick={async()=>{if(await save(draft)){setEditing(false);setDraft(null);}}}>✓ Confirm & Save Changes</button></section>}
 {!isOwner&&!loading&&<div className="bingo-owner-login"><a href="/api/kick/login?returnTo=admin">ZeekFusion creator sign-in</a><span>Already signed in? Refresh the page. Only the verified owner account can edit.</span></div>}

{error&&<p role="alert" className="bingo-error">{error}</p>}
 </main>;
}
