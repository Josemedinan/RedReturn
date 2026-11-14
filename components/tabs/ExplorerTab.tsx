"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { CATALOG, LAYERS } from "@/data/catalog";
import { useMissionStore } from "@/lib/store";
import { coord } from "@/lib/format";
import { normalizeLon } from "@/lib/mars";
import { Badge, Loading, NumField, Panel } from "../ui";
import { GlobalMap } from "../GlobalMap";

const Globe = dynamic(() => import("../AdvancedMarsGlobe"), { ssr: false, loading: () => <div className="globe"><Loading label="Loading 3D globe…" /></div> });

export function ExplorerTab() {
  const s = useMissionStore();
  const [q, setQ] = useState(""); const [focus, setFocus] = useState<{ lat: number; lon: number } | null>(null);
  const [hover, setHover] = useState<{ lat: number; lon: number } | null>(null);
  const [view, setView] = useState<"globe" | "map">("globe");
  const results = useMemo(() => CATALOG.filter(c => (c.name + c.kind).toLowerCase().includes(q.toLowerCase())), [q]);
  const cover = s.alternatives ? [s.alternatives.tile] : s.snapshot?.coverage.items ?? [];
  const inWindow = (lat: number, lon: number) => cover.some(c => lat >= c.bounds.lat_min && lat <= c.bounds.lat_max && lon >= c.bounds.lon_min && lon <= c.bounds.lon_max);
  const pick = (p: { lat: number; lon: number }) => { s.setPoint({ lat: +p.lat.toFixed(4), lon: +normalizeLon(p.lon).toFixed(4) }); };
  const place = (c: (typeof CATALOG)[number], as: "origin" | "destination") => { (as === "origin" ? s.setOrigin : s.setDestination)({ lat: c.lat, lon: c.lon, name: c.name }); setFocus({ lat: c.lat, lon: c.lon }); };
  return (
    <div className="grid split-r">
      <div className="stack">
        <Panel title="Select points">
          <div className="seg" role="group" aria-label="Which point does a map click set?">
            <button aria-pressed={s.selection === "origin"} onClick={() => s.setSelection("origin")}>Base</button><button aria-pressed={s.selection === "destination"} onClick={() => s.setSelection("destination")}>Target</button>
          </div>
          <p className="tiny muted">Click the globe or map to set the {s.selection === "origin" ? "base" : "target"}. Numeric terrain exists only inside the green windows.</p>
          {([["Base", s.origin, s.setOrigin], ["Target", s.destination, s.setDestination]] as const).map(([label, p, set]) => (
            <div key={label} className="stack" style={{ marginBottom: 8 }}>
              <div className="row between"><b className="small">{label}</b>{inWindow(p.lat, p.lon) ? <Badge tone="ok">numeric DEM</Badge> : <Badge tone="warn">no DEM</Badge>}</div>
              <div className="grid g2"><NumField label="Lat" value={p.lat} min={-90} max={90} step={0.01} onChange={v => set({ ...p, lat: v })} /><NumField label="Lon" value={p.lon} min={-180} max={180} step={0.01} onChange={v => set({ ...p, lon: v })} /></div>
              <span className="tiny dim">{p.name ?? "Custom coordinate"} · {coord(p.lat, p.lon)}</span>
            </div>
          ))}
        </Panel>
        <Panel title="Data layer" right={<Badge tone="info">NASA Mars Trek</Badge>}>
          <div className="stack">{LAYERS.map(l => <label key={l.id} className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}><input type="radio" name="layer" checked={s.layer === l.id} onChange={() => s.setLayer(l.id)} /><span><b className="small">{l.name}</b> <Badge>{l.kind}</Badge><br /><span className="tiny muted">{l.note}</span></span></label>)}</div>
        </Panel>
        <Panel title="Location catalog" right={<span className="tiny dim">{results.length} / {CATALOG.length}</span>}>
          <input type="search" placeholder="Search named features…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search locations" />
          <div className="stack" style={{ marginTop: 8, maxHeight: 280, overflow: "auto" }}>
            {results.length === 0 && <p className="muted small">No match. Try “crater” or “plain”.</p>}
            {results.map(c => <div key={c.id} className="row between" style={{ flexWrap: "nowrap" }}><div style={{ minWidth: 0 }}><b className="small">{c.name}</b><div className="tiny dim">{c.kind} · {coord(c.lat, c.lon)}</div></div><div className="row" style={{ flexWrap: "nowrap" }}><button className="btn sm" onClick={() => place(c, "origin")}>Base</button><button className="btn sm" onClick={() => place(c, "destination")}>Target</button></div></div>)}
          </div>
          <p className="tiny dim" style={{ marginTop: 8 }}>Approximate centres; verify with the USGS Planetary Gazetteer.</p>
        </Panel>
      </div>
      <div className="stack">
        <div className="row between"><div className="seg" role="group" aria-label="View"><button aria-pressed={view === "globe"} onClick={() => setView("globe")}>3D globe</button><button aria-pressed={view === "map"} onClick={() => setView("map")}>2D map</button></div><span className="tiny dim num">{hover ? coord(hover.lat, hover.lon) : "hover the map for coordinates"}</span></div>
        {view === "globe" ? <Globe layer={s.layer} origin={s.origin} destination={s.destination} focus={focus} onPick={pick} /> : null}
        <GlobalMap layer={s.layer} origin={s.origin} destination={s.destination} coverage={cover} onPick={pick} onHover={setHover} />
        <p className="tiny dim">Globe and map share the same base/target/layer state. Layers are imagery or radiance products from NASA; colour is never read back as elevation. Local terrain analysis lives in the Terrain tab.</p>
      </div>
    </div>
  );
}
