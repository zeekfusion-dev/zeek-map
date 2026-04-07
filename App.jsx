import React from "react";
import { MapContainer, TileLayer, Polygon, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const visitedZones = [
  {
    name: "South Florida",
    description: "Visited zone",
    points: [
      [27.25, -80.05],
      [27.05, -80.32],
      [26.75, -80.45],
      [26.35, -80.42],
      [25.95, -80.38],
      [25.55, -80.30],
      [25.20, -80.18],
      [25.35, -80.02],
      [25.95, -79.92],
      [26.55, -79.90],
      [27.05, -79.95]
    ]
  },
  {
    name: "Dallas–Fort Worth",
    description: "Home base / visited zone",
    points: [
      [33.20, -97.45],
      [33.18, -96.55],
      [32.98, -96.15],
      [32.60, -96.05],
      [32.25, -96.30],
      [32.12, -96.85],
      [32.18, -97.30],
      [32.55, -97.55],
      [32.95, -97.60]
    ]
  },
  {
    name: "Austria Route",
    description: "Visited region",
    points: [
      [48.35, 13.15],
      [48.45, 16.55],
      [47.65, 16.30],
      [47.40, 13.05]
    ]
  }
];

const plannedZones = [
  {
    name: "NYC Trip Zone",
    description: "Planned trip",
    points: [
      [40.92, -74.22],
      [40.92, -73.68],
      [40.48, -73.66],
      [40.47, -74.18]
    ]
  }
];

const visitedStyle = {
  color: "#123dff",
  fillColor: "#123dff",
  fillOpacity: 0.22,
  weight: 3
};

const plannedStyle = {
  color: "#f59e0b",
  fillColor: "#f59e0b",
  fillOpacity: 0.20,
  weight: 3,
  dashArray: "8 8"
};

export default function App() {
  return (
    <div style={{ height: "100vh", width: "100%", color: "white" }}>
      <div
        style={{
          position: "absolute",
          top: 20,
          width: "100%",
          textAlign: "center",
          zIndex: 1000,
          fontSize: "28px",
          fontWeight: "bold",
          letterSpacing: "0.03em",
          textShadow: "0 2px 10px rgba(0,0,0,0.7)"
        }}
      >
        ZEEKFUSION MAP TRAVELS ON STREAM
      </div>

      <MapContainer center={[31, -30]} zoom={3} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />

        {visitedZones.map((zone, i) => (
          <Polygon key={i} positions={zone.points} pathOptions={visitedStyle}>
            <Popup>
              <strong>{zone.name}</strong>
              <br />
              {zone.description}
            </Popup>
          </Polygon>
        ))}

        {plannedZones.map((zone, i) => (
          <Polygon key={i} positions={zone.points} pathOptions={plannedStyle}>
            <Popup>
              <strong>{zone.name}</strong>
              <br />
              {zone.description}
            </Popup>
          </Polygon>
        ))}
      </MapContainer>

      <div
        style={{
          position: "absolute",
          bottom: 20,
          width: "100%",
          textAlign: "center",
          zIndex: 1000,
          textShadow: "0 2px 10px rgba(0,0,0,0.7)"
        }}
      >
        <span style={{ color: "#8fb0ff", marginRight: 20 }}>■ Visited zones</span>
        <span style={{ color: "#fbbf24" }}>■ Planned zones</span>
      </div>
    </div>
  );
}
