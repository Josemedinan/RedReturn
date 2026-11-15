"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from "recharts";
import { useMissionStore } from "@/lib/store";
import { fmt, STRATEGY_COLOR, STRATEGY_LABEL } from "@/lib/format";
import { buildConceptualTerrain } from "@/lib/terrain";
import { Mountain } from "lucide-react";
import { Badge, Empty, ErrorState, Loading, Notice, PageHead, Panel, Stat } from "../ui";
import { ProfileChart } from "../charts";
import { TerrainMap } from "../TerrainMap";

const Mesh = dynamic(() => import("../TerrainMesh3D"), { ssr: false, loading: () => <Loading label="Building 3D terrain…" /> });
const ALL = ["shortest", "terrain", "resource", "science"];

export function TerrainTab() {
  const s = useMissionStore(); const alt = s.alternatives; const hf = s.heightfield;
  const [show, setShow] = useState<string[]>(["shortest", "terrain", "resource"]);
  const [mode, setMode] = useState<"relief" | "mesh" | "concept">("relief");
  const [slopeOverlay, setSlope] = useState(true);
  const concept = useMemo(() => buildConceptualTerrain([s.origin, s.destination]), [s.origin, s.destination]);
  const toggle = (k: string) => setShow(v => (v.includes(k) ? v.filter(x => x !== k) : [...v, k]));
  const mapArea = mode === "concept" ? (
    <Panel title="Educational conceptual terrain" right={<Badge tone="bad">NOT MARS DATA</Badge>}>
      <Notice tone="bad">Procedurally generated from a hash of the route coordinates for teaching purposes only. These elevations are <b>not measurements</b> and never feed any mission result.</Notice>
      <ResponsiveContainer width="100%" height={260}><LineChart data={concept.profile.map(p => ({ d: +p.distanceKm.toFixed(2), e: Math.round(p.elevationM) }))}><CartesianGrid stroke="#1b2531" /><XAxis dataKey="d" stroke="#6c7a89" fontSize={11} unit=" km" /><YAxis stroke="#6c7a89" fontSize={11} width={48} /><Line dataKey="e" stroke="#9aa7b5" dot={false} strokeDasharray="4 3" isAnimationActive={false} /></LineChart></ResponsiveContainer>
    </Panel>
  ) : !alt || !hf ? (
    s.errors.alternatives ? <Panel title="Terrain"><ErrorState message={s.errors.alternatives} retry={() => void s.refreshAlternatives()} />{s.errors.alternatives !== "API offline" && <p className="tiny muted" style={{ textAlign: "center" }}>Pick a base and target inside a green DEM window (Mars Explorer).</p>}</Panel>
      : s.busy.alt ? <Panel title="Terrain"><Loading label="Sampling MOLA elevations and planning routes…" /></Panel> : <Panel title="Terrain"><Empty title="No terrain analysis yet">Select a base and target inside a cached MOLA window.</Empty></Panel>
  ) : mode === "relief" ? (
    <TerrainMap hf={hf} routes={alt.routes} show={show} origin={s.origin} destination={s.destination} stops={s.stops} showSlope={slopeOverlay} maxSlope={s.config.maxSlopeDeg} onPick={p => s.setPoint({ lat: +p.lat.toFixed(4), lon: +p.lon.toFixed(4) })} />
  ) : <Mesh hf={hf} routes={alt.routes} show={show} origin={s.origin} destination={s.destination} showSlope={slopeOverlay} maxSlope={s.config.maxSlopeDeg} />;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <PageHead icon={Mountain} title="Terrain" right={alt ? <Badge tone="info">NASA MGS MOLA · {fmt(alt.tile.pixel_size_m, 0)} m grid</Badge> : undefined}>Real MOLA elevations around your route: shaded relief, 3D surface, slope hot-spots and the four candidate routes.</PageHead>
      {alt && <div className="kpis">
        <Stat label="DEM resolution" value={`${fmt(alt.tile.pixel_size_m, 0)} m`} detail={`≥ ${fmt(alt.resolution.smallest_resolvable_feature_m, 0)} m features`} tone="warn" />
        <Stat label="Vertical uncertainty" value={`±${alt.resolution.vertical_uncertainty_m} m`} detail="USGS total, incl. areoid" />
        <Stat label="Window coverage" value={`${fmt(alt.tile.valid_fraction * 100, 1)}%`} detail={`${alt.tile.nodata_cells} nodata cells`} tone={alt.tile.nodata_cells ? "warn" : "ok"} />
        <Stat label="Elevation range" value={`${fmt(alt.tile.elevation_min_m, 0)}…${fmt(alt.tile.elevation_max_m, 0)}`} detail="m above MOLA areoid (whole window)" />
      </div>}
      <div className="dash">
        <div className="col c8">
          <div className="row between">
            <div className="seg" role="group" aria-label="Terrain view"><button aria-pressed={mode === "relief"} onClick={() => setMode("relief")}>Relief map</button><button aria-pressed={mode === "mesh"} onClick={() => setMode("mesh")}>3D mesh</button><button aria-pressed={mode === "concept"} onClick={() => setMode("concept")}>Educational concept</button></div>
            {mode !== "concept" && <label className="row small"><input type="checkbox" checked={slopeOverlay} onChange={e => setSlope(e.target.checked)} />Highlight slopes &gt; {s.config.maxSlopeDeg}°</label>}
          </div>
          {mapArea}
          {alt && mode !== "concept" && <div className="legend" role="group" aria-label="Route visibility">{ALL.map(k => <label key={k} className="row" style={{ gap: 6, cursor: "pointer" }}><input type="checkbox" checked={show.includes(k)} onChange={() => toggle(k)} /><span><i style={{ background: STRATEGY_COLOR[k] }} />{STRATEGY_LABEL[k]}</span></label>)}</div>}
        </div>
        <div className="col c4">
          {alt && <>
            <Panel title="Route terrain metrics" right={<Badge tone="info">class B · derived from A</Badge>}>
              <div className="tscroll" role="region" aria-label="Route terrain metrics table" tabIndex={0}><table className="t"><thead><tr><th>Route</th><th>km</th><th>Gain / loss</th><th>Max°</th><th>Interp. / gaps</th></tr></thead><tbody>
                {alt.routes.map(r => { const over = (r.metrics.max_slope_deg ?? 0) > s.config.maxSlopeDeg; return <tr key={r.strategy}><td style={{ color: STRATEGY_COLOR[r.strategy] }}>{STRATEGY_LABEL[r.strategy]}</td><td className="n">{fmt(r.metrics.distance_km)}</td><td className="n">+{fmt(r.metrics.elevation_gain_m, 0)} / −{fmt(r.metrics.elevation_loss_m, 0)} m</td><td className="n" style={over ? { color: "var(--bad)" } : undefined}>{fmt(r.metrics.max_slope_deg)}</td><td className="n">{r.metrics.interpolated_samples}/{r.metrics.samples} · {r.metrics.nodata_samples + r.metrics.outside_coverage_samples}</td></tr>; })}
              </tbody></table></div>
              <p className="tiny dim">Interp. = samples that are bilinear interpolations, not cell values. Gaps = nodata or outside coverage (never filled). Slope baseline ≈ 0.5–1.4 km.</p>
            </Panel>
            <Notice>{alt.resolution.statement}</Notice>
          </>}
        </div>
        {alt && <>
          <div className="c8"><Panel title="Elevation profile and slope"><ProfileChart routes={alt.routes} maxSlope={s.config.maxSlopeDeg} show={show} /></Panel></div>
          <div className="c4"><Panel title="What this terrain data cannot tell you"><ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>{alt.limitations.map(l => <li key={l}>{l}</li>)}</ul></Panel></div>
        </>}
      </div>
    </div>
  );
}
