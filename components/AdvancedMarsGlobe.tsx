"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, BackSide, Color, DoubleSide, Quaternion, SRGBColorSpace, Vector3 } from "three";
import { CATALOG, tileUrl, type LayerId } from "@/data/catalog";
import { coordinateToVector, normalizeLon, type Coordinate } from "@/lib/mars";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ATMO_V = `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const ATMO_F = `uniform vec3 glow; varying vec3 vN; varying vec3 vW; void main(){ vec3 v = normalize(cameraPosition - vW); float r = pow(max(0.0,0.72-dot(vN,v)),2.7); gl_FragColor = vec4(glow, smoothstep(0.0,0.85,r)*0.32); }`;

function Beacon({ point, color }: { point: Coordinate; color: string }) {
  const pos = useMemo(() => new Vector3(...coordinateToVector(point, 2.03)), [point]);
  const q = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), pos.clone().normalize()), [pos]);
  return <group position={pos} quaternion={q}>
    <mesh position={[0, .1, 0]}><cylinderGeometry args={[.006, .014, .2, 8]} /><meshBasicMaterial color={color} /></mesh>
    <mesh position={[0, .21, 0]}><octahedronGeometry args={[.035, 0]} /><meshBasicMaterial color={color} /></mesh>
  </group>;
}

function Planet({ layer, origin, destination, onPick, segments, onReady }: { layer: LayerId; origin: Coordinate; destination: Coordinate; onPick: (p: Coordinate) => void; segments: [number, number]; onReady: () => void }) {
  const [west, east] = useTexture([tileUrl(layer, 0), tileUrl(layer, 1)]);
  useEffect(() => { onReady(); }, [west, east, onReady]);
  [west, east].forEach(t => { t.colorSpace = SRGBColorSpace; t.anisotropy = 4; });
  const pick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const p = e.point.clone().normalize();
    onPick({ lat: 90 - Math.acos(clamp(p.y, -1, 1)) * 180 / Math.PI, lon: normalizeLon(Math.atan2(p.z, -p.x) * 180 / Math.PI - 180) });
  };
  return <group rotation={[0, -Math.PI / 2, 0]}>
    <mesh onClick={pick}><sphereGeometry args={[2, segments[0], segments[1], 0, Math.PI]} /><meshStandardMaterial map={west} roughness={.9} /></mesh>
    <mesh scale={1.001} onClick={pick}><sphereGeometry args={[2, segments[0], segments[1], Math.PI, Math.PI]} /><meshStandardMaterial map={east} roughness={.9} side={DoubleSide} /></mesh>
    <mesh scale={1.07} renderOrder={-1}><sphereGeometry args={[2, 64, 48]} /><shaderMaterial vertexShader={ATMO_V} fragmentShader={ATMO_F} uniforms={{ glow: { value: new Color("#c86f56") } }} side={BackSide} blending={AdditiveBlending} transparent depthWrite={false} /></mesh>
    {CATALOG.map(c => <mesh key={c.id} position={coordinateToVector(c, 2.02)}><sphereGeometry args={[.012, 8, 8]} /><meshBasicMaterial color="#c4a174" /></mesh>)}
    <Beacon point={origin} color="#62b8a4" /><Beacon point={destination} color="#e8794a" />
  </group>;
}

/** Smoothly flies the camera above a point when `focus` changes. */
function CameraRig({ focus, reduced }: { focus: Coordinate | null; reduced: boolean }) {
  const { camera } = useThree();
  const target = useRef<Vector3 | null>(null);
  useEffect(() => { if (!focus) return; const v = new Vector3(...coordinateToVector(focus, 1)).applyAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2); target.current = v.multiplyScalar(5.2); }, [focus]);
  useFrame((_, dt) => {
    if (!target.current) return;
    if (reduced) { camera.position.copy(target.current); target.current = null; return; }
    camera.position.lerp(target.current, 1 - Math.pow(0.002, dt));
    if (camera.position.distanceTo(target.current) < 0.02) target.current = null;
  });
  return null;
}

export default function AdvancedMarsGlobe({ layer, origin, destination, focus, onPick }: { layer: LayerId; origin: Coordinate; destination: Coordinate; focus: Coordinate | null; onPick: (p: Coordinate) => void }) {
  const [key, setKey] = useState(0);
  const [lost, setLost] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reduced, setReduced] = useState(false);
  const small = typeof window !== "undefined" && window.innerWidth < 760;
  useEffect(() => { setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  return <div className="globe" aria-label="Interactive 3D Mars globe. Click the surface to set the selected point.">
    <div className="overlay"><span className="chip ok">Base</span><span className="chip warn">Target</span><span className="chip">Click surface to set {""}selected point</span></div>
    {!loaded && <div className="empty" style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }} role="status"><span className="spin" aria-hidden /><span className="small">Loading NASA Trek tiles…</span></div>}
    {lost && <div className="empty" style={{ position: "absolute", inset: 0, zIndex: 3, background: "rgba(7,9,12,.9)" }} role="alert"><b>Graphics context lost</b><button className="btn sm" onClick={() => { setLost(false); setKey(k => k + 1); }}>Restore 3D view</button></div>}
    <Canvas key={key} camera={{ position: [0, .25, 5.65], fov: 40, near: .1, far: 180 }} dpr={[1, small ? 1.25 : 1.65]} gl={{ antialias: !small, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", e => { e.preventDefault(); setLost(true); });
        gl.domElement.addEventListener("webglcontextrestored", () => setLost(false));
      }}>
      <color attach="background" args={["#07090c"]} />
      <Stars radius={76} depth={44} count={small ? 500 : 1200} factor={1.6} saturation={0} fade speed={reduced ? 0 : .15} />
      <Suspense fallback={null}>
        <Planet layer={layer} origin={origin} destination={destination} onPick={onPick} segments={small ? [72, 48] : [128, 80]} onReady={() => setLoaded(true)} />
      </Suspense>
      <directionalLight position={[5, 2.5, 4]} intensity={2.8} color="#e6cbb7" /><ambientLight intensity={.3} color="#747e83" />
      <CameraRig focus={focus} reduced={reduced} />
      <OrbitControls autoRotate={!reduced && !focus} autoRotateSpeed={.35} enablePan={false} minDistance={2.5} maxDistance={8.5} enableDamping dampingFactor={.06} />
    </Canvas>
  </div>;
}
