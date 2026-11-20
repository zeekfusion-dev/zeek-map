(() => {
 if (location.protocol !== 'https:' && location.protocol !== 'http:') return;
 const board = document.getElementById('leaders');
 async function refresh() {
  try {
   const r=await fetch('/api/site?giveaway=1',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(8000)});
   if (r.status===404){board.hidden=true;board.replaceChildren();return;}
   if (!r.ok) throw Error();
   const data=await r.json();
   if (!Array.isArray(data.entries)) throw Error();
   const rows=data.entries.filter(x=>x&&Number.isInteger(x.rank)&&Number.isInteger(x.xp)&&typeof x.username==='string').slice(0,3);
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
   // Keep the last successful leaderboard if a refresh fails.
  }
 }
 refresh();
 setInterval(refresh,20000);
})();
