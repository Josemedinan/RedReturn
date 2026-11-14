"use client";
import { Activity, Bot, FileText, Globe2, LayoutDashboard, Mountain, Route, ShieldAlert, Siren } from "lucide-react";
import { useEffect, useRef, type ComponentType } from "react";
import { useMissionStore, type Tab } from "@/lib/store";
import { ErrorBoundary } from "./ErrorBoundary";
import { OverviewTab } from "./tabs/OverviewTab";
import { ExplorerTab } from "./tabs/ExplorerTab";
import { TerrainTab } from "./tabs/TerrainTab";
import { PlannerTab } from "./tabs/PlannerTab";
import { RiskTab } from "./tabs/RiskTab";
import { EmergencyTab } from "./tabs/EmergencyTab";
import { AresTab } from "./tabs/AresTab";
import { ReportsTab } from "./tabs/ReportsTab";

const TABS: { id: Tab; label: string; icon: ComponentType<{ size?: number }>; view: ComponentType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, view: OverviewTab },
  { id: "explorer", label: "Mars Explorer", icon: Globe2, view: ExplorerTab },
  { id: "terrain", label: "Terrain", icon: Mountain, view: TerrainTab },
  { id: "planner", label: "Planner", icon: Route, view: PlannerTab },
  { id: "risk", label: "Risk Lab", icon: Activity, view: RiskTab },
  { id: "emergency", label: "Emergency", icon: Siren, view: EmergencyTab },
  { id: "ares", label: "ARES", icon: Bot, view: AresTab },
  { id: "reports", label: "Reports", icon: FileText, view: ReportsTab },
];

export default function AppShell() {
  const { tab, setTab, init, apiState, sources, origin, destination, stops, config, refreshAlternatives, snapshot } = useMissionStore();
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
  const View = TABS.find(t => t.id === tab)!.view;
  const live = apiState === "online";
  const usingSnapshot = Object.values(sources).includes("snapshot");
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><b>RED<i>RETURN</i></b><span>Mars mission decision intelligence</span></div>
        <nav className="tabs" role="tablist" aria-label="Sections">
          {TABS.map(({ id, label, icon: Icon }, i) => <button key={id} role="tab" className="tab" aria-selected={tab === id} onClick={() => setTab(id)} title={`${label} (${i + 1})`}><Icon size={15} />{label}</button>)}
        </nav>
        <div className="chips" aria-live="polite">
          <span className={`chip ${live ? "ok" : apiState === "unknown" ? "" : "bad"}`}>{live ? "API online" : apiState === "unknown" ? "Connecting…" : "API offline"}</span>
          {usingSnapshot && <span className="chip warn" title={snapshot?.snapshot.note}>Precomputed snapshot</span>}
          <span className="chip hide-sm">Prototype · not certified</span>
        </div>
      </header>
      <main className="main" id="main"><ErrorBoundary key={tab} label={TABS.find(t => t.id === tab)!.label}><View /></ErrorBoundary></main>
      <nav className="bottomnav" role="tablist" aria-label="Sections (mobile)">
        {TABS.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}><Icon size={18} />{label.replace("Mars ", "")}</button>)}
      </nav>
      <footer className="legal"><ShieldAlert size={13} /><span><b>Research &amp; education prototype.</b> Not operational guidance, not validated or endorsed by NASA. Terrain-evaluated ≠ safe. “Feasible within model” ≠ safe.</span></footer>
    </div>
  );
}
