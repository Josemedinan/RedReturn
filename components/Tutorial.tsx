"use client";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Tab } from "@/lib/store";

export const TOUR_KEY = "redreturn.tour.v1";
export const tourSeen = () => { try { return localStorage.getItem(TOUR_KEY) === "done"; } catch { return false; } };
const markSeen = () => { try { localStorage.setItem(TOUR_KEY, "done"); } catch { /* private mode: tour may show again, harmless */ } };

type Step = { tab: Tab | null; title: string; body: string; tip?: string };
const STEPS: Step[] = [
  { tab: null, title: "Welcome to RedReturn", body: "A decision tool for a Mars surface excursion: can the crew reach the target, do the science and get back? It uses real NASA MOLA terrain and shows how every number was produced.", tip: "This 1-minute tour never changes your inputs. Press Esc any time to skip." },
  { tab: "overview", title: "1 · Overview", body: "Your mission at a glance: recommended route, return margin and a readiness checklist. “Load judge demo” restores the Jezero scenario at any time.", tip: "Keys 1–8 jump between sections." },
  { tab: "explorer", title: "2 · Mars Explorer", body: "Pick the base and the target on the 3D globe or 2D map, or search named features. Numeric terrain exists only inside the green DEM windows (Jezero, Gale).", tip: "Imagery layers are pictures; only the MOLA elevation grid enters calculations." },
  { tab: "terrain", title: "3 · Terrain", body: "Shaded relief and a 3D mesh of the real MOLA elevations with the four candidate routes on top. Red marks slopes above your limit; the table lists climb, descent and data gaps.", tip: "Drag the 3D view to orbit; the exaggeration slider only affects the picture." },
  { tab: "planner", title: "4 · Planner", body: "Set crew, rover, consumables, reserves and science stops. RedReturn plans shortest, terrain-aware, resource-conservative and science-prioritised routes and explains why they differ.", tip: "Select a row to make that route the working plan." },
  { tab: "risk", title: "5 · Risk Lab", body: "A seeded Monte Carlo ensemble perturbs the uncertain inputs. The result is the share of simulated scenarios meeting every modelled constraint — not a survival probability.", tip: "Same seed and request always reproduce the same result." },
  { tab: "emergency", title: "6 · Emergency", body: "Break the plan: battery loss, slower rover, blocked route, extra science time. The simulator compares continuing, rerouting, skipping science and aborting to base.", tip: "This is the “can we still get home?” moment." },
  { tab: "ares", title: "7 · ARES and Reports", body: "ARES answers questions using the calculation engines and shows its evidence. Reports exports a PDF, JSON with reproducibility data, and GeoJSON routes.", tip: "ARES never invents numbers: every figure comes from a tool run." },
  { tab: "overview", title: "Know the limits", body: "Terrain is a 463 m grid: boulders, dunes and small craters are not resolved. Resource rates are editable assumptions. “Terrain-evaluated” and “feasible within model” never mean safe, and nothing here is certified.", tip: "Replay this tour from the ? button in the top bar." },
];

export function Tutorial({ open, onClose, setTab, onStep }: { open: boolean; onClose: () => void; setTab: (t: Tab) => void; onStep: (t: Tab | null) => void }) {
  const [i, setI] = useState(0); const card = useRef<HTMLDivElement>(null);
  const step = STEPS[i], last = i === STEPS.length - 1, first = i === 0;
  const close = () => { markSeen(); onStep(null); onClose(); };
  useEffect(() => { if (open) setI(0); }, [open]);
  useEffect(() => { if (!open) return; if (step.tab) setTab(step.tab); onStep(step.tab); card.current?.focus(); }, [open, i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(); else if (e.key === "ArrowRight" && !last) setI(v => v + 1); else if (e.key === "ArrowLeft" && !first) setI(v => v - 1);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  return (
    <>
      {first && <div className="tour-backdrop" aria-hidden onClick={close} />}
      <div ref={card} tabIndex={-1} role="dialog" aria-label={`Guided tour, step ${i + 1} of ${STEPS.length}`} className={`tour ${first ? "welcome" : ""}`}>
        <button className="tour-x" aria-label="Skip tour" onClick={close}><X size={15} /></button>
        <div className="tour-step tiny">Step {i + 1} of {STEPS.length}</div>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        {step.tip && <p className="tip">{step.tip}</p>}
        <div className="tour-dots" aria-hidden>{STEPS.map((_, k) => <i key={k} className={k === i ? "on" : k < i ? "past" : ""} />)}</div>
        <div className="row between">
          <button className="btn sm" onClick={close}>{last ? "Close" : "Skip tour"}</button>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            {!first && <button className="btn sm" onClick={() => setI(v => v - 1)}><ArrowLeft size={13} />Back</button>}
            <button className="btn sm primary" onClick={() => (last ? close() : setI(v => v + 1))}>{last ? "Start exploring" : first ? "Take the tour" : "Next"}{!last && <ArrowRight size={13} />}</button>
          </div>
        </div>
      </div>
    </>
  );
}
