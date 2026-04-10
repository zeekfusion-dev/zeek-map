import React, { useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import { feature } from "topojson-client";

export default function App() {
  const globeRef = useRef();

  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);

  // Countries you've visited
  const visitedCountries = useMemo(
    () =>
      new Set([
        "Austria"
      ]),
    []
  );

  // US states you've visited
  const visitedStates = useMemo(
    () =>
      new Set([
        "Florida",
        "Texas",
        "Louisiana",
        "New York"
      ]),
    []
  );

  const points = [
    { lat: 25.7617, lng: -80.1918, label: "Miami (Home Base)", color: "#22d3ee" },
    { lat: 26.1224, lng: -80.1373, label: "Fort Lauderdale", color: "#3b82f6" },
    { lat: 28.5383, lng: -81.3792, label: "Orlando", color: "#3b82f6" },
    { lat: 30.4383, lng: -84.2807, label: "Tallahassee", color: "#3b82f6" },
    { lat: 29.9511, lng: -90.0715, label: "New Orleans", color: "#3b82f6" },
    { lat: 32.7767, lng: -96.7970, label: "Dallas", color: "#3b82f6" },
    { lat: 48.2082, lng: 16.3738, label: "Vienna", color: "#3b82f6" },
    { lat: 40.7128, lng: -74.006, label: "New York", color: "#38bdf8" }
  ];

  const arcs = [
    { startLat: 25.7617, startLng: -80.1918, endLat: 26.1224, endLng: -80.1373 },
    { startLat: 25.7617, startLng: -80.1918, endLat: 28.5383, endLng: -81.3792 },
    { startLat: 25.7617, startLng: -80.1918, endLat: 30.4383, endLng: -84.2807 },
    { startLat: 25.7617, startLng: -80.1918, endLat: 29.9511, endLng: -90.0715 },
    { startLat: 25.7617, startLng: -80.1918, endLat: 32.7767, endLng: -96.797 },
    { startLat: 25.7617, startLng: -80.1918, endLat: 48.2082, endLng: 16.3738 },
    { startLat: 25.7617, startLng: -80.1918, endLat: 40.7128, endLng: -74.006 }
  ];

  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.controls().autoRotate = true;
    globeRef.current.controls().autoRotateSpeed = 0.45;
    globeRef.current.pointOfView({ lat: 28, lng: -20, altitude: 2.1 }, 0);
  }, []);

  useEffect(() => {
    async function loadMapData() {
      try {
        // World countries
        const worldRes = await fetch("https://unpkg.com/world-atlas@2/countries-110m.json");
        const worldTopo = await worldRes.json();
        const worldGeo = feature(worldTopo, worldTopo.objects.countries);

        // US states
        const usRes = await fetch("https://unpkg.com/us-atlas@3/states-10m.json");
        const usTopo = await usRes.json();
        const usGeo = feature(usTopo, usTopo.objects.states);

        const mappedCountries = worldGeo.features.map((f) => ({
          ...f,
          name: f.properties?.name || "Unknown",
          isVisited: visitedCountries.has(f.properties?.name || "")
        }));

        const mappedStates = usGeo.features.map((f) => ({
          ...f,
          name: f.properties?.name || "Unknown",
          isVisited: visitedStates.has(f.properties?.name || "")
        }));

        setCountries(mappedCountries);
        setStates(mappedStates);
      } catch (err) {
        console.error("Failed loading map data:", err);
      }
    }

    loadMapData();
  }, [visitedCountries, visitedStates]);

  const countryBorderColor = "rgba(96,165,250,0.45)";
  const stateBorderColor = "rgba(34,211,238,0.95)";
  const visitedCountryFill = "rgba(59,130,246,0.40)";
  const visitedStateFill = "rgba(34,211,238,0.58)";
  const unvisitedFill = "rgba(255,255,255,0.03)";

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#020617" }}>
      <div
        style={{
          position: "absolute",
          top: 20,
          width: "100%",
          textAlign: "center",
          color: "white",
          fontSize: "32px",
          fontWeight: "bold",
          zIndex: 20,
          textShadow: "0 0 20px rgba(59,130,246,0.7)"
        }}
      >
        ZEEKFUSION MAP TRAVELS ON STREAM
      </div>

      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        backgroundColor="#020617"
        atmosphereColor="#3b82f6"
        atmosphereAltitude={0.18}

        // World countries
        polygonsData={countries}
        polygonGeoJsonGeometry="geometry"
        polygonCapColor={(d) => (d.isVisited ? visitedCountryFill : unvisitedFill)}
        polygonSideColor={() => "rgba(0,0,0,0.02)"}
        polygonStrokeColor={() => countryBorderColor}
        polygonAltitude={(d) => (d.isVisited ? 0.01 : 0.003)}
        polygonLabel={(d) => `
          <div style="padding:8px 10px;">
            <strong>${d.name}</strong><br/>
            ${d.isVisited ? "Visited" : "Not visited yet"}
          </div>
        `}

        // US states overlay
        hexPolygonsData={states}
        hexPolygonGeoJsonGeometry="geometry"
        hexPolygonColor={(d) => (d.isVisited ? visitedStateFill : "rgba(0,0,0,0)")}
        hexPolygonResolution={3}
        hexPolygonMargin={0.12}
        hexPolygonUseDots={false}
        hexPolygonCurvatureResolution={5}

        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointLabel="label"
        pointRadius={0.42}
        pointAltitude={0.02}

        arcsData={arcs}
        arcColor={() => ["#22d3ee", "#3b82f6"]}
        arcAltitude={0.22}
        arcStroke={1.8}
        arcDashLength={0.7}
        arcDashGap={0.2}
        arcDashAnimateTime={1800}
      />

      <div
        style={{
          position: "absolute",
          bottom: 25,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 20,
          color: "white",
          fontSize: "14px",
          display: "flex",
          gap: "20px",
          background: "rgba(0,0,0,0.32)",
          padding: "10px 18px",
          borderRadius: "999px",
          border: "1px solid rgba(96,165,250,0.18)"
        }}
      >
        <span><span style={{ color: "#3b82f6" }}>■</span> Visited Country</span>
        <span><span style={{ color: "#22d3ee" }}>■</span> Visited US State</span>
        <span><span style={{ color: "#38bdf8" }}>●</span> Travel Points</span>
      </div>
    </div>
  );
}
