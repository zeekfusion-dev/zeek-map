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
