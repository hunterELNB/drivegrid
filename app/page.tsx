"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import usAtlasModule from "us-atlas/states-10m.json";

type Market = "ERCOT" | "CAISO" | "PJM";
type MarketFilter = "ALL" | Market;

type Node = {
  city: string;
  state: string;
  market: Market;
  lon: number;
  lat: number;
  mw: number;
  assets: number;
  batteryMW: number;
  evMW: number;
  flexibleMW: number;
  signal: "HIGH" | "MEDIUM" | "LOW";
};

const NODES: Node[] = [
  {
    city: "Dallas",
    state: "TX",
    market: "ERCOT",
    lon: -96.797,
    lat: 32.7767,
    mw: 21.8,
    assets: 842,
    batteryMW: 13.2,
    evMW: 5.4,
    flexibleMW: 3.2,
    signal: "HIGH",
  },
  {
    city: "Houston",
    state: "TX",
    market: "ERCOT",
    lon: -95.3698,
    lat: 29.7604,
    mw: 18.6,
    assets: 716,
    batteryMW: 10.8,
    evMW: 4.9,
    flexibleMW: 2.9,
    signal: "HIGH",
  },
  {
    city: "Austin",
    state: "TX",
    market: "ERCOT",
    lon: -97.7431,
    lat: 30.2672,
    mw: 14.2,
    assets: 531,
    batteryMW: 8.1,
    evMW: 3.7,
    flexibleMW: 2.4,
    signal: "MEDIUM",
  },
  {
    city: "San Antonio",
    state: "TX",
    market: "ERCOT",
    lon: -98.4936,
    lat: 29.4241,
    mw: 11.7,
    assets: 438,
    batteryMW: 6.5,
    evMW: 3.1,
    flexibleMW: 2.1,
    signal: "MEDIUM",
  },
  {
    city: "Los Angeles",
    state: "CA",
    market: "CAISO",
    lon: -118.2437,
    lat: 34.0522,
    mw: 24.5,
    assets: 921,
    batteryMW: 14.6,
    evMW: 6.8,
    flexibleMW: 3.1,
    signal: "HIGH",
  },
  {
    city: "San Francisco",
    state: "CA",
    market: "CAISO",
    lon: -122.4194,
    lat: 37.7749,
    mw: 16.8,
    assets: 604,
    batteryMW: 9.4,
    evMW: 4.6,
    flexibleMW: 2.8,
    signal: "MEDIUM",
  },
  {
    city: "San Diego",
    state: "CA",
    market: "CAISO",
    lon: -117.1611,
    lat: 32.7157,
    mw: 13.6,
    assets: 517,
    batteryMW: 7.9,
    evMW: 3.8,
    flexibleMW: 1.9,
    signal: "HIGH",
  },
  {
    city: "Las Vegas",
    state: "NV",
    market: "CAISO",
    lon: -115.1398,
    lat: 36.1699,
    mw: 9.8,
    assets: 361,
    batteryMW: 5.8,
    evMW: 2.5,
    flexibleMW: 1.5,
    signal: "LOW",
  },
  {
    city: "Philadelphia",
    state: "PA",
    market: "PJM",
    lon: -75.1652,
    lat: 39.9526,
    mw: 19.4,
    assets: 702,
    batteryMW: 11.4,
    evMW: 5.2,
    flexibleMW: 2.8,
    signal: "HIGH",
  },
  {
    city: "New York",
    state: "NY",
    market: "PJM",
    lon: -74.006,
    lat: 40.7128,
    mw: 22.1,
    assets: 811,
    batteryMW: 12.6,
    evMW: 6.2,
    flexibleMW: 3.3,
    signal: "HIGH",
  },
  {
    city: "Columbus",
    state: "OH",
    market: "PJM",
    lon: -82.9988,
    lat: 39.9612,
    mw: 12.8,
    assets: 465,
    batteryMW: 7.2,
    evMW: 3.5,
    flexibleMW: 2.1,
    signal: "MEDIUM",
  },
  {
    city: "Cleveland",
    state: "OH",
    market: "PJM",
    lon: -81.6944,
    lat: 41.4993,
    mw: 10.9,
    assets: 402,
    batteryMW: 6.1,
    evMW: 2.9,
    flexibleMW: 1.9,
    signal: "MEDIUM",
  },
  {
    city: "Cincinnati",
    state: "OH",
    market: "PJM",
    lon: -84.512,
    lat: 39.1031,
    mw: 8.7,
    assets: 326,
    batteryMW: 4.9,
    evMW: 2.4,
    flexibleMW: 1.4,
    signal: "LOW",
  },
  {
    city: "Louisville",
    state: "KY",
    market: "PJM",
    lon: -85.7585,
    lat: 38.2527,
    mw: 7.9,
    assets: 294,
    batteryMW: 4.5,
    evMW: 2.1,
    flexibleMW: 1.3,
    signal: "LOW",
  },
];

const MARKET_COLOR: Record<Market, string> = {
  ERCOT: "#4ade80",
  CAISO: "#60a5fa",
  PJM: "#c084fc",
};

function normalizeAtlas(value: unknown): any {
  const candidate = value as any;

  if (candidate?.objects?.states) {
    return candidate;
  }

  if (candidate?.default?.objects?.states) {
    return candidate.default;
  }

  return candidate?.default ?? candidate;
}

