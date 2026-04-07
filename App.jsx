import React from "react";
import { MapContainer, TileLayer, Polygon, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const visitedStyle = {
  color: "#1d4ed8",
  fillColor: "#1d4ed8",
  fillOpacity: 0.22,
  weight: 2.5
};

const homeBaseStyle = {
  color: "#06b6d4",
  fillColor: "#06b6d4",
  fillOpacity: 0.34,
  weight: 3.5
};

const plannedStyle = {
  color: "#f59e0b",
  fillColor: "#f59e0b",
  fillOpacity: 0.18,
  weight: 2.5,
  dashArray: "8 8"
};

const visitedZones = [
  {
    name: "Miami-Dade County (HOME BASE)",
    reason: "Home base / main content hub",
    details: ["Where I live", "IRL streams", "Daily content"],
    youtube: "https://youtube.com/",
    style: homeBaseStyle,
    points: [
      [25.958, -80.873],
      [25.920, -80.760],
      [25.904, -80.640],
      [25.903, -80.520],
      [25.872, -80.390],
      [25.806, -80.250],
      [25.690, -80.130],
      [25.500, -80.120],
      [25.320, -80.170],
      [25.180, -80.250],
      [25.070, -80.350],
      [25.110, -80.550],
      [25.230, -80.670],
      [25.400, -80.760],
      [25.620, -80.820],
      [25.820, -80.860]
    ]
  },
  {
    name: "Broward County",
    reason: "South Florida streams / travel",
    details: ["Fort Lauderdale", "South Florida"],
    youtube: "https://youtube.com/",
    style: visitedStyle,
    points: [
      [26.337, -80.873],
      [26.338, -80.620],
      [26.332, -80.390],
      [26.300, -80.170],
      [26.180, -80.090],
      [26.010, -80.090],
      [25.960, -80.160],
      [25.960, -80.390],
      [25.960, -80.620],
      [25.958, -80.873]
    ]
  },
  {
    name: "Palm Beach County",
    reason: "South Florida streams / travel",
    details: ["Boca", "West Palm"],
    youtube: "https://youtube.com/",
    style: visitedStyle,
    points: [
      [26.960, -80.880],
      [26.960, -80.450],
      [26.950, -80.090],
      [26.720, -80.030],
      [26.420, -80.030],
      [26.337, -80.090],
      [26.337, -80.390],
      [26.338, -80.650],
      [26.337, -80.873]
    ]
  },
  {
    name: "Orange County, FL",
    reason: "Downtown Orlando",
    details: ["Nightlife", "IRL content"],
    youtube: "https://youtube.com/",
    style: visitedStyle,
    points: [
      [28.800, -81.680],
      [28.800, -81.080],
      [28.330, -81.080],
      [28.330, -81.680]
    ]
  },
  {
    name: "Leon County, FL",
    reason: "Tallahassee",
    details: ["Travel stop", "Content trip"],
    youtube: "https://youtube.com/",
    style: visitedStyle,
    points: [
      [30.650, -84.510],
      [30.650, -84.020],
      [30.290, -84.020],
      [30.290, -84.510]
    ]
  },
  {
    name: "Orleans Parish, LA",
    reason: "Mardi Gras",
    details: ["New Orleans", "Festival trip"],
    youtube: "https://youtube.com/",
    style: visitedStyle,
    points: [
      [30.120, -90.180],
      [30.120, -89.930],
      [29.860, -89.930],
      [29.860, -90.180]
    ]
  },
  {
    name: "Hillsborough County, FL",
    reason: "Gasparilla",
    details: ["Tampa", "Festival trip"],
    youtube: "https://youtube.com/",
    style: visitedStyle,
    points: [
      [28.330, -82.820],
      [28.330, -82.050],
      [27.560, -82.050],
      [27.560, -82.820]
    ]
  },
  {
    name: "Dallas County, TX",
    reason: "Home area / regular content",
    details: ["Dallas"],
    youtube: "https://youtube.com/",
    style: visitedStyle,
    points: [
      [33.020, -97.040],
      [33.020, -96.520],
      [32.545, -96.520],
      [32.545, -97.040]
    ]
  },
  {
    name: "Tarrant County, TX",
    reason: "DFW area",
    details: ["Fort Worth"],
    youtube: "https://youtube.com/",
    style: visitedStyle,
    points: [
      [33.020, -97.560],
      [33.020, -96.900],
      [32.550, -96.900],
      [32.550, -97.560]
    ]
  },
  {
    name: "Austria",
    reason: "Whole country highlight",
    details: ["Home country", "Vienna", "Salzburg area"],
    youtube: "https://youtube.com/",
    style: visitedStyle,
    points: [
      [48.78, 9.53],
      [48.55, 10.45],
      [48.78, 12.82],
      [48.58, 13.84],
      [48.42, 14.95],
      [48.15, 16.98],
      [47.75, 17.16],
      [47.31, 16.88],
      [46.95, 16.11],
      [46.64, 15.44],
      [46.57, 14.62],
      [46.38, 13.52],
      [46.56, 12.72],
      [46.73, 12.15],
      [46.74, 10.96],
      [46.87, 10.44],
      [47.27, 9.58],
      [47.65, 9.53]
    ]
  }
];

const plannedZones = [
  {
    name: "New York County / Manhattan (planned)",
    reason: "Planned trip",
    details: ["NYC"],
    youtube: "https://youtube.com/",
    style: plannedStyle,
    points: [
      [40.880, -74.047],
      [40.880, -73.907],
      [40.680, -73.907],
      [40.680, -74.047]
    ]
  }
];

function ZonePopup({ zone }) {
  return (
    <Popup>
      <div style={{ minWidth: 220 }}>
        <strong>{zone.name}</strong>
        <br />
        <span>{zone.reason}</span>
        {zone.details?.length ? (
          <>
            <br />
            <br />
            <span style={{ fontWeight: 700 }}>Why I was there:</span>
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
          textShadow: "0 2px 10px rgba(0,0,0,0.45)"
        }}
      >
        ZEEKFUSION MAP TRAVELS ON STREAM
      </div>

      <MapContainer
        center={[31, -30]}
        zoom={3}
        style={{ height: "100%", width: "100%" }}
        worldCopyJump={false}
        maxBounds={[[-85, -180], [85, 180]]}
        maxBoundsViscosity={1.0}
        minZoom={2}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

        {visitedZones.map((zone, i) => (
          <Polygon key={i} positions={zone.points} pathOptions={zone.style || visitedStyle}>
            <ZonePopup zone={zone} />
          </Polygon>
        ))}

        {plannedZones.map((zone, i) => (
          <Polygon key={i} positions={zone.points} pathOptions={zone.style || plannedStyle}>
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
          textShadow: "0 2px 10px rgba(255,255,255,0.45)"
        }}
      >
        <span style={{ color: "#60a5fa", marginRight: 18 }}>■ Conquered counties</span>
        <span style={{ color: "#22d3ee", marginRight: 18 }}>■ HOME BASE</span>
        <span style={{ color: "#fbbf24" }}>■ Planned</span>
      </div>
    </div>
  );
}
