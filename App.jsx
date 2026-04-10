import React, { useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import { feature } from "topojson-client";

export default function App() {
  const globeRef = useRef();

  const [viewMode, setViewMode] = useState("world");
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);

  const visitedCountries = useMemo(
    () => new Set(["Austria", "United States of America"]),
    []
  );

  const visitedStateIds = useMemo(
    () => new Set(["12", "22", "36", "48"]), // FL, LA, NY, TX
    []
  );

  const worldPoints = [
    { lat: 25.7617, lng: -80.1918, label: "Miami", color: "#22d3ee" },
    { lat: 32.7767, lng: -96.797, label: "Dallas", color: "#3b82f6" },
    { lat: 48.2082, lng: 16.3738, label: "Vienna", color: "#3b82f6" }
  ];

  const usaPoints = [
    { lat: 25.7617, lng: -80.1918, label: "Florida", color: "#22d3ee" },
    { lat: 29.9511, lng: -90.0715, label: "Louisiana", color: "#3b82f6" },
    { lat: 32.7767, lng: -96.797, label: "Texas", color: "#3b82f6" },
    { lat: 40.7128, lng: -74.006, label: "New York", color: "#38bdf8" }
  ];

  useEffect(() => {
    async function loadMapData() {
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
    atmosphereAltitude: 0.25
  };

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#020617" }}>
      
      {/* TITLE */}
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

      {/* BUTTONS */}
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
        <button onClick={() => setViewMode("world")}>World</button>
        <button onClick={() => setViewMode("usa")}>USA</button>
      </div>

      {/* GLOBE SWITCH */}
      {viewMode === "world" ? (
        <Globe
          {...commonGlobeProps}
          polygonsData={countries}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={(d) =>
            d.isVisited ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.03)"
          }
          polygonSideColor={() => "rgba(0,0,0,0)"}
          polygonStrokeColor={() => "#60a5fa"}  // thicker/brighter border
          polygonAltitude={(d) => (d.isVisited ? 0.02 : 0.006)} // thicker effect
          pointsData={worldPoints}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointLabel="label"
        />
      ) : (
        <Globe
          {...commonGlobeProps}
          polygonsData={states}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={(d) =>
            d.isVisited ? "rgba(34,211,238,0.65)" : "rgba(255,255,255,0.03)"
          }
          polygonSideColor={() => "rgba(0,0,0,0)"}
          polygonStrokeColor={() => "#22d3ee"} // brighter state borders
          polygonAltitude={(d) => (d.isVisited ? 0.025 : 0.008)} // thicker effect
          pointsData={usaPoints}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointLabel="label"
        />
      )}
    </div>
  );
}
