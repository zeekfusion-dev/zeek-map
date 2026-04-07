import React from "react";
import { MapContainer, TileLayer, Polygon, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const visitedZones = [
  {
    name: "Miami (HOME BASE)",
    description: "Where I live / main content hub",
    details: ["Home Base", "IRL streams", "Daily content"],
    youtube: "https://youtube.com/",
    style: {
      color: "#00c2ff",
      fillColor: "#00c2ff",
      fillOpacity: 0.35,
      weight: 4
    },
    points: [
      [25.95, -80.40],
      [25.95, -80.05],
      [25.55, -80.05],
      [25.55, -80.40]
    ]
  },
  {
    name: "South Florida",
    description: "General South Florida travel / streams",
    details: ["Miami", "Fort Lauderdale", "Boca Raton"],
    youtube: "https://youtube.com/",
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
    details: ["Dallas", "Fort Worth"],
    youtube: "https://youtube.com/",
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
    name: "Downtown Orlando",
    description: "Nightlife / IRL content",
    details: ["Downtown Orlando", "Night stream"],
    youtube: "https://youtube.com/",
    points: [
      [28.585, -81.408],
      [28.585, -81.345],
      [28.515, -81.345],
      [28.515, -81.408]
    ]
  },
  {
    name: "Tallahassee",
    description: "Travel / content stop",
    details: ["Tallahassee"],
    youtube: "https://youtube.com/",
    points: [
      [30.52, -84.40],
      [30.52, -84.18],
      [30.36, -84.18],
      [30.36, -84.40]
    ]
  },
  {
    name: "New Orleans",
    description: "Mardi Gras",
    details: ["New Orleans", "Mardi Gras"],
    youtube: "https://youtube.com/",
    points: [
      [30.04, -90.16],
      [30.04, -89.93],
      [29.88, -89.93],
      [29.88, -90.16]
    ]
  },
  {
    name: "Tampa",
    description: "Gasparilla",
    details: ["Tampa", "Gasparilla"],
    youtube: "https://youtube.com/",
    points: [
      [28.03, -82.58],
      [28.03, -82.34],
      [27.84, -82.34],
      [27.84, -82.58]
    ]
  },
  {
    name: "Austria Route",
    description: "Visited region",
    details: ["Vienna", "Salzburg area"],
    youtube: "https://youtube.com/",
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
    details: ["New York City"],
    youtube: "https://youtube.com/",
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

function ZonePopup({ zone }) {
  return (
    <Popup>
      <div style={{ minWidth: 180 }}>
        <strong>{zone.name}</strong>
        <br />
        <span>{zone.description}</span>
        {zone.details?.length ? (
          <>
            <br />
            <br />
            <span style={{ fontWeight: 600 }}>Why I was there:</span>
            <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
              {zone.details.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </>
        ) : null}
        {zone.youtube ? (
          <>
            <br />
            <a href={zone.youtube} target="_blank" rel="noreferrer">
              Watch the YouTube video
            </a>
          </>
        ) : null}
      </div>
    </Popup>
  );
}

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
          <Polygon key={i} positions={zone.points} pathOptions={zone.style || visitedStyle}>
          <ZonePopup zone={zone} />
          </Polygon>
        ))}

        {plannedZones.map((zone, i) => (
          <Polygon key={i} positions={zone.points} pathOptions={plannedStyle}>
            <ZonePopup zone={zone} />
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
