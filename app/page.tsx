"use client";

import { useEffect, useMemo, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import us from "us-atlas/states-10m.json";

type AssetNode = {
  id: string;
  state: string;
  code: string;
  city: string;
  lat: number;
  lon: number;
  mw: number;
  assets: number;
  market: "ERCOT" | "CAISO" | "PJM";
};

const assets: AssetNode[] = [
  { id: "tx", state: "Texas", code: "TX", city: "Dallas", lat: 32.8, lon: -96.8, mw: 18.4, assets: 2840, market: "ERCOT" },
  { id: "ca", state: "California", code: "CA", city: "Los Angeles", lat: 34.05, lon: -118.25, mw: 16.8, assets: 3120, market: "CAISO" },
  { id: "ny", state: "New York", code: "NY", city: "New York", lat: 40.7, lon: -74.0, mw: 8.7, assets: 1450, market: "PJM" },
  { id: "il", state: "Illinois", code: "IL", city: "Chicago", lat: 41.88, lon: -87.63, mw: 6.9, assets: 1080, market: "PJM" },
  { id: "pa", state: "Pennsylvania", code: "PA", city: "Philadelphia", lat: 39.95, lon: -75.17, mw: 5.8, assets: 940, market: "PJM" },
  { id: "az", state: "Arizona", code: "AZ", city: "Phoenix", lat: 33.45, lon: -112.07, mw: 4.9, assets: 730, market: "CAISO" },
  { id: "co", state: "Colorado", code: "CO", city: "Denver", lat: 39.74, lon: -104.99, mw: 4.2, assets: 610, market: "ERCOT" },
  { id: "fl", state: "Florida", code: "FL", city: "Miami", lat: 25.76, lon: -80.19, mw: 3.8, assets: 520, market: "PJM" },
  { id: "ga", state: "Georgia", code: "GA", city: "Atlanta", lat: 33.75, lon: -84.39, mw: 3.4, assets: 470, market: "PJM" },
  { id: "nv", state: "Nevada", code: "NV", city: "Las Vegas", lat: 36.17, lon: -115.14, mw: 2.9, assets: 390, market: "CAISO" },
  { id: "wa", state: "Washington", code: "WA", city: "Seattle", lat: 47.61, lon: -122.33, mw: 2.7, assets: 350, market: "CAISO" },
  { id: "or", state: "Oregon", code: "OR", city: "Portland", lat: 45.52, lon: -122.68, mw: 2.4, assets: 310, market: "CAISO" },
];

const stateCapacity: Record<string, number> = {
  Texas: 18.4,
  California: 16.8,
  "New York": 8.7,
  Illinois: 6.9,
  Pennsylvania: 5.8,
  Arizona: 4.9,
  Colorado: 4.2,
  Florida: 3.8,
  Georgia: 3.4,
  Nevada: 2.9,
  Washington: 2.7,
  Oregon: 2.4,
};

const marketColors = {
  ERCOT: "#22d3ee",
  CAISO: "#60a5fa",
  PJM: "#a78bfa",
};

const marketDescriptions = {
  ERCOT: "Texas wholesale energy market",
  CAISO: "California wholesale energy market",
  PJM: "Eastern U.S. wholesale market",
};

function formatMoney(value: number) {
  return "$" + value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatMW(value: number) {
  return value.toFixed(1) + " MW";
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="section-title">
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function USNetworkMap({
  running,
  selectedMarket,
  onSelectNode,
}: {
  running: boolean;
  selectedMarket: "ALL" | "ERCOT" | "CAISO" | "PJM";
  onSelectNode: (node: AssetNode) => void;
}) {
  const [selectedNode, setSelectedNode] = useState<string | null>("tx");

  const projection = useMemo(
    () =>
      geoAlbersUsa()
        .scale(1300)
        .translate([487.5, 305]),
    []
  );

  const pathGenerator = useMemo(
    () => geoPath(projection),
    [projection]
  );

  const states = useMemo(() => {
    const geo = feature(
      us as any,
      (us as any).objects.states
    ) as any;

    return geo.features;
  }, []);

  const projectedNodes = useMemo(() => {
    return assets
      .map((node) => {
        const point = projection([node.lon, node.lat]);

        if (!point) return null;

        return {
          ...node,
          x: point[0],
          y: point[1],
        };
      })
      .filter(Boolean) as (AssetNode & { x: number; y: number })[];
  }, [projection]);

  const visibleNodes = projectedNodes.filter(
    (node) =>
      selectedMarket === "ALL" ||
      node.market === selectedMarket
  );

  const selected =
    assets.find((node) => node.id === selectedNode) ||
    assets[0];

  const selectedPoint = projectedNodes.find(
    (node) => node.id === selected.id
  );

  return (
    <div className="map-shell">
      <div className="map-toolbar">
        <div>
          <div className="map-title">NATIONAL VPP NETWORK</div>
          <div className="map-status">
            <span className="status-dot" />
            {running ? "LIVE SIMULATION RUNNING" : "SIMULATION READY"}
          </div>
        </div>

        <div className="market-tabs">
          {(["ALL", "ERCOT", "CAISO", "PJM"] as const).map(
            (market) => (
              <button
                key={market}
                className={
                  selectedMarket === market
                    ? "market-tab active"
                    : "market-tab"
                }
                onClick={() => {
                  // Parent controls the filter through a synthetic click
                  const event = new CustomEvent(
                    "drivegrid-market",
                    { detail: market }
                  );
                  window.dispatchEvent(event);
                }}
              >
                {market}
              </button>
            )
          )}
        </div>
      </div>

      <div className="map-container">
        <svg
          viewBox="0 0 975 610"
          className="us-map"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <linearGradient
              id="stateGradient"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop offset="0%" stopColor="#10283a" />
              <stop offset="100%" stopColor="#08141f" />
            </linearGradient>

            <linearGradient
              id="flowGradient"
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
              <stop offset="50%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* U.S. states */}
          <g>
            {states.map((state: any) => {
              const name = state.properties?.name || "";
              const capacity = stateCapacity[name] || 0;
              const isActive = capacity > 0;

              const d = pathGenerator(state);

              return (
                <path
                  key={state.id}
                  d={d || ""}
                  className={
                    isActive
                      ? "state active-state"
                      : "state"
                  }
                  style={{
                    opacity:
                      capacity > 10
                        ? 0.95
                        : capacity > 0
                        ? 0.82
                        : 0.58,
                  }}
                />
              );
            })}
          </g>

          {/* Energy flow lines */}
          {selectedPoint &&
            visibleNodes
              .filter((node) => node.id !== selected.id)
              .slice(0, 7)
              .map((node) => (
                <line
                  key={`flow-${node.id}`}
                  x1={selectedPoint.x}
                  y1={selectedPoint.y}
                  x2={node.x}
                  y2={node.y}
                  className={
                    running
                      ? "energy-line running"
                      : "energy-line"
                  }
                />
              ))}

          {/* Nodes */}
          {visibleNodes.map((node) => {
            const isSelected = node.id === selected.id;
            const color = marketColors[node.market];

            return (
              <g
                key={node.id}
                className="node-group"
                onClick={() => {
                  setSelectedNode(node.id);
                  onSelectNode(node);
                }}
              >
                {running && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isSelected ? 13 : 9}
                    className="node-pulse"
                    style={{
                      stroke: color,
                    }}
                  />
                )}

                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isSelected ? 7 : 5}
                  className="node-core"
                  style={{
                    fill: color,
                    filter: "url(#glow)",
                  }}
                />

                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isSelected ? 11 : 8}
                  className="node-ring"
                  style={{
                    stroke: color,
                  }}
                />

                {isSelected && (
                  <g>
                    <rect
                      x={node.x + 14}
                      y={node.y - 34}
                      width="126"
                      height="42"
                      rx="5"
                      className="node-label-box"
                    />

                    <text
                      x={node.x + 24}
                      y={node.y - 18}
                      className="node-label-title"
                    >
                      {node.city}, {node.code}
                    </text>

                    <text
                      x={node.x + 24}
                      y={node.y - 4}
                      className="node-label-value"
                    >
                      {formatMW(node.mw)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        <div className="map-overlay">
          <div className="overlay-title">VPP CAPACITY</div>
          <div className="overlay-value">
            {running ? "86.4" : "82.7"}
            <span> MW</span>
          </div>
          <div className="overlay-small">
            {running
              ? "+4.8 MW dispatching"
              : "Network synchronized"}
          </div>
        </div>

        <div className="map-legend">
          <div>
            <span
              className="legend-dot"
              style={{ background: marketColors.ERCOT }}
            />
            ERCOT
          </div>
          <div>
            <span
              className="legend-dot"
              style={{ background: marketColors.CAISO }}
            />
            CAISO
          </div>
          <div>
            <span
              className="legend-dot"
              style={{ background: marketColors.PJM }}
            />
            PJM
          </div>
        </div>
      </div>

      <div className="selected-panel">
        <div>
          <div className="selected-kicker">
            SELECTED VPP NODE
          </div>
          <div className="selected-name">
            {selected.city}, {selected.state}
          </div>
          <div className="selected-market">
            {selected.market} · {marketDescriptions[selected.market]}
          </div>
        </div>

        <div className="selected-stat">
          <span>CAPACITY</span>
          <strong>{formatMW(selected.mw)}</strong>
        </div>

        <div className="selected-stat">
          <span>ASSETS</span>
          <strong>
            {selected.assets.toLocaleString()}
          </strong>
        </div>

        <div className="selected-stat">
          <span>STATUS</span>
          <strong className="online">ONLINE</strong>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [running, setRunning] = useState(true);
  const [selectedMarket, setSelectedMarket] =
    useState<"ALL" | "ERCOT" | "CAISO" | "PJM">("ALL");

  const [selectedNode, setSelectedNode] =
    useState<AssetNode>(assets[0]);

  const [revenue, setRevenue] = useState(48721);
  const [dispatchMW, setDispatchMW] = useState(21.8);
  const [soc, setSoc] = useState(74);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<
        "ALL" | "ERCOT" | "CAISO" | "PJM"
      >;

      setSelectedMarket(custom.detail);
    };

    window.addEventListener("drivegrid-market", handler);

    return () => {
      window.removeEventListener(
        "drivegrid-market",
        handler
      );
    };
  }, []);

  useEffect(() => {
    if (!running) return;

    const timer = window.setInterval(() => {
      setRevenue((value) => value + Math.floor(Math.random() * 180));
      setDispatchMW(
        18 + Math.random() * 8
      );
      setSoc(
        Math.max(
          48,
          Math.min(
            91,
            soc + (Math.random() > 0.5 ? 1 : -1)
          )
        )
      );
    }, 1800);

    return () => window.clearInterval(timer);
  }, [running, soc]);

  return (
    <main className="site">
      <style>{`
        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #03080d;
          color: #e5eef5;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        button {
          font: inherit;
        }

        .site {
          min-height: 100vh;
          background:
            radial-gradient(circle at 50% -10%, rgba(34,211,238,.10), transparent 35%),
            linear-gradient(180deg, #03080d 0%, #050b11 100%);
        }

        .topbar {
          height: 72px;
          padding: 0 5vw;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(148,163,184,.12);
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(3,8,13,.88);
          backdrop-filter: blur(18px);
        }

        .brand {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: .12em;
        }

        .brand span {
          color: #22d3ee;
        }

        .nav {
          display: flex;
          gap: 25px;
          color: #94a3b8;
          font-size: 13px;
        }

        .nav a {
          color: inherit;
          text-decoration: none;
          transition: color .2s;
        }

        .nav a:hover {
          color: #e5eef5;
        }

        .demo-pill {
          padding: 8px 13px;
          border: 1px solid rgba(34,211,238,.35);
          color: #67e8f9;
          border-radius: 999px;
          font-size: 11px;
          letter-spacing: .08em;
          font-weight: 700;
        }

        .hero {
          padding: 105px 7vw 70px;
          max-width: 1500px;
          margin: auto;
        }

        .eyebrow {
          color: #22d3ee;
          font-size: 11px;
          letter-spacing: .18em;
          font-weight: 800;
          margin-bottom: 15px;
        }

        .hero h1 {
          max-width: 850px;
          font-size: clamp(48px, 7vw, 92px);
          line-height: .94;
          letter-spacing: -.055em;
          margin: 0;
        }

        .hero p {
          max-width: 680px;
          margin: 28px 0 35px;
          color: #94a3b8;
          font-size: 18px;
          line-height: 1.65;
        }

        .hero-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .primary-btn,
        .secondary-btn {
          border-radius: 8px;
          padding: 14px 20px;
          cursor: pointer;
          font-weight: 750;
          font-size: 13px;
        }

        .primary-btn {
          background: #22d3ee;
          color: #031018;
          border: 1px solid #22d3ee;
        }

        .secondary-btn {
          background: transparent;
          color: #cbd5e1;
          border: 1px solid #334155;
        }

        .metrics {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 7vw 80px;
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 1px;
          background: rgba(148,163,184,.12);
        }

        .metric {
          min-height: 125px;
          padding: 22px;
          background: #050c13;
        }

        .metric-label {
          color: #64748b;
          font-size: 10px;
          letter-spacing: .12em;
          font-weight: 700;
        }

        .metric-value {
          margin-top: 14px;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -.04em;
        }

        .metric-sub {
          color: #22d3ee;
          margin-top: 7px;
          font-size: 11px;
        }

        section {
          max-width: 1400px;
          margin: auto;
          padding: 110px 7vw;
        }

        .section-title {
          max-width: 720px;
          margin-bottom: 45px;
        }

        .section-title h2 {
          font-size: clamp(34px, 4vw, 58px);
          letter-spacing: -.045em;
          line-height: 1;
          margin: 0;
        }

        .section-title p {
          color: #64748b;
          line-height: 1.7;
          margin-top: 18px;
        }

        .map-shell {
          border: 1px solid rgba(148,163,184,.16);
          border-radius: 16px;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 45%, rgba(34,211,238,.045), transparent 48%),
            #050c12;
          box-shadow: 0 30px 90px rgba(0,0,0,.28);
        }

        .map-toolbar {
          min-height: 82px;
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(148,163,184,.12);
          gap: 20px;
        }

        .map-title {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .14em;
        }

        .map-status {
          margin-top: 8px;
          color: #64748b;
          font-size: 10px;
          letter-spacing: .08em;
        }

        .status-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22d3ee;
          margin-right: 7px;
          box-shadow: 0 0 12px #22d3ee;
        }

        .market-tabs {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }

        .market-tab {
          background: #07111a;
          border: 1px solid #1e293b;
          color: #64748b;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
        }

        .market-tab.active {
          color: #dffbff;
          border-color: #22d3ee;
          background: rgba(34,211,238,.08);
        }

        .map-container {
          position: relative;
          min-height: 650px;
          padding: 25px;
        }

        .us-map {
          width: 100%;
          height: 650px;
          display: block;
        }

        .state {
          fill: url(#stateGradient);
          stroke: #203342;
          stroke-width: .8;
          transition: all .3s;
        }

        .active-state {
          fill: #0c2534;
          stroke: #275166;
        }

        .node-group {
          cursor: pointer;
        }

        .node-core {
          stroke: #07131c;
          stroke-width: 2;
        }

        .node-ring {
          fill: none;
          stroke-width: 1;
          opacity: .7;
        }

        .node-pulse {
          fill: none;
          stroke-width: 1.5;
          opacity: 0;
        }

        .running {
          animation: flowMove 2.3s linear infinite;
        }

        @keyframes flowMove {
          0% {
            stroke-dashoffset: 100;
            opacity: .05;
          }
          30% {
            opacity: .8;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: .05;
          }
        }

        .energy-line {
          stroke: url(#flowGradient);
          stroke-width: 1.2;
          stroke-dasharray: 8 14;
          opacity: .2;
        }

        .node-pulse {
          animation: pulse 1.8s ease-out infinite;
        }

        @keyframes pulse {
          0% {
            transform: scale(.6);
            opacity: .8;
            transform-origin: center;
          }
          100% {
            transform: scale(2.4);
            opacity: 0;
            transform-origin: center;
          }
        }

        .node-label-box {
          fill: rgba(4,12,18,.94);
          stroke: rgba(34,211,238,.4);
        }

        .node-label-title {
          fill: #e2f8fc;
          font-size: 10px;
          font-weight: 800;
        }

        .node-label-value {
          fill: #22d3ee;
          font-size: 10px;
          font-weight: 700;
        }

        .map-overlay {
          position: absolute;
          left: 42px;
          top: 45px;
          padding: 16px 19px;
          border: 1px solid rgba(34,211,238,.18);
          background: rgba(3,10,16,.82);
          backdrop-filter: blur(10px);
          border-radius: 8px;
        }

        .overlay-title {
          font-size: 9px;
          letter-spacing: .15em;
          color: #64748b;
          font-weight: 800;
        }

        .overlay-value {
          font-size: 28px;
          font-weight: 850;
          margin-top: 5px;
        }

        .overlay-value span {
          font-size: 11px;
          color: #64748b;
        }

        .overlay-small {
          margin-top: 4px;
          color: #22d3ee;
          font-size: 10px;
        }

        .map-legend {
          position: absolute;
          right: 42px;
          bottom: 34px;
          display: flex;
          gap: 18px;
          padding: 11px 14px;
          background: rgba(3,10,16,.88);
          border: 1px solid rgba(148,163,184,.15);
          border-radius: 7px;
          font-size: 10px;
          color: #94a3b8;
        }

        .legend-dot {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          margin-right: 5px;
        }

        .selected-panel {
          display: grid;
          grid-template-columns: 2fr repeat(3, 1fr);
          border-top: 1px solid rgba(148,163,184,.12);
        }

        .selected-panel > div {
          padding: 20px 24px;
          border-right: 1px solid rgba(148,163,184,.12);
        }

        .selected-kicker {
          color: #64748b;
          font-size: 9px;
          letter-spacing: .12em;
          font-weight: 800;
        }

        .selected-name {
          margin-top: 7px;
          font-size: 18px;
          font-weight: 800;
        }

        .selected-market {
          color: #64748b;
          margin-top: 5px;
          font-size: 11px;
        }

        .selected-stat span {
          display: block;
          color: #64748b;
          font-size: 9px;
          letter-spacing: .1em;
        }

        .selected-stat strong {
          display: block;
          margin-top: 8px;
          font-size: 17px;
        }

        .online {
          color: #22d3ee;
        }

        .control-grid {
          display: grid;
          grid-template-columns: 1.2fr .8fr;
          gap: 18px;
        }

        .control-card {
          border: 1px solid rgba(148,163,184,.14);
          border-radius: 12px;
          background: #050c13;
          padding: 28px;
        }

        .control-card h3 {
          margin: 0;
          font-size: 15px;
        }

        .control-card p {
          color: #64748b;
          font-size: 12px;
          line-height: 1.6;
        }

        .big-number {
          font-size: 56px;
          font-weight: 850;
          letter-spacing: -.06em;
          margin-top: 25px;
        }

        .big-number span {
          color: #64748b;
          font-size: 15px;
          letter-spacing: 0;
        }

        .bar {
          height: 6px;
          background: #0f1b25;
          border-radius: 99px;
          overflow: hidden;
          margin-top: 18px;
        }

        .bar-inner {
          height: 100%;
          background: #22d3ee;
          transition: width .6s ease;
        }

        .dispatch-btn {
          width: 100%;
          padding: 15px;
          border-radius: 7px;
          border: 1px solid #22d3ee;
          background: rgba(34,211,238,.08);
          color: #67e8f9;
          font-weight: 800;
          cursor: pointer;
          margin-top: 20px;
        }

        .dispatch-btn:hover {
          background: rgba(34,211,238,.15);
        }

        .market-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
        }

        .market-card {
          padding: 25px;
          border: 1px solid rgba(148,163,184,.14);
          border-radius: 12px;
          background: #050c13;
        }

        .market-card .market-name {
          font-size: 12px;
          letter-spacing: .12em;
          font-weight: 800;
        }

        .market-card .market-price {
          font-size: 35px;
          font-weight: 850;
          margin-top: 22px;
        }

        .market-card p {
          color: #64748b;
          font-size: 11px;
          line-height: 1.6;
        }

        .investor {
          border-top: 1px solid rgba(148,163,184,.1);
        }

        .investor-box {
          display: grid;
          grid-template-columns: 1.4fr .6fr;
          gap: 30px;
          align-items: center;
          border: 1px solid rgba(34,211,238,.18);
          border-radius: 16px;
          padding: 45px;
          background:
            radial-gradient(circle at 80% 30%, rgba(34,211,238,.08), transparent 35%),
            #050c13;
        }

        .investor-box h2 {
          font-size: clamp(35px, 4vw, 58px);
          letter-spacing: -.05em;
          line-height: 1;
          margin: 0;
        }

        .investor-box p {
          color: #64748b;
          line-height: 1.7;
          max-width: 680px;
        }

        .revenue-number {
          text-align: right;
        }

        .revenue-number small {
          display: block;
          color: #64748b;
          font-size: 10px;
          letter-spacing: .12em;
        }

        .revenue-number strong {
          display: block;
          font-size: 48px;
          color: #22d3ee;
          margin-top: 8px;
        }

        .footer {
          padding: 40px 7vw;
          border-top: 1px solid rgba(148,163,184,.1);
          display: flex;
          justify-content: space-between;
          color: #475569;
          font-size: 10px;
          letter-spacing: .08em;
        }

        @media (max-width: 1000px) {
          .metrics {
            grid-template-columns: repeat(3, 1fr);
          }

          .control-grid,
          .investor-box {
            grid-template-columns: 1fr;
          }

          .market-grid {
            grid-template-columns: 1fr;
          }

          .selected-panel {
            grid-template-columns: 1fr 1fr;
          }

          .revenue-number {
            text-align: left;
          }

          .nav {
            display: none;
          }
        }

        @media (max-width: 650px) {
          .hero {
            padding-top: 70px;
          }

          .metrics {
            grid-template-columns: 1fr 1fr;
          }

          section {
            padding-top: 75px;
            padding-bottom: 75px;
          }

          .map-container {
            min-height: 430px;
            padding: 5px;
          }

          .us-map {
            height: 430px;
          }

          .map-overlay {
            left: 20px;
            top: 20px;
          }

          .map-legend {
            right: 15px;
            bottom: 15px;
            flex-direction: column;
            gap: 7px;
          }

          .selected-panel {
            grid-template-columns: 1fr 1fr;
          }

          .selected-panel > div {
            padding: 16px;
          }

          .investor-box {
            padding: 28px;
          }

          .footer {
            flex-direction: column;
            gap: 10px;
          }
        }
      `}</style>

      <header className="topbar">
        <div className="brand">
          DRIVE<span>GRID</span>
        </div>

        <nav className="nav">
          <a href="#network">Command Center</a>
          <a href="#dispatch">Dispatch</a>
          <a href="#markets">Markets</a>
          <a href="#investor">Investor</a>
        </nav>

        <div className="demo-pill">
          DEMO / SIMULATED DATA
        </div>
      </header>

      <div className="hero">
        <div className="eyebrow">
          DISTRIBUTED ENERGY INTELLIGENCE
        </div>

        <h1>
          Intelligent Distributed Energy Infrastructure.
        </h1>

        <p>
          DRIVEGRID connects batteries, EVs, solar and
          flexible energy resources into a software-defined
          virtual power plant designed for wholesale energy
          markets.
        </p>

        <div className="hero-actions">
          <button
            className="primary-btn"
            onClick={() =>
              document
                .getElementById("network")
                ?.scrollIntoView()
            }
          >
            RUN VPP SIMULATION →
          </button>

          <button
            className="secondary-btn"
            onClick={() =>
              document
                .getElementById("investor")
                ?.scrollIntoView()
            }
          >
            INVESTOR OVERVIEW
          </button>
        </div>
      </div>

      <div className="metrics">
        <Metric
          label="CONNECTED ASSETS"
          value="12,482"
          sub="+18.6% this month"
        />
        <Metric
          label="VPP CAPACITY"
          value="86.4 MW"
          sub="Across 12 markets"
        />
        <Metric
          label="BATTERY CAPACITY"
          value="51.8 MW"
          sub="Residential + C&I"
        />
        <Metric
          label="EV FLEXIBLE CAPACITY"
          value="24.7 MW"
          sub="Smart charging + V2G"
        />
        <Metric
          label="TODAY'S MARKET REVENUE"
          value={formatMoney(revenue)}
          sub="Simulated"
        />
        <Metric
          label="CUSTOMER REVENUE SHARE"
          value="$944K"
          sub="Monthly"
        />
      </div>

      <section id="network">
        <SectionTitle
          eyebrow="VPP COMMAND CENTER"
          title="A national energy network."
          text="See how distributed energy resources can be coordinated across U.S. wholesale markets in real time."
        />

        <USNetworkMap
          running={running}
          selectedMarket={selectedMarket}
          onSelectNode={(node) => setSelectedNode(node)}
        />
      </section>

      <section id="dispatch">
        <SectionTitle
          eyebrow="DISPATCH ENGINE"
          title="Turn distributed assets into market capacity."
          text="DRIVEGRID continuously evaluates energy prices, state of charge, customer constraints and grid conditions to determine the highest-value dispatch."
        />

        <div className="control-grid">
          <div className="control-card">
            <h3>REAL-TIME DISPATCH</h3>

            <p>
              Simulated portfolio response across
              batteries, EVs and flexible loads.
            </p>

            <div className="big-number">
              {dispatchMW.toFixed(1)}
              <span> MW dispatched</span>
            </div>

            <div className="bar">
              <div
                className="bar-inner"
                style={{
                  width: `${Math.min(
                    100,
                    dispatchMW * 2.5
                  )}%`,
                }}
              />
            </div>

            <button
              className="dispatch-btn"
              onClick={() => setRunning(!running)}
            >
              {running
                ? "PAUSE SIMULATION"
                : "START VPP SIMULATION"}
            </button>
          </div>

          <div className="control-card">
            <h3>PORTFOLIO STATE</h3>

            <p>
              Aggregated battery state of charge across
              the simulated network.
            </p>

            <div className="big-number">
              {soc}
              <span>% average SOC</span>
            </div>

            <div className="bar">
              <div
                className="bar-inner"
                style={{ width: `${soc}%` }}
              />
            </div>

            <p>
              Automated dispatch prioritizes market
              revenue while maintaining customer
              operating constraints.
            </p>
          </div>
        </div>
      </section>

      <section id="markets">
        <SectionTitle
          eyebrow="WHOLESALE MARKETS"
          title="Designed for market participation."
          text="The platform is built around the economics of wholesale energy, ancillary services and flexible distributed capacity."
        />

        <div className="market-grid">
          <div className="market-card">
            <div
              className="market-name"
              style={{ color: marketColors.ERCOT }}
            >
              ERCOT
            </div>

            <div className="market-price">
              $0.19/kWh
            </div>

            <p>
              High-frequency price volatility creates
              opportunities for automated distributed
              energy dispatch.
            </p>
          </div>

          <div className="market-card">
            <div
              className="market-name"
              style={{ color: marketColors.CAISO }}
            >
              CAISO
            </div>

            <div className="market-price">
              $0.24/kWh
            </div>

            <p>
              Solar-heavy grid conditions create strong
              opportunities for storage and flexible load.
            </p>
          </div>

          <div className="market-card">
            <div
              className="market-name"
              style={{ color: marketColors.PJM }}
            >
              PJM
            </div>

            <div className="market-price">
              $0.21/kWh
            </div>

            <p>
              Large interconnected market supporting
              multiple distributed resource opportunities.
            </p>
          </div>
        </div>
      </section>

      <section id="investor" className="investor">
        <div className="investor-box">
          <div>
            <div className="eyebrow">
              INVESTOR DEMONSTRATION
            </div>

            <h2>
              One software layer.
              <br />
              Thousands of energy assets.
            </h2>

            <p>
              DRIVEGRID is designed as a light-asset
              infrastructure platform. Instead of owning
              every battery or EV, the platform aggregates
              third-party distributed resources and
              monetizes their flexibility through energy
              markets.
            </p>

            <button
              className="primary-btn"
              onClick={() => setRunning(true)}
            >
              LAUNCH LIVE DEMO →
            </button>
          </div>

          <div className="revenue-number">
            <small>SIMULATED MONTHLY REVENUE</small>
            <strong>$1.18M</strong>
            <small>
              CUSTOMER SHARE · $944K
            </small>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div>DRIVEGRID ENERGY INTELLIGENCE</div>
        <div>
          DEMO SYSTEM · ALL DATA SIMULATED
        </div>
      </footer>
    </main>
  );
}