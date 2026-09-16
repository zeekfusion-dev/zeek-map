import crypto from 'node:crypto';
export const BROADCASTER = 20306616;
export const defaults = {subscription_z:0,gift_z:0,renewal_z:0,question_z:100,question_interval_minutes:30,answer_seconds:60,questions_enabled:true,kicks_enabled:false,kicks_per_z:100,botrix_enabled:false,botrix_points_per_z:1};
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
  for(const key of ['subscription_z','gift_z','renewal_z','question_z']) {cents(output[key]);if(Number(output[key])<0||Number(output[key])>1000) throw new Error('Reward rates must be between 0 and 1,000 Zs.');output[key]=Number(output[key]);}
  for(const [key,min,max] of [['question_interval_minutes',5,1440],['answer_seconds',15,300],['kicks_per_z',1,1000000],['botrix_points_per_z',1,10000000]]) if(!Number.isInteger(output[key])||output[key]<min||output[key]>max) throw new Error(`Invalid ${key}.`);
  for(const key of ['questions_enabled','kicks_enabled','botrix_enabled']) if(typeof output[key]!=='boolean')throw new Error(`Invalid ${key}.`);
  output.subscription_z=0;output.gift_z=0;output.renewal_z=0;output.kicks_enabled=false;
  return output;
}
export function rewardForEvent(type,b,cfg) {
  // Paid activity never grants Zs, even with stale stored configuration.
  return null;
}

export function verifySignature(key,id,timestamp,signature,raw,now=Date.now()) {
  if(typeof id!=='string'||id.length>200||typeof timestamp!=='string'||timestamp.length>64||typeof signature!=='string'||signature.length>2048||!Number.isFinite(Date.parse(timestamp))||Math.abs(now-Date.parse(timestamp))>300000) return false;
  try{return crypto.verify('RSA-SHA256',Buffer.concat([Buffer.from(`${id}.${timestamp}.`),raw]),key,Buffer.from(signature,'base64'));}catch{return false;}
}
