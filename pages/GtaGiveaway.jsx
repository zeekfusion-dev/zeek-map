import React,{useCallback,useEffect,useState} from 'react';
import './GtaGiveaway.css';

const labels={
 'random-preview':'One surprise check-in per 30-minute block. Chat normally; one message since the previous check-in is enough.',
 'block-30':'Chat normally at least once in each live 30-minute block. Extra messages don’t earn extra XP.',
 'chat-15':'Send any message during a live 15-minute block.',
 'chat-30':'Be on the active chatter list at the check-in.',
 command:'Type !gta during a live 15-minute block.'
};
export function GiveawayBoard({mode, status, entries=[], nextCheckIn=null, skippedWindows=0, now=Date.now()}) {
 const minutes=nextCheckIn==null?null:Math.max(0,Math.ceil((nextCheckIn-now)/60000));
 return <main className="gg-page">
  <header className="gg-hero">
   <div className="gg-tag">ZEEKFUSION · KICK COMMUNITY</div>
   <h1>GTA Giveaway<span>Leaderboard</span></h1>
   <div className="gg-prize"><strong>GTA 6 copy or gift card</strong><p>(If you don’t want it, it’ll be passed on to the next person.)</p></div>
   <span className="gg-state">{({preview:'Preview · scoring off',live:'Live · scoring on',paused:'Between streams',closed:'Giveaway closed',stale:'Scoring paused · feed check pending'})[status] ?? 'Scoring unavailable'}</span>
  </header>
  <div className="gg-grid">
   <section className="gg-panel" aria-label="Live standings"><h2>Standings</h2>
    {!entries.length?<p>No scored check-ins yet.</p>:<table>
     <thead><tr><th>Rank</th><th>Kick handle</th><th>XP</th></tr></thead>
     <tbody>{entries.map(r=><tr key={r.username}><td>{r.rank}</td><td>@{r.username}</td><td>{r.xp}</td></tr>)}</tbody>
    </table>}
   </section>
   <section className="gg-panel" aria-label="How scoring works"><h2>How it works</h2>
    <p>{labels[mode] ?? 'The check-in rule has not been set.'}</p>
    <p>{status==='live'&&minutes!==null?'Next check-in: '+minutes+' min.':'Check-ins run only when ZeekFusion is live.'}</p>
    <p>No subscription, payment, or gifts required.</p>
    <p>XP carries across streams. If a check-in cannot be verified, it won’t award XP.</p>
    {skippedWindows>0&&<p>{skippedWindows} unverified {skippedWindows===1?'block skipped':'blocks skipped'}.</p>}
   </section>
  </div>
 </main>;
}

const ENDPOINT='/api/site?giveaway=1&owner=1';
export default function GtaGiveaway(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now());
 const refresh=useCallback(async(signal)=>{
  try{const r=await fetch(ENDPOINT,{cache:'no-store',signal}),j=await r.json();
   if(r.status===404){setData({status:'preview',entries:[]});setError('');return;}
   if(!r.ok)throw Error('Standings are temporarily unavailable.');
   setData(j);setError('');
  }catch(e){if(e.name!=='AbortError')setError('Couldn’t refresh; the scores below are the last confirmed standings.');}
 },[]);
 useEffect(()=>{const ac=new AbortController();refresh(ac.signal);const poll=setInterval(()=>{if(!document.hidden)refresh(ac.signal);},20000);
  const timer=setInterval(()=>setNow(Date.now()),1000);return()=>{ac.abort();clearInterval(poll);clearInterval(timer);};},[refresh]);
 const manage=async(action,handle)=>{
  setBusy(true);setError('');
  try{const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,handle})});
   const j=await res.json();if(!res.ok)throw Error(j.error||'Could not save the change.');await refresh();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 };
 return <>
  {error&&<p className="gg-alert" role="status">{error}</p>}
  <GiveawayBoard mode={data?.status==='preview'?'random-preview':'block-30'} {...(data??{status:'loading'})} now={now}/>
  {data?.isOwner&&<section className="gg-panel gg-owner" aria-label="Giveaway controls">
   <h2>Owner controls</h2>
   {data.status==='preview'&&<p>Tracking is off while the updated rules are being tested.</p>}
   {['live','paused','stale'].includes(data.status)&&<button disabled={busy} onClick={()=>{if(window.confirm('Stop the giveaway and freeze XP?'))manage('stop');}}>Stop and freeze XP</button>}
   {data.status==='closed'&&<form onSubmit={e=>{e.preventDefault();const h=new FormData(e.currentTarget).get('handle');if(window.confirm('Mark this confirmed participant as passed?'))manage('pass',h);}}>
    <label>Kick handle of participant who passed <input name="handle" required /></label><button disabled={busy}>Mark as passed</button>
   </form>}
  </section>}
 </>;
}
