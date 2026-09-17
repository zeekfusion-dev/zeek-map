import React,{useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {createClient} from '@supabase/supabase-js';
import {createAlertQueue} from '../components/alert-queue.mjs';
import RewardPlayer from '../components/RewardPlayer';
export default function RewardOverlay(){const [params]=useSearchParams(),key=params.get('key'),[playing,setPlaying]=useState(null),[error,setError]=useState('');
 useEffect(()=>{document.documentElement.classList.add('is-reward-overlay');return()=>document.documentElement.classList.remove('is-reward-overlay')},[]);
 useEffect(()=>{let alive=true,client,channel,queue,wakeTimer,bootTimer,pendingResolve;const controller=new AbortController(),clientId=crypto.randomUUID(),played=new Set();
 const request=async body=>{const r=await fetch('/api/reward-alerts',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+(key||''),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify({...body,client:clientId}):undefined,signal:controller.signal});const j=await r.json();if(!r.ok)throw Object.assign(Error(j.error||'Alerts temporarily disconnected.'),{status:r.status});return j;};
 const boot=(attempt=0)=>request().then(config=>{if(!alive)return;client=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});queue=createAlertQueue({request,play:item=>new Promise(resolve=>{pendingResolve=resolve;setPlaying({item,done:ok=>{setPlaying(null);pendingResolve=null;resolve(ok)}})}),remember:id=>played.add(id),wasPlayed:id=>played.has(id),onError:e=>{if(alive)setError(e.message);if(e.status===401)queue?.stop()}});channel=client.channel(config.channel).on('broadcast',{event:'changed'},()=>{if(!wakeTimer)wakeTimer=setTimeout(()=>{wakeTimer=null;queue.wake()},300)}).subscribe(status=>{if(!alive)return;if(status==='SUBSCRIBED'){setError('');queue.wake()}else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')setError('Stream alerts reconnecting…');});}).catch(e=>{if(alive){setError(e.message);if(e.status!==401)bootTimer=setTimeout(()=>boot(attempt+1),Math.min(60000,1000*2**Math.min(attempt,6)));}});boot();
 return()=>{alive=false;controller.abort();queue?.stop();clearTimeout(wakeTimer);clearTimeout(bootTimer);pendingResolve?.(false);if(channel)client.removeChannel(channel);};
 },[key]);
 return <main className="reward-overlay">{playing&&<RewardPlayer item={playing.item} onDone={playing.done} onError={setError}/>} {error&&<p className="reward-overlay-error" role="alert">{error}</p>}</main>;
}
