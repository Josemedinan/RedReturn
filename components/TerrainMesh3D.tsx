"use client";
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { useMemo, useState } from "react";
import { BufferAttribute, PlaneGeometry } from "three";
import type { Heightfield, RouteAlt } from "@/lib/types";
import { STRATEGY_COLOR } from "@/lib/format";

const SIZE = 10;
export default function TerrainMesh3D({ hf, routes, show }: { hf: Heightfield; routes: RouteAlt[]; show: string[] }) {
  const [exag, setExag] = useState(4);
  const model = useMemo(() => {
    const { rows, cols, bounds: b } = hf; const z = hf.elevation_m;
    const valid = z.filter((v): v is number => v !== null); const lo = Math.min(...valid), hi = Math.max(...valid);
    const widthM = (b.lon_max - b.lon_min) * Math.cos(((b.lat_max + b.lat_min) / 2) * Math.PI / 180) * 59274, heightM = (b.lat_max - b.lat_min) * 59274; // ~m per degree on Mars
    const sx = SIZE, sz = SIZE * (heightM / widthM), unit = SIZE / widthM;            // world units per metre (horizontal)
    const geo = new PlaneGeometry(sx, sz, cols - 1, rows - 1); geo.rotateX(-Math.PI / 2);
    const colors = new Float32Array(rows * cols * 3);
    for (let i = 0; i < rows * cols; i++) { const v = z[i]; const t = v === null ? 0 : (v - lo) / Math.max(1, hi - lo); colors.set(v === null ? [1, 0, 1] : [.16 + .8 * t, .2 + .5 * t, .28 + .2 * (1 - t) + .3 * t * t], i * 3); }
    geo.setAttribute("color", new BufferAttribute(colors, 3));
    return { geo, lo, hi, unit, sx, sz, b, z, rows, cols };
  }, [hf]);
  const { geo, lo, unit, sx, sz, b } = model;
  useMemo(() => { const pos = geo.attributes.position as BufferAttribute; for (let i = 0; i < model.z.length; i++) pos.setY(i, ((model.z[i] ?? lo) - lo) * unit * exag); pos.needsUpdate = true; geo.computeVertexNormals(); }, [geo, model.z, lo, unit, exag]);
  const to = (lat: number, lon: number, e: number | null): [number, number, number] => [((lon - b.lon_min) / (b.lon_max - b.lon_min) - .5) * sx, ((e ?? lo) - lo) * unit * exag + .04, -((lat - b.lat_min) / (b.lat_max - b.lat_min) - .5) * sz];
  return (
    <div className="mapwrap" style={{ height: 380 }}>
      <Canvas camera={{ position: [0, 6, 9], fov: 42 }} dpr={[1, 1.5]} gl={{ antialias: true }} aria-label="3D terrain from MOLA elevations">
        <color attach="background" args={["#07090c"]} />
        <ambientLight intensity={.55} /><directionalLight position={[6, 8, 4]} intensity={1.6} />
        <mesh geometry={geo}><meshStandardMaterial vertexColors roughness={1} flatShading={false} /></mesh>
        {routes.filter(r => show.includes(r.strategy)).map(r => <Line key={r.strategy} points={r.coordinates.map(c => to(c.lat, c.lon, c.elevation_m))} color={STRATEGY_COLOR[r.strategy]} lineWidth={2.5} />)}
        <OrbitControls enableDamping dampingFactor={.08} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
      <label className="range" style={{ position: "absolute", left: 10, bottom: 8, width: 190, background: "rgba(10,13,17,.8)", padding: "4px 8px", borderRadius: 6 }}><span>Vertical exaggeration<b>{exag}×</b></span><input type="range" min={1} max={12} step={0.5} value={exag} onChange={e => setExag(Number(e.target.value))} /></label>
      <span className="map-credit" style={{ left: "auto", right: 8 }}>3D render of MOLA 463 m elevations · exaggerated vertically</span>
    </div>
  );
}
