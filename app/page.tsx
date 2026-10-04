"use client";

import { useState } from "react";

const assets = [
  { name: "Residential Batteries", value: "51.8 MW", count: "8,421 assets" },
  { name: "EV / V2G", value: "24.7 MW", count: "3,214 vehicles" },
  { name: "Commercial DER", value: "9.9 MW", count: "847 sites" },
];

const markets = [
  { name: "ERCOT", price: "$0.42", status: "ACTIVE" },
  { name: "CAISO", price: "$0.31", status: "READY" },
  { name: "PJM", price: "$0.27", status: "READY" },
];

export default function Home() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(false);

  const runSimulation = () => {
    setRunning(true);
    setResult(false);

    setTimeout(() => {
      setRunning(false);
      setResult(true);
    }, 1800);
  };

  return (
    <main className="min-h-screen bg-[#05070a] text-white">
      {/* NAVIGATION */}
      <nav className="border-b border-white/10 bg-[#05070a]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
            <span className="text-xl font-bold tracking-[0.25em]">
              DRIVEGRID
            </span>
          </div>

          <div className="hidden gap-8 text-sm text-zinc-400 md:flex">
            <a href="#command">Command Center</a>
            <a href="#assets">Assets</a>
            <a href="#markets">Markets</a>
            <a href="#ev">EV / V2G</a>
            <a href="#investor">Investor</a>
          </div>

          <button
            onClick={runSimulation}
            className="rounded-md border border-cyan-400/50 px-4 py-2 text-xs font-semibold tracking-wider text-cyan-300 transition hover:bg-cyan-400/10"
          >
            {running ? "RUNNING..." : "LAUNCH DEMO"}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="border-b border-white/10">
        <div className="mx-auto grid max-w-7xl gap-16 px-6 py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="mb-6 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/5 px-4 py-2 text-xs tracking-[0.2em] text-cyan-300">
              VIRTUAL POWER PLANT · DEMO ENVIRONMENT
            </div>

            <h1 className="max-w-4xl text-5xl font-semibold leading-tight tracking-tight md:text-7xl">
              Intelligent
              <br />
              Distributed
              <br />
              <span className="text-cyan-300">Energy Infrastructure.</span>
            </h1>

            <p className="mt-8 max-w-xl text-lg leading-8 text-zinc-400">
              DRIVEGRID connects batteries, EVs, solar and flexible energy
              resources into a market-driven virtual power plant.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <button
                onClick={runSimulation}
                className="rounded-md bg-cyan-300 px-6 py-3 font-semibold text-black transition hover:bg-cyan-200"
              >
                {running ? "SIMULATING..." : "RUN VPP SIMULATION"}
              </button>

              <a
                href="#command"
                className="rounded-md border border-white/15 px-6 py-3 font-semibold text-zinc-200 transition hover:bg-white/5"
              >
                EXPLORE PLATFORM
              </a>
            </div>

            <p className="mt-5 text-xs tracking-wide text-zinc-600">
              ALL DATA SHOWN IN THIS DEMO IS SIMULATED.
            </p>
          </div>

          {/* LIVE METRICS */}
          <div className="grid grid-cols-2 gap-3">
            <Metric label="CONNECTED ASSETS" value="12,482" />
            <Metric label="VPP CAPACITY" value="86.4 MW" />
            <Metric label="TODAY'S REVENUE" value="$48,721" />
            <Metric label="CUSTOMER SHARE" value="$944K" />
          </div>
        </div>
      </section>

      {/* COMMAND CENTER */}
      <section id="command" className="mx-auto max-w-7xl px-6 py-20">
        <SectionTitle
          eyebrow="01 / COMMAND CENTER"
          title="One Grid. Thousands of Distributed Assets."
          description="A simulated view of the DRIVEGRID aggregation engine operating across distributed energy resources."
        />

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {assets.map((asset) => (
            <div
              key={asset.name}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div className="mb-10 flex items-center justify-between">
                <span className="h-2 w-2 rounded-full bg-cyan-300" />
                <span className="text-xs text-zinc-600">ONLINE</span>
              </div>

              <p className="text-sm text-zinc-400">{asset.name}</p>
              <p className="mt-2 text-4xl font-semibold">{asset.value}</p>
              <p className="mt-2 text-sm text-zinc-600">{asset.count}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SIMULATION */}
      <section className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionTitle
            eyebrow="02 / DISPATCH ENGINE"
            title="Respond to the Market in Real Time."
            description="Simulate how DRIVEGRID detects a price event and coordinates thousands of distributed resources."
          />

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-[#080b0f] p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <span className="text-sm font-semibold">MARKET EVENT</span>
                <span className="text-xs text-cyan-300">ERCOT · LIVE DEMO</span>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-6">
                <Metric label="PRICE BEFORE" value="$0.08/kWh" />
                <Metric label="PRICE EVENT" value="$0.42/kWh" />
              </div>

              <button
                onClick={runSimulation}
                className="mt-8 w-full rounded-md bg-white px-5 py-4 font-semibold text-black transition hover:bg-zinc-200"
              >
                {running ? "OPTIMIZING ASSETS..." : "RUN DISPATCH SIMULATION"}
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#080b0f] p-7">
              <p className="text-sm font-semibold">DISPATCH RESULT</p>

              {!result && !running && (
                <div className="flex h-48 items-center justify-center text-sm text-zinc-600">
                  Run the simulation to generate a dispatch event.
                </div>
              )}

              {running && (
                <div className="flex h-48 items-center justify-center text-sm text-cyan-300">
                  Optimizing 8,421 assets...
                </div>
              )}

              {result && (
                <div className="mt-6 space-y-4">
                  <Row label="Battery Dispatch" value="+24.8 MW" />
                  <Row label="EV Smart Charging" value="+9.7 MW" />
                  <Row label="Commercial Load" value="+4.1 MW" />
                  <div className="mt-6 border-t border-white/10 pt-5">
                    <Row
                      label="ESTIMATED REVENUE"
                      value="$8,421"
                      highlight
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* MARKETS */}
      <section id="markets" className="mx-auto max-w-7xl px-6 py-20">
        <SectionTitle
          eyebrow="03 / WHOLESALE MARKETS"
          title="Built for Market Access."
          description="A multi-market architecture designed to connect distributed flexibility with wholesale electricity markets."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {markets.map((market) => (
            <div
              key={market.name}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div className="flex justify-between">
                <span className="text-xl font-semibold">{market.name}</span>
                <span className="text-xs text-cyan-300">
                  {market.status}
                </span>
              </div>

              <p className="mt-10 text-4xl font-semibold">{market.price}</p>
              <p className="mt-2 text-sm text-zinc-600">
                Simulated wholesale opportunity
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* EV */}
      <section id="ev" className="border-y border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <SectionTitle
            eyebrow="04 / EV + V2G"
            title="Turn Vehicles Into Grid Resources."
            description="Smart charging and vehicle-to-grid capabilities create a second layer of distributed flexibility."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Feature title="SMART CHARGING" text="Shift charging toward lower-cost periods." />
            <Feature title="V2G" text="Return available battery energy to the grid." />
            <Feature title="REVENUE SHARE" text="Share market value with EV owners and partners." />
          </div>
        </div>
      </section>

      {/* INVESTOR */}
      <section id="investor" className="mx-auto max-w-7xl px-6 py-24">
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-10 md:p-16">
          <p className="text-xs tracking-[0.25em] text-cyan-300">
            INVESTOR PLATFORM
          </p>

          <h2 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
            Build the operating layer for distributed energy.
          </h2>

          <p className="mt-6 max-w-2xl leading-7 text-zinc-400">
            DRIVEGRID is designed as a light-asset VPP platform connecting
            distributed energy resources, wholesale markets and future
            distributed computing.
          </p>

          <div className="mt-10 flex flex-wrap gap-8">
            <Metric label="SEED ROUND" value="$3M" />
            <Metric label="LONG-TERM TARGET" value="500+ MW" />
            <Metric label="CORE MODEL" value="VPP PLATFORM" />
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-xs text-zinc-600">
        DRIVEGRID · INTELLIGENT DISTRIBUTED ENERGY INFRASTRUCTURE · DEMO
      </footer>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-[10px] tracking-[0.18em] text-zinc-600">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs tracking-[0.25em] text-cyan-300">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
        {title}
      </h2>
      <p className="mt-5 leading-7 text-zinc-400">{description}</p>
    </div>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className={highlight ? "text-2xl font-semibold text-cyan-300" : "font-semibold"}>
        {value}
      </span>
    </div>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-3 text-sm leading-6 text-zinc-500">{text}</p>
    </div>
  );
}