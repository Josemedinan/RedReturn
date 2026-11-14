"use client";
import { create } from "zustand";
import { api, ApiFailure, isAbort } from "./api";
import { DEFAULT_CONFIG, type MissionConfig, type RouteStrategy } from "./mars";
import type { Alternatives, AresAnswer, Datasets, Heightfield, Incident, Point, Risk, Scenario, Snapshot, Stop } from "./types";
import type { LayerId } from "@/data/catalog";

export type Tab = "overview" | "explorer" | "terrain" | "planner" | "risk" | "emergency" | "ares" | "reports";
type Source = "live" | "snapshot";
type Busy = { alt: boolean; risk: boolean; scenario: boolean; ares: boolean };

type Store = {
  tab: Tab; origin: Point; destination: Point; stops: Stop[]; config: MissionConfig; strategy: RouteStrategy;
  incidents: Incident[]; incidentProgress: number; layer: LayerId; selection: "origin" | "destination";
  apiState: "unknown" | "online" | "offline"; snapshot: Snapshot | null;
  alternatives: Alternatives | null; risk: Risk | null; scenario: Scenario | null; heightfield: Heightfield | null; datasets: Datasets | null;
  sources: Partial<Record<"alternatives" | "risk" | "scenario" | "heightfield" | "ares", Source>>;
  errors: Partial<Record<"alternatives" | "risk" | "scenario" | "heightfield" | "ares", string>>; busy: Busy;
  chat: { q: string; a: AresAnswer; source: Source }[];
  setTab: (t: Tab) => void; setLayer: (l: LayerId) => void; setSelection: (s: "origin" | "destination") => void;
  setOrigin: (p: Point) => void; setDestination: (p: Point) => void; setPoint: (p: Point) => void;
  setConfig: (c: Partial<MissionConfig>) => void; setStrategy: (s: RouteStrategy) => void;
  setStops: (s: Stop[]) => void; setIncidents: (i: Incident[]) => void; setIncidentProgress: (v: number) => void;
  init: () => Promise<void>; loadDemo: () => void;
  refreshAlternatives: () => Promise<void>; runRisk: () => Promise<void>; runScenario: () => Promise<void>; ask: (q: string) => Promise<void>;
  reportBody: () => Record<string, unknown>;
};

const ctrl: Partial<Record<keyof Busy | "hf", AbortController>> = {};
const fresh = (k: keyof Busy | "hf") => { ctrl[k]?.abort(); const c = new AbortController(); ctrl[k] = c; return c; };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const round = (p: Point) => ({ lat: +p.lat.toFixed(5), lon: +p.lon.toFixed(5) });
const msg = (e: unknown) => e instanceof ApiFailure ? (e.offline ? "API offline" : e.message) : "Unexpected error";

