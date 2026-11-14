"use client";
import { CATALOG, tileUrl, type LayerId } from "@/data/catalog";
import { normalizeLon } from "@/lib/mars";
import type { Coverage, Point } from "@/lib/types";

/** Equirectangular map sharing state with the globe; shows DEM coverage windows (where numeric elevation exists). */
export function GlobalMap({ layer, origin, destination, coverage, onPick, onHover }: { layer: LayerId; origin: Point; destination: Point; coverage: Coverage[]; onPick: (p: Point) => void; onHover?: (p: Point) => void }) {
  const X = (lon: number) => ((normalizeLon(lon) + 180) / 360) * 1000, Y = (lat: number) => ((90 - lat) / 180) * 500;
  const pt = (e: React.MouseEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { lon: normalizeLon(((e.clientX - r.left) / r.width) * 360 - 180), lat: Math.max(-90, Math.min(90, 90 - ((e.clientY - r.top) / r.height) * 180)) }; };
  return (
    <div className="mapwrap" style={{ aspectRatio: "2/1", cursor: "crosshair" }} onClick={e => onPick(pt(e))} onMouseMove={e => onHover?.(pt(e))}>
      <div style={{ position: "absolute", inset: 0, display: "flex" }}>
        {([0, 1] as const).map(c => <img key={c} src={tileUrl(layer, c)} alt="" draggable={false} style={{ width: "50%", height: "100%", objectFit: "fill" }} />)}
      </div>
      <svg viewBox="0 0 1000 500" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }} aria-label="Equirectangular Mars map">
        {coverage.map(c => <rect key={c.id} x={X(c.bounds.lon_min)} y={Y(c.bounds.lat_max)} width={X(c.bounds.lon_max) - X(c.bounds.lon_min)} height={Y(c.bounds.lat_min) - Y(c.bounds.lat_max)} fill="rgba(98,184,164,.2)" stroke="#62b8a4" strokeWidth={1.5} vectorEffect="non-scaling-stroke"><title>{`${c.name}: numeric MOLA elevation`}</title></rect>)}
        {CATALOG.map(c => <circle key={c.id} cx={X(c.lon)} cy={Y(c.lat)} r={3} fill="#c4a174" stroke="#000" strokeWidth={.6}><title>{c.name}</title></circle>)}
        <line x1={X(origin.lon)} y1={Y(origin.lat)} x2={X(destination.lon)} y2={Y(destination.lat)} stroke="#e8794a" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <circle cx={X(origin.lon)} cy={Y(origin.lat)} r={6} fill="#62b8a4" stroke="#0a0d11" strokeWidth={2} /><circle cx={X(destination.lon)} cy={Y(destination.lat)} r={6} fill="#e8794a" stroke="#0a0d11" strokeWidth={2} />
      </svg>
      <span className="map-credit">NASA Mars Trek · 463 m–100 m global tiles · green boxes = cached numeric MOLA DEM windows</span>
    </div>
  );
}
