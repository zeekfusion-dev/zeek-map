import {db,rpc,configuration} from '../../server/db.mjs';
import {BROADCASTER,rewardForEvent,verifySignature,normalizeAnswer} from '../../server/domain.mjs';
import {flushOutbox} from '../../server/kick.mjs';
export const config={api:{bodyParser:false},maxDuration:60};
const KICK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq/+l1WnlRrGSolDMA+A8
6rAhMbQGmQ2SapVcGM3zq8ANXjnhDWocMqfWcTd95btDydITa10kDvHzw9WQOqp2
MZI7ZyrfzJuz5nhTPCiJwTwnEtWft7nV14BYRDHvlfqPUaZ+1KR4OCaO/wWIk/rQ
L/TjY0M70gse8rlBkbo2a8rKhu69RQTRsoaf4DVhDPEeSeI5jVrRDGAMGL3cGuyY
6CLKGdjVEM78g3JfYOvDU/RvfqD7L89TZ3iN94jrmWdGz34JNlEI5hqK8dd7C5EF
BEbZ5jgB8s8ReQV8H+MkuffjdAj3ajDDX3DOJMIut1lBrUVD1AaSrGCKHooWoL2e
twIDAQAB
-----END PUBLIC KEY-----`;


export default async function handler(req,res){
 if(req.method==='GET')return res.json({ok:true,message:'ZeekFusion Kick webhook is online',version:'z-vault-1'});
 if(req.method!=='POST')return res.status(405).end();
 try{const chunks=[];let size=0;for await(const chunk of req){const b=Buffer.from(chunk);size+=b.length;if(size>1048576)return res.status(413).end();chunks.push(b);}const raw=Buffer.concat(chunks);
 const id=req.headers['kick-event-message-id'],ts=req.headers['kick-event-message-timestamp'],sig=req.headers['kick-event-signature'],type=req.headers['kick-event-type'];
 if(!verifySignature(KICK_PUBLIC_KEY,id,ts,sig,raw))return res.status(401).json({error:'Invalid signature'});
 let body;try{body=JSON.parse(raw.toString());}catch{return res.status(400).end();}
 if(Number(body.broadcaster?.user_id)!==BROADCASTER)return res.json({received:true,ignored:true});
 const cfg=await configuration();const reward=type==='kicks.gifted'?null:rewardForEvent(type,body,cfg);
 if(type==='kicks.gifted'&&cfg.kicks_enabled&&body.sender?.user_id&&!body.sender.is_anonymous&&Number.isSafeInteger(body.gift?.amount)&&body.gift.amount>0)await rpc('z_award_kicks',{p_user:body.sender.user_id,p_name:body.sender.username,p_kicks:body.gift.amount,p_event:id});
 if(reward)await rpc('z_award',{p_user:reward.userId,p_name:reward.username,p_amount:reward.amount,p_reason:reward.reason,p_event:id,p_metadata:{event:type}});
 if(type!=='chat.message.sent')await db('z_runtime?id=eq.1',{method:'PATCH',body:{last_webhook_at:new Date().toISOString()}});
 if(type==='chat.message.sent'&&body.sender?.user_id&&!body.sender.is_anonymous){
 const who=body.sender,content=String(body.content||'');let send=false;
 if(/^!zs(?:\s|$)/i.test(content)){await rpc('z_balance_command',{p_user:who.user_id,p_name:who.username,p_message:body.message_id});send=true;}
 else if(body.created_at&&Number.isFinite(Date.parse(body.created_at)))send=!!await rpc('z_answer',{p_user:who.user_id,p_name:who.username,p_answer:normalizeAnswer(content),p_message:body.message_id,p_created:body.created_at});
 try{if(send)await flushOutbox();}catch(e){console.error('Chat delivery deferred:',e.message);}
 }
 return res.json({received:true});
 }catch(e){console.error('Kick webhook:',e.message);return res.status(500).json({error:'Webhook processing failed'});}
}
