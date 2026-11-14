"use client";
import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { useMissionStore } from "@/lib/store";
import { Badge, ErrorState, Loading, Notice, Panel } from "../ui";

const SUGGESTED = ["Why is this route preferable?", "What happens if battery capacity drops by 25%?", "How much additional oxygen would the mission require?",
  "Which assumption contributes the most uncertainty?", "What evidence supports this terrain classification?", "Which parts of the route lack adequate scientific data?",
  "What changes improve modeled return margins?", "Why can the system not certify this mission?"];

export function AresTab() {
  const s = useMissionStore(); const [q, setQ] = useState(""); const end = useRef<HTMLDivElement>(null);
  const ask = async (text: string) => { if (!text.trim()) return; setQ(""); await s.ask(text.trim()); setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50); };
  return (
    <div className="grid split-r">
      <div className="stack">
        <Panel title="Ask ARES"><form className="row" style={{ flexWrap: "nowrap" }} onSubmit={e => { e.preventDefault(); void ask(q); }}>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Ask about the current plan…" aria-label="Question for ARES" maxLength={500} />
          <button className="btn primary" type="submit" disabled={s.busy.ares || !s.alternatives} aria-label="Send question"><Send size={14} /></button></form>
          <div className="stack" style={{ marginTop: 10 }}>{SUGGESTED.map(x => <button key={x} className="btn sm" style={{ justifyContent: "flex-start", textAlign: "left" }} onClick={() => void ask(x)} disabled={s.busy.ares || !s.alternatives}>{x}</button>)}</div>
        </Panel>
        <Notice tone="info"><b>How ARES works.</b> It routes your question to the deterministic engines (routes, mission model, Monte Carlo, emergency replanning) and writes the answer from their outputs. Language-model paraphrase is optional, disabled here, and would never supply numbers.</Notice>
      </div>
      <div className="stack">
        {!s.alternatives && <Panel title="ARES"><Loading label="Waiting for a route plan…" /></Panel>}
        <div className="chat" aria-live="polite">
          {s.chat.length === 0 && s.alternatives && <Panel title="No questions yet"><p className="muted small">Pick a suggested question. Each answer lists the calculations used and its uncertainty.</p></Panel>}
          {s.chat.map((m, i) => <div key={i} className="stack">
            <div className="msg q">{m.q}</div>
            <div className="msg"><div className="row between" style={{ marginBottom: 6 }}><Badge tone="ok">Calculation-based</Badge><span className="tiny dim">{m.source === "snapshot" ? "precomputed snapshot" : "live"} · tools: {m.a.tools_used.join(", ")}</span></div>
              <p style={{ margin: "0 0 8px" }}>{m.a.answer}</p>
              {m.a.evidence.length > 0 && <details><summary className="small muted" style={{ cursor: "pointer" }}>Evidence ({m.a.evidence.length})</summary><ul className="tiny muted">{m.a.evidence.map(e => <li key={e}>{e}</li>)}</ul></details>}
              <div className="tiny dim" style={{ marginTop: 6 }}>Uncertainty: {m.a.uncertainty.join(" ")}</div>
              {m.a.suggested_experiments.length > 0 && <div className="row" style={{ marginTop: 6 }}><span className="tiny dim">Try next:</span>{m.a.suggested_experiments.map(x => <button key={x} className="btn sm" onClick={() => void ask(x)} disabled={s.busy.ares}>{x}</button>)}</div>}
            </div></div>)}
          {s.busy.ares && <Loading label="Running calculation tools…" />}
          {s.errors.ares && <ErrorState message={s.errors.ares === "API offline" ? "API offline — only precomputed demo answers are available for the demo scenario." : s.errors.ares} />}
          <div ref={end} />
        </div>
      </div>
    </div>
  );
}
