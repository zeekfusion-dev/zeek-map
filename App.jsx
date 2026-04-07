import React from "react";
import { MapContainer, TileLayer, Circle, Polygon, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const visitedZones = [
  {
    name: "South Florida",
    center: [26.0, -80.2],
    radius: 85000,
    description: "Visited zone"
  },
  {
    name: "Dallas Area",
    center: [32.8, -96.8],
    radius: 70000,
    description: "Home base / visited zone"
  },
  {
    name: "Austria Route",
    points: [
      [48.28, 13.9],
      [48.35, 16.7],
      [47.65, 16.3],
      [47.55, 13.1]
    ],
    description: "Visited region"
  }
];

const plannedZones = [
  {
    name: "NYC Trip Zone",
    center: [40.75, -73.98],
    radius: 60000,
    description: "Planned trip"
  }
];

const visitedStyle = {
  color: "#0b2ea8",
  fillColor: "#0b2ea8",
  fillOpacity: 0.28,
  weight: 2
};

const plannedStyle = {
  color: "#f59e0b",
  fillColor: "#f59e0b",
  fillOpacity: 0.24,
  weight: 2,
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
          textShadow: "0 2px 10px rgba(0,0,0,0.65)"
        }}
      >
        ZEEKFUSION MAP TRAVELS ON STREAM
      </div>

      <MapContainer center={[28, -10]} zoom={3} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />

        {visitedZones.map((zone, i) =>
          zone.points ? (
            <Polygon key={i} positions={zone.points} pathOptions={visitedStyle}>
              <Popup>
                <strong>{zone.name}</strong>
                <br />
                {zone.description}
              </Popup>
            </Polygon>
          ) : (
            <Circle key={i} center={zone.center} radius={zone.radius} pathOptions={visitedStyle}>
              <Popup>
                <strong>{zone.name}</strong>
                <br />
                {zone.description}
              </Popup>
            </Circle>
          )
        )}

        {plannedZones.map((zone, i) =>
          zone.points ? (
            <Polygon key={i} positions={zone.points} pathOptions={plannedStyle}>
              <Popup>
                <strong>{zone.name}</strong>
                <br />
                {zone.description}
              </Popup>
            </Polygon>
          ) : (
            <Circle key={i} center={zone.center} radius={zone.radius} pathOptions={plannedStyle}>
              <Popup>
                <strong>{zone.name}</strong>
                <br />
                {zone.description}
              </Popup>
            </Circle>
          )
        )}
      </MapContainer>

      <div
        style={{
          position: "absolute",
          bottom: 20,
          width: "100%",
          textAlign: "center",
          zIndex: 1000,
          textShadow: "0 2px 10px rgba(0,0,0,0.65)"
        }}
      >
        <span style={{ color: "#7ea2ff", marginRight: 20 }}>■ Visited zones</span>
        <span style={{ color: "#fbbf24" }}>■ Planned zones</span>
      </div>
    </div>
  );
}
