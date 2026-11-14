"use client";
import { useEffect, useMemo, useRef } from "react";
import type { Heightfield, Point, RouteAlt, Stop } from "@/lib/types";
import { STRATEGY_COLOR } from "@/lib/format";

/** Hypsometric tint + hillshade of the DEM block means. Colour encodes elevation values; it is NOT sampled back as data. */
function paint(hf: Heightfield, canvas: HTMLCanvasElement, showSlope: boolean, maxSlope: number) {
  const { rows, cols } = hf;
  canvas.width = cols; canvas.height = rows;
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const img = ctx.createImageData(cols, rows);
  const z = hf.elevation_m; const valid = z.filter((v): v is number => v !== null);
  const lo = Math.min(...valid), hi = Math.max(...valid), span = Math.max(1, hi - lo);
  const cellM = hf.display_pixel_m;
  const at = (r: number, c: number) => z[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = (r * cols + c) * 4; const v = z[r * cols + c];
    if (v === null) { img.data.set([255, 0, 255, 255], i); continue; }            // missing data stays visibly missing
    const t = (v - lo) / span;
    const base = [40 + 190 * t, 52 + 150 * t * t + 40 * t, 70 + 60 * (1 - t) + 80 * t * t];
    const a = at(r - 1, c - 1), b = at(r - 1, c + 1), d = at(r + 1, c - 1), e = at(r + 1, c + 1);
    let shade = 1;
    if ([a, b, d, e].every(x => x !== null)) {
      const dzdx = ((b as number) - (a as number) + (e as number) - (d as number)) / (4 * cellM), dzdy = ((d as number) - (a as number) + (e as number) - (b as number)) / (4 * cellM);
      shade = Math.max(0.35, Math.min(1.5, 0.95 + 4.5 * (-dzdx * 0.6 + dzdy * 0.8)));
    }
    let [R, G, B] = base.map(x => Math.min(255, x * shade));
    const s = hf.slope_deg[r * cols + c];
    if (showSlope && s !== null && s > maxSlope) { R = R * 0.35 + 224 * 0.65; G = G * 0.35 + 70 * 0.65; B = B * 0.35 + 64 * 0.65; }
    img.data.set([R, G, B, 255], i);
  }
  ctx.putImageData(img, 0, 0);
}

export function TerrainMap({ hf, routes, show, origin, destination, stops, showSlope, maxSlope, onPick }: {
  hf: Heightfield; routes: RouteAlt[]; show: string[]; origin: Point; destination: Point; stops: Stop[]; showSlope: boolean; maxSlope: number; onPick?: (p: Point) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) paint(hf, ref.current, showSlope, maxSlope); }, [hf, showSlope, maxSlope]);
  const { bounds: b } = hf;
  const W = 1000, H = (hf.rows / hf.cols) * 1000;
  const px = (lat: number, lon: number) => [((lon - b.lon_min) / (b.lon_max - b.lon_min)) * W, ((b.lat_max - lat) / (b.lat_max - b.lat_min)) * H];
  const paths = useMemo(() => routes.filter(r => show.includes(r.strategy)).map(r => ({ s: r.strategy, d: r.coordinates.map((c, i) => { const [x, y] = px(c.lat, c.lon); return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`; }).join("") })), [routes, show, b]); // eslint-disable-line react-hooks/exhaustive-deps
  const click = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onPick) return; const r = e.currentTarget.getBoundingClientRect();
    onPick({ lon: b.lon_min + ((e.clientX - r.left) / r.width) * (b.lon_max - b.lon_min), lat: b.lat_max - ((e.clientY - r.top) / r.height) * (b.lat_max - b.lat_min) });
  };
  const mark = (p: { lat: number; lon: number }, color: string, label: string) => { const [x, y] = px(p.lat, p.lon); return <g key={label + p.lat}><circle cx={x} cy={y} r={9} fill={color} stroke="#0a0d11" strokeWidth={3} /><text x={x + 13} y={y + 5} fill="#fff" fontSize={20} stroke="#000" strokeWidth={4} paintOrder="stroke">{label}</text></g>; };
  return (
    <div className="mapwrap">
      <canvas ref={ref} aria-label="Shaded relief rendered from MOLA elevations" role="img" />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, cursor: onPick ? "crosshair" : "default" }} onClick={click} aria-label="Route overlay">
        {paths.map(p => <path key={p.s} d={p.d} fill="none" stroke="#0a0d11" strokeWidth={9} opacity={.5} strokeLinejoin="round" />)}
        {paths.map(p => <path key={p.s + "c"} d={p.d} fill="none" stroke={STRATEGY_COLOR[p.s]} strokeWidth={5} strokeDasharray={p.s === "shortest" ? "14 9" : undefined} strokeLinejoin="round" />)}
        {stops.map((s, i) => mark(s, "#b48ead", `S${i + 1}`))}
        {mark(origin, "#62b8a4", "BASE")}{mark(destination, "#e8794a", "TARGET")}
      </svg>
      <span className="map-credit">NASA MGS MOLA 463 m DEM · {hf.display_pixel_m.toFixed(0)} m display cells · relief shading is a rendering, not data</span>
    </div>
  );
}
