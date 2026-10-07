import {BROADCASTER} from './domain.mjs';
export async function ensureRewardSubscription(token,request=fetch){
 const url='https://api.kick.com/public/v1/events/subscriptions';
 const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 const list=async()=>{
  const r=await request(url+'?broadcaster_user_id='+BROADCASTER,{headers,signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw new Error(`Kick reward-event check failed (${r.status}).`);
  const body=await r.json();
  if(!Array.isArray(body.data))throw new Error('Kick reward-event check returned an invalid response.');
  return body.data.some(s=>Number(s.broadcaster_user_id)===BROADCASTER&&s.event==='channel.reward.redemption.updated'&&Number(s.version)===1);
 };
 if(await list())return {repaired:false};
 const r=await request(url,{method:'POST',headers,body:JSON.stringify({broadcaster_user_id:BROADCASTER,events:[{name:'channel.reward.redemption.updated',version:1}],method:'webhook'}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Error(`Kick reward-event subscription could not be created (${r.status}). Existing Kick features were left unchanged.`);
 if(!await list())throw new Error('Kick did not confirm the reward-event subscription. Existing Kick features were left unchanged.');
 return {repaired:true};
}
