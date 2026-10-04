import {BROADCASTER} from './domain.mjs';
// Called under the scheduler's distributed lock; never remove existing subscriptions.
export async function ensureChatSubscription(token,request=fetch){
 const url='https://api.kick.com/public/v1/events/subscriptions';
 const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 const list=async()=>{
  const r=await request(url+'?broadcaster_user_id='+BROADCASTER,{headers,signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error(`Kick incoming-chat check failed (${r.status}).`);
  const body=await r.json();
  if(!Array.isArray(body.data))throw new Error('Kick incoming-chat check returned an invalid response.');
  return body.data.some(s=>Number(s.broadcaster_user_id)===BROADCASTER&&s.event==='chat.message.sent'&&Number(s.version)===1);
 };
 if(await list())return {repaired:false};
 const r=await request(url,{method:'POST',headers,body:JSON.stringify({broadcaster_user_id:BROADCASTER,events:[{name:'chat.message.sent',version:1}],method:'webhook'}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Error(`Kick incoming-chat subscription could not be restored (${r.status}). Check the website app's webhook settings in Kick.`);
 if(!await list())throw new Error('Kick has not confirmed the incoming-chat subscription. Check the website app webhook settings.');
 return {repaired:true};
}
