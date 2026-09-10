import crypto from 'node:crypto';
export const BROADCASTER = 20306616;
export const defaults = {subscription_z:5,gift_z:5,renewal_z:5,question_z:1,question_interval_minutes:30,answer_seconds:60,questions_enabled:true,kicks_enabled:false,kicks_per_z:100,botrix_enabled:false,botrix_points_per_z:1000,botrix_weekly_cap_z:5};
export function cents(value) {
  const s=String(value);
  if(!/^-?\d+(\.\d{1,2})?$/.test(s)) throw new Error('Use a number with at most two decimal places.');
  const n=Math.round(Number(s)*100);
  if(!Number.isSafeInteger(n)||Math.abs(n)>100000000) throw new Error('Amount is too large.');
  return n;
}
export function normalizeAnswer(s) {return String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();}
export function validConfig(input) {
  const output={...defaults};
  for(const key of Object.keys(defaults)) if(key in input) output[key]=input[key];
  for(const key of ['subscription_z','gift_z','renewal_z','question_z','botrix_weekly_cap_z']) {cents(output[key]);if(Number(output[key])<0||Number(output[key])>1000) throw new Error('Reward rates must be between 0 and 1,000 Zs.');output[key]=Number(output[key]);}
  for(const [key,min,max] of [['question_interval_minutes',5,1440],['answer_seconds',15,300],['kicks_per_z',1,1000000],['botrix_points_per_z',1,10000000]]) if(!Number.isInteger(output[key])||output[key]<min||output[key]>max) throw new Error(`Invalid ${key}.`);
  for(const key of ['questions_enabled','kicks_enabled','botrix_enabled']) if(typeof output[key]!=='boolean')throw new Error(`Invalid ${key}.`);
  return output;
}
export function rewardForEvent(type,b,cfg) {
  if(Number(b.broadcaster?.user_id)!==BROADCASTER) return null;
  let who,amount,reason;
  if(type==='channel.subscription.new'||type==='channel.subscription.renewal') {who=b.subscriber;amount=cents(type.endsWith('.new')?cfg.subscription_z:cfg.renewal_z);reason=type.endsWith('.new')?'New subscription':'Subscription renewal';}
  if(type==='channel.subscription.gifts') {who=b.gifter;amount=cents(cfg.gift_z)*(Array.isArray(b.giftees)?b.giftees.length:0);reason=`Gifted ${b.giftees?.length||0} subscription(s)`;}
  if(type==='kicks.gifted'&&cfg.kicks_enabled) {who=b.sender;const k=b.gift?.amount;if(!Number.isSafeInteger(k)||k<=0)return null;amount=Math.floor(k*100/cfg.kicks_per_z);reason=`Sent ${k} KICKs`;}
  if(!who||who.is_anonymous||!Number.isSafeInteger(who.user_id)||who.user_id<=0||!who.username||!Number.isSafeInteger(amount)||amount<=0) return null;
  return {userId:who.user_id,username:who.username,amount:amount/100,reason};
}
export function verifySignature(key,id,timestamp,signature,raw,now=Date.now()) {
  if(!id||!timestamp||!signature||!Number.isFinite(Date.parse(timestamp))||Math.abs(now-Date.parse(timestamp))>300000) return false;
  try{return crypto.verify('RSA-SHA256',Buffer.concat([Buffer.from(`${id}.${timestamp}.`),raw]),key,Buffer.from(signature,'base64'));}catch{return false;}
}