function USNetworkMap({
  market,
  selected,
  onSelect,
}: {
  market: MarketFilter;
  selected: Node | null;
  onSelect: (node: Node) => void;
}) {
  const atlas = useMemo(() => normalizeAtlas(usAtlasModule), []);

  const projection = useMemo(
    () =>
      geoAlbersUsa()
        .scale(1000)
        .translate([470, 260]),
    []
  );

  const pathGenerator = useMemo(
    () => geoPath(projection),
    [projection]
  );

  const states = useMemo(() => {
    try {
      const stateObject = atlas?.objects?.states;

      if (!atlas || !stateObject) {
        return [];
      }

      const result = feature(
        atlas as any,
        stateObject as any
      ) as any;

      return result?.features ?? [];
    } catch (error) {
      console.error(
        "US map data could not be rendered:",
        error
      );

      return [];
    }
  }, [atlas]);

  const visibleNodes =
    market === "ALL"
      ? NODES
      : NODES.filter(
          (node) => node.market === market
        );

  const regionalGroups: Record<Market, Node[]> = {
    ERCOT: NODES.filter(
      (node) => node.market === "ERCOT"
    ),
    CAISO: NODES.filter(
      (node) => node.market === "CAISO"
    ),
    PJM: NODES.filter(
      (node) => node.market === "PJM"
    ),
  };

  const projectPoint = (
    lon: number,
    lat: number
  ) => {
    const point = projection([lon, lat]);

    if (!point) {
      return null;
    }

    return [
      Number(point[0].toFixed(3)),
      Number(point[1].toFixed(3)),
    ] as [number, number];
  };

  return (
    <div className="mapArea">
      <svg
        viewBox="0 0 940 520"
        role="img"
        aria-label="Interactive United States virtual power plant network"
      >
        <rect
          x="0"
          y="0"
          width="940"
          height="520"
          rx="18"
          className="mapBackground"
        />

        {/* United States map */}
        <g>
          {states.map(
            (state: any, index: number) => {
              const d = pathGenerator(state);

              if (!d) {
                return null;
              }

              return (
                <path
                  key={`state-${index}`}
                  d={d}
                  className="state"
                />
              );
            }
          )}
        </g>

        {/* Regional VPP power-flow networks */}
        {(
          ["ERCOT", "CAISO", "PJM"] as Market[]
        ).map((m) => {
          const points = regionalGroups[m]
            .map((node) =>
              projectPoint(
                node.lon,
                node.lat
              )
            )
            .filter(
              (
                point
              ): point is [number, number] =>
                point !== null
            );

          if (points.length < 2) {
            return null;
          }

          const pointString = points
            .map(
              ([x, y]) =>
                `${x},${y}`
            )
            .join(" ");

          const flowPath = points
            .map(
              ([x, y], index) =>
                index === 0
                  ? `M ${x} ${y}`
                  : `L ${x} ${y}`
            )
            .join(" ");

          const isActive =
            market === "ALL" ||
            market === m;

          return (
            <g
              key={`network-${m}`}
              className={`regionalNetwork ${
                isActive
                  ? "regionalActive"
                  : "regionalInactive"
              }`}
            >
              {/* Base regional network */}
              <polyline
                points={pointString}
                fill="none"
                stroke={MARKET_COLOR[m]}
                strokeWidth="1.5"
                strokeDasharray="4 8"
                opacity={
                  isActive ? 0.38 : 0.07
                }
              />

              {/* Animated electricity flow */}
              <path
                d={flowPath}
                fill="none"
                stroke={MARKET_COLOR[m]}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="2 18"
                opacity={
                  isActive ? 0.82 : 0.08
                }
                className="energyFlow"
              />

              {/* Moving energy particles */}
              {isActive && (
                <>
                  <circle
                    r="3.5"
                    fill={MARKET_COLOR[m]}
                    className="energyParticle"
                  >
                    <animateMotion
                      dur="3.2s"
                      repeatCount="indefinite"
                      path={flowPath}
                    />
                  </circle>

                  <circle
                    r="2.8"
                    fill={MARKET_COLOR[m]}
                    className="energyParticle"
                    opacity="0.82"
                  >
                    <animateMotion
                      dur="3.2s"
                      begin="1.05s"
                      repeatCount="indefinite"
                      path={flowPath}
                    />
                  </circle>

                  <circle
                    r="2.2"
                    fill={MARKET_COLOR[m]}
                    className="energyParticle"
                    opacity="0.65"
                  >
                    <animateMotion
                      dur="3.2s"
                      begin="2.1s"
                      repeatCount="indefinite"
                      path={flowPath}
                    />
                  </circle>
                </>
              )}
            </g>
          );
        })}

        {/* City / VPP nodes */}
        {visibleNodes.map((node) => {
          const point = projectPoint(
            node.lon,
            node.lat
          );

          if (!point) {
            return null;
          }

          const x = point[0];
          const y = point[1];

          const active =
            selected?.city === node.city;

          const size = active ? 7 : 4.5;

          return (
            <g
              key={node.city}
              transform={`translate(${x},${y})`}
              className={`mapNode ${
                active
                  ? "mapNodeActive"
                  : ""
              }`}
              onClick={() =>
                onSelect(node)
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" ||
                  event.key === " "
                ) {
                  event.preventDefault();
                  onSelect(node);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${node.city}, ${node.state}, ${node.market}, ${node.mw} megawatts`}
            >
              {/* Outer signal ring */}
              {active && (
                <circle
                  r="12"
                  fill="none"
                  stroke={
                    MARKET_COLOR[
                      node.market
                    ]
                  }
                  strokeWidth="1"
                  opacity="0.55"
                  className="nodePulse"
                />
              )}

              {/* Node glow */}
              <circle
                r={size + 4}
                fill={
                  MARKET_COLOR[
                    node.market
                  ]
                }
                opacity={
                  active
                    ? 0.16
                    : 0.08
                }
              />

              {/* Node */}
              <circle
                r={size}
                fill={
                  MARKET_COLOR[
                    node.market
                  ]
                }
                stroke="#071019"
                strokeWidth="2"
              />

              {/* City name */}
              <text
                x="10"
                y="-7"
                className="nodeName"
              >
                {node.city}
              </text>

              {/* MW label */}
              <text
                x="10"
                y="5"
                className="nodePower"
              >
                {node.mw} MW
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mapLegend">
        <span>
          <i
            style={{
              background:
                MARKET_COLOR.ERCOT,
            }}
          />
          ERCOT
        </span>

        <span>
          <i
            style={{
              background:
                MARKET_COLOR.CAISO,
            }}
          />
          CAISO
        </span>

        <span>
          <i
            style={{
              background:
                MARKET_COLOR.PJM,
            }}
          />
          PJM
        </span>

        <span className="mapHint">
          Click a city to inspect the VPP portfolio
        </span>
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="sectionHeader">
      <div>
        <div className="eyebrow">
          {eyebrow}
        </div>

        <h2>{title}</h2>
      </div>

      <p>{description}</p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="miniMetric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function Home() {

const [formStatus, setFormStatus] = useState<
  "idle" | "sending" | "success" | "error"
>("idle");

const handlePartnerSubmit = async (
  event: React.FormEvent<HTMLFormElement>
) => {
  event.preventDefault();

  setFormStatus("sending");

  const form = event.currentTarget;
  const formData = new FormData(form);

  const data = {
    name: formData.get("partnerName"),
    company: formData.get("partnerCompany"),
    email: formData.get("partnerEmail"),
    phone: formData.get("partnerPhone"),
    message: formData.get("partnerMessage"),
  };

  try {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error("Failed to submit inquiry");
    }

    form.reset();
    setFormStatus("success");
  } catch (error) {
    console.error(error);
    setFormStatus("error");
  }
};

  const [market, setMarket] =
    useState<MarketFilter>("ALL");

  const [selected, setSelected] =
    useState<Node | null>(NODES[0]);

  const [running, setRunning] =
    useState(false);

  const [step, setStep] = useState(0);

  const timerRef =
    useRef<number | null>(null);

  const simulation = [
    21.8,
    27.6,
    31.4,
    28.9,
  ];

  const filteredNodes =
    market === "ALL"
      ? NODES
      : NODES.filter(
          (node) =>
            node.market === market
        );

  const networkMW =
    filteredNodes.reduce(
      (sum, node) =>
        sum + node.mw,
      0
    );

  const networkAssets =
    filteredNodes.reduce(
      (sum, node) =>
        sum + node.assets,
      0
    );

  const dispatchMW =
    simulation[
      Math.min(
        step,
        simulation.length - 1
      )
    ];

  const marketPrice = 200;

  const grossRevenue =
    dispatchMW * marketPrice;

  const platformShare =
    grossRevenue * 0.2;

  const customerShare =
    grossRevenue * 0.8;

  function startSimulation() {
    if (running) {
      return;
    }

    if (timerRef.current) {
      window.clearInterval(
        timerRef.current
      );
    }

    setStep(0);
    setRunning(true);

    let next = 0;

    timerRef.current =
      window.setInterval(() => {
        next += 1;

        if (
          next >=
          simulation.length
        ) {
          setStep(
            simulation.length - 1
          );

          setRunning(false);

          if (
            timerRef.current
          ) {
            window.clearInterval(
              timerRef.current
            );

            timerRef.current = null;
          }

          return;
        }

        setStep(next);
      }, 850);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(
          timerRef.current
        );
      }
    };
  }, []);

  return (
    <main>
      <style jsx global>{`
        :root {
          color-scheme: dark;
        }

        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: #05080d;
          color: #e8eef5;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        button {
          font: inherit;
        }

.page {
  min-height: 100vh;
  background: #05080d;
}

        .container {
          width: min(
            1180px,
            calc(100% - 36px)
          );
          margin: auto;
        }

        .nav {
          height: 150px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid
            #17212c;
        }

.brand {
  font-weight: 900;
  letter-spacing: 0.16em;
  font-size: 18px;
  display: flex;
  align-items: center;
  padding-top: 50px;
}

.brand img {
  width: 360px;
  height: 100px;
  object-fit: contain;
  object-position: left center;
  display: block;
}


        .brand span {
          color: #67e8f9;
          margin-left: 5px;
        }

        .navLinks {
          display: flex;
          gap: 25px;
          color: #7d8b9c;
          font-size: 18px;
          font-weight: 700;
        }

        .navLinks a:hover {
          color: white;
        }

.hero {
  padding: 105px 0 90px;
  display: grid;
  grid-template-columns:
    1.15fr 0.85fr;
  gap: 60px;
  align-items: center;
  min-height: 620px;
  position: relative;
  background:
    linear-gradient(
      90deg,
      rgba(5, 8, 13, 0.88) 0%,
      rgba(5, 8, 13, 0.68) 45%,
      rgba(5, 8, 13, 0.38) 100%
    ),
    url("/hero.png") center / cover no-repeat;

}



        .eyebrow {
          color: #67e8f9;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        h1 {
          margin: 18px 0 25px;
          font-size: clamp(
            46px,
            7vw,
            82px
          );
          line-height: 0.96;
          letter-spacing: -0.055em;
          max-width: 850px;
        }

        .heroText {
          color: #9ba8b7;
          font-size: 18px;
          line-height: 1.65;
          max-width: 690px;
        }

        .actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 30px;
        }

        .btn {
          border: 1px solid #273542;
          background: #0b1119;
          color: white;
          padding: 13px 18px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 900;
          transition:
            transform 0.2s ease,
            border-color 0.2s ease;
        }

        .btn:hover {
          border-color: #526579;
          transform: translateY(-1px);
        }

        .btn:disabled {
          cursor: default;
          opacity: 0.65;
          transform: none;
        }

        .btnPrimary {
          background: #dffbff;
          color: #071015;
          border-color: #dffbff;
        }

        .heroPanel {
          border: 1px solid #1d2a38;
          border-radius: 22px;
          padding: 22px;
          background:
            linear-gradient(
              145deg,
              rgba(
                13,
                22,
                33,
                0.98
              ),
              rgba(
                7,
                11,
                17,
                0.98
              )
            );
        }

        .heroCards {
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 9px;
          margin-top: 16px;
        }

        .heroCard {
          min-height: 145px;
          border: 1px solid #1c2b39;
          border-radius: 15px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .heroCard span {
          color: #6f7e90;
          font-size: 10px;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .heroCard strong {
          font-size: 24px;
        }

        .heroCard small {
          color: #738396;
          line-height: 1.4;
        }

        section {
          padding: 92px 0;
          border-top: 1px solid
            #111a23;
        }

        .sectionHeader {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 40px;
          margin-bottom: 34px;
        }

        .sectionHeader h2 {
          font-size: 39px;
          line-height: 1.08;
          letter-spacing: -0.04em;
          margin: 9px 0 0;
          max-width: 720px;
        }

        .sectionHeader p {
          margin: 0;
          max-width: 530px;
          color: #8290a0;
          line-height: 1.65;
          font-size: 14px;
        }

        .flow {
          display: grid;
          grid-template-columns:
            repeat(7, 1fr);
          gap: 8px;
        }

        .flowBox {
          min-height: 115px;
          border: 1px solid #1b2936;
          border-radius: 13px;
          background: #080e15;
          padding: 15px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          text-align: center;
        }

        .flowBox strong {
          font-size: 12px;
        }

        .flowBox span {
          color: #657589;
          font-size: 10px;
          line-height: 1.45;
          margin-top: 8px;
        }

        .grid3 {
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 15px;
        }

        .grid2 {
          display: grid;
          grid-template-columns:
            repeat(2, 1fr);
          gap: 15px;
        }

        .card {
          border: 1px solid #1a2734;
          border-radius: 17px;
          background: #091019;
          padding: 23px;
        }

        .card h3 {
          margin: 0 0 10px;
          font-size: 19px;
        }

        .card p {
          margin: 0;
          color: #8492a3;
          font-size: 13px;
          line-height: 1.65;
        }

        .tag {
          display: inline-flex;
          border: 1px solid #293746;
          border-radius: 999px;
          padding: 5px 9px;
          color: #94a4b5;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
        }

        .phaseGrid {
          display: grid;
          grid-template-columns:
            repeat(3, 1fr);
          gap: 15px;
          margin-top: 16px;
        }

        .phase {
          position: relative;
          padding-left: 66px;
        }

        .phaseNumber {
          position: absolute;
          left: 22px;
          top: 22px;
          width: 32px;
          height: 32px;
          border: 1px solid #2d3c4c;
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: #67e8f9;
          font-size: 12px;
          font-weight: 900;
        }

        .network {
          border: 1px solid #1b2937;
          border-radius: 21px;
          overflow: hidden;
          background: #070d14;
        }

        .networkBar {
          padding: 18px 20px;
          border-bottom: 1px solid
            #182531;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
        }

        .networkTitle strong {
          display: block;
          font-size: 17px;
        }

        .networkTitle span {
          color: #68798b;
          font-size: 11px;
          margin-top: 5px;
          display: block;
        }

        .tabs {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .tab {
          background: #0a1119;
          border: 1px solid #273543;
          color: #8391a1;
          border-radius: 8px;
          padding: 9px 13px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 900;
        }

        .tab.active {
          color: white;
          border-color: #4b5e71;
          background: #17232f;
        }

        .networkBody {
          display: grid;
          grid-template-columns:
            minmax(0, 1fr) 300px;
        }

        .mapArea {
          padding: 18px;
          border-right: 1px solid
            #182531;
        }

        .mapArea svg {
          width: 100%;
          display: block;
        }

        .mapBackground {
          fill: #060b11;
        }

        .state {
          fill: #0b151f;
          stroke: #1c2b39;
          stroke-width: 0.75;
        }

        .mapNode {
          cursor: pointer;
          outline: none;
        }

        .mapNode:focus {
          outline: none;
        }

        .mapNode:hover
          circle:last-of-type {
          filter: brightness(1.3);
        }

        .nodeName {
          fill: #dce5ee;
          font-size: 9px;
          font-weight: 800;
          pointer-events: none;
        }

        .nodePower {
          fill: #65778a;
          font-size: 8px;
          pointer-events: none;
        }

        /*
          Regional electricity animation.
          The dash pattern moves continuously along
          the regional VPP connection.
        */
        .energyFlow {
          animation:
            energyFlowMove 1.2s linear
            infinite;
        }

        @keyframes energyFlowMove {
          from {
            stroke-dashoffset: 0;
          }

          to {
            stroke-dashoffset: -20;
          }
        }

        .energyParticle {
          filter:
            drop-shadow(
              0 0 4px currentColor
            );
        }

        .nodePulse {
          animation:
            nodePulseAnimation 2s
            ease-out infinite;
        }

        @keyframes nodePulseAnimation {
          0% {
            opacity: 0.7;
            transform: scale(0.7);
          }

          70% {
            opacity: 0;
            transform: scale(1.35);
          }

          100% {
            opacity: 0;
            transform: scale(1.35);
          }
        }

        .regionalInactive {
          transition: opacity 0.25s ease;
        }

        .regionalActive {
          transition: opacity 0.25s ease;
        }

        .mapLegend {
          display: flex;
          align-items: center;
          gap: 17px;
          flex-wrap: wrap;
          padding: 10px 3px 0;
          color: #748396;
          font-size: 10px;
        }

        .mapLegend span {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .mapLegend i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          display: inline-block;
        }

        .mapHint {
          margin-left: auto;
        }

        .sidePanel {
          padding: 20px;
        }

        .sidePanel h3 {
          margin: 0;
          font-size: 20px;
        }

        .muted {
          color: #69798b;
          font-size: 11px;
        }

        .signal {
          border: 1px solid #1d2b38;
          border-radius: 12px;
          padding: 15px;
          margin: 18px 0;
        }

        .signalLabel {
          color: #697b8e;
          font-size: 10px;
          letter-spacing: 0.1em;
        }

        .signal strong {
          display: block;
          margin-top: 5px;
          font-size: 25px;
        }

        .signal small {
          color: #6d7e90;
          display: block;
          margin-top: 4px;
        }

        .miniGrid {
          display: grid;
          grid-template-columns:
            1fr 1fr;
          gap: 8px;
        }

        .miniMetric {
          padding: 12px;
          background: #0a1119;
          border: 1px solid #172431;
          border-radius: 10px;
        }

        .miniMetric span {
          display: block;
          color: #67798c;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .miniMetric strong {
          display: block;
          margin-top: 5px;
          font-size: 14px;
        }

        .simBar {
          padding: 16px 20px;
          border-top: 1px solid
            #182531;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          flex-wrap: wrap;
        }

        .simStatus {
          color: #7d8d9e;
          font-size: 11px;
        }

        .simCharts {
          display: grid;
          grid-template-columns:
            1fr 1fr;
          gap: 15px;
          margin-top: 15px;
        }

        .chartCard {
          border: 1px solid #1a2734;
          border-radius: 16px;
          background: #091019;
          padding: 20px;
        }

        .chartTitle {
          font-weight: 900;
          font-size: 14px;
        }

        .chartSub {
          color: #68798c;
          font-size: 10px;
          margin-top: 4px;
        }

        .bars {
          height: 190px;
          display: flex;
          align-items: end;
          gap: 13px;
          padding: 25px 8px 24px;
        }

        .barColumn {
          flex: 1;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: end;
          align-items: center;
          position: relative;
        }

        .barValue {
          color: #b9c6d3;
          font-size: 9px;
          margin-bottom: 5px;
        }

        .bar {
          width: 100%;
          max-width: 55px;
          min-height: 8px;
          border-radius: 5px 5px 0 0;
          background:
            linear-gradient(
              to top,
              #2563eb,
              #67e8f9
            );
          transition:
            height 0.4s ease;
        }

        .barLabel {
          position: absolute;
          bottom: -20px;
          color: #637489;
          font-size: 9px;
        }

        .revenueNumber {
          font-size: 42px;
          font-weight: 900;
          letter-spacing: -0.045em;
          margin: 20px 0 6px;
        }

        .revenueCaption {
          color: #718196;
          font-size: 11px;
        }

        .revenueRows {
          margin-top: 20px;
          border-top: 1px solid
            #172430;
        }

        .revenueRow {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 10px 0;
          border-bottom: 1px solid
            #172430;
          color: #7f8e9f;
          font-size: 11px;
        }

        .revenueRow strong {
          color: #dce6ef;
        }

        .formula {
          margin-top: 15px;
          padding: 12px;
          border: 1px dashed
            #2a3948;
          border-radius: 10px;
          color: #78899b;
          font-size: 10px;
          line-height: 1.7;
        }

        .partnerGrid {
          display: grid;
          grid-template-columns:
            1fr 1fr;
          gap: 15px;
        }

        .partnerCard {
          min-height: 260px;
        }

        .partnerLabel {
          color: #67e8f9;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .benefits {
          display: grid;
          grid-template-columns:
            repeat(5, 1fr);
          gap: 10px;
        }

        .benefit {
          padding: 19px;
          border: 1px solid #1a2734;
          border-radius: 14px;
          background: #080e15;
        }

        .benefit strong {
          display: block;
          font-size: 13px;
          margin-bottom: 8px;
        }

        .benefit span {
          color: #718196;
          font-size: 11px;
          line-height: 1.55;
        }

        .flywheel {
          display: grid;
          grid-template-columns:
            repeat(6, 1fr);
          gap: 9px;
          align-items: center;
        }

        .wheel {
          width: 145px;
          height: 145px;
          margin: auto;
          border: 1px solid #253443;
          border-radius: 50%;
          display: grid;
          place-items: center;
          text-align: center;
          padding: 22px;
          background: #09111a;
        }

        .wheel strong {
          font-size: 12px;
          line-height: 1.35;
        }

        .compute {
          display: grid;
          grid-template-columns:
            1fr 1fr;
          gap: 15px;
        }

        .computeVisual {
          border: 1px solid #1b2a38;
          border-radius: 17px;
          padding: 28px;
          background: #080f17;
        }

        .computeFlow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 45px;
        }

        .computeBox {
          border: 1px solid #293846;
          border-radius: 11px;
          padding: 16px 10px;
          min-width: 82px;
          text-align: center;
        }

        .computeBox strong {
          display: block;
          font-size: 11px;
        }

        .computeBox span {
          display: block;
          color: #697b8e;
          font-size: 9px;
          margin-top: 5px;
        }

        .roadmap {
          display: grid;
          grid-template-columns:
            repeat(4, 1fr);
          gap: 10px;
        }

        .road {
          border-top: 2px solid
            #2b3c4d;
          background: #080e15;
          border-radius: 0 0 13px 13px;
          padding: 21px;
        }

        .road strong {
          font-size: 29px;
        }

        .road span {
          display: block;
          color: #708095;
          font-size: 11px;
          margin-top: 7px;
        }

        .cta {
          text-align: center;
          padding: 110px 20px;
        }

        .cta h2 {
          margin: 10px auto 18px;
          max-width: 820px;
          font-size: clamp(
            40px,
            6vw,
            65px
          );
          line-height: 1;
          letter-spacing: -0.05em;
        }

        .cta p {
          max-width: 650px;
          margin: auto;
          color: #8291a2;
          line-height: 1.65;
        }

        footer {
          border-top: 1px solid
            #17212c;
          padding: 27px 0;
          color: #596a7c;
          font-size: 11px;
          display: flex;
          justify-content: space-between;
          gap: 20px;
        }


.partnerForm {
  max-width: 980px;
  margin: 0 auto;
  padding: 42px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 20px;
  background: rgba(10, 15, 22, 0.72);
  backdrop-filter: blur(12px);
}

.formGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

.formField {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.formField label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #9ca3af;
}

.formField input,
.formField textarea {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.045);
  color: #ffffff;
  padding: 14px 16px;
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s ease,
    background 0.2s ease;
  box-sizing: border-box;
}

.formField input {
  height: 50px;
}

.formField textarea {
  min-height: 150px;
  resize: vertical;
  margin-bottom: 26px;
}

.formField input::placeholder,
.formField textarea::placeholder {
  color: #6b7280;
}

.formField input:focus,
.formField textarea:focus {
  border-color: rgba(96, 165, 250, 0.7);
  background: rgba(255, 255, 255, 0.07);
}

.partnerForm .btn {
  min-width: 170px;
  justify-content: center;
}

@media (max-width: 700px) {
  .partnerForm {
    padding: 24px;
  }

  .formGrid {
    grid-template-columns: 1fr;
    gap: 18px;
  }
}


        @media (max-width: 950px) {
          .hero,
          .grid2,
          .compute,
          .partnerGrid {
            grid-template-columns: 1fr;
          }

          .networkBody {
            grid-template-columns: 1fr;
          }

          .mapArea {
            border-right: 0;
            border-bottom: 1px solid
              #182531;
          }

          .grid3,
          .phaseGrid {
            grid-template-columns: 1fr;
          }

          .flow {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .benefits {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .flywheel {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .roadmap {
            grid-template-columns:
              repeat(2, 1fr);
          }
        }

        @media (max-width: 650px) {
          .container {
            width: calc(
              100% - 24px
            );
          }

          .navLinks {
            display: none;
          }

          .hero {
            padding: 65px 0;
          }

          .heroCards {
            grid-template-columns: 1fr;
          }

          section {
            padding: 65px 0;
          }

          .sectionHeader {
            display: block;
          }

          .sectionHeader h2 {
            font-size: 31px;
          }

          .flow {
            grid-template-columns: 1fr;
          }

          .benefits,
          .roadmap {
            grid-template-columns: 1fr;
          }

          .flywheel {
            grid-template-columns:
              1fr 1fr;
          }

          .wheel {
            width: 125px;
            height: 125px;
          }

          .simCharts {
            grid-template-columns: 1fr;
          }

          .mapHint {
            width: 100%;
            margin-left: 0;
          }

          footer {
            display: block;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          html {
            scroll-behavior: auto;
          }

          .energyFlow,
          .nodePulse {
            animation: none;
          }
        }
      `}</style>

      <div className="page">
        <div className="container">
          <nav className="nav">
      
<div className="brand">
  <img src="/logo.png" alt="DRIVEGRID" />
</div>

            <div className="navLinks">
              <a href="#model">
                Business Model
              </a>

              <a href="#ecosystem">
                Ecosystem
              </a>

              <a href="#network">
                VPP Network
              </a>

              <a href="#partners">
                Automakers
              </a>

              <a href="#computing">
                Computing
              </a>
            </div>
          </nav>

          <header className="hero">
            <div>
              <div className="eyebrow">
                EV + ENERGY + VPP
              </div>

              <h1>
                The Intelligent Energy Platform for the Next EV Economy.
              </h1>

              <p className="heroText">
                DRIVEGRID connects electric
                vehicles, distributed energy
                assets and wholesale power
                markets — turning energy
                flexibility into recurring
                economic value for customers,
                automakers and asset owners.
              </p>

              <div className="actions">
                <a
                  className="btn btnPrimary"
                  href="#network"
                >
                  Explore VPP Demo
                </a>

                <a
                  className="btn"
                  href="#model"
                >
                  See the Business Model
                </a>
              </div>
            </div>

            <div className="heroPanel">
              <div className="eyebrow">
                CORE PLATFORM
              </div>

              <div className="heroCards">
                <div className="heroCard">
                  <span>
                    Mobility
                  </span>

                  <strong>EV</strong>

                  <small>
                    The vehicle becomes a
                    connected energy asset.
                  </small>
                </div>

                <div className="heroCard">
                  <span>
                    Distributed
                  </span>

                  <strong>ENERGY</strong>

                  <small>
                    Solar · battery · charger
                    · EMS.
                  </small>
                </div>

                <div className="heroCard">
                  <span>
                    Market
                  </span>

                  <strong>VPP</strong>

                  <small>
                    AI optimization ·
                    dispatch · wholesale
                    markets.
                  </small>
                </div>
              </div>
            </div>
          </header>

          <section id="model">
            <SectionHeader
              eyebrow="THE BUSINESS MODEL"
              title="Convert recurring energy value into EV purchasing power."
              description="Instead of treating the EV as the end of the transaction, DRIVEGRID makes the vehicle the entry point into a long-term distributed-energy relationship."
            />

            <div className="flow">
              {[
                [
                  "EV SALES",
                  "Customer acquisition",
                ],
                [
                  "EV + ENERGY",
                  "Solar · battery · charger",
                ],
                [
                  "DRIVEGRID",
                  "Unified platform",
                ],
                [
                  "VPP + AI",
                  "Optimize & dispatch",
                ],
                [
                  "POWER MARKETS",
                  "Wholesale value",
                ],
                [
                  "ENERGY REVENUE",
                  "Recurring value",
                ],
                [
                  "CUSTOMER VALUE",
                  "Savings · sharing · financing",
                ],
              ].map(
                ([title, subtitle]) => (
                  <div
                    className="flowBox"
                    key={title}
                  >
                    <strong>
                      {title}
                    </strong>

                    <span>
                      {subtitle}
                    </span>
                  </div>
                )
              )}
            </div>

            <div
              className="grid3"
              style={{
                marginTop: 15,
              }}
            >
              <div className="card">
                <h3>
                  From one-time sale to recurring relationship
                </h3>

                <p>
                  Energy services extend the
                  customer relationship beyond
                  vehicle delivery and create an
                  additional economic layer
                  around every EV.
                </p>
              </div>

              <div className="card">
                <h3>
                  From energy consumer to mobile energy asset
                </h3>

                <p>
                  Smart charging — and
                  eventually V2G — allows EV
                  batteries to participate in a
                  coordinated distributed-energy
                  portfolio.
                </p>
              </div>

              <div className="card">
                <h3>
                  Convert future value into today's competitiveness
                </h3>

                <p>
                  DRIVEGRID can return part of
                  the economic value created by
                  energy assets through savings,
                  incentives, financing benefits
                  and revenue sharing.
                </p>
              </div>
            </div>
          </section>

          <section id="ecosystem">
            <SectionHeader
              eyebrow="DRIVEGRID EV & ENERGY ECOSYSTEM"
              title="One customer. One energy account. One platform."
              description="DRIVEGRID integrates EVs, solar, home storage, charging infrastructure, EMS and future V2G capability into one operating layer."
            />

            <div className="grid3">
              {[
                [
                  "EV",
                  "The mobility asset and customer acquisition channel.",
                ],
                [
                  "SOLAR",
                  "Local generation that increases energy flexibility.",
                ],
                [
                  "HOME BATTERY",
                  "Dispatchable storage for bill optimization and wholesale participation.",
                ],
                [
                  "EV CHARGER",
                  "Smart charging infrastructure connecting mobility and the grid.",
                ],
                [
                  "EMS",
                  "Unified energy control, monitoring and customer account layer.",
                ],
                [
                  "V2G",
                  "Future bidirectional EV participation in the VPP.",
                ],
              ].map(
                ([name, description]) => (
                  <div
                    className="card"
                    key={name}
                  >
                    <span className="tag">
                      {name}
                    </span>

                    <p
                      style={{
                        marginTop: 14,
                      }}
                    >
                      {description}
                    </p>
                  </div>
                )
              )}
            </div>

            <div className="phaseGrid">
              <div className="card phase">
                <div className="phaseNumber">
                  1
                </div>

                <h3>
                  Home storage first
                </h3>

                <p>
                  Solar → Home Battery →
                  DRIVEGRID VPP → Electricity
                  Market. Build the customer
                  energy account, device
                  connectivity and
                  market-operations foundation
                  using mature storage technology.
                </p>
              </div>

              <div className="card phase">
                <div className="phaseNumber">
                  2
                </div>

                <h3>
                  EV smart charging + V2G
                </h3>

                <p>
                  Solar ↔ Home Battery ↔ EV ↔
                  DRIVEGRID VPP ↔ Grid. Add
                  bidirectional EVs as vehicles,
                  chargers, interconnection and
                  regulations mature.
                </p>
              </div>

              <div className="card phase">
                <div className="phaseNumber">
                  3
                </div>

                <h3>
                  Integrated energy ecosystem
                </h3>

                <p>
                  Continuously optimize
                  generation, storage, charging
                  and flexible loads while
                  managing the customer energy
                  account and market participation.
                </p>
              </div>
            </div>
          </section>

          <section id="network">
            <SectionHeader
              eyebrow="NATIONAL VPP NETWORK"
              title="Market signal → AI optimization → dispatch → revenue."
              description="Interactive investor demonstration. Figures shown here are illustrative demo assumptions, not live market data or commercial guarantees."
            />

            <div className="network">
              <div className="networkBar">
                <div className="networkTitle">
                  <strong>
                    NATIONAL VPP NETWORK
                  </strong>

                  <span>
                    Distributed assets across
                    major U.S. power markets
                  </span>
                </div>

                <div className="tabs">
                  {(
                    [
                      "ALL",
                      "ERCOT",
                      "CAISO",
                      "PJM",
                    ] as MarketFilter[]
                  ).map((item) => (
                    <button
                      key={item}
                      className={`tab ${
                        market === item
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setMarket(item)
                      }
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="networkBar">
                <div className="networkTitle">
                  <strong>
                    AI OPTIMIZATION ENGINE
                  </strong>

                  <span>
                    Price-aware portfolio
                    dispatch and asset
                    coordination
                  </span>
                </div>

                <span className="tag">
                  OPTIMIZATION ACTIVE
                </span>
              </div>

              <div className="networkBody">
                <div className="mapArea">
                  <USNetworkMap
                    market={market}
                    selected={selected}
                    onSelect={setSelected}
                  />

                  <div className="simBar">
                    <div className="simStatus">
                      {running
                        ? `SIMULATION RUNNING · STEP ${
                            step + 1
                          } / ${
                            simulation.length
                          }`
                        : "READY · MARKET SIGNAL DETECTED"}
                    </div>

                    <button
                      className="btn btnPrimary"
                      onClick={
                        startSimulation
                      }
                      disabled={running}
                    >
                      {running
                        ? "RUNNING..."
                        : "RUN VPP SIMULATION"}
                    </button>
                  </div>
                </div>

                <aside className="sidePanel">
                  <h3>
                    {selected?.city ??
                      "Portfolio"}
                  </h3>

                  <div className="muted">
                    {selected?.market} ·{" "}
                    {selected?.state}
                  </div>

                  <div className="signal">
                    <div className="signalLabel">
                      MARKET SIGNAL
                    </div>

                    <strong>
                      ${marketPrice}/MWh
                    </strong>

                    <small>
                      Illustrative dispatch
                      scenario
                    </small>
                  </div>

                  <div className="miniGrid">
                    <MiniMetric
                      label="Portfolio"
                      value={`${
                        selected?.mw ?? 0
                      } MW`}
                    />

                    <MiniMetric
                      label="Assets"
                      value={`${selected?.assets ?? 0}`}
                    />

                    <MiniMetric
                      label="Battery"
                      value={`${
                        selected?.batteryMW ??
                        0
                      } MW`}
                    />

                    <MiniMetric
                      label="EV"
                      value={`${
                        selected?.evMW ?? 0
                      } MW`}
                    />

                    <MiniMetric
                      label="Flexible"
                      value={`${
                        selected?.flexibleMW ??
                        0
                      } MW`}
                    />

                    <MiniMetric
                      label="Signal"
                      value={
                        selected?.signal ??
                        "—"
                      }
                    />
                  </div>
                </aside>
              </div>
            </div>

            <div
              className="grid3"
              style={{
                marginTop: 15,
              }}
            >
              <div className="card">
                <h3>
                  Market signal
                </h3>

                <p>
                  Detect price opportunities
                  and operating conditions
                  across participating power
                  markets.
                </p>
              </div>

              <div className="card">
                <h3>
                  AI optimization
                </h3>

                <p>
                  Coordinate batteries, EVs
                  and flexible resources
                  against market signals and
                  portfolio constraints.
                </p>
              </div>

              <div className="card">
                <h3>
                  Dispatch command
                </h3>

                <p>
                  Convert the optimized
                  portfolio decision into
                  coordinated distributed-asset
                  dispatch.
                </p>
              </div>
            </div>

            <div className="simCharts">
              <div className="chartCard">
                <div className="chartTitle">
                  VPP Power Dispatch
                </div>

                <div className="chartSub">
                  Simulation output · MW
                </div>

                <div className="bars">
                  {simulation.map(
                    (
                      value,
                      index
                    ) => {
                      const height =
                        (value / 35) *
                        100;

                      return (
                        <div
                          className="barColumn"
                          key={`${value}-${index}`}
                        >
                          <div className="barValue">
                            {value} MW
                          </div>

                          <div
                            className="bar"
                            style={{
                              height: `${height}%`,
                            }}
                          />

                          <div className="barLabel">
                            T{index + 1}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="chartCard">
                <div className="chartTitle">
                  Illustrative Revenue
                </div>

                <div className="chartSub">
                  Current dispatch scenario
                </div>

                <div className="revenueNumber">
                  $
                  {Math.round(
                    platformShare
                  ).toLocaleString()}
                </div>

                <div className="revenueCaption">
                  DRIVEGRID platform share ·
                  20% demo assumption
                </div>

                <div className="revenueRows">
                  <div className="revenueRow">
                    <span>
                      Dispatch
                    </span>

                    <strong>
                      {dispatchMW} MW
                    </strong>
                  </div>

                  <div className="revenueRow">
                    <span>
                      Duration
                    </span>

                    <strong>
                      1.0 hr
                    </strong>
                  </div>

                  <div className="revenueRow">
                    <span>
                      Market price
                    </span>

                    <strong>
                      ${marketPrice}/MWh
                    </strong>
                  </div>

                  <div className="revenueRow">
                    <span>
                      Gross revenue
                    </span>

                    <strong>
                      $
                      {Math.round(
                        grossRevenue
                      ).toLocaleString()}
                    </strong>
                  </div>

                  <div className="revenueRow">
                    <span>
                      Customer / asset owner
                      share
                    </span>

                    <strong>
                      $
                      {Math.round(
                        customerShare
                      ).toLocaleString()}
                    </strong>
                  </div>

                  <div className="revenueRow">
                    <span>
                      DRIVEGRID platform
                      share
                    </span>

                    <strong>
                      $
                      {Math.round(
                        platformShare
                      ).toLocaleString()}
                    </strong>
                  </div>
                </div>

                <div className="formula">
                  Dispatch MW × 1.0 hr ×
                  $200/MWh = Gross Market
                  Revenue
                  <br />
                  Gross Revenue × 20% =
                  Illustrative DRIVEGRID
                  Platform Revenue
                </div>
              </div>
            </div>

            <div
              className="card"
              style={{
                marginTop: 15,
              }}
            >
              <h3>
                Demo network snapshot
              </h3>

              <div
                className="miniGrid"
                style={{
                  marginTop: 15,
                }}
              >
                <MiniMetric
                  label="Selected market"
                  value={market}
                />

                <MiniMetric
                  label="Network MW"
                  value={`${networkMW.toFixed(
                    1
                  )} MW`}
                />

                <MiniMetric
                  label="Connected assets"
                  value={networkAssets.toLocaleString()}
                />

                <MiniMetric
                  label="Simulation dispatch"
                  value={`${dispatchMW} MW`}
                />
              </div>
            </div>
          </section>

          <section>
            <SectionHeader
              eyebrow="HOW DRIVEGRID MAKES MONEY"
              title="Capture economic value created by flexible energy assets."
              description="The platform monetizes distributed flexibility through multiple market and service channels rather than relying on a single revenue stream."
            />

            <div className="grid3">
              <div className="card">

                <h3
                  style={{
                    marginTop: 15,
                  }}
                >
                  Energy Market Revenue
                </h3>

                <p>
                  Storage and flexible
                  resources participate in
                  energy markets, price
                  optimization and energy
                  arbitrage where qualified.
                </p>
              </div>

              <div className="card">
        
                <h3
                  style={{
                    marginTop: 15,
                  }}
                >
                  Ancillary Services
                </h3>

                <p>
                  Frequency regulation,
                  reserves and other
                  ancillary-market
                  opportunities subject to
                  market qualification and
                  resource capabilities.
                </p>
              </div>

              <div className="card">
           
                <h3
                  style={{
                    marginTop: 15,
                  }}
                >
                  Capacity / Resource Adequacy
                </h3>

                <p>
                  Monetize qualifying capacity
                  and resource-adequacy value
                  in markets where these
                  mechanisms are available.
                </p>
              </div>

              <div className="card">
            
                <h3
                  style={{
                    marginTop: 15,
                  }}
                >
                  EV-VPP Revenue Sharing
                </h3>

                <p>
                  EVs and charging assets can
                  become VPP resources, with
                  market value shared according
                  to customer and partner
                  agreements.
                </p>
              </div>

              <div className="card">
              
                <h3
                  style={{
                    marginTop: 15,
                  }}
                >
                  Platform & Service Revenue
                </h3>

                <p>
                  Provide software, energy
                  operations and VPP services
                  for commercial customers,
                  energy partners and OEMs.
                </p>
              </div>

              <div className="card">
            
                <h3
                  style={{
                    marginTop: 15,
                  }}
                >
                  Customer Energy Services
                </h3>

                <p>
                  Device monitoring,
                  optimization, charging,
                  maintenance and ongoing
                  energy-account services
                  create additional customer
                  relationships.
                </p>
              </div>
            </div>
          </section>

          <section id="partners">
            <SectionHeader
              eyebrow="AUTOMAKER PARTNERSHIP"
              title="Two paths for automakers to enter the energy economy."
              description="DRIVEGRID can support automakers with or without an existing green-energy product portfolio."
            />

            <div className="partnerGrid">
              <div className="card partnerCard">
                <div className="partnerLabel">
                  MODEL A
                </div>

                <h3
                  style={{
                    marginTop: 12,
                  }}
                >
                  Automaker with its own energy products
                </h3>

                <p>
                  The automaker provides EVs,
                  solar, inverters, home
                  batteries and related
                  products. DRIVEGRID focuses
                  on U.S. installation and
                  delivery, VPP technical
                  integration, electricity-market
                  operations, customer service
                  and financing solutions.
                </p>

                <div className="modelRows">
                  {[
                    "Automaker products",
                    "DRIVEGRID integration",
                    "VPP operations",
                    "Wholesale market participation",
                    "Joint customer benefits",
                  ].map((item) => (
                    <div
                      className="revenueRow"
                      key={item}
                    >
                      <span>
                        {item}
                      </span>

                      <strong>
                        CONNECTED
                      </strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card partnerCard">
                <div className="partnerLabel">
                  MODEL B
                </div>

                <h3
                  style={{
                    marginTop: 12,
                  }}
                >
                  Automaker without its own energy products
                </h3>

                <p>
                  DRIVEGRID supplies access
                  to a mature energy supply
                  chain and installation
                  network, enabling the
                  automaker to launch a branded
                  EV + energy package with VPP,
                  electricity trading and
                  financing services.
                </p>

                <div className="modelRows">
                  {[
                    "EV brand",
                    "DRIVEGRID energy package",
                    "VPP platform",
                    "Electricity-market services",
                    "Financing & customer benefits",
                  ].map((item) => (
                    <div
                      className="revenueRow"
                      key={item}
                    >
                      <span>
                        {item}
                      </span>

                      <strong>
                        READY
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section>
            <SectionHeader
              eyebrow="CUSTOMER VALUE"
              title="Use energy value to reduce the effective cost of EV ownership."
              description="The objective is not simply a larger upfront discount. DRIVEGRID converts recurring energy economics into customer-facing financial and marketing benefits."
            />

            <div className="benefits">
              {[
                [
                  "EV incentives",
                  "Use energy economics to strengthen EV purchase incentives.",
                ],
                [
                  "Battery discounts",
                  "Bundle home storage with EV purchases and reduce package cost.",
                ],
                [
                  "Charging credits",
                  "Reward customers through smart-charging participation.",
                ],
                [
                  "Bill savings",
                  "Optimize energy consumption, storage and charging.",
                ],
                [
                  "VPP revenue sharing",
                  "Return qualifying market value to participating customers.",
                ],
                [
                  "Low-down-payment financing",
                  "Combine energy-equipment financing with the vehicle purchase.",
                ],
                [
                  "Future-value advance",
                  "Where risk is controlled, advance part of expected future energy value.",
                ],
                [
                  "Whole-home energy management",
                  "Coordinate solar, battery, EV and flexible loads.",
                ],
                [
                  "Ongoing service",
                  "Monitoring, maintenance, upgrades and energy-account management.",
                ],
                [
                  "Lower total ownership cost",
                  "Turn recurring energy value into a long-term EV ownership benefit.",
                ],
              ].map(
                ([title, description]) => (
                  <div
                    className="benefit"
                    key={title}
                  >
                    <strong>
                      {title}
                    </strong>

                    <span>
                      {description}
                    </span>
                  </div>
                )
              )}
            </div>
          </section>

          <section>
            <SectionHeader
              eyebrow="DRIVEGRID FLYWHEEL"
              title="More EVs can create more energy value — which can create more EV demand."
              description="The platform links mobility sales, distributed energy deployment and wholesale-market economics into a reinforcing commercial loop."
            />

            <div className="flywheel">
              {[
                "More EV Sales",
                "More Energy Assets",
                "Larger VPP",
                "More Market Revenue",
                "More Customer Value",
                "Lower EV Ownership Cost",
              ].map((item) => (
                <div
                  className="wheel"
                  key={item}
                >
                  <strong>
                    {item}
                  </strong>
                </div>
              ))}
            </div>
          </section>

          <section id="computing">
            <SectionHeader
              eyebrow="STRATEGIC SECOND GROWTH CURVE"
              title="Distributed Energy Computing: Grid + Solar + Battery + GPU."
              description="After the VPP reaches sufficient scale, DRIVEGRID can explore combining energy optimization with distributed computing demand."
            />

            <div className="compute">
              <div className="computeVisual">
                <div className="eyebrow">
                  ENERGY + COMPUTE
                </div>

                <div className="computeFlow">
                  <div className="computeBox">
                    <strong>
                      GRID
                    </strong>

                    <span>
                      Market price
                    </span>
                  </div>

                  <span>→</span>

                  <div className="computeBox">
                    <strong>
                      SOLAR
                    </strong>

                    <span>
                      Generation
                    </span>
                  </div>

                  <span>→</span>

                  <div className="computeBox">
                    <strong>
                      BATTERY
                    </strong>

                    <span>
                      Flexibility
                    </span>
                  </div>

                  <span>→</span>

                  <div className="computeBox">
                    <strong>
                      GPU
                    </strong>

                    <span>
                      Compute load
                    </span>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3>
                  Two synergistic revenue streams
                </h3>

                <p>
                  The platform can optimize
                  energy and computing together.
                  During lower-price periods,
                  storage can charge and suitable
                  computing loads can increase.
                  During higher-price periods,
                  non-critical compute demand can
                  be reduced while stored energy
                  supports the system.
                </p>

                <div className="modelRows">
                  <div className="revenueRow">
                    <span>
                      Energy Market Revenue
                    </span>

                    <strong>
                      STREAM 01
                    </strong>
                  </div>

                  <div className="revenueRow">
                    <span>
                      Computing Revenue
                    </span>

                    <strong>
                      STREAM 02
                    </strong>
                  </div>

                  <div className="revenueRow">
                    <span>
                      Potential applications
                    </span>

                    <strong>
                      AI · GPU · Rendering ·
                      Cloud
                    </strong>
                  </div>
                </div>

                <div className="formula">
                  This is a strategic extension
                  after VPP scale — not a Phase 1
                  core revenue source.
                </div>
              </div>
            </div>
          </section>

          <section>
            <SectionHeader
              eyebrow="SCALE & ROADMAP"
              title="Build the platform from regional VPP to national energy infrastructure."
              description="Illustrative strategic milestones showing how distributed assets can scale into a larger market platform."
            />

            <div className="roadmap">
              <div className="road">
                <strong>
                  31 MW
                </strong>

                <span>
                  Demonstration network
                  baseline
                </span>
              </div>

              <div className="road">
                <strong>
                  100 MW
                </strong>

                <span>
                  Regional VPP operating
                  scale
                </span>
              </div>

              <div className="road">
                <strong>
                  500 MW
                </strong>

                <span>
                  Multi-market platform
                  scale
                </span>
              </div>

              <div className="road">
                <strong>
                  1 GW+
                </strong>

                <span>
                  National distributed-energy
                  platform
                </span>
              </div>
            </div>
          </section>

          <section className="cta">
            <div className="eyebrow">
              INVESTOR & PARTNER PLATFORM
            </div>

            <h2>
              From EV sales to an intelligent energy network.
            </h2>

            <p>
              DRIVEGRID brings together
              automakers, energy partners, asset
              owners and wholesale power markets
              around one operating platform.
            </p>

            <div
              className="actions"
              style={{
                justifyContent:
                  "center",
              }}
            >

<a
  className="btn btnPrimary"
  href="#partner-form"
>
  Partner With DRIVEGRID
</a>

              <a
                href="#network"
                className="btn"
              >
                View VPP Simulation
              </a>
            </div>
          </section>

<section
  id="partner-form"
  className="section"
>
  <SectionHeader
    eyebrow="PARTNER WITH DRIVEGRID"
    title="Let's Build the Next Energy Platform."
    text="Tell us about your company, market or partnership opportunity."
  />


<form
  className="partnerForm"
  onSubmit={handlePartnerSubmit}
>
  <div className="formGrid">
    <div className="formField">
      <label htmlFor="partnerName">
        Name
      </label>
      <input
        id="partnerName"
        name="partnerName"
        type="text"
        placeholder="Your name"
        required
      />
    </div>

    <div className="formField">
      <label htmlFor="partnerCompany">
        Company
      </label>
      <input
        id="partnerCompany"
        name="partnerCompany"
        type="text"
        placeholder="Company name"
      />
    </div>

    <div className="formField">
      <label htmlFor="partnerEmail">
        Email
      </label>
      <input
        id="partnerEmail"
        name="partnerEmail"
        type="email"
        placeholder="you@company.com"
        required
      />
    </div>

    <div className="formField">
      <label htmlFor="partnerPhone">
        Phone
      </label>
      <input
        id="partnerPhone"
        name="partnerPhone"
        type="tel"
        placeholder="Optional"
      />
    </div>
  </div>

  <div className="formField">
    <label htmlFor="partnerMessage">
      Message
    </label>
    <textarea
      id="partnerMessage"
      name="partnerMessage"
      rows={6}
      placeholder="Tell us how you would like to work with DRIVEGRID."
      required
    />
  </div>

  <button
    type="submit"
    className="btn btnPrimary"
    disabled={formStatus === "sending"}
  >
    {formStatus === "sending"
      ? "Sending..."
      : "Submit Inquiry"}
  </button>

  {formStatus === "success" && (
    <p className="formSuccess">
      Thank you. Your inquiry has been submitted successfully.
    </p>
  )}

  {formStatus === "error" && (
    <p className="formError">
      Something went wrong. Please try again.
    </p>
  )}
</form>


</section>


          <footer>
            <span>
              © 2026 DRIVEGRID. EV + Energy +
              VPP.
            </span>

            <span>
              Investor demonstration ·
              Illustrative assumptions
            </span>
          </footer>
        </div>
      </div>
    </main>
  );
}