import {db} from '../../server/db.mjs';
import {parseNativeRewardReceipt} from '../../server/native-reward.mjs';
export const config={maxDuration:10};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).end();
 try{
  const cutoff=encodeURIComponent(new Date(Date.now()-180000).toISOString());
  const rows=await db(`z_webhook_receipts?select=id,created_at&id=like.native-reward:*&created_at=gte.${cutoff}&order=created_at.asc&limit=100`);
  return res.json({events:(rows||[]).map(r=>parseNativeRewardReceipt(r.id,r.created_at)).filter(Boolean)});
 }catch(e){console.error('Reward feed:',e.message);return res.status(503).json({error:'Reward feed unavailable'});}
}
