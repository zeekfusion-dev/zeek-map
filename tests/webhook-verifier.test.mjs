import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createWebhookVerifier} from '../server/webhook-verifier.mjs';
const first=generateKeyPairSync('rsa',{modulusLength:2048}), second=generateKeyPairSync('rsa',{modulusLength:2048});
const pem=k=>k.publicKey.export({type:'spki',format:'pem'});
function event(k,now){const id='event-1',ts=new Date(now).toISOString(),raw=Buffer.from('{"content":"15"}');return [id,ts,sign('RSA-SHA256',Buffer.concat([Buffer.from(`${id}.${ts}.`),raw]),k.privateKey).toString('base64'),raw];}
test('fetches current key, caches it and refreshes on rotation',async()=>{
 let now=Date.now(),key=first,calls=0;
 const verify=createWebhookVerifier(async(url,options)=>{calls++;assert.equal(url,'https://api.kick.com/public/v1/public-key');assert.equal(options.redirect,'error');return {ok:true,json:async()=>({data:{public_key:pem(key)}})};},()=>now);
 assert.equal(await verify(...event(first,now)),true);
 assert.equal(await verify(...event(first,now)),true);assert.equal(calls,1);
 key=second;now+=31000;
 assert.equal(await verify(...event(second,now)),true);assert.equal(calls,2);
 assert.equal(await verify(...event(first,now)),false);assert.equal(calls,2);
});
test('rejects tampering and stale messages; coalesces key requests',async()=>{
 const now=Date.now();let calls=0;
 const verify=createWebhookVerifier(async()=>{calls++;return {ok:true,json:async()=>({data:{public_key:pem(first)}})};},()=>now);
 assert.deepEqual(await Promise.all([verify(...event(first,now)),verify(...event(first,now))]),[true,true]);assert.equal(calls,1);
 const forged=event(first,now);forged[3]=Buffer.from('{"content":"100"}');assert.equal(await verify(...forged),false);
 assert.equal(await verify(...event(first,now-301000)),false);assert.equal(calls,1);
});
test('fails closed if key endpoint fails or returns a malformed key',async()=>{
 const now=Date.now();
 await assert.rejects(createWebhookVerifier(async()=>({ok:false}),()=>now)(...event(first,now)),/unavailable/);
 await assert.rejects(createWebhookVerifier(async()=>({ok:true,json:async()=>({data:{public_key:'invalid'}})}),()=>now)(...event(first,now)));
});
