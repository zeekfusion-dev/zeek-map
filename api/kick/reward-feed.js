import {limit} from '../../server/security.mjs';
import {securityLog} from '../../server/security-log.mjs';
import {db} from '../../server/db.mjs';
import {parseNativeRewardReceipt} from '../../server/native-reward.mjs';
import {verifyOverlayToken} from '../../server/rewards.mjs';
export const config={maxDuration:10};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).end();
 try{
  const token=req.headers.authorization?.replace(/^Bearer /,'');
  if(typeof token!=='string'||!/^[-_A-Za-z0-9]{43}$/.test(token))return res.status(401).json({error:'Unauthorized'});
  await limit(req,'native-reward-feed',180);
  const settings=(await db('z_overlay_settings?id=eq.1&select=nonce'))[0];
  if(!settings||!verifyOverlayToken(token,settings.nonce))return res.status(401).json({error:'Unauthorized'});
  const cutoff=encodeURIComponent(new Date(Date.now()-180000).toISOString());
  const rows=await db(`z_webhook_receipts?select=id,created_at&id=like.native-reward:*&created_at=gte.${cutoff}&order=created_at.asc&limit=100`);
  return res.json({events:(rows||[]).map(r=>parseNativeRewardReceipt(r.id,r.created_at)).filter(Boolean)});
 }catch(e){securityLog('reward_feed_failure',e.status===429?429:503);if(e.status===429){res.setHeader('Retry-After','60');return res.status(429).json({error:'Too many requests. Please wait.'});}return res.status(503).json({error:'Reward feed unavailable'});}
}
