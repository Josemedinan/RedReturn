"use client";
import { Activity, Bot, CircleHelp, FileText, Globe2, LayoutDashboard, Mountain, Route, ShieldAlert, Siren } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { useMissionStore, type Tab } from "@/lib/store";
import { ErrorBoundary } from "./ErrorBoundary";
import { Tutorial, tourSeen } from "./Tutorial";
import { STRATEGY_LABEL } from "@/lib/format";
import { OverviewTab } from "./tabs/OverviewTab";
import { ExplorerTab } from "./tabs/ExplorerTab";
import { TerrainTab } from "./tabs/TerrainTab";
import { PlannerTab } from "./tabs/PlannerTab";
import { RiskTab } from "./tabs/RiskTab";
import { EmergencyTab } from "./tabs/EmergencyTab";
import { AresTab } from "./tabs/AresTab";
import { ReportsTab } from "./tabs/ReportsTab";

const TABS: { id: Tab; label: string; group: string; icon: ComponentType<{ size?: number }>; view: ComponentType }[] = [
  { id: "overview", label: "Overview", group: "Mission", icon: LayoutDashboard, view: OverviewTab },
  { id: "explorer", label: "Mars Explorer", group: "Mission", icon: Globe2, view: ExplorerTab },
  { id: "terrain", label: "Terrain", group: "Mission", icon: Mountain, view: TerrainTab },
  { id: "planner", label: "Planner", group: "Mission", icon: Route, view: PlannerTab },
  { id: "risk", label: "Risk Lab", group: "Analysis", icon: Activity, view: RiskTab },
  { id: "emergency", label: "Emergency", group: "Analysis", icon: Siren, view: EmergencyTab },
  { id: "ares", label: "ARES", group: "Analysis", icon: Bot, view: AresTab },
  { id: "reports", label: "Reports", group: "Output", icon: FileText, view: ReportsTab },
];
const GROUPS = ["Mission", "Analysis", "Output"];

export default function AppShell() {
  const { tab, setTab, init, apiState, sources, origin, destination, stops, config, refreshAlternatives, snapshot, alternatives } = useMissionStore();
  const ready = useRef(false);
  useEffect(() => { void init().then(() => { ready.current = true; }); }, [init]);
  useEffect(() => {
    if (!ready.current) return;
    const t = setTimeout(() => void refreshAlternatives(), 450);
    return () => clearTimeout(t);
  }, [origin, destination, stops, config, refreshAlternatives]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches("input, textarea, select")) return;
      const n = Number(e.key); if (n >= 1 && n <= TABS.length && !e.metaKey && !e.ctrlKey && !e.altKey) setTab(TABS[n - 1].id);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [setTab]);
  const [tour, setTour] = useState(false); const [tourTab, setTourTab] = useState<Tab | null>(null);
  useEffect(() => { if (!tourSeen()) setTour(true); }, []);
  const View = TABS.find(t => t.id === tab)!.view;
  const live = apiState === "online";
  const usingSnapshot = Object.values(sources).includes("snapshot");
  const rec = alternatives?.recommended;
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><b>RED<i>RETURN</i></b><span>Mars mission decision intelligence</span></div>
        <div className="ctx" aria-label="Current mission">{rec ? <><span className="chip ok">Plan: {STRATEGY_LABEL[rec]}</span></> : alternatives ? <span className="chip bad">No route meets all constraints</span> : null}</div>
        <div className="chips" aria-live="polite">
          <span className={`chip ${live ? "ok" : apiState === "unknown" ? "" : "bad"}`}>{live ? "API online" : apiState === "unknown" ? "Connecting…" : "API offline"}</span>
          {usingSnapshot && <span className="chip warn" title={snapshot?.snapshot.note}>Precomputed snapshot</span>}
          <span className="chip hide-sm">Prototype · not certified</span>
          <button className="iconbtn" aria-label="Show guided tour" title="Guided tour" onClick={() => setTour(true)}><CircleHelp size={17} /></button>
        </div>
      </header>
      <div className="frame">
        <aside className="side">
          <nav role="tablist" aria-label="Sections" aria-orientation="vertical">
            {GROUPS.map(g => <div key={g} className="navgroup"><span className="navlabel">{g}</span>
              {TABS.map((t, i) => ({ t, i })).filter(x => x.t.group === g).map(({ t: { id, label, icon: Icon }, i }) => (
                <button key={id} role="tab" className={`tab ${tourTab === id ? "tour-hl" : ""}`} aria-selected={tab === id} onClick={() => setTab(id)} title={`${label} (${i + 1})`}><Icon size={16} /><span>{label}</span><kbd aria-hidden>{i + 1}</kbd></button>))}
            </div>)}
          </nav>
          <div className="sidefoot tiny dim">Real NASA MOLA terrain · assumptions are labelled · nothing is certified.</div>
        </aside>
        <main className="main" id="main"><ErrorBoundary key={tab} label={TABS.find(t => t.id === tab)!.label}><View /></ErrorBoundary></main>
      </div>
      <nav className="bottomnav" role="tablist" aria-label="Sections (mobile)">
        {TABS.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}><Icon size={18} />{label.replace("Mars ", "")}</button>)}
      </nav>
      <footer className="legal"><ShieldAlert size={13} /><span><b>Research &amp; education prototype.</b> Not operational guidance, not validated or endorsed by NASA. Terrain-evaluated ≠ safe. “Feasible within model” ≠ safe.</span></footer>
      <Tutorial open={tour} onClose={() => setTour(false)} setTab={setTab} onStep={setTourTab} />
    </div>
  );
}
