import crypto from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {db,rpc} from '../server/db.mjs';
import {requireAdmin,sameOrigin,apiError,site} from '../server/auth.mjs';
import {bodyObject,validateQuery,limit,invalid} from '../server/security.mjs';
import {overlayToken,verifyOverlayToken,publicKey,uuid,uploadInput,MEDIA_BUCKET} from '../server/rewards.mjs';
export const config={api:{bodyParser:{sizeLimit:'16kb'}},maxDuration:30};
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');try{
 validateQuery(req);if(!['GET','POST'].includes(req.method))return res.status(405).end();
 const b=req.method==='POST'?bodyObject(req):{};if(req.method==='POST')sameOrigin(req);
 if(req.query.owner==='1'){
  const owner=await requireAdmin(req);await limit(req,'reward-admin',40,60,owner.kick_user_id);
  if(req.method==='POST'&&b.action==='upload'){
   const file=uploadInput(b),client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data,error}=await client.storage.from(MEDIA_BUCKET).createSignedUploadUrl(file.path);
   if(error)throw Error('Upload unavailable');
   return res.json({signedUrl:data.signedUrl,url:client.storage.from(MEDIA_BUCKET).getPublicUrl(file.path).data.publicUrl});
  }
  if(req.method==='POST'){if(b.action!=='rotate')throw invalid('Unknown action.');await db('z_overlay_settings?id=eq.1',{method:'PATCH',body:{nonce:crypto.randomUUID()}});}
  const settings=(await db('z_overlay_settings?id=eq.1'))[0];if(!settings)throw Error();
  const recent=await db('z_reward_alerts?select=id,title,username,status,created_at&order=sequence.desc&limit=20');
  return res.json({url:site()+'/#/reward-alerts?key='+overlayToken(settings.nonce),ready:!!publicKey(settings.publishable_key),recent});
 }
 await limit(req,'reward-overlay',180);
 const settings=(await db('z_overlay_settings?id=eq.1'))[0];
 const token=req.headers.authorization?.replace(/^Bearer /,'');if(!settings||!verifyOverlayToken(token,settings.nonce))throw invalid('This overlay link is invalid. Copy a new link from Owner Controls.',401);
 if(req.method==='GET'){const key=publicKey(settings.publishable_key);if(!key)throw invalid('Stream alerts are not connected yet.',409);return res.json({url:process.env.SUPABASE_URL,key,channel:'zeek-reward-alerts'});}
 const client=uuid(b.client);
 if(b.action==='claim')return res.json(await rpc('z_claim_alert',{p_client:client}));
 if(b.action==='finish')return res.json({ok:await rpc('z_finish_alert',{p_id:uuid(b.id),p_client:client,p_failed:b.failed===true})});
 throw invalid('Unknown action.');
 }catch(e){return apiError(res,e);}}
