import React, { useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import { feature } from "topojson-client";

export default function App() {
  const globeRef = useRef();

  const [viewMode, setViewMode] = useState("world");
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [hoveredPlace, setHoveredPlace] = useState(null);

  const visitedCountryData = useMemo(
    () => [
      {
        name: "Austria",
        youtube: "https://youtube.com/"
      },
      {
        name: "United States of America",
        youtube: "https://youtube.com/"
      }
    ],
    []
  );

  const visitedStateData = useMemo(
    () => [
      {
        id: "12",
        name: "Florida",
        youtube: "https://youtube.com/"
      },
      {
        id: "22",
        name: "Louisiana",
        youtube: "https://youtube.com/"
      },
      {
        id: "36",
        name: "New York",
        youtube: "https://youtube.com/"
      },
      {
        id: "48",
        name: "Texas",
        youtube: "https://youtube.com/"
      }
    ],
    []
  );

  const visitedCountriesMap = useMemo(() => {
    const map = new Map();
    visitedCountryData.forEach((item) => map.set(item.name, item));
    return map;
  }, [visitedCountryData]);

  const visitedStatesMap = useMemo(() => {
    const map = new Map();
    visitedStateData.forEach((item) => map.set(item.id, item));
    return map;
  }, [visitedStateData]);

  const fanVotes = [
    { place: "Tokyo", votes: 412 },
    { place: "Los Angeles", votes: 365 },
    { place: "London", votes: 287 },
    { place: "Dubai", votes: 244 }
  ];

  const worldPoints = [
    {
      lat: 25.7617,
      lng: -80.1918,
      label: "United States of America",
      color: "#22d3ee",
      altitude: 0.03
    },
    {
      lat: 48.2082,
      lng: 16.3738,
      label: "Austria",
      color: "#3b82f6",
      altitude: 0.03
    }
  ];

  const usaPoints = [
    {
      lat: 27.9944,
      lng: -81.7603,
      label: "Florida",
      color: "#22d3ee",
      altitude: 0.025
    },
    {
      lat: 31.1695,
      lng: -91.8678,
      label: "Louisiana",
      color: "#3b82f6",
      altitude: 0.025
    },
    {
      lat: 31.9686,
      lng: -99.9018,
      label: "Texas",
      color: "#3b82f6",
      altitude: 0.025
    },
    {
      lat: 42.9134,
      lng: -75.5963,
      label: "New York",
      color: "#38bdf8",
      altitude: 0.025
    }
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

        const mappedCountries = worldGeo.features.map((f) => {
          const name = f.properties?.name || "";
          const visitedInfo = visitedCountriesMap.get(name);

          return {
            ...f,
            name,
            isVisited: Boolean(visitedInfo),
            youtube: visitedInfo?.youtube || null,
            placeType: "Visited Country"
          };
        });

        const mappedStates = usGeo.features.map((f) => {
          const id = String(f.id);
          const visitedInfo = visitedStatesMap.get(id);

          return {
            ...f,
            id,
            name: visitedInfo?.name || `State ${id}`,
            isVisited: Boolean(visitedInfo),
            youtube: visitedInfo?.youtube || null,
            placeType: "Visited State"
          };
        });

        setCountries(mappedCountries);
        setStates(mappedStates);
      } catch (error) {
        console.error("Failed loading map data:", error);
      }
    }

    loadMapData();
  }, [visitedCountriesMap, visitedStatesMap]);

  useEffect(() => {
    if (!globeRef.current) return;

    globeRef.current.controls().autoRotate = true;
    globeRef.current.controls().autoRotateSpeed = 0.45;

    if (viewMode === "world") {
      globeRef.current.pointOfView({ lat: 20, lng: -20, altitude: 2.2 }, 1000);
    } else {
      globeRef.current.pointOfView({ lat: 37, lng: -96, altitude: 1.25 }, 1000);
    }
  }, [viewMode]);

  const commonGlobeProps = {
    ref: globeRef,
    globeImageUrl: "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
    backgroundColor: "#020617",
    atmosphereColor: "#3b82f6",
    atmosphereAltitude: 0.25
  };

  const buttonStyle = (active, activeColor) => ({
    padding: "10px 18px",
    borderRadius: "999px",
    border: "1px solid rgba(96,165,250,0.35)",
    background: active ? activeColor : "rgba(255,255,255,0.08)",
    color: "white",
    cursor: "pointer",
    fontWeight: 700,
    boxShadow: active ? "0 0 18px rgba(59,130,246,0.45)" : "none"
  });

  const panelStyle = {
    background: "rgba(0,0,0,0.38)",
    border: "1px solid rgba(96,165,250,0.28)",
    borderRadius: "18px",
    backdropFilter: "blur(8px)",
    color: "white",
    boxShadow: "0 0 22px rgba(37,99,235,0.18)"
  };

  const activeInfoPanel = selectedPlace || hoveredPlace;

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#020617", position: "relative" }}>
      {/* 3D / layered title */}
      <div
        style={{
          position: "absolute",
          top: 18,
          width: "100%",
          textAlign: "center",
          zIndex: 30,
          pointerEvents: "none"
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "100%",
            transform: "translate(3px, 3px)",
            color: "rgba(8,47,73,0.95)",
            fontSize: "34px",
            fontWeight: 900,
            letterSpacing: "0.04em",
            textTransform: "uppercase"
          }}
        >
          ZEEKFUSION MAP TRAVELS ON STREAM
        </div>

        <div
          style={{
            position: "absolute",
            width: "100%",
            transform: "translate(1.5px, 1.5px)",
            color: "rgba(14,116,144,0.95)",
            fontSize: "34px",
            fontWeight: 900,
            letterSpacing: "0.04em",
            textTransform: "uppercase"
          }}
        >
          ZEEKFUSION MAP TRAVELS ON STREAM
        </div>

        <div
          style={{
            position: "relative",
            color: "#e0f2fe",
            fontSize: "34px",
            fontWeight: 900,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            textShadow:
              "0 0 8px rgba(255,255,255,0.45), 0 0 18px rgba(56,189,248,0.65), 0 0 36px rgba(37,99,235,0.55)"
          }}
        >
          ZEEKFUSION MAP TRAVELS ON STREAM
        </div>
      </div>

      {/* mode buttons */}
      <div
        style={{
          position: "absolute",
          top: 78,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          gap: "12px",
          zIndex: 20
        }}
      >
        <button
          onClick={() => {
            setViewMode("world");
            setSelectedPlace(null);
            setHoveredPlace(null);
          }}
          style={buttonStyle(viewMode === "world", "#3b82f6")}
        >
          World
        </button>

        <button
          onClick={() => {
            setViewMode("usa");
            setSelectedPlace(null);
            setHoveredPlace(null);
          }}
          style={buttonStyle(viewMode === "usa", "#22d3ee")}
        >
          USA
        </button>
      </div>

      {/* top left */}
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 24,
          zIndex: 20,
          width: 220,
          padding: "16px 18px",
          ...panelStyle
        }}
      >
        <div style={{ fontSize: 13, color: "#93c5fd", letterSpacing: "0.08em", fontWeight: 800 }}>
          {viewMode === "world" ? "COUNTRIES VISITED" : "STATES VISITED"}
        </div>
        <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, marginTop: 8, color: "#22d3ee" }}>
          {viewMode === "world" ? `${visitedCountryData.length}` : `${visitedStateData.length}`}
        </div>
        <div style={{ marginTop: 10, fontSize: 14, color: "#e2e8f0" }}>
          {viewMode === "world" ? "Tracked on globe" : "Tracked in USA mode"}
        </div>
      </div>

      {/* bottom left */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 24,
          zIndex: 20,
          width: 260,
          padding: "16px 18px",
          ...panelStyle
        }}
      >
        <div style={{ fontSize: 13, color: "#93c5fd", letterSpacing: "0.08em", fontWeight: 800 }}>
          FAN VOTES
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {fanVotes.map((item) => (
            <div
              key={item.place}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                color: "white"
              }}
            >
              <span>{item.place}</span>
              <span style={{ color: "#22d3ee", fontWeight: 700 }}>{item.votes}</span>
            </div>
          ))}
        </div>
      </div>

      {/* right info panel */}
      {activeInfoPanel && (
        <div
          style={{
            position: "absolute",
            right: 24,
            top: 120,
            zIndex: 25,
            width: 290,
            padding: "16px 18px",
            ...panelStyle
          }}
        >
          <div style={{ fontSize: 13, color: "#93c5fd", letterSpacing: "0.08em", fontWeight: 800 }}>
            {selectedPlace ? "SELECTED LOCATION" : "HOVERING"}
          </div>

          <div style={{ marginTop: 10, fontSize: 24, fontWeight: 800 }}>
            {activeInfoPanel.name}
          </div>

          <div style={{ marginTop: 8, color: "#cbd5e1", fontSize: 14 }}>
            {activeInfoPanel.type}
          </div>

          {activeInfoPanel.youtube ? (
            <a
              href={activeInfoPanel.youtube}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                marginTop: 14,
                padding: "10px 14px",
                borderRadius: "999px",
                background: "#22d3ee",
                color: "#020617",
                textDecoration: "none",
                fontWeight: 800,
                boxShadow: "0 0 16px rgba(34,211,238,0.45)"
              }}
            >
              Watch YouTube Video
            </a>
          ) : (
            <div style={{ marginTop: 14, color: "#94a3b8", fontSize: 14 }}>
              No video link added yet.
            </div>
          )}
        </div>
      )}

      {viewMode === "world" ? (
        <Globe
          {...commonGlobeProps}
          polygonsData={countries}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={(d) => {
            if (hoveredPlace?.name === d.name) return "rgba(125,211,252,0.92)";
            if (d.isVisited) return "rgba(59,130,246,0.62)";
            return "rgba(255,255,255,0.03)";
          }}
          polygonSideColor={() => "rgba(0,0,0,0)"}
          polygonStrokeColor={(d) => {
            if (hoveredPlace?.name === d.name) return "#e0f2fe";
            return "#60a5fa";
          }}
          polygonAltitude={(d) => {
            if (hoveredPlace?.name === d.name) return 0.032;
            if (d.isVisited) return 0.02;
            return 0.006;
          }}
          onPolygonHover={(d) => {
            if (!d || !d.isVisited) {
              setHoveredPlace(null);
              return;
            }

            setHoveredPlace({
              name: d.name,
              youtube: d.youtube,
              type: "Visited Country"
            });
          }}
          onPolygonClick={(d) => {
            if (!d?.isVisited) return;
            setSelectedPlace({
              name: d.name,
              youtube: d.youtube,
              type: "Visited Country"
            });
          }}
          polygonLabel={(d) => (d.isVisited ? `${d.name} • Hover / Click` : d.name)}
          pointsData={worldPoints}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointLabel="label"
          pointRadius={0.16}
          pointAltitude="altitude"
        />
      ) : (
        <Globe
          {...commonGlobeProps}
          polygonsData={states}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={(d) => {
            if (hoveredPlace?.name === d.name) return "rgba(103,232,249,0.96)";
            if (d.isVisited) return "rgba(34,211,238,0.7)";
            return "rgba(255,255,255,0.03)";
          }}
          polygonSideColor={() => "rgba(0,0,0,0)"}
          polygonStrokeColor={(d) => {
            if (hoveredPlace?.name === d.name) return "#ecfeff";
            return "#22d3ee";
          }}
          polygonAltitude={(d) => {
            if (hoveredPlace?.name === d.name) return 0.038;
            if (d.isVisited) return 0.025;
            return 0.008;
          }}
          onPolygonHover={(d) => {
            if (!d || !d.isVisited) {
              setHoveredPlace(null);
              return;
            }

            setHoveredPlace({
              name: d.name,
              youtube: d.youtube,
              type: "Visited State"
            });
          }}
          onPolygonClick={(d) => {
            if (!d?.isVisited) return;
            setSelectedPlace({
              name: d.name,
              youtube: d.youtube,
              type: "Visited State"
            });
          }}
          polygonLabel={(d) => (d.isVisited ? `${d.name} • Hover / Click` : d.name)}
          pointsData={usaPoints}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointLabel="label"
          pointRadius={0.14}
          pointAltitude="altitude"
        />
      )}

      {/* bottom center legend */}
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
        <span><span style={{ color: "#22d3ee" }}>│</span> Travel Marker</span>
        <span><span style={{ color: "#93c5fd" }}>Hover / Click</span> for video</span>
      </div>
    </div>
  );
}
