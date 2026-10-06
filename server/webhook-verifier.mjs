import {createPublicKey} from 'node:crypto';
import {verifySignature} from './domain.mjs';

// Only trust Kick's fixed HTTPS endpoint, never a URL supplied by an event.
export function createWebhookVerifier(request=fetch,clock=Date.now){
 let cached=null, fetchedAt=0, pending=null;
 async function refresh(){
  if(pending)return pending;
  pending=(async()=>{
   const response=await request('https://api.kick.com/public/v1/public-key',{signal:AbortSignal.timeout(8000),redirect:'error'});
   if(!response.ok)throw new Error('Kick verification key unavailable');
   const pem=(await response.json())?.data?.public_key;
   if(typeof pem!=='string'||pem.length>8192)throw new Error('Invalid Kick verification key');
   const key=createPublicKey(pem);
   if(key.asymmetricKeyType!=='rsa')throw new Error('Invalid Kick verification key type');
   cached=key;fetchedAt=clock();return key;
  })();
  try{return await pending;}finally{pending=null;}
 }
 return async(id,timestamp,signature,raw)=>{
  const now=clock();
  if(typeof id!=='string'||id.length>200||typeof timestamp!=='string'||timestamp.length>64||typeof signature!=='string'||signature.length>2048||!Number.isFinite(Date.parse(timestamp))||Math.abs(now-Date.parse(timestamp))>300000)return false;
  const key=!cached||now-fetchedAt>=300000?await refresh():cached;
  if(verifySignature(key,id,timestamp,signature,raw,now))return true;
  // Retry rotation once, with a cooldown so forged events cannot flood Kick.
  if(now-fetchedAt>=30000)return verifySignature(await refresh(),id,timestamp,signature,raw,now);
  return false;
 };
}
export const verifyKickWebhook=createWebhookVerifier();
