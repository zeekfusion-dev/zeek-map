import React from "react";

export default function Home() {
  return (
    <div
      style={{
        background: "#020617",
        minHeight: "100vh",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px"
      }}
    >
      <h1 style={{ fontSize: "60px" }}>ZEEKFUSION</h1>

      <a href="/#/map">🌎 Travel Map</a>

      <a href="/#/schedule">📅 Stream Schedule</a>

      <a href="/#/merch">👕 Merch</a>
    </div>
  );
}