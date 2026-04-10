import React, { useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import { feature } from "topojson-client";

export default function App() {
  const globeRef = useRef();

  const [viewMode, setViewMode] = useState("world");
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);

  // Countries visited
  const visitedCountries = useMemo(
    () => new Set(["Austria", "United States of America"]),
    []
  );

  // State FIPS codes
  // Florida = 12
  // Louisiana = 22
  // New York = 36
  // Texas = 48
  const visitedStateIds = useMemo(
    () => new Set(["12", "22", "36", "48"]),
    []
  );

  const worldPoints = [
    { lat: 25.7617, lng: -80.1918, label: "Miami", color: "#22d3ee" },
    { lat: 32.7767, lng: -96.797, label: "Dallas", color: "#3b82f6" },
    { lat: 48.2082, lng: 16.3738, label: "Vienna", color: "#3b82f6" }
  ];

  const worldArcs = [
    { startLat: 25.7617, startLng: -80.1918, endLat: 32.7767, endLng: -96.797 },
    { startLat: 25.7617, startLng: -80.1918, endLat: 48.2082, endLng: 16.3738 }
  ];

  const usaPoints = [
    { lat: 25.7617, lng: -80.1918, label: "Florida", color: "#22d3ee" },
    { lat: 29.9511, lng: -90.0715, label: "Louisiana", color: "#3b82f6" },
    { lat: 32.7767, lng: -96.797, label: "Texas", color: "#3b82f6" },
    { lat: 40.7128, lng: -74.006, label: "New York", color: "#38bdf8" }
  ];

  const usaArcs = [
    { startLat: 25.7617, startLng: -80.1918, endLat: 29.9511, endLng: -90.0715 },
    { startLat: 25.7617, startLng: -80.1918, endLat: 32.7767, endLng: -96.797 },
    { startLat: 25.7617, startLng: -80.1918, endLat: 40.7128, endLng: -74.006 }
  ];

  useEffect(() => {
    async function loadMapData() {
      try {
        const worldRes = await fetch("https://unpkg.com/world-atlas@2/countries-110m.json");
        const worldTopo = await worldRes.json();
        const worldGeo = feature(worldTopo, worldTopo.objects.countries);

        const usRes = await fetch("https://unpkg.com/us-atlas@3/states-10m.json");
        const usTopo = await usRes.json();
        const usGeo = feature(usTopo, usTopo.objects.states);

        const mappedCountries = worldGeo.features.map((f) => ({
          ...f,
          name: f.properties?.name || "",
          isVisited: visitedCountries.has(f.properties?.name || "")
        }));

        const mappedStates = usGeo.features.map((f) => ({
          ...f,
          id: String(f.id),
          isVisited: visitedStateIds.has(String(f.id))
        }));

        setCountries(mappedCountries);
        setStates(mappedStates);
      } catch (err) {
        console.error("Failed loading map data:", err);
      }
    }

    loadMapData();
  }, [visitedCountries, visitedStateIds]);

  useEffect(() => {
    if (!globeRef.current) return;

    globeRef.current.controls().autoRotate = true;
    globeRef.current.controls().autoRotateSpeed = 0.45;

    if (viewMode === "world") {
      globeRef.current.pointOfView({ lat: 20, lng: -20, altitude: 2.2 }, 1000);
    } else {
      globeRef.current.pointOfView({ lat: 37, lng: -96, altitude: 1.2 }, 1000);
    }
  }, [viewMode]);

  const commonGlobeProps = {
    ref: globeRef,
    globeImageUrl: "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
    backgroundColor: "#020617",
    atmosphereColor: "#3b82f6",
    atmosphereAltitude: 0.18
  };

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

      <div
        style={{
          position: "absolute",
          top: 75,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          gap: "12px",
          zIndex: 20
        }}
      >
        <button
          onClick={() => setViewMode("world")}
          style={{
            padding: "10px 18px",
            borderRadius: "999px",
            border: "1px solid rgba(96,165,250,0.35)",
            background: viewMode === "world" ? "#3b82f6" : "rgba(255,255,255,0.08)",
            color: "white",
            cursor: "pointer"
          }}
        >
          World
        </button>

        <button
          onClick={() => setViewMode("usa")}
          style={{
            padding: "10px 18px",
            borderRadius: "999px",
            border: "1px solid rgba(96,165,250,0.35)",
            background: viewMode === "usa" ? "#22d3ee" : "rgba(255,255,255,0.08)",
            color: "white",
            cursor: "pointer"
          }}
        >
          USA
        </button>
      </div>

      {viewMode === "world" ? (
        <Globe
          {...commonGlobeProps}
          polygonsData={countries}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={(d) =>
            d.isVisited ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.03)"
          }
          polygonSideColor={() => "rgba(0,0,0,0.02)"}
          polygonStrokeColor={() => "rgba(147,197,253,0.45)"}
          polygonAltitude={(d) => (d.isVisited ? 0.01 : 0.003)}
          polygonLabel={(d) => `
            <div style="padding:8px 10px;">
              <strong>${d.name}</strong><br/>
              ${d.isVisited ? "Visited" : "Not visited yet"}
            </div>
          `}
          pointsData={worldPoints}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointLabel="label"
          pointRadius={0.35}
          pointAltitude={0.02}
          arcsData={worldArcs}
          arcColor={() => ["#22d3ee", "#3b82f6"]}
          arcAltitude={0.22}
          arcStroke={1.8}
          arcDashLength={0.7}
          arcDashGap={0.2}
          arcDashAnimateTime={1800}
        />
      ) : (
        <Globe
          {...commonGlobeProps}
          polygonsData={states}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={(d) =>
            d.isVisited ? "rgba(34,211,238,0.65)" : "rgba(255,255,255,0.03)"
          }
          polygonSideColor={() => "rgba(0,0,0,0.02)"}
          polygonStrokeColor={() => "rgba(147,197,253,0.75)"}
          polygonAltitude={(d) => (d.isVisited ? 0.012 : 0.003)}
          polygonLabel={(d) => `
            <div style="padding:8px 10px;">
              <strong>State ID: ${d.id}</strong><br/>
              ${d.isVisited ? "Visited" : "Not visited yet"}
            </div>
          `}
          pointsData={usaPoints}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointLabel="label"
          pointRadius={0.35}
          pointAltitude={0.02}
          arcsData={usaArcs}
          arcColor={() => ["#22d3ee", "#3b82f6"]}
          arcAltitude={0.18}
          arcStroke={1.8}
          arcDashLength={0.7}
          arcDashGap={0.2}
          arcDashAnimateTime={1800}
        />
      )}

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
        <span><span style={{ color: "#3b82f6" }}>■</span> Visited Area</span>
        <span><span style={{ color: "#22d3ee" }}>●</span> Main Stops</span>
      </div>
    </div>
  );
}
