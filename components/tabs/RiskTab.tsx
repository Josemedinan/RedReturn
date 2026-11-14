"use client";
import { useEffect } from "react";
import { useMissionStore } from "@/lib/store";
import { fmt, FACTOR_LABEL, STRATEGY_LABEL } from "@/lib/format";
import { Badge, Empty, ErrorState, Loading, Notice, Panel, Stat } from "../ui";
import { MarginHistogram, Tornado } from "../charts";

export function RiskTab() {
  const s = useMissionStore(); const r = s.risk; const alt = s.alternatives;
  useEffect(() => { if (alt && !r && !s.busy.risk && !s.errors.risk) void s.runRisk(); }, [alt]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!alt) return <Panel title="Risk Lab">{s.busy.alt ? <Loading label="Planning routes first…" /> : <Empty title="Plan a route first">Risk analysis runs on the recommended route.</Empty>}</Panel>;
  const strategy = alt.recommended ?? s.strategy;
  return (
    <div className="stack">
      <Notice><b>Hypothetical ensemble — not a survival probability.</b> The input spreads below are assumptions chosen to explore sensitivity. The output is the share of simulated scenarios that satisfy the modelled constraints, nothing more.</Notice>
      <div className="row between"><span className="small muted">Route analysed: <b>{STRATEGY_LABEL[strategy]}</b> · seeded, reproducible</span><button className="btn primary" onClick={() => void s.runRisk()} disabled={s.busy.risk}>{s.busy.risk ? "Running…" : "Re-run ensemble"}</button></div>
      {s.busy.risk && !r && <Loading label="Running seeded Monte Carlo…" />}
      {s.errors.risk && !r && <ErrorState message={s.errors.risk} retry={() => void s.runRisk()} />}
      {r && <>
        <div className="grid g4">
          <Stat label="Scenarios satisfying constraints" value={`${fmt(r.fraction_satisfying_constraints * 100, 1)}%`} detail={`MC sampling interval ${fmt(r.monte_carlo_sampling_interval_95.low * 100, 1)}–${fmt(r.monte_carlo_sampling_interval_95.high * 100, 1)}% (95%, sampling error only)`} tone={r.fraction_satisfying_constraints > 0.9 ? "ok" : r.fraction_satisfying_constraints > 0.6 ? "warn" : "bad"} />
          <Stat label="Dominant failure mode" value={r.dominant_failure_mode ? FACTOR_LABEL[r.dominant_failure_mode] : "None"} detail={r.dominant_failure_mode ? `${r.dominant_failure_mode_counts[r.dominant_failure_mode]} of ${r.runs} runs` : "no failing runs"} />
          <Stat label="Total time P10 / P50 / P90" value={`${fmt(r.distributions.duration_hours.p50)} h`} detail={`${fmt(r.distributions.duration_hours.p10)} – ${fmt(r.distributions.duration_hours.p90)} h`} />
          <Stat label="Limiting margin P10 / P50 / P90" value={`${fmt(r.distributions.limiting_margin_percent.p50)}%`} detail={`${fmt(r.distributions.limiting_margin_percent.p10)} – ${fmt(r.distributions.limiting_margin_percent.p90)}%`} />
        </div>
        <div className="grid g2">
          <Panel title="Distribution of limiting margin" right={<Badge tone="info">class D · simulation</Badge>}><MarginHistogram hist={r.margin_histogram} /><p className="tiny dim">Red bars: scenarios where at least one modelled constraint fails ({r.runs} runs, seed {r.seed}).</p></Panel>
          <Panel title="Sensitivity (what moves the margin)" right={<Badge tone="info">class D</Badge>}><Tornado rows={r.sensitivity} /><p className="tiny dim">Swing in limiting margin between the P10 and P90 of each assumed input, others nominal. Blue = measurement/resolution, amber = model, violet = scenario.</p></Panel>
        </div>
        <div className="grid g2">
          <Panel title="Resource outcomes at base (P10 · P50 · P90)">
            <table className="t"><thead><tr><th>Quantity</th><th>P10</th><th>P50</th><th>P90</th></tr></thead><tbody>
              {([["Oxygen remaining (kg)", "oxygen_remaining_kg"], ["Energy remaining (kWh)", "energy_remaining_kwh"], ["Water remaining (L)", "water_remaining_liters"], ["Dose (mSv)", "radiation_msv"]] as const).map(([l, k]) => <tr key={k}><td>{l}</td>{(["p10", "p50", "p90"] as const).map(q => <td key={q} className="n">{fmt(r.distributions[k][q], 2)}</td>)}</tr>)}
            </tbody></table>
            <p className="tiny dim">Quantiles describe the simulated outcomes under assumed inputs; they are not confidence intervals on truth.</p>
          </Panel>
          <Panel title="Measurement vs model vs scenario uncertainty"><table className="t"><thead><tr><th>Source active</th><th>Margin P10–P90</th><th>Spread</th></tr></thead><tbody>
            {Object.entries(r.uncertainty_decomposition).map(([k, v]) => <tr key={k}><td style={{ textTransform: "capitalize" }}>{k}</td><td className="n">{fmt(v.margin_p10)} … {fmt(v.margin_p90)}%</td><td className="n">{fmt(v.spread_percent_points)} pts</td></tr>)}
          </tbody></table><p className="tiny dim">Each row runs the ensemble with only that class of uncertainty active. Larger spread = more of the decision depends on it.</p></Panel>
        </div>
        <div className="grid g2">
          <Panel title="Why this result?">
            <ol className="small stack" style={{ margin: 0, paddingLeft: 18 }}>
              <li>The deterministic engine computes the nominal mission: {r.deterministic ? `${fmt(r.deterministic.duration_hours)} h, limiting factor ${FACTOR_LABEL[r.deterministic.limiting_factor]} at ${fmt(r.deterministic.limiting_margin_percent)}% margin` : "see Planner"}.</li>
              <li>The ensemble perturbs {r.assumptions.length} inputs (table at right) with a seeded generator ({r.engine.rng}); each draw goes through the <b>same</b> deterministic equations.</li>
              <li>A run passes only if oxygen, energy, water, dose and time constraints all hold. The reported share is {fmt(r.fraction_satisfying_constraints * 100, 1)}%.</li>
              <li>{r.sensitivity[0] ? `The largest swing comes from “${r.sensitivity[0].label}” (${fmt(r.sensitivity[0].swing_percent_points)} pts) — the assumption to firm up first.` : "No input varied."}</li>
              <li>Reproduce: same request + seed ⇒ result hash <span className="num tiny">{r.result_sha256.slice(0, 16)}…</span></li>
            </ol>
          </Panel>
          <Panel title="Assumed input distributions" right={<Badge tone="warn">class C</Badge>}><div className="tscroll"><table className="t"><thead><tr><th>Input</th><th>Class</th><th>Spread</th></tr></thead><tbody>
            {r.assumptions.map(a => <tr key={a.name} title={a.rationale}><td>{a.label}</td><td><Badge tone={a.kind === "measurement" ? "info" : a.kind === "model" ? "warn" : undefined}>{a.kind}</Badge></td><td className="n">{a.law === "triangular" ? `${a.lo}/${a.mode}/${a.hi} h` : `σ ${a.sigma}`}</td></tr>)}
          </tbody></table></div></Panel>
        </div>
      </>}
    </div>
  );
}
