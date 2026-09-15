import React, {lazy,Suspense,useEffect} from "react";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";

import SiteNav from "./components/SiteNav";
import "./components/SiteShell.css";
import Home from "./pages/Home.jsx";
const Admin = lazy(()=>import('./pages/Admin.jsx'));
const Clips = lazy(()=>import('./pages/Clips.jsx'));
const Map = lazy(() => import("./Map.jsx"));

import Vault from "./pages/Vault.jsx";
import Merch from "./pages/Merch.jsx";

function RouteLayout(){const {pathname}=useLocation();useEffect(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});document.title=pathname==='/market'?'Z Market · ZeekFusion':pathname==='/admin'?'Creator Admin · ZeekFusion':'ZeekFusion';},[pathname]);useEffect(()=>{const header=document.querySelector('.site-header-shell');const observer=new ResizeObserver(()=>document.documentElement.style.setProperty('--header-height',header.getBoundingClientRect().height+'px'));observer.observe(header);return()=>observer.disconnect();},[]);return null;}
export default function App() {
  return (
    <HashRouter>
      <RouteLayout/>
      <div className="site-header-shell"><SiteNav/></div>
      <Suspense fallback={<p style={{padding:40}}>Loading…</p>}><Routes>
        <Route path="/" element={<Home />} />
        <Route path="/clips" element={<Clips />} />
        <Route path="/map" element={<Map />} />
        <Route path="/schedule" element={<Vault />} />
        <Route path="/market" element={<Vault />} />
        <Route path="/vault" element={<Navigate to="/market" replace />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/merch" element={<Merch />} />
      </Routes></Suspense>
    </HashRouter>
  );
}