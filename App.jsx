import React, {lazy,Suspense} from "react";
import { HashRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home.jsx";
const Map = lazy(() => import("./Map.jsx"));

import Vault from "./pages/Vault.jsx";
import Merch from "./pages/Merch.jsx";

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<p style={{padding:40}}>Loading…</p>}><Routes>
        <Route path="/" element={<Home />} />
        <Route path="/map" element={<Map />} />
        <Route path="/schedule" element={<Vault />} />
        <Route path="/vault" element={<Vault />} />
        <Route path="/merch" element={<Merch />} />
      </Routes></Suspense>
    </HashRouter>
  );
}