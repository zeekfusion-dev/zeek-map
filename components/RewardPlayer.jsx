import React,{useEffect,useRef,useState} from 'react';
import './RewardAlerts.css';
export default function RewardPlayer({item,onDone,onError=()=>{}}){const [visible,setVisible]=useState(false),[blocked,setBlocked]=useState(false),failed=useRef(false),audio=useRef(null),callbacks=useRef({onDone,onError});callbacks.current={onDone,onError};
 useEffect(()=>{let cancelled=false,timer;failed.current=false;setBlocked(false);const a=item.audio_url?new Audio():null;audio.current=a;
 const ready=(asset,event)=>new Promise(resolve=>{const finish=()=>{clearTimeout(timeout);asset.removeEventListener(event,finish);asset.removeEventListener('error',finish);resolve()};const timeout=setTimeout(finish,5000);asset.addEventListener(event,finish,{once:true});asset.addEventListener('error',finish,{once:true});});
 const image=item.image_url?new Image():null,waits=[];if(image){waits.push(ready(image,'load'));image.src=item.image_url;}if(a){a.volume=Math.min(1,Math.max(0,Number(item.volume)/100));a.preload='auto';waits.push(ready(a,'canplaythrough'));a.src=item.audio_url;a.load();}
 Promise.all(waits).then(async()=>{if(cancelled)return;const started=Date.now();setVisible(true);if(a){try{await Promise.race([a.play(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Audio timeout')),5000))])}catch(e){failed.current=true;if(e.name==='NotAllowedError')setBlocked(true);else callbacks.current.onError('Audio could not play. Check the file and OBS autoplay settings.')}}if(cancelled){a?.pause();return;}timer=setTimeout(()=>{a?.pause();setVisible(false);callbacks.current.onDone(!failed.current)},Math.max(0,Math.max(2,Math.min(120,Number(item.duration)))*1000-(Date.now()-started)));});
 return()=>{cancelled=true;clearTimeout(timer);if(a){a.pause();a.removeAttribute('src');a.load()}audio.current=null;};
 },[item.id]);
 async function enableAudio(){try{await audio.current?.play();failed.current=false;setBlocked(false);callbacks.current.onError('')}catch{callbacks.current.onError('Check the audio file and allow sound for this browser.')}}
 return <div className={'reward-alert-stage '+(visible?'is-visible':'')} aria-live="polite">{item.image_url&&<img src={item.image_url} alt=""/>}<div className="reward-alert-caption"><span>@{item.username}</span><strong>{item.title}</strong></div>{blocked&&<button className="reward-enable-audio" onClick={enableAudio}>Enable audio</button>}</div>;
}
