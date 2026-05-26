import React from "react";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div style={page}>
      <nav style={nav}>
        <a href="https://kick.com/zeekfusion" target="_blank" rel="noreferrer" style={kickBrand}>
          <span style={kickK}>K</span>
          <span>KICK.COM/ZEEKFUSION</span>
        </a>

        <div style={navLinks}>
          <Link style={activeNav} to="/">HOME</Link>
          <Link style={navLink} to="/map">MAP</Link>
          <Link style={navLink} to="/schedule">SCHEDULE</Link>
          <Link style={navLink} to="/merch">MERCH</Link>
          <a style={navLink} href="https://youtube.com/@ZeekFusion" target="_blank" rel="noreferrer">CLIPS</a>
        </div>

        <img src="/zeek-profile.webp" alt="ZeekFusion" style={avatar} />

        <a href="https://kick.com/zeekfusion" target="_blank" rel="noreferrer" style={watchBtn}>
          <span style={kickSmall}>K</span> WATCH LIVE
        </a>
      </nav>

      <main style={layout}>
        <section style={hero}>
          <div>
            <p style={welcome}>WELCOME TO</p>
            <h1 style={title}>
              ZEEK <br />
              <span>FUSION</span>
            </h1>
            <p style={heroText}>IRL STREAMER. TRAVELER. CONTENT CREATOR.</p>
            <p style={heroTextBlue}>CHAOS EVERYTIME.</p>

            <a href="https://kick.com/zeekfusion" target="_blank" rel="noreferrer" style={heroButton}>
              <span style={kickSmall}>K</span> WATCH LIVE ON KICK →
            </a>
          </div>

          <div style={heroFace}>
            <img src="/zeek-profile.webp" alt="ZeekFusion" style={heroImg} />
          </div>
        </section>

        <Link to="/map" style={{ ...card, ...mapCard }}>
          <h2>TRAVEL MAP</h2>
          <p>See everywhere I’ve been and where I’m going next.</p>
          <button style={smallBtn}>EXPLORE MAP →</button>
        </Link>

        <Link to="/schedule" style={{ ...card, ...scheduleCard }}>
          <h2>STREAM SCHEDULE</h2>
          <p>Check out upcoming streams and events.</p>
          <button style={smallBtn}>VIEW SCHEDULE →</button>
        </Link>

        <section style={videoCard}>
          <h3>▌ LATEST VIDEO</h3>
          <div style={videoBox}>
            <img src="/zeek-profile.webp" alt="Latest video" style={videoFace} />
            <div style={play}>▶</div>
            <p>INSANE DAY IN MIAMI! 😂</p>
          </div>
          <a style={blueLink} href="https://youtube.com/@ZeekFusion" target="_blank" rel="noreferrer">
            WATCH ON YOUTUBE →
          </a>
        </section>

        <section style={connectCard}>
          <h3>CONNECT WITH ME</h3>
          <div style={socials}>
            <a href="https://kick.com/zeekfusion" target="_blank" rel="noreferrer">KICK</a>
            <a href="https://youtube.com/@ZeekFusion" target="_blank" rel="noreferrer">YOUTUBE</a>
            <a href="https://instagram.com/zeekfusion" target="_blank" rel="noreferrer">INSTAGRAM</a>
            <a href="https://x.com/zeekfusion" target="_blank" rel="noreferrer">X</a>
            <a href="https://tiktok.com/@zeekfusion" target="_blank" rel="noreferrer">TIKTOK</a>
          </div>

          <a href="https://kick.com/zeekfusion" target="_blank" rel="noreferrer" style={community}>
            <div>
              <strong>JOIN THE COMMUNITY</strong>
              <p>LIVE CHAT • GIVEAWAYS • BE PART OF THE JOURNEY</p>
            </div>
            <span>›</span>
          </a>
        </section>

        <Link to="/merch" style={merchCard}>
          <h3>MERCH</h3>
          <h2>LIMITED DROPS<br />COMING SOON</h2>
          <button style={smallBtn}>SHOP MERCH →</button>
        </Link>

        <section style={stats}>
          <div><strong>100M+</strong><span>TOTAL VIEWS</span></div>
          <div><strong>500+</strong><span>VIDEOS</span></div>
          <div><strong>20+</strong><span>COUNTRIES VISITED</span></div>
          <div><strong>LIVE</strong><span>ALMOST EVERY DAY</span></div>
          <div><strong>ALL ENERGY</strong><span>ALL CHAOS</span></div>
        </section>
      </main>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  background: "#02040a",
  color: "white",
  fontFamily: "Impact, Arial Black, Arial, sans-serif",
  padding: "22px",
};

const nav = {
  height: "78px",
  display: "flex",
  alignItems: "center",
  gap: "28px",
  borderBottom: "1px solid rgba(0,132,255,.35)",
  marginBottom: "22px",
};

const kickBrand = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  color: "white",
  textDecoration: "none",
  fontSize: "30px",
  fontWeight: 900,
};

const kickK = {
  color: "#38ff14",
  fontSize: "48px",
  lineHeight: 1,
};

const navLinks = {
  flex: 1,
  display: "flex",
  justifyContent: "center",
  gap: "34px",
};

