import React, { useRef, useEffect } from "react";
import Globe from "react-globe.gl";

export default function App() {
  const globeRef = useRef();

  const points = [
    { lat: 25.7617, lng: -80.1918, label: "Miami (Home)", color: "#22d3ee" },
    { lat: 26.1224, lng: -80.1373, label: "Fort Lauderdale", color: "#3b82f6" },
    { lat: 28.5383, lng: -81.3792, label: "Orlando", color: "#3b82f6" },
    { lat: 32.7767, lng: -96.7970, label: "Dallas", color: "#3b82f6" },
    { lat: 48.2082, lng: 16.3738, label: "Vienna", color: "#3b82f6" },
    { lat: 40.7128, lng: -74.0060, label: "NYC (Planned)", color: "#f59e0b" }
  ];

  const arcs = [
    { startLat: 25.7617, startLng: -80.1918, endLat: 26.1224, endLng: -80.1373 },
    { startLat: 25.7617, startLng: -80.1918, endLat: 28.5383, endLng: -81.3792 },
    { startLat: 25.7617, startLng: -80.1918, endLat: 32.7767, endLng: -96.7970 },
    { startLat: 25.7617, startLng: -80.1918, endLat: 48.2082, endLng: 16.3738 },
    { startLat: 25.7617, startLng: -80.1918, endLat: 40.7128, endLng: -74.0060 }
  ];

  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.controls().autoRotate = true;
    globeRef.current.controls().autoRotateSpeed = 0.5;
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#050816" }}>
      <div style={{
        position: "absolute",
        top: 20,
        width: "100%",
        textAlign: "center",
        color: "white",
        fontSize: "32px",
        fontWeight: "bold",
        zIndex: 10
      }}>
        ZEEKFUSION MAP TRAVELS ON STREAM
      </div>

      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        backgroundColor="#050816"
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointLabel="label"
        arcsData={arcs}
        arcColor={() => "#3b82f6"}
        arcDashLength={0.5}
        arcDashGap={0.3}
        arcDashAnimateTime={2000}
      />
    </div>
  );
}