export const useMissionStore = create<Store>((set, get) => {
  const body = () => {
    const s = get();
    return { origin: s.origin, destination: s.destination, config: apiConfig(s.config), science_stops: s.stops };
  };
  const demoMatch = () => {
    const s = get(), d = s.snapshot?.demo;
    if (!d) return false;
    return same(round(s.origin), round(d.origin)) && same(round(s.destination), round(d.destination)) && same(s.stops.map(x => [x.lat, x.lon, x.dwell_hours]), d.science_stops.map(x => [x.lat, x.lon, x.dwell_hours]))
      && same(apiConfig(s.config), apiConfig({ ...DEFAULT_CONFIG, ...fromApiConfig(d.config as Record<string, number | boolean>) }));
  };
  const fail = (key: keyof Store["errors"], e: unknown) => { if (!isAbort(e)) set(s => ({ errors: { ...s.errors, [key]: msg(e) } })); };
  const ok = (key: keyof Store["errors"], source: Source) => set(s => ({ errors: { ...s.errors, [key]: undefined }, sources: { ...s.sources, [key]: source } }));
  const invalidate = () => set({ alternatives: null, risk: null, scenario: null });

  return {
    tab: "overview", origin: { lat: 18.38, lon: 77.58, name: "Jezero base (reference point)" },
    destination: { lat: 18.6, lon: 77.2, name: "Western rim target (demo coordinate)" }, stops: [], config: DEFAULT_CONFIG, strategy: "resource",
    incidents: [{ kind: "battery_loss", magnitude: 35 }, { kind: "speed_reduction", magnitude: 30 }], incidentProgress: 0.6,
    layer: "colorshade", selection: "destination", apiState: "unknown", snapshot: null,
    alternatives: null, risk: null, scenario: null, heightfield: null, datasets: null, sources: {}, errors: {}, busy: { alt: false, risk: false, scenario: false, ares: false }, chat: [],
    setTab: tab => set({ tab }), setLayer: layer => set({ layer }), setSelection: selection => set({ selection }),
    setOrigin: origin => { set({ origin }); invalidate(); },
    setDestination: destination => { set({ destination }); invalidate(); },
    setPoint: p => (get().selection === "origin" ? get().setOrigin(p) : get().setDestination(p)),
    setConfig: c => { set(s => ({ config: { ...s.config, ...c } })); invalidate(); },
    setStrategy: strategy => set({ strategy, risk: null, scenario: null }),
    setStops: stops => { set({ stops }); invalidate(); },
    setIncidents: incidents => set({ incidents, scenario: null }), setIncidentProgress: incidentProgress => set({ incidentProgress, scenario: null }),

    init: async () => {
      let snap: Snapshot | null = null;
      try { const r = await fetch("/data/demo-snapshot.json"); if (r.ok) snap = await r.json(); } catch { /* snapshot is optional */ }
      set({ snapshot: snap });
      try { await api("/api/health", { timeoutMs: 4000 }); set({ apiState: "online" }); } catch { set({ apiState: "offline" }); }
      try { const datasets = await api<Datasets>("/api/datasets", { timeoutMs: 6000 }); set({ datasets }); }
      catch { if (snap) set({ datasets: snap.datasets }); }
      if (snap) get().loadDemo();
    },

    loadDemo: () => {
      const d = get().snapshot?.demo;
      if (!d) return;
      set({ origin: d.origin, destination: d.destination, stops: d.science_stops, config: { ...DEFAULT_CONFIG, ...fromApiConfig(d.config as Record<string, number | boolean>) },
        incidents: d.incident.kinds as Incident[], incidentProgress: d.incident.at_progress, alternatives: null, risk: null, scenario: null, chat: [] });
      void get().refreshAlternatives();
    },

    refreshAlternatives: async () => {
      const c = fresh("alt"); set(s => ({ busy: { ...s.busy, alt: true } }));
      try {
        const alternatives = await api<Alternatives>("/api/routes/alternatives", { body: body(), signal: c.signal });
        set({ alternatives, apiState: "online" }); ok("alternatives", "live");
        void loadHeightfield(alternatives.tile.id);
      } catch (e) {
        if (isAbort(e)) return;
        const snap = get().snapshot;
        if (e instanceof ApiFailure && e.offline && snap && demoMatch()) {
          set({ alternatives: snap.alternatives, apiState: "offline", heightfield: snap.heightfield }); ok("alternatives", "snapshot"); ok("heightfield", "snapshot");
        } else { set({ alternatives: null, ...(e instanceof ApiFailure && e.offline ? { apiState: "offline" as const } : {}) }); fail("alternatives", e); }
      } finally { if (ctrl.alt === c) set(s => ({ busy: { ...s.busy, alt: false } })); }
    },

    runRisk: async () => {
      const c = fresh("risk"); set(s => ({ busy: { ...s.busy, risk: true } }));
      const s0 = get(); const strategy = s0.alternatives?.recommended ?? s0.strategy;
      try { set({ risk: await api<Risk>("/api/risk/analyze", { body: { ...body(), strategy, runs: s0.snapshot?.demo.runs ?? 2000, seed: s0.snapshot?.demo.seed ?? 20261114 }, signal: c.signal, timeoutMs: 40000 }) }); ok("risk", "live"); }
      catch (e) {
        const snap = get().snapshot;
        if (e instanceof ApiFailure && e.offline && snap && demoMatch() && strategy === snap.alternatives.recommended) { set({ risk: snap.risk }); ok("risk", "snapshot"); }
        else fail("risk", e);
      } finally { if (ctrl.risk === c) set(s => ({ busy: { ...s.busy, risk: false } })); }
    },

    runScenario: async () => {
      const c = fresh("scenario"); set(s => ({ busy: { ...s.busy, scenario: true } }));
      const s0 = get(); const strategy = s0.alternatives?.recommended ?? s0.strategy;
      try { set({ scenario: await api<Scenario>("/api/scenarios/simulate", { body: { ...body(), strategy, incidents: s0.incidents, at_progress: s0.incidentProgress }, signal: c.signal, timeoutMs: 40000 }) }); ok("scenario", "live"); }
      catch (e) {
        const snap = get().snapshot; const d = snap?.demo;
        if (e instanceof ApiFailure && e.offline && snap && d && demoMatch() && same(s0.incidents, d.incident.kinds) && s0.incidentProgress === d.incident.at_progress) { set({ scenario: snap.scenario }); ok("scenario", "snapshot"); }
        else fail("scenario", e);
      } finally { if (ctrl.scenario === c) set(s => ({ busy: { ...s.busy, scenario: false } })); }
    },

    ask: async q => {
      const c = fresh("ares"); set(s => ({ busy: { ...s.busy, ares: true } }));
      const s0 = get(); const strategy = s0.alternatives?.recommended ?? s0.strategy;
      try {
        const a = await api<AresAnswer>("/api/ares/ask", { body: { ...body(), strategy, question: q, use_language_model: false }, signal: c.signal, timeoutMs: 40000 });
        set(s => ({ chat: [...s.chat, { q, a, source: "live" }] })); ok("ares", "live");
      } catch (e) {
        const hit = get().snapshot?.ares[q];
        if (e instanceof ApiFailure && e.offline && hit && demoMatch()) { set(s => ({ chat: [...s.chat, { q, a: hit, source: "snapshot" }] })); ok("ares", "snapshot"); }
        else fail("ares", e);
      } finally { if (ctrl.ares === c) set(s => ({ busy: { ...s.busy, ares: false } })); }
    },

    reportBody: () => {
      const s = get();
      return { ...body(), runs: s.snapshot?.demo.runs ?? 2000, seed: s.snapshot?.demo.seed ?? 20261114, incident_progress: s.incidentProgress, incident: s.incidents[0] ?? null };
    },
  };

  async function loadHeightfield(tile: string) {
    const c = fresh("hf"); const s = get();
    const pts = [s.origin, s.destination, ...s.stops];
    const pad = 0.25;
    const lat = pts.map(p => p.lat), lon = pts.map(p => p.lon);
    try {
      const q = new URLSearchParams({ tile, lat_min: String(Math.min(...lat) - pad), lat_max: String(Math.max(...lat) + pad), lon_min: String(Math.min(...lon) - pad), lon_max: String(Math.max(...lon) + pad), max_size: "128" });
      set({ heightfield: await api<Heightfield>(`/api/terrain/heightfield?${q}`, { signal: c.signal }) }); ok("heightfield", "live");
    } catch (e) { fail("heightfield", e); }
  }
});

