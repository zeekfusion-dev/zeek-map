import React from "react";
import { Link } from "react-router-dom";

export default function Schedule() {
  return (
    <div style={page}>
      <nav style={nav}>
        <Link to="/" style={back}>← BACK HOME</Link>
        <h1>STREAM SCHEDULE</h1>
      </nav>

      <section style={hero}>
        <h2>yeah we'll see if this happens lol</h2>
        <p></p>
      </section>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  background: "#02040a",
  color: "white",
  fontFamily: "Impact, Arial Black, Arial, sans-serif",
  padding: "32px",
};

const nav = {
  display: "flex",
  alignItems: "center",
  gap: "30px",
  borderBottom: "1px solid rgba(0,132,255,.35)",
  paddingBottom: "20px",
};

const back = {
  color: "#0ea5ff",
  textDecoration: "none",
  fontWeight: 900,
};

const hero = {
  marginTop: "60px",
  border: "1px solid rgba(0,132,255,.45)",
  borderRadius: "18px",
  padding: "60px",
  background: "linear-gradient(135deg,#06101f,#082954)",
};