import React,{useCallback,useEffect,useState} from 'react';
import './GtaGiveaway.css';

export function GiveawayBoard({status, entries=[], skippedWindows=0}) {
 return <main className="gg-page">
  <header className="gg-hero">
   <h1>GTA Giveaway <span>Leaderboard</span></h1>
   <p className="gg-prize">GTA 6 Copy or Gift Card</p>
  </header>
  <div className="gg-grid">
   <section className="gg-panel" aria-label="Live standings"><h2>Standings</h2>
    {status==='closed'&&<p>Giveaway closed.</p>}
    {status==='stale'&&<p>Standings are temporarily paused.</p>}
    {!entries.length?<p>No standings yet.</p>:<table>
     <thead><tr><th>Rank</th><th>Kick handle</th><th>XP</th></tr></thead>
     <tbody>{entries.map(r=><tr key={r.username}><td>{r.rank}</td><td>@{r.username}</td><td>{r.xp}</td></tr>)}</tbody>
    </table>}
    {skippedWindows>0&&<p>{skippedWindows} unverified {skippedWindows===1?'block skipped':'blocks skipped'}.</p>}
   </section>
   <section className="gg-panel" aria-label="How scoring works"><h2>How it works</h2>
    <p>While ZeekFusion is live, there’s one surprise check-in per 30-minute block. If you chatted in that block before the check-in, you get 1 XP. No command or spam needed.</p>
    <p>At the end of each stream, the top three chatters get bonus XP: 1st +3, 2nd +2, 3rd +1.</p>
    <p>XP carries across streams. Good luck!</p>
    <p className="gg-rules">If the winner passes, the prize goes to the next eligible person.</p>
   </section>
  </div>
 </main>;
}

const ENDPOINT='/api/site?giveaway=1&owner=1';
export default function GtaGiveaway(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[picked,setPicked]=useState('');
 const refresh=useCallback(async(signal)=>{
  try{const r=await fetch(ENDPOINT,{cache:'no-store',signal}),j=await r.json();
   if(r.status===404){setData({status:'preview',entries:[]});setError('');return;}
   if(!r.ok)throw Error('Standings are temporarily unavailable.');
   setData(j);setError('');
  }catch(e){if(e.name!=='AbortError')setError('Couldn’t refresh; the scores below are the last confirmed standings.');}
 },[]);
 useEffect(()=>{const ac=new AbortController();refresh(ac.signal);const poll=setInterval(()=>{if(!document.hidden)refresh(ac.signal);},20000);
  return()=>{ac.abort();clearInterval(poll);};},[refresh]);
 const manage=async(action,fields={})=>{
  setBusy(true);setError('');setNotice('');
  try{const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...fields})});
   const j=await res.json();if(!res.ok)throw Error(j.error||'Could not save the change.');await refresh();
   if(action==='bonus')setNotice(j.result==='unchanged'?'Those bonuses were already recorded. No points were added again.':'Top-three bonuses saved.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 const streams=data?.streams??[];
 const selected=streams.find(s=>s.started_at===picked)??streams[0];
 return <>
  {error&&<p className="gg-alert" role="status">{error}</p>}
  <GiveawayBoard {...(data??{status:'loading'})}/>
  {data?.isOwner&&<section className="gg-panel gg-owner" aria-label="Giveaway controls">
   <h2>Owner controls</h2>
   {data.status==='preview'&&(data.canStart?<button disabled={busy} onClick={()=>{if(window.confirm('Start scoring this giveaway?'))manage('start');}}>Start scoring</button>:<p>Tracking is off while the setup is being tested.</p>)}
   {notice&&<p role="status">{notice}</p>}
   {['live','paused','stale'].includes(data.status)&&<div className="gg-bonus">
    <h3>Top chatter bonuses</h3>
    {!selected?<p>Choose the top chatters after a stream has ended.</p>:<>
    <label>Completed stream <select value={selected.started_at} onChange={e=>setPicked(e.target.value)} disabled={busy}>
     {streams.map(s=><option key={s.started_at} value={s.started_at}>{new Date(s.started_at).toLocaleString()} {s.gta_bonuses.length?'(awarded)':''}</option>)}
    </select></label>
    {selected.gta_bonuses.length?<ol>{[...selected.gta_bonuses].sort((a,b)=>a.place-b.place).map(x=><li key={x.place}>@{x.username} (+{4-x.place} XP)</li>)}</ol>:
     <form key={selected.started_at} onSubmit={e=>{
      e.preventDefault();const f=new FormData(e.currentTarget);const handles=[1,2,3].map(n=>String(f.get('place'+n)).trim());
      if(window.confirm('Record these bonuses? '+handles.map((h,i)=>h+' +'+(3-i)+' XP').join(', ')))manage('bonus',{stream:selected.started_at,handles});
     }}>
      {['1st','2nd','3rd'].map((place,i)=><label key={place}>{place} (+{3-i} XP) <input name={'place'+(i+1)} placeholder="@KickHandle" maxLength={101} required disabled={busy}/></label>)}
      <button disabled={busy}>Award bonuses</button>
     </form>}
    </>}
   </div>}
   {['live','paused','stale'].includes(data.status)&&<button disabled={busy} onClick={()=>{if(window.confirm('Stop the giveaway and freeze XP?'))manage('stop');}}>Stop and freeze XP</button>}
   {data.status==='closed'&&<form onSubmit={e=>{e.preventDefault();const h=new FormData(e.currentTarget).get('handle');if(window.confirm('Mark this confirmed participant as passed?'))manage('pass',{handle:h});}}>
    <label>Kick handle of participant who passed <input name="handle" required /></label><button disabled={busy}>Mark as passed</button>
   </form>}
  </section>}
 </>;
}