/** API field names for the mission configuration (single mapping, mirrored by tests/parity.test.ts). */
export function apiConfig(c: MissionConfig) {
  return {
    crew: c.crew, speed_kmh: c.speedKmh, oxygen_kg: c.oxygenKg, oxygen_kg_per_person_hour: c.oxygenKgPerPersonHour, energy_kwh: c.energyKwh,
    energy_kwh_per_hour: c.energyKwhPerHour, water_liters: c.waterLiters, water_liters_per_person_day: c.waterLitersPerPersonDay,
    radiation_msv_per_hour: c.radiationMsvPerHour, max_radiation_msv: c.maxRadiationMsv, reserve_percent: c.reservePercent, max_hours: c.maxHours,
    science_hours: c.scienceHours, contingency_percent: c.contingencyPercent, return_required: c.returnRequired,
    max_slope_deg: c.maxSlopeDeg, rover_mass_kg: c.roverMassKg, drivetrain_efficiency: c.drivetrainEfficiency,
  };
}

const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
/** Inverse of apiConfig for partial API configs (e.g. the demo scenario). */
export function fromApiConfig(c: Record<string, number | boolean>): Partial<MissionConfig> {
  const map: Record<string, string> = { oxygen_kg_per_person_hour: "oxygenKgPerPersonHour", water_liters_per_person_day: "waterLitersPerPersonDay", energy_kwh_per_hour: "energyKwhPerHour", radiation_msv_per_hour: "radiationMsvPerHour" };
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [map[k] ?? camel(k), v])) as Partial<MissionConfig>;
}
