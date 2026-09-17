import React, {lazy,Suspense,useEffect} from "react";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import OwnerOnly from './components/OwnerOnly';
import SiteNav from "./components/SiteNav";
import "./components/SiteShell.css";
import Home from "./pages/Home.jsx";
const RewardOverlay=lazy(()=>import('./pages/RewardOverlay.jsx'));
const MCServer = lazy(()=>import('./pages/MCServer.jsx'));
const Admin = lazy(()=>import('./pages/Admin.jsx'));
const Clips = lazy(()=>import('./pages/Clips.jsx'));
const Map = lazy(() => import("./Map.jsx"));

import Vault from "./pages/Vault.jsx";
import Merch from "./pages/Merch.jsx";

function RouteLayout(){const {pathname}=useLocation();useEffect(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});document.title=pathname==='/market'?'Z Market · ZeekFusion':pathname==='/admin'?'Creator Admin · ZeekFusion':pathname==='/mc-server'?'MC Server · ZeekFusion':'ZeekFusion';},[pathname]);useEffect(()=>{const header=document.querySelector('.site-header-shell');if(!header){document.documentElement.style.setProperty('--header-height','0px');return;}const observer=new ResizeObserver(()=>document.documentElement.style.setProperty('--header-height',header.getBoundingClientRect().height+'px'));observer.observe(header);return()=>observer.disconnect();},[pathname]);return null;}
function SiteHeader(){const {pathname}=useLocation();if(pathname==='/reward-alerts')return null;return <div className={'site-header-shell'+(pathname==='/mc-server'?' is-mc':'')}><SiteNav/></div>;}
export default function App() {
  return (
    <HashRouter>
      <RouteLayout/>
      <SiteHeader/>
      <Suspense fallback={<p style={{padding:40}}>Loading…</p>}><Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reward-alerts" element={<RewardOverlay/>}/>
        <Route path="/clips" element={<Clips />} />
        <Route path="/map" element={<Map />} />
        <Route path="/schedule" element={<Vault />} />
        <Route path="/market" element={<Vault />} />
        <Route path="/vault" element={<Navigate to="/market" replace />} />
        <Route path="/admin" element={<OwnerOnly><Admin /></OwnerOnly>} />
        <Route path="/mc-server" element={<MCServer />} />
        <Route path="/merch" element={<Merch />} />
      </Routes></Suspense>
    </HashRouter>
  );
}