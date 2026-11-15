"use client";
import { AlertTriangle, Info, LoaderCircle } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import type { DatasetLayer } from "@/lib/types";

export function Panel({ title, right, children, className = "" }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><header><h3>{title}</h3>{right}</header><div className="body">{children}</div></section>;
}
export function Stat({ label, value, detail, tone }: { label: string; value: ReactNode; detail?: ReactNode; tone?: "ok" | "bad" | "warn" }) {
  return <div className={`stat ${tone ?? ""}`}><span className="l">{label}</span><span className="v">{value}</span>{detail && <span className="d">{detail}</span>}</div>;
}
export function Badge({ children, tone }: { children: ReactNode; tone?: "ok" | "bad" | "warn" | "info" }) { return <span className={`badge ${tone ?? ""}`}>{children}</span>; }
export function ClassBadge({ c, title }: { c: DatasetLayer["class"]; title?: string }) { return <span className={`badge cls cls-${c}`} title={title ?? CLASS_TITLE[c]}>{c}</span>; }
export const CLASS_TITLE: Record<string, string> = { A: "Direct observation / gridded instrument product", B: "Derived calculation", C: "Model assumption", D: "Simulation output", E: "Missing data" };
export function Notice({ children, tone, icon = true }: { children: ReactNode; tone?: "bad" | "info"; icon?: boolean }) {
  return <div className={`notice ${tone ?? ""}`} role={tone === "bad" ? "alert" : "note"}>{icon && (tone === "info" ? <Info size={15} /> : <AlertTriangle size={15} />)}<div>{children}</div></div>;
}
export function Loading({ label }: { label: string }) { return <div className="empty" role="status"><LoaderCircle className="spin" size={18} aria-hidden /><span>{label}</span></div>; }
export function Empty({ title, children }: { title: string; children?: ReactNode }) { return <div className="empty"><b>{title}</b>{children && <span className="small">{children}</span>}</div>; }
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="empty" role="alert"><b style={{ color: "var(--bad)" }}>{message}</b>{retry && <button className="btn sm" onClick={retry}>Retry</button>}</div>;
}
export function NumField({ label, value, onChange, min, max, step = 1, unit, hint }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string; hint?: string }) {
  return <label className="field"><span>{label}{unit ? ` (${unit})` : ""}</span>
    <input type="number" inputMode="decimal" value={Number.isFinite(value) ? value : ""} min={min} max={max} step={step}
      onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(min !== undefined && max !== undefined ? Math.max(min, Math.min(max, v)) : v); }} />
    {hint && <small>{hint}</small>}</label>;
}
export function Range({ label, value, onChange, min, max, step = 1, unit = "" }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string }) {
  return <label className="range"><span>{label}<b>{value}{unit}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} /></label>;
}
export function PageHead({ icon: Icon, title, children, right }: { icon?: ComponentType<{ size?: number }>; title: string; children?: ReactNode; right?: ReactNode }) {
  return <div className="pagehead"><div className="ph-main">{Icon && <span className="ph-ico" aria-hidden><Icon size={18} /></span>}<div><h1>{title}</h1>{children && <p>{children}</p>}</div></div>{right && <div className="ph-right">{right}</div>}</div>;
}
