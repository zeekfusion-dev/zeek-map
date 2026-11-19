export const WINDOW_MS = 15 * 60 * 1000;
const MODES = new Set(['chat-15', 'chat-30', 'command', 'block-30']);
/** Reference scorer: use trusted chat messages & authoritative Kick stream spans. */
export function calculateStandings({mode, openedAt, closedAt=Infinity, asOf, streams, events, excluded=new Set()}) {
 if (!MODES.has(mode) || !Number.isFinite(openedAt) || !Number.isFinite(asOf)) throw new Error('Invalid scoring configuration');
 const stop=Math.min(asOf,closedAt), totals=new Map();
 const windowMs=mode==='block-30'?2*WINDOW_MS:WINDOW_MS;
 for(const {start,end=Infinity} of streams) {
  const activeFrom=Math.max(start,openedAt), activeTo=Math.min(stop,end);
  if(!Number.isFinite(start)||activeTo<activeFrom) continue;
  const ticks=new Map();
  for(const event of events) {
   if(!Number.isSafeInteger(event.userId)||event.userId<=0||event.bot||event.host||event.anonymous||excluded.has(event.userId)||typeof event.username!=='string'||!event.username||!Number.isFinite(event.at))continue;
   if(event.at<activeFrom||event.at>=activeTo) continue;
   if(mode==='command'&&String(event.message).trim().toLowerCase()!=='!gta')continue;
   const first=1+Math.floor((event.at-start)/windowMs);
   const count=mode==='chat-30'?2:1;
   for(let tick=first;tick<first+count;tick++) {
    const at=start+tick*windowMs;
    if(at>activeTo) break;
    if(!ticks.has(tick))ticks.set(tick,new Map());
    const row=ticks.get(tick);
    if(!row.has(event.userId)||row.get(event.userId).at<event.at)row.set(event.userId,event);
   }
  }
  for(const bucket of ticks.values()) for(const event of bucket.values()) {
   const old=totals.get(event.userId);
   totals.set(event.userId,{username:!old||old.latest<event.at?event.username:old.username,latest:Math.max(old?.latest??0,event.at),xp:(old?.xp??0)+1});
  }
 }
 return [...totals.values()].map(({username,xp})=>({username,xp})).sort((a,b)=>b.xp-a.xp||a.username.localeCompare(b.username)).map((row,i,rows)=>({...row,rank:i===0||row.xp!==rows[i-1].xp?i+1:rows.findIndex(r=>r.xp===row.xp)+1}));
}

// The final ten minutes of each 30-minute block are eligible checkpoint times.
// Random draws must be stored once per stream/block by the production layer.
export function surpriseCheckpoint(streamStart, blockIndex, draw) {
 if(!Number.isFinite(streamStart)||!Number.isInteger(blockIndex)||blockIndex<0||!Number.isInteger(draw)||draw<0||draw>=600) throw Error('Invalid checkpoint inputs');
 return streamStart+(blockIndex*30+20)*60000+draw*1000;
}

export function surpriseAwards({start,end=Infinity,asOf,checks,events}) {
 const verified=checks.filter(c=>Number.isFinite(c)&&c>=start&&c<=end&&c<=asOf).sort((a,b)=>a-b);
 const totals=new Map();
 let since=start;
 for(const at of new Set(verified)){
  const participants=new Set(events.filter(e=>e.at>=since&&e.at<at&&e.userId>0&&!e.host&&!e.bot&&!e.anonymous).map(e=>e.userId));
  for(const user of participants)totals.set(user,(totals.get(user)??0)+1);
  since=at;
 }
 return totals;
}
