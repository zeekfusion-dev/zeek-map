(() => {
 if (location.protocol !== 'https:' && location.protocol !== 'http:') return;
 const board = document.getElementById('leaders');
 const status = document.getElementById('status');
 const labels = {preview:'Scoring hasn’t started yet.',live:'Live standings · Top 3',paused:'Between streams · Top 3',closed:'Final standings · Top 3',stale:'Scoring paused · Top 3'};
 async function refresh() {
  try {
   const r=await fetch('/api/site?giveaway=1',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(8000)});
   if (r.status===404){status.textContent=labels.preview;board.hidden=true;board.replaceChildren();return;}
   if (!r.ok) throw Error();
   const data=await r.json();
   if (!Object.hasOwn(labels,data.status) || !Array.isArray(data.entries)) throw Error();
   const rows=data.entries.filter(x=>x&&Number.isInteger(x.rank)&&Number.isInteger(x.xp)&&typeof x.username==='string').slice(0,3);
   status.textContent=rows.length||data.status==='preview'?labels[data.status]:(data.status==='stale'?'Scoring paused.':data.status==='closed'?'Giveaway closed.':'No points awarded yet.');
   board.replaceChildren(...rows.map(row=>{
    const li=document.createElement('li');
    for (const [i,text] of [String(row.rank),'@'+row.username,row.xp+' XP'].entries()){
     const node=document.createElement('span');
     if(i===2) node.className='xp';
     node.textContent=text;
     li.append(node);
    }
    return li;
   }));
   board.hidden=!rows.length;
  } catch {
   status.textContent=board.hidden?'Standings unavailable.':'Last confirmed standings · Top 3';
  }
 }
 refresh();
 setInterval(refresh,20000);
})();
