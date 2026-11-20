(() => {
 if (location.protocol !== 'https:' && location.protocol !== 'http:') return;
 const popup=document.getElementById('popup');
 const board=document.getElementById('leaders');
 const empty=document.getElementById('empty');
 const intervalMs=15*60*1000,visibleMs=30*1000;
 function paint(rows,message) {
  board.replaceChildren(...rows.map(row=>{
   const li=document.createElement('li');
   for(const [i,label] of [String(row.rank),'@'+row.username,row.xp+' XP'].entries()){
    const node=document.createElement('span');
    if(i===2)node.className='xp';
    node.textContent=label;
    li.append(node);
   }
   return li;
  }));
  board.hidden=!rows.length;
  empty.textContent=message;
  empty.hidden=!message;
 }
 async function show() {
  try {
   const r=await fetch('/api/site?giveaway=1',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(5000)});
   if(r.status===404)paint([],'No standings yet.');
   else{
    if(!r.ok)throw Error();
    const {entries}=await r.json();
    if(!Array.isArray(entries))throw Error();
    const rows=entries.filter(x=>x&&Number.isInteger(x.rank)&&Number.isInteger(x.xp)&&typeof x.username==='string').slice(0,5);
    paint(rows,rows.length?'':'No XP yet.');
   }
  }catch{paint([],'Standings unavailable.');}
  popup.hidden=false;
  setTimeout(()=>{popup.hidden=true;},visibleMs);
 }
 show();
 setInterval(show,intervalMs);
})();
