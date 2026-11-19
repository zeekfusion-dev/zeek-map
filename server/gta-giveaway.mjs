import {db,rpc} from './db.mjs';
import {BROADCASTER} from './domain.mjs';
import {botName} from './bot-identity.mjs';
import {bodyObject,invalid,limit} from './security.mjs';
import {requireAdmin,sameOrigin,session} from './auth.mjs';
import {securityLog} from './security-log.mjs';

export const giveawayEnabled=()=>process.env.GTA_GIVEAWAY_ENABLED==='1';
const time=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null;
export function isEligible(sender,content){
 return Number.isSafeInteger(sender?.user_id) && sender.user_id>0 && sender.user_id!==BROADCASTER &&
  (!process.env.KICK_BOT_USER_ID||sender.user_id!==Number(process.env.KICK_BOT_USER_ID)) &&
  !sender.is_anonymous && typeof sender.username==='string' && sender.username.length>0&&sender.username.length<=100 &&
  sender.username.toLowerCase()!==botName().toLowerCase() &&
  !sender.identity?.badges?.some?.(x=>['bot','chat bot'].includes(String(x.type??x.text??'').toLowerCase())) &&
  typeof content==='string' && !!content.trim() && !/^\s*!/.test(content);
}
export async function recordGiveawayChat(body,call=rpc){
 const p_at=time(body.created_at), sender=body.sender;
 if(!p_at||!isEligible(sender,body.content))return false;
 return call('gta_record_chat',{p_user:sender.user_id,p_name:sender.username,p_at});
}
export async function observeGiveawayStream({live,start,ended=null,observed=new Date().toISOString()},call=rpc){
 const p_at=time(observed),p_start=time(start),p_end=time(ended);
 if(!p_at||typeof live!=='boolean'||(live&&!p_start))return false;
 return call('gta_observe',{p_live:live,p_start,p_at,p_end});
}
export async function ensureGiveawayLifecycle(token,request=fetch){
 const url='https://api.kick.com/public/v1/events/subscriptions';
 const event='livestream.status.updated';
 const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const exists=async()=>{
  const res=await request(url+'?broadcaster_user_id='+BROADCASTER,{headers,signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw Error('Kick lifecycle subscription could not be checked.');
  const {data}=await res.json();
  if(!Array.isArray(data))throw Error('Invalid Kick subscription response.');
  return data.some(x=>Number(x.broadcaster_user_id)===BROADCASTER&&x.event===event&&Number(x.version)===1);
 };
 if(await exists())return;
 const res=await request(url,{method:'POST',headers,body:JSON.stringify({broadcaster_user_id:BROADCASTER,events:[{name:event,version:1}],method:'webhook'}),signal:AbortSignal.timeout(10000)});
 if(!res.ok||!await exists())throw Error('Kick lifecycle subscription was not confirmed.');
}

export async function giveawayApi(req,res){
 if(!giveawayEnabled())return res.status(404).json({error:'Giveaway is not open.'});
 if(req.method==='GET'){
  await limit(req,'gta-standings',45);
  const standings=await rpc('gta_standings');
  const u=req.query.owner==='1'?await session(req):null;
  return res.json({...standings,isOwner:Number(u?.kick_user_id)===BROADCASTER});
 }
 if(req.method!=='POST')return res.status(405).end();
 sameOrigin(req);
 const u=await requireAdmin(req);
 await limit(req,'gta-owner',15,60,u.kick_user_id);
 const b=bodyObject(req,1000), now=new Date().toISOString();
 if(b.action==='start'){
  // Single campaign; never replace an existing scoreboard or its start.
  await db('gta_campaign?on_conflict=id',{method:'POST',prefer:'resolution=ignore-duplicates',body:{id:1,opened_at:now}});
 }else if(b.action==='stop'){
  await db('gta_campaign?id=eq.1&closed_at=is.null',{method:'PATCH',body:{closed_at:now}});
 }else if(b.action==='pass'){
  const handle=String(b.handle??'').trim().replace(/^@/,'');
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(handle))throw invalid('Enter the Kick handle exactly.');
  const campaign=(await db('gta_campaign?id=eq.1&select=closed_at'))[0];
  if(!campaign?.closed_at)throw invalid('Stop scoring before marking a participant as passed.');
  const matches=await db('gta_checkins?select=user_id&username=eq.'+encodeURIComponent(handle)+'&limit=1000');
  const ids=[...new Set(matches.map(x=>x.user_id))];
  if(ids.length!==1)throw invalid('That handle could not be uniquely matched.');
  await db('gta_passes?on_conflict=user_id',{method:'POST',prefer:'resolution=ignore-duplicates',body:{user_id:ids[0]}});
 }else throw invalid('Unknown giveaway action.');
 return res.json(await rpc('gta_standings'));
}

// Keep giveaway problems isolated from trivia, subscriptions and Z Market.
export async function tryGiveawayObservation(fn){try{await fn();}catch{securityLog('giveaway_observation_failure',503);}}
