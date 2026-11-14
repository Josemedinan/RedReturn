# Judging evidence

The official 2026 *Judging & Awards Guide* was not accessible (published 13 Nov; not read). The criteria below are therefore **generic dimensions**, not the official rubric; treat the mapping as unverified against 2026 rules.

| Dimension | Evidence in this repository |
|---|---|
| Relevance to the chosen challenge | `CHALLENGE_ALIGNMENT.md` maps each stated requirement to features, including the partial/unmet ones. |
| Scientific validity | Real MOLA int16 elevations (`DATA_PROVENANCE.md`), Horn slope, independent rasterio cross-check, 74 pytest + 23 Vitest cases, golden vectors shared by Python and TS, explicit refusal to certify (`SCIENTIFIC_VALIDATION.md`). |
| Impact / usefulness | One concrete decision surfaced from data: the geometrically shortest route breaks a 15° slope limit (18.1°) while a ~2.5–3 km detour avoids it with ≈27 % less climb (640 vs 871 m); after a simulated battery+speed failure the model flips the decision to *abort and return* (13.5 % margin vs −19.7 % if continuing). |
| Originality | Failure-aware ORIGINAL / FAILURE / REVISED comparison; measurement-vs-model-vs-scenario uncertainty decomposition; calculation-backed assistant with provenance badges; data classes A–E in the UI. |
| Reliability in a live demo | Static web app + small API; precomputed-snapshot fallback; deterministic seeds; `GET /api/diagnostics`. |
| Presentation | Dark mission-operations UI, responsive 375 px → desktop, keyboard shortcuts, reduced-motion support, loading/empty/error states. |

## Draft project description (≤ 200 words)
RedReturn answers one question for a Mars surface excursion: *can the crew reach a science target, survive plausible failures, and return with margin?* It loads real NASA MGS MOLA elevation data (463 m grid) for Jezero and Gale, and plans four route strategies with explicit slope and data-gap rules. In our demo the straight line to a crater-rim target crosses an 18° slope; terrain-aware and resource-conservative routes avoid it with a small detour. A seeded Monte Carlo shows which assumptions dominate uncertainty (and is labelled hypothetical, not a survival probability). An emergency simulator injects a battery and speed failure mid-traverse, recalculates every consumable, compares original / failure / revised missions, and recommends aborting to base. ARES explains results from the calculations only. Everything is traceable: dataset provenance, reproducibility hashes, PDF/JSON/GeoJSON exports. RedReturn never certifies a route; it is an educational decision-support prototype, not validated or endorsed by NASA.

## SI-tool use disclosure (required by the official FAQ)
The codebase pre-existed; this iteration (audit, DEM pipeline, routing, risk/emergency engines, API refactor, UI rebuild, tests and documentation) was produced with an AI coding assistant (Claude, Anthropic) driven by a team member, with web research, local execution and browser checks. All calculations are deterministic code; the optional language-model layer is off by default and never supplies numbers. The team should review and edit this statement before submitting.

## Demo plan
See `DEMO_SCRIPT.md` (≈ 4 min). Video/slide format requirements from the official submission guide are **unverified**.
