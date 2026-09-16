import React,{useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import './MCServer.css';

const SERVER={java:'208.115.225.34:25568',bedrock:'208.115.225.34',port:'25568',version:'1.21.8'};
const DISCORD='https://discord.gg/AdduJ22Ven';
const SCREENS=new Set(['main','join','java','bedrock','how','how-java','how-bedrock','info']);
const TITLES={join:'Join Multiplayer',java:'Java Edition',bedrock:'Bedrock Edition',how:'How to Join','how-java':'Joining on Java','how-bedrock':'Joining on Bedrock',info:'Server Info'};
const PARENTS={join:'main',java:'join',bedrock:'join',how:'main','how-java':'how','how-bedrock':'how',info:'main'};
const STEPS={java:['Open Minecraft: Java Edition.','Select Multiplayer, then Add Server.','Name it ZeekFusion. Paste the Java IP into Server Address.','Click Done, select ZeekFusion, then Join Server.'],bedrock:['Open Minecraft: Bedrock Edition.','Select Play, then Servers and Add Server.','Name it ZeekFusion. Enter the Bedrock IP and port separately.','Save the server, then select Join Server.']};

export default function MCServer(){
 const [params,setParams]=useSearchParams();
 const screen=SCREENS.has(params.get('screen'))?params.get('screen'):'main';
 const [sound,setSound]=useState(false),[notice,setNotice]=useState(''),[copying,setCopying]=useState(false);
 const audio=useRef(null),heading=useRef(null),first=useRef(true),copyField=useRef(null);
 useEffect(()=>{setNotice('');window.scrollTo({top:0,left:0,behavior:'instant'});if(first.current){first.current=false;return;}heading.current?.focus({preventScroll:true});},[screen]);
 useEffect(()=>()=>{audio.current?.close().catch(()=>{});},[]);
 function click(){if(!sound)return;try{const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;const context=audio.current||(audio.current=new Context());context.resume().catch(()=>{});const o=context.createOscillator(),g=context.createGain();o.type='square';o.frequency.setValueAtTime(650,context.currentTime);o.frequency.exponentialRampToValueAtTime(180,context.currentTime+.035);g.gain.setValueAtTime(.025,context.currentTime);g.gain.exponentialRampToValueAtTime(.001,context.currentTime+.045);o.connect(g);g.connect(context.destination);o.start();o.stop(context.currentTime+.05);}catch{/* Sound is optional. */}}
 function go(next){click();setParams(next==='main'?{}:{screen:next});}
 function back(){go(PARENTS[screen]||'main');}
 async function copy(value,label){if(copying)return;click();setCopying(true);try{await navigator.clipboard.writeText(value);setNotice(label+' copied!');}catch{copyField.current?.focus();copyField.current?.select();setNotice('Select the address and copy it manually.');}finally{setCopying(false);}}
 const edition=screen==='bedrock'||screen==='how-bedrock'?'bedrock':'java';
 const isAddress=screen==='java'||screen==='bedrock';
 return <main className={'mc-menu-world '+(screen==='main'?'mc-is-title':'mc-is-submenu')} onKeyDown={e=>{if(e.key==='Escape'&&screen!=='main'){e.preventDefault();back();}}}>
  <div className="mc-panorama" aria-hidden="true"/><div className="mc-vignette" aria-hidden="true"/>
  <div className="mc-game-content">
   <header className="mc-game-logo" aria-label="ZeekFusion MC Server"><div className="mc-stone-logo" aria-hidden="true">ZEEKFUSION</div><span className="mc-logo-edition">MC SERVER</span>{screen==='main'&&<span className="mc-splash" aria-hidden="true">All energy. All blocks!</span>}</header>
   <section className={'mc-menu-screen mc-screen-'+screen} key={screen} aria-labelledby="mc-screen-title">
    <h1 ref={heading} id="mc-screen-title" tabIndex={-1} className={screen==='main'?'mc-sr-only':'mc-screen-heading'}>{screen==='main'?'ZeekFusion Minecraft server':TITLES[screen]}</h1>
    {screen==='main'&&<div className="mc-button-stack">
     <button className="mc-menu-button mc-join-main" onClick={()=>go('join')}>Join Server</button>
     <div className="mc-menu-pair"><button className="mc-menu-button" onClick={()=>go('java')}>Java Edition</button><button className="mc-menu-button" onClick={()=>go('bedrock')}>Bedrock Edition</button></div>
     <button className="mc-menu-button" onClick={()=>go('how')}>How to Join</button>
     <div className="mc-menu-pair mc-menu-gap"><button className="mc-menu-button" onClick={()=>go('info')}>Server Info</button><a className="mc-menu-button" href={DISCORD} target="_blank" rel="noreferrer" onClick={click}>Discord ↗</a></div>
    </div>}
    {screen==='join'&&<><div className="mc-dirt-panel"><div className="mc-server-entry"><span className="mc-server-icon" aria-hidden="true">Z</span><div><h2>ZeekFusion</h2><p className="mc-yellow">Your next spawn point.</p><p>Java + Bedrock · {SERVER.version}</p></div><span className="mc-server-bars" aria-hidden="true">▂▄▆</span></div><p className="mc-access-note">First, join Discord and send your Minecraft username in <strong>MC Announcements</strong> to get access.</p></div><p className="mc-prompt">Choose your edition</p><div className="mc-menu-pair"><button className="mc-menu-button" onClick={()=>go('java')}>Java Edition</button><button className="mc-menu-button" onClick={()=>go('bedrock')}>Bedrock Edition</button></div><a className="mc-menu-button" href={DISCORD} target="_blank" rel="noreferrer" onClick={click}>Join Discord ↗</a></>}
    {isAddress&&<><div className="mc-dirt-panel mc-address-panel"><label htmlFor="mc-ip">{edition==='java'?'Java IP':'Bedrock IP'}</label><input id="mc-ip" ref={copyField} className="mc-ip-field" readOnly value={SERVER[edition]} onFocus={e=>e.target.select()}/>{edition==='bedrock'&&<div className="mc-port-row"><span>Port <strong>{SERVER.port}</strong></span><button className="mc-menu-button mc-mini-button" disabled={copying} onClick={()=>copy(SERVER.port,'Port')}>Copy Port</button></div>}<p className="mc-version-line">Version <strong>{SERVER.version}</strong></p><p className="mc-access-note">Access through Discord’s <strong>MC Announcements</strong> section.</p></div><button className="mc-menu-button" disabled={copying} onClick={()=>copy(SERVER[edition],'IP address')}>{copying?'Copying…':'Copy IP'}</button><button className="mc-menu-button" onClick={()=>go('how-'+edition)}>How to Join</button></>}
    {screen==='how'&&<><p className="mc-prompt">Which edition are you playing?</p><div className="mc-button-stack"><button className="mc-menu-button" onClick={()=>go('how-java')}>Java Edition</button><button className="mc-menu-button" onClick={()=>go('how-bedrock')}>Bedrock Edition</button></div></>}
    {(screen==='how-java'||screen==='how-bedrock')&&<><div className="mc-dirt-panel mc-instructions"><p className="mc-access-note"><strong>Before you join:</strong> join Discord and send your Minecraft username in <strong>MC Announcements</strong>. Wait for access to be granted.</p><ol>{STEPS[edition].map(step=><li key={step}>{step}</li>)}</ol>{edition==='bedrock'&&<p className="mc-small-note">These steps apply where Bedrock supports adding external servers. Console menus may differ.</p>}</div><button className="mc-menu-button" onClick={()=>go(edition)}>Show {edition==='java'?'Java':'Bedrock'} IP</button><a className="mc-menu-button" href={DISCORD} target="_blank" rel="noreferrer" onClick={click}>Join Discord ↗</a></>}
    {screen==='info'&&<div className="mc-dirt-panel mc-info-panel"><h2>ZeekFusion MC Server</h2><p className="mc-yellow">Build. Explore. Cause chaos.</p><dl><div><dt>Version</dt><dd>{SERVER.version}</dd></div><div><dt>Platforms</dt><dd>Java + Bedrock</dd></div><div><dt>Access</dt><dd>Via Discord</dd></div></dl><p>Build something ridiculous. Explore together. Make this world ours.</p><p className="mc-access-note">Send your Minecraft username in <strong>MC Announcements</strong> to get access.</p></div>}
    {screen!=='main'&&<button className="mc-menu-button mc-back" onClick={back}>Back</button>}
    <p className="mc-copy-notice" role="status" aria-live="polite">{notice}</p>
   </section>
  </div>
  <footer className="mc-game-footer"><span>ZeekFusion {SERVER.version}<small>Java + Bedrock</small></span><button className="mc-menu-button mc-sound-toggle" aria-pressed={sound} onClick={()=>setSound(x=>!x)}>Sound: {sound?'ON':'OFF'}</button><span className="mc-footer-caption">A world for the community.</span></footer>
 </main>;
}
