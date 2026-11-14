# Demo script (≈ 4 minutes) — "REAL DATA → MEASURABLE RISK → EXPLAINABLE DECISION → REVISED MISSION"

Setup (before judging): API running (`npm run api` or hosted URL baked into `NEXT_PUBLIC_API_URL`), web app open. If the API dies mid-demo the header turns "API offline · Precomputed snapshot" and every step below still works for this scenario (answers are clearly labelled).

1. **Overview (0:00)** — "A two-person crew leaves a base at the Jezero crater reference point for a rim target ~25 km away." Point at *Recommended*, *Return margin*, *Terrain resolution 463 m*, *Certification: not certifiable*.
2. **Mars Explorer (0:30)** — rotate the globe, switch layers (Viking optical, THEMIS thermal); green boxes = where real numeric MOLA elevation exists. Click *Terrain*.
3. **Terrain (1:00)** — relief map: the **dashed shortest line crosses the rim**; red = slopes above the 15° limit. Profile chart: shortest route climbs an 18° ridge, the detours (teal/amber) go around it. Say: "These are measured MOLA elevations, bilinear-interpolated, 463 m grid — this cannot see boulders."
4. **Planner (1:45)** — table: shortest violates `max slope`; resource-conservative is recommended (14.8 % limiting margin on the time window); science route is feasible but thinner. Show *Why they differ* bars and the explanation sentence.
5. **Risk Lab (2:15)** — "74.7 % of 3,000 simulated scenarios satisfy the constraints — **hypothetical inputs, not a survival probability**." Show tornado: travel speed and unresolved terrain dominate; measurement vs model vs scenario spread; "Why this result?" panel and result hash.
6. **Emergency (2:55)** — default incident: 35 % battery loss + 30 % speed loss at 60 % outbound. Press *Simulate*: Original feasible → Failure (continue) violates energy/time → **Revised: abort to base, feasible with 13.5 % margin**. Read the cause column; show levers and "unavoidable uncertainty".
7. **ARES (3:30)** — click "Why can the system not certify this mission?" and "Which assumption contributes the most uncertainty?"; point at *Calculation-based* badge and tools used.
8. **Reports (3:50)** — export PDF/JSON/GeoJSON; show data-source classes A–E and the challenge-alignment table including the *partial* items.

Commands: `.venv/bin/python -m uvicorn api.main:app --port 8000` · `npm run build && python3 -m http.server 3000 --directory out`.
Reproducibility: demo inputs live in `api/data/demo_scenario.json`; seed 20261114.
