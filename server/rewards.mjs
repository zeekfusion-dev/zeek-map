import crypto from 'node:crypto';
import {invalid} from './security.mjs';
import {safeLink} from './content.mjs';
export const MEDIA_TYPES={'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp','audio/mpeg':'mp3','audio/wav':'wav','audio/x-wav':'wav','audio/ogg':'ogg','audio/mp4':'m4a'};
export const MEDIA_BUCKET='z-reward-media';
export function rewardInput(b){
 const str=(v,n,required=false)=>{if(typeof v!=='string'||v.length>n||required&&!v.trim())throw invalid('Enter a valid reward name and description.');return v.trim();};
 const number=(v,min,max,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw invalid('Invalid '+label+'.');return v;};
 const title=str(b.title,80,true),description=str(b.description??'',500),cost=number(b.cost,.01,1000000,'Z price');if(Math.round(cost*100)!==cost*100&&Math.abs(Math.round(cost*100)-cost*100)>1e-7)throw invalid('Use up to two decimal places.');
 const stock=b.stock===null?null:number(b.stock,0,2147483647,'stock');if(stock!==null&&!Number.isInteger(stock))throw invalid('Use whole-number stock.');
 const duration=number(b.alert_duration??8,2,120,'alert duration'),volume=number(b.alert_volume??80,0,100,'volume'),cooldown=number(b.cooldown_seconds??0,0,86400,'cooldown');if(!Number.isInteger(cooldown))throw invalid('Cooldown must be whole seconds.');
 return {title,description,cost,stock,enabled:b.enabled===true,thumbnail_url:safeLink(b.thumbnail_url),image_url:safeLink(b.image_url),audio_url:safeLink(b.audio_url),alert_duration:duration,alert_volume:volume,cooldown_seconds:cooldown};
}
export function uploadInput(b){const ext=MEDIA_TYPES[b.type];if(!ext||!Number.isSafeInteger(b.size)||b.size<1||b.size>(b.type.startsWith('image/')?10:20)*1024*1024)throw invalid('Use PNG, JPEG, GIF or WebP (up to 10 MB), or MP3, WAV, OGG or M4A (up to 20 MB).');return {path:crypto.randomUUID()+'.'+ext,type:b.type};}
export function overlayToken(nonce){if(!process.env.KICK_CLIENT_SECRET)throw Error('Missing configuration');return crypto.createHmac('sha256',process.env.KICK_CLIENT_SECRET).update('zeek-reward-overlay-v1:'+nonce).digest('base64url');}
export function verifyOverlayToken(token,nonce){if(typeof token!=='string'||!/^[-_A-Za-z0-9]{43}$/.test(token))return false;return crypto.timingSafeEqual(Buffer.from(token),Buffer.from(overlayToken(nonce)));}
export function publicKey(key){if(typeof key!=='string')return null;if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))return key;try{const payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));return payload.role==='anon'?key:null;}catch{return null;}}
export function uuid(value){if(typeof value!=='string'||!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value))throw invalid('Invalid request.');return value;}
