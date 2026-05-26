import React from "react";
import { HashRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home.jsx";
import Map from "./Map.jsx";
import Schedule from "./pages/Schedule.jsx";
import Merch from "./pages/Merch.jsx";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/map" element={<Map />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/merch" element={<Merch />} />
      </Routes>
    </HashRouter>
  );
}