const navLink = {
  color: "white",
  textDecoration: "none",
  fontSize: "18px",
  fontWeight: 900,
};

const activeNav = {
  ...navLink,
  color: "#0ea5ff",
  borderBottom: "3px solid #0ea5ff",
  paddingBottom: "8px",
};

const avatar = {
  width: "70px",
  height: "70px",
  borderRadius: "50%",
  objectFit: "cover",
  border: "3px solid #008cff",
  boxShadow: "0 0 22px #008cff",
};

const watchBtn = {
  background: "linear-gradient(90deg,#005bea,#00a6ff)",
  color: "white",
  padding: "15px 24px",
  borderRadius: "8px",
  textDecoration: "none",
  fontSize: "18px",
  fontWeight: 900,
  boxShadow: "0 0 20px rgba(0,132,255,.75)",
};

const layout = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr",
  gap: "14px",
};

const hero = {
  gridRow: "span 2",
  minHeight: "520px",
  border: "1px solid rgba(0,132,255,.55)",
  borderRadius: "16px",
  background:
    "radial-gradient(circle at 70% 50%, rgba(0,132,255,.55), transparent 30%), linear-gradient(135deg,#030711,#071a38)",
  padding: "42px",
  display: "grid",
  gridTemplateColumns: "1.1fr .9fr",
  overflow: "hidden",
};

const welcome = {
  color: "#008cff",
  fontSize: "22px",
  letterSpacing: "5px",
};

const title = {
  fontSize: "110px",
  lineHeight: ".86",
  margin: "10px 0",
  textShadow: "0 0 22px rgba(0,132,255,.6)",
};

const heroText = {
  fontSize: "22px",
  margin: "10px 0 0",
};

const heroTextBlue = {
  fontSize: "24px",
  color: "#0ea5ff",
  margin: 0,
};

const heroButton = {
  marginTop: "24px",
  display: "inline-flex",
  alignItems: "center",
  gap: "12px",
  padding: "14px 22px",
  border: "1px solid #008cff",
  borderRadius: "8px",
  color: "white",
  textDecoration: "none",
  boxShadow: "0 0 20px rgba(0,132,255,.6)",
};

const kickSmall = {
  color: "#38ff14",
  fontWeight: 900,
};

const heroFace = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const heroImg = {
  width: "360px",
  height: "360px",
  objectFit: "cover",
  borderRadius: "50%",
  filter: "drop-shadow(0 0 35px #008cff)",
};

const card = {
  minHeight: "235px",
  border: "1px solid rgba(0,132,255,.45)",
  borderRadius: "16px",
  padding: "28px",
  color: "white",
  textDecoration: "none",
  background: "linear-gradient(135deg,#06101f,#082954)",
};

const mapCard = {
  background:
    "radial-gradient(circle at right, rgba(0,132,255,.7), transparent 40%), #06101f",
};

const scheduleCard = {
  background:
    "radial-gradient(circle at right, rgba(0,89,255,.65), transparent 40%), #06101f",
};

const smallBtn = {
  marginTop: "18px",
  background: "#031a35",
  border: "1px solid #008cff",
  color: "white",
  padding: "12px 18px",
  borderRadius: "7px",
  fontWeight: 900,
};

const videoCard = {
  border: "1px solid rgba(0,132,255,.45)",
  borderRadius: "16px",
  padding: "18px",
  background: "#05080e",
};

const videoBox = {
  height: "175px",
  borderRadius: "10px",
  background: "linear-gradient(135deg,#06213d,#0ea5ff)",
  position: "relative",
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const videoFace = {
  position: "absolute",
  left: "15px",
  width: "115px",
  height: "115px",
  objectFit: "cover",
  borderRadius: "12px",
};

const play = {
  fontSize: "54px",
  color: "red",
  zIndex: 2,
};

const blueLink = {
  display: "inline-block",
  marginTop: "14px",
  color: "#008cff",
  textDecoration: "none",
};

const connectCard = {
  border: "1px solid rgba(0,132,255,.45)",
  borderRadius: "16px",
  padding: "22px",
  background: "#05080e",
};

const socials = {
  display: "flex",
  justifyContent: "space-between",
  margin: "24px 0",
  gap: "12px",
};

const community = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  border: "1px solid #008cff",
  borderRadius: "10px",
  padding: "18px",
  color: "white",
  textDecoration: "none",
  background: "linear-gradient(90deg,#031a35,#062b5d)",
};

const merchCard = {
  border: "1px solid rgba(0,132,255,.45)",
  borderRadius: "16px",
  padding: "28px",
  color: "white",
  textDecoration: "none",
  background:
    "radial-gradient(circle at right, rgba(0,132,255,.9), transparent 38%), linear-gradient(135deg,#05080e,#071a38)",
};

const stats = {
  gridColumn: "1 / span 2",
  display: "grid",
  gridTemplateColumns: "repeat(5,1fr)",
  border: "1px solid rgba(0,132,255,.45)",
  borderRadius: "16px",
  padding: "22px",
  background: "linear-gradient(90deg,#05080e,#06162d)",
  textAlign: "center",
};

const statsDiv = {};