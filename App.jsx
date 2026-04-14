import React, { useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import { feature } from "topojson-client";

const US_STATE_NAMES = {
  "01": "Alabama",
  "02": "Alaska",
  "04": "Arizona",
  "05": "Arkansas",
  "06": "California",
  "08": "Colorado",
  "09": "Connecticut",
  "10": "Delaware",
  "11": "District of Columbia",
  "12": "Florida",
  "13": "Georgia",
  "15": "Hawaii",
  "16": "Idaho",
  "17": "Illinois",
  "18": "Indiana",
  "19": "Iowa",
  "20": "Kansas",
  "21": "Kentucky",
  "22": "Louisiana",
  "23": "Maine",
  "24": "Maryland",
  "25": "Massachusetts",
  "26": "Michigan",
  "27": "Minnesota",
  "28": "Mississippi",
  "29": "Missouri",
  "30": "Montana",
  "31": "Nebraska",
  "32": "Nevada",
  "33": "New Hampshire",
  "34": "New Jersey",
  "35": "New Mexico",
  "36": "New York",
  "37": "North Carolina",
  "38": "North Dakota",
  "39": "Ohio",
  "40": "Oklahoma",
  "41": "Oregon",
  "42": "Pennsylvania",
  "44": "Rhode Island",
  "45": "South Carolina",
  "46": "South Dakota",
  "47": "Tennessee",
  "48": "Texas",
  "49": "Utah",
  "50": "Vermont",
  "51": "Virginia",
  "53": "Washington",
  "54": "West Virginia",
  "55": "Wisconsin",
  "56": "Wyoming"
};

const INITIAL_WORLD_VOTES = {
  Japan: 412,
  Austria: 365,
  Mexico: 287,
  Brazil: 244,
  Canada: 196,
  "South Korea": 180,
  Germany: 171,
  Italy: 160,
  Spain: 152,
  Australia: 141
};

const INITIAL_USA_VOTES = {
  California: 312,
  Nevada: 264,
  Arizona: 208,
  Tennessee: 177,
  Colorado: 166,
  Illinois: 142,
  Georgia: 130,
  Hawaii: 119,
  Washington: 110,
  Ohio: 104
};

function safeLoad(key, fallback) {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error(`Failed reading ${key}:`, error);
    return fallback;
  }
}

function getWorldRegion(countryName) {
  const regionMap = {
    "United States of America": "Americas",
    Canada: "Americas",
    Mexico: "Americas",
    Brazil: "Americas",
    Argentina: "Americas",
    Colombia: "Americas",
    Peru: "Americas",
    Chile: "Americas",
    Austria: "Europe",
    Germany: "Europe",
    Italy: "Europe",
    Spain: "Europe",
    France: "Europe",
    Portugal: "Europe",
    Netherlands: "Europe",
    Belgium: "Europe",
    Switzerland: "Europe",
    "United Kingdom": "Europe",
    Ireland: "Europe",
    Czechia: "Europe",
    Japan: "Asia",
    China: "Asia",
    India: "Asia",
    Thailand: "Asia",
    Vietnam: "Asia",
    "South Korea": "Asia",
    Indonesia: "Asia",
    Philippines: "Asia",
    Australia: "Oceania",
    "New Zealand": "Oceania",
    Egypt: "Africa",
    Morocco: "Africa",
    "South Africa": "Africa",
    UAE: "Middle East",
    Israel: "Middle East",
    Turkey: "Middle East",
    Saudi: "Middle East"
  };

  return regionMap[countryName] || "World";
}

function getUsaRegion(stateName) {
  const west = new Set([
    "Alaska",
    "Arizona",
    "California",
    "Colorado",
    "Hawaii",
    "Idaho",
    "Montana",
    "Nevada",
    "New Mexico",
    "Oregon",
    "Utah",
    "Washington",
    "Wyoming"
  ]);

  const south = new Set([
    "Alabama",
    "Arkansas",
    "Delaware",
    "Florida",
    "Georgia",
    "Kentucky",
    "Louisiana",
    "Maryland",
    "Mississippi",
    "North Carolina",
    "Oklahoma",
    "South Carolina",
    "Tennessee",
    "Texas",
    "Virginia",
    "West Virginia",
    "District of Columbia"
  ]);

  const midwest = new Set([
    "Illinois",
    "Indiana",
    "Iowa",
    "Kansas",
    "Michigan",
    "Minnesota",
    "Missouri",
    "Nebraska",
    "North Dakota",
    "Ohio",
    "South Dakota",
    "Wisconsin"
  ]);

  const northeast = new Set([
    "Connecticut",
    "Maine",
    "Massachusetts",
    "New Hampshire",
    "New Jersey",
    "New York",
    "Pennsylvania",
    "Rhode Island",
    "Vermont"
  ]);

  if (west.has(stateName)) return "West";
  if (south.has(stateName)) return "South";
  if (midwest.has(stateName)) return "Midwest";
  if (northeast.has(stateName)) return "Northeast";
  return "USA";
}

export default function App() {
  const globeRef = useRef();

  const [viewMode, setViewMode] = useState("world");
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [hoveredPlace, setHoveredPlace] = useState(null);

  const [votesOpen, setVotesOpen] = useState(false);
  const [voteSearch, setVoteSearch] = useState("");

  const [worldVoteCounts, setWorldVoteCounts] = useState(() =>
    safeLoad("zeekfusion-world-votes", INITIAL_WORLD_VOTES)
  );
  const [usaVoteCounts, setUsaVoteCounts] = useState(() =>
    safeLoad("zeekfusion-usa-votes", INITIAL_USA_VOTES)
  );
  const [votesUsed, setVotesUsed] = useState(() =>
    safeLoad("zeekfusion-votes-used", { world: 0, usa: 0 })
  );

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

  const plannedCountryData = useMemo(
    () => [
      {
        name: "Italy",
        note: "Europe Summer July-August"
      },
      {
        name: "Czechia",
        note: "Europe Summer July-August"
      }
    ],
    []
  );

  const plannedStateData = useMemo(
    () => [
      {
        id: "13",
        name: "Georgia",
        note: "Dreamhack Atlanta May 15-17"
      },
      {
        id: "39",
        name: "Ohio",
        note: "Randomly Picked by End of May"
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

  const plannedCountriesMap = useMemo(() => {
    const map = new Map();
    plannedCountryData.forEach((item) => map.set(item.name, item));
    return map;
  }, [plannedCountryData]);

  const plannedStatesMap = useMemo(() => {
    const map = new Map();
    plannedStateData.forEach((item) => map.set(item.id, item));
    return map;
  }, [plannedStateData]);

  const socialLinks = {
    kick: "https://kick.com/zeekfusion",
    instagram: "https://instagram.com/zeekfusion",
    youtube: "https://youtube.com/@ZeekFusion",
    x: "https://x.com/zeekfusion",
    tiktok: "https://tiktok.com/@zeekfusion"
  };

  const markerColor = "#facc15";

  const worldPoints = [
    {
      lat: 25.7617,
      lng: -80.1918,
      label: "United States of America",
      color: markerColor,
      altitude: 0.045
    },
    {
      lat: 48.2082,
      lng: 16.3738,
      label: "Austria",
      color: markerColor,
      altitude: 0.045
    }
  ];

  const usaPoints = [
    {
      lat: 27.9944,
      lng: -81.7603,
      label: "Florida",
      color: markerColor,
      altitude: 0.038
    },
    {
      lat: 31.1695,
      lng: -91.8678,
      label: "Louisiana",
      color: markerColor,
      altitude: 0.038
    },
    {
      lat: 31.9686,
      lng: -99.9018,
      label: "Texas",
      color: markerColor,
      altitude: 0.038
    },
    {
      lat: 42.9134,
      lng: -75.5963,
      label: "New York",
      color: markerColor,
      altitude: 0.038
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
          const plannedInfo = plannedCountriesMap.get(name);

          return {
            ...f,
            name,
            isVisited: Boolean(visitedInfo),
            isPlanned: Boolean(plannedInfo),
            youtube: visitedInfo?.youtube || null,
            note: plannedInfo?.note || null,
            placeType: "Country"
          };
        });

        const mappedStates = usGeo.features.map((f) => {
          const id = String(f.id).padStart(2, "0");
          const visitedInfo = visitedStatesMap.get(id);
          const plannedInfo = plannedStatesMap.get(id);
          const realName = US_STATE_NAMES[id] || `State ${id}`;

          return {
            ...f,
            id,
            name: visitedInfo?.name || plannedInfo?.name || realName,
            isVisited: Boolean(visitedInfo),
            isPlanned: Boolean(plannedInfo),
            youtube: visitedInfo?.youtube || null,
            note: plannedInfo?.note || null,
            placeType: "State"
          };
        });

        setCountries(mappedCountries);
        setStates(mappedStates);
      } catch (error) {
        console.error("Failed loading map data:", error);
      }
    }

    loadMapData();
  }, [visitedCountriesMap, visitedStatesMap, plannedCountriesMap, plannedStatesMap]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("zeekfusion-world-votes", JSON.stringify(worldVoteCounts));
    }
  }, [worldVoteCounts]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("zeekfusion-usa-votes", JSON.stringify(usaVoteCounts));
    }
  }, [usaVoteCounts]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("zeekfusion-votes-used", JSON.stringify(votesUsed));
    }
  }, [votesUsed]);

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

  const socialIconStyle = {
    width: 34,
    height: 34,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "10px",
    fontSize: "18px",
    fontWeight: 900,
    color: "white",
    boxShadow: "0 0 10px rgba(255,255,255,0.15)",
    textDecoration: "none"
  };

  const activeInfoPanel = selectedPlace || hoveredPlace;

  const worldVoteItems = useMemo(() => {
    return countries
      .filter((item) => item.name && item.name !== "Antarctica")
      .map((item) => ({
        place: item.name,
        region: getWorldRegion(item.name),
        votes: worldVoteCounts[item.name] || 0
      }))
      .sort((a, b) => b.votes - a.votes || a.place.localeCompare(b.place));
  }, [countries, worldVoteCounts]);

  const usaVoteItems = useMemo(() => {
    return states
      .filter((item) => item.name)
      .map((item) => ({
        place: item.name,
        region: getUsaRegion(item.name),
        votes: usaVoteCounts[item.name] || 0
      }))
      .sort((a, b) => b.votes - a.votes || a.place.localeCompare(b.place));
  }, [states, usaVoteCounts]);

  const activeVoteItems = viewMode === "world" ? worldVoteItems : usaVoteItems;
  const activeVotesUsed = viewMode === "world" ? votesUsed.world : votesUsed.usa;

  const filteredVotes = useMemo(() => {
    return activeVoteItems.filter((item) =>
      item.place.toLowerCase().includes(voteSearch.toLowerCase())
    );
  }, [activeVoteItems, voteSearch]);

  const maxVoteValue = useMemo(() => {
    if (!filteredVotes.length) return 1;
    return Math.max(...filteredVotes.map((item) => item.votes), 1);
  }, [filteredVotes]);

  function handleVote(placeName) {
    if (viewMode === "world") {
      if (votesUsed.world >= 3) return;

      setWorldVoteCounts((prev) => ({
        ...prev,
        [placeName]: (prev[placeName] || 0) + 1
      }));

      setVotesUsed((prev) => ({
        ...prev,
        world: prev.world + 1
      }));
    } else {
      if (votesUsed.usa >= 3) return;

      setUsaVoteCounts((prev) => ({
        ...prev,
        [placeName]: (prev[placeName] || 0) + 1
      }));

      setVotesUsed((prev) => ({
        ...prev,
        usa: prev.usa + 1
      }));
    }
  }

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#020617", position: "relative" }}>
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
            setVoteSearch("");
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
            setVoteSearch("");
          }}
          style={buttonStyle(viewMode === "usa", "#22d3ee")}
        >
          USA
        </button>
      </div>

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

      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 24,
          zIndex: 20,
          width: 310,
          color: "white"
        }}
      >
        <div
          onClick={() => setVotesOpen((prev) => !prev)}
          style={{
            cursor: "pointer",
            padding: "12px 14px",
            borderRadius: "16px",
            background: "rgba(2,6,23,0.78)",
            border: "1px solid rgba(96,165,250,0.26)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 0 22px rgba(37,99,235,0.16)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#dbeafe",
              lineHeight: 1.2,
              textTransform: "uppercase",
              letterSpacing: "0.03em"
            }}
          >
            Where should{" "}
            <span
              style={{
                color: "#67e8f9",
                textShadow: "0 0 8px rgba(103,232,249,0.55), 0 0 18px rgba(59,130,246,0.35)"
              }}
            >
              ZEEK
            </span>{" "}
            go next?
          </div>

          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: "#67e8f9",
              transform: votesOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              flexShrink: 0
            }}
          >
            ^
          </div>
        </div>

        {votesOpen && (
          <div
            style={{
              marginTop: 10,
              padding: "14px",
              borderRadius: "18px",
              background: "rgba(2,6,23,0.86)",
              border: "1px solid rgba(96,165,250,0.22)",
              backdropFilter: "blur(10px)",
              boxShadow: "0 0 24px rgba(37,99,235,0.14)",
              maxHeight: 430,
              overflowY: "auto"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                gap: 12
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    color: "#93c5fd",
                    fontWeight: 800
                  }}
                >
                  VIEWER VOTES
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: "white",
                    marginTop: 4,
                    lineHeight: 1.2
                  }}
                >
                  Where should{" "}
                  <span
                    style={{
                      color: "#67e8f9",
                      textShadow: "0 0 8px rgba(103,232,249,0.45)"
                    }}
                  >
                    ZEEK
                  </span>{" "}
                  go next?
                </div>
              </div>

              <div
                style={{
                  padding: "6px 10px",
                  borderRadius: "999px",
                  border: "1px solid rgba(96,165,250,0.24)",
                  color: "#67e8f9",
                  fontWeight: 800,
                  fontSize: 13,
                  whiteSpace: "nowrap",
                  background: "rgba(15,23,42,0.7)"
                }}
              >
                {activeVotesUsed}/3
              </div>
            </div>

            <input
              type="text"
              value={voteSearch}
              onChange={(e) => setVoteSearch(e.target.value)}
              placeholder={viewMode === "world" ? "Search countries..." : "Search states..."}
              style={{
                width: "100%",
                padding: "12px 14px",
                marginBottom: 14,
                borderRadius: "14px",
                border: "1px solid rgba(96,165,250,0.22)",
                background: "rgba(15,23,42,0.86)",
                color: "white",
                outline: "none",
                fontSize: "14px"
              }}
            />

            <div style={{ display: "grid", gap: 10 }}>
              {filteredVotes.length === 0 && (
                <div style={{ color: "#94a3b8", fontSize: 14 }}>No results found.</div>
              )}

              {filteredVotes.map((item, index) => {
                const barWidth = `${(item.votes / maxVoteValue) * 100}%`;

                return (
                  <div
                    key={item.place}
                    style={{
                      padding: "10px 2px",
                      borderBottom: "1px solid rgba(255,255,255,0.05)"
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "40px 1fr 60px",
                        gap: 10,
                        alignItems: "center"
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "10px",
                          border: "1px solid rgba(255,255,255,0.1)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 900,
                          fontSize: 14,
                          color:
                            index === 0
                              ? "#67e8f9"
                              : index === 1
                              ? "#cbd5e1"
                              : index === 2
                              ? "#93c5fd"
                              : "#94a3b8",
                          background: "rgba(15,23,42,0.72)"
                        }}
                      >
                        {index + 1}
                      </div>

                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap"
                          }}
                        >
                          <span style={{ fontSize: 15, fontWeight: 700 }}>{item.place}</span>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "4px 8px",
                              borderRadius: "999px",
                              background: "rgba(255,255,255,0.07)",
                              color: "#94a3b8"
                            }}
                          >
                            {item.region}
                          </span>
                        </div>

                        <div
                          style={{
                            marginTop: 8,
                            height: 6,
                            width: "100%",
                            background: "rgba(255,255,255,0.1)",
                            borderRadius: "999px",
                            overflow: "hidden"
                          }}
                        >
                          <div
                            style={{
                              width: barWidth,
                              height: "100%",
                              background:
                                index === 0
                                  ? "#67e8f9"
                                  : index === 1
                                  ? "#60a5fa"
                                  : index === 2
                                  ? "#93c5fd"
                                  : "#475569",
                              borderRadius: "999px"
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: 17,
                            fontWeight: 900,
                            color: index === 0 ? "#67e8f9" : "#e5e7eb"
                          }}
                        >
                          {item.votes}
                        </div>

                        <button
                          onClick={() => handleVote(item.place)}
                          disabled={activeVotesUsed >= 3}
                          style={{
                            marginTop: 6,
                            padding: "6px 9px",
                            borderRadius: "10px",
                            border: "1px solid rgba(96,165,250,0.18)",
                            background:
                              activeVotesUsed >= 3
                                ? "rgba(255,255,255,0.05)"
                                : "rgba(59,130,246,0.12)",
                            color: activeVotesUsed >= 3 ? "#6b7280" : "#93c5fd",
                            cursor: activeVotesUsed >= 3 ? "not-allowed" : "pointer",
                            fontWeight: 800,
                            fontSize: 12
                          }}
                        >
                          Vote
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

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

          {activeInfoPanel.note && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: "12px",
                background: "rgba(250,204,21,0.12)",
                border: "1px solid rgba(250,204,21,0.3)",
                color: "#fde68a",
                fontSize: 14,
                fontWeight: 700
              }}
            >
              {activeInfoPanel.note}
            </div>
          )}

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
            if (d.isPlanned) return "rgba(250,204,21,0.72)";
            if (d.isVisited) return "rgba(59,130,246,0.62)";
            return "rgba(255,255,255,0.03)";
          }}
          polygonSideColor={() => "rgba(0,0,0,0)"}
          polygonStrokeColor={(d) => {
            if (hoveredPlace?.name === d.name) return "#e0f2fe";
            if (d.isPlanned) return "#facc15";
            return "#60a5fa";
          }}
          polygonAltitude={(d) => {
            if (hoveredPlace?.name === d.name) return 0.032;
            if (d.isPlanned) return 0.022;
            if (d.isVisited) return 0.02;
            return 0.006;
          }}
          onPolygonHover={(d) => {
            if (!d) {
              setHoveredPlace(null);
              return;
            }

            setHoveredPlace({
              name: d.name,
              youtube: d.youtube,
              note: d.note,
              type: d.isVisited ? "Visited Country" : d.isPlanned ? "Planned Country" : "Country"
            });
          }}
          onPolygonClick={(d) => {
            if (!d?.isVisited && !d?.isPlanned) return;
            setSelectedPlace({
              name: d.name,
              youtube: d.youtube,
              note: d.note,
              type: d.isVisited ? "Visited Country" : "Planned Country"
            });
          }}
          polygonLabel={(d) => d.name}
          pointsData={worldPoints}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointLabel="label"
          pointRadius={0.34}
          pointAltitude="altitude"
        />
      ) : (
        <Globe
          {...commonGlobeProps}
          polygonsData={states}
          polygonGeoJsonGeometry="geometry"
          polygonCapColor={(d) => {
            if (hoveredPlace?.name === d.name) return "rgba(103,232,249,0.96)";
            if (d.isPlanned) return "rgba(250,204,21,0.76)";
            if (d.isVisited) return "rgba(34,211,238,0.7)";
            return "rgba(255,255,255,0.03)";
          }}
          polygonSideColor={() => "rgba(0,0,0,0)"}
          polygonStrokeColor={(d) => {
            if (hoveredPlace?.name === d.name) return "#ecfeff";
            if (d.isPlanned) return "#facc15";
            return "#22d3ee";
          }}
          polygonAltitude={(d) => {
            if (hoveredPlace?.name === d.name) return 0.038;
            if (d.isPlanned) return 0.028;
            if (d.isVisited) return 0.025;
            return 0.008;
          }}
          onPolygonHover={(d) => {
            if (!d) {
              setHoveredPlace(null);
              return;
            }

            setHoveredPlace({
              name: d.name,
              youtube: d.youtube,
              note: d.note,
              type: d.isVisited ? "Visited State" : d.isPlanned ? "Planned State" : "State"
            });
          }}
          onPolygonClick={(d) => {
            if (!d?.isVisited && !d?.isPlanned) return;
            setSelectedPlace({
              name: d.name,
              youtube: d.youtube,
              note: d.note,
              type: d.isVisited ? "Visited State" : "Planned State"
            });
          }}
          polygonLabel={(d) => d.name}
          pointsData={usaPoints}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointLabel="label"
          pointRadius={0.3}
          pointAltitude="altitude"
        />
      )}

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
        <span><span style={{ color: "#facc15" }}>■</span> Planned Soon</span>
        <span><span style={{ color: markerColor }}>│</span> Travel Marker</span>
        <span><span style={{ color: "#93c5fd" }}>Hover / Click</span> for info</span>
      </div>

      <div
        style={{
          position: "absolute",
          right: 24,
          bottom: 24,
          zIndex: 25,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 14px",
          borderRadius: "18px",
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(96,165,250,0.25)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 0 20px rgba(37,99,235,0.18)"
        }}
      >
        <a href={socialLinks.kick} target="_blank" rel="noreferrer" style={{ ...socialIconStyle, background: "#22c55e" }}>
          K
        </a>

        <a
          href={socialLinks.instagram}
          target="_blank"
          rel="noreferrer"
          style={{
            ...socialIconStyle,
            background: "linear-gradient(135deg, #f9ce34, #ee2a7b, #6228d7)"
          }}
        >
          IG
        </a>

        <a href={socialLinks.youtube} target="_blank" rel="noreferrer" style={{ ...socialIconStyle, background: "#ef4444" }}>
          ▶
        </a>

        <a href={socialLinks.x} target="_blank" rel="noreferrer" style={{ ...socialIconStyle, background: "#38bdf8" }}>
          X
        </a>

        <a
          href={socialLinks.tiktok}
          target="_blank"
          rel="noreferrer"
          style={{
            ...socialIconStyle,
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.15)"
          }}
        >
          ♪
        </a>

        <div
          style={{
            marginLeft: "4px",
            color: "#e0f2fe",
            fontSize: "28px",
            fontWeight: 900,
            letterSpacing: "0.02em",
            textShadow: "0 0 10px rgba(56,189,248,0.45)"
          }}
        >
          ZeekFusion
        </div>
      </div>
    </div>
  );
}
