<p align="center"><img src="docs/assets/redreturn-banner.svg" alt="RedReturn" width="100%"></p>

# RedReturn — Mars mission decision intelligence

> **Can a crew reach a science target on Mars, survive plausible failures, and return with margin?**
> Real NASA MOLA elevation → route alternatives → explainable uncertainty → failure-aware revised mission.

Built for **NASA Space Apps 2026 — [Interplanetary Survival Guide: Martian Map](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/)**.
Educational research prototype. **Not operational guidance; never certifies a route; not validated or endorsed by NASA.**

## What it does
| Tab | Decision it supports |
|---|---|
| Overview | Is the mission feasible *within the model*, how thin is the return margin, how good is the data? |
| Mars Explorer | Pick base/target on a 3D globe + 2D map synced with NASA Trek layers (MOLA, Viking, THEMIS, TES); see where numeric terrain exists. |
| Terrain | Relief map / 3D mesh from **real MOLA elevations**, elevation + slope profiles, resolution and coverage disclosure. |
| Planner | Crew, rover, consumables, reserves, science stops; four route strategies with different objectives and the reason for the recommendation. |
| Risk Lab | Seeded Monte Carlo (hypothetical inputs), sensitivity, failure modes, P10/P50/P90, measurement-vs-model-vs-scenario uncertainty, "Why this result?". |
| Emergency | Inject battery/speed/oxygen/water/delay/comms/obstruction incidents → ORIGINAL vs FAILURE vs REVISED mission with causes, options and levers. |
| ARES | Questions answered **from the calculations** (provenance badge, tools used, uncertainty). Optional LLM paraphrase is off by default. |
| Reports | PDF, JSON (with reproducibility hashes), GeoJSON; data sources by class A–E; challenge alignment. |

## Quick start
```bash
# API (Python 3.12)
python3.12 -m venv .venv && .venv/bin/pip install -r api/requirements.txt
.venv/bin/python -m uvicorn api.main:app --port 8000        # docs: http://localhost:8000/docs

# Web (Node 22)
npm ci && npm run build && python3 -m http.server 3000 --directory out   # or: npm run dev
```
Set `NEXT_PUBLIC_API_URL` at build time to your deployed API. Copy `.env.example` for all variables.

## Verify
```bash
npm run typecheck && npm test        # TypeScript, 23 Vitest cases incl. golden parity with Python
.venv/bin/python -m pytest api -q    # 74 cases: geodesy, DEM, routing, mission, risk, emergency, API contracts
npm run build
```
Results actually recorded in [docs/VERIFICATION.md](docs/VERIFICATION.md).

## Real data
`api/data/dem/*.tif` are windows of the **USGS/NASA MGS MOLA 463 m DEM** (int16 metres above the MOLA areoid, nodata preserved) for Jezero and Gale, ~1 MB each with SHA-256 and source ETag. Rebuild with `scripts/build_mola_windows.py`. Colour tiles are display-only and never converted to numbers. See [docs/DATA_PROVENANCE.md](docs/DATA_PROVENANCE.md).

## Scientific rules enforced
Visual texture is not elevation · nodata stays missing · interpolated values are flagged · a 463 m DEM cannot see hazards under ~1 km · Monte Carlo output is **not** a survival probability · terrain-evaluated ≠ safe · no route is ever certified. Details: [docs/SCIENTIFIC_VALIDATION.md](docs/SCIENTIFIC_VALIDATION.md).

## API (OpenAPI at `/docs`)
`GET /api/health · /api/diagnostics · /api/datasets · /api/datasets/status · /api/terrain/coverage · /api/terrain/elevation · /api/terrain/heightfield · /api/demo` ·
`POST /api/terrain/profile · /api/routes/alternatives · /api/risk/analyze · /api/scenarios/simulate · /api/ares/ask · /api/reports/json · /api/reports/geojson`; legacy `/api/routes/plan|compare`, `/api/mission/evaluate|simulate`, `/api/ai/mission-copilot` (deprecated) kept. All errors: `{"error":{"code","message","details"}}`.

## Deploy
Static web: any static host (`out/`). API: `api/Dockerfile` or `render.yaml`; set `REDRETURN_CORS_ORIGINS` to the web origin. No secrets are needed for the demo; no promotional cloud credits are used.

## Docs
[AUDIT_2026](docs/AUDIT_2026.md) · [CHALLENGE_ALIGNMENT](docs/CHALLENGE_ALIGNMENT.md) · [DATA_PROVENANCE](docs/DATA_PROVENANCE.md) · [SCIENTIFIC_VALIDATION](docs/SCIENTIFIC_VALIDATION.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [DEMO_SCRIPT](docs/DEMO_SCRIPT.md) · [JUDGING_EVIDENCE](docs/JUDGING_EVIDENCE.md) · [GLOBAL_OFFERS](docs/GLOBAL_OFFERS.md) · [VERIFICATION](docs/VERIFICATION.md) · [FINAL_REPORT](docs/FINAL_REPORT.md)

## Known limitations
No rock/boulder or soil data; 463 m terrain only; two cached regions (Jezero, Gale); constant-rate resource model; no Playwright suite; optional LLM layer untested. See the audit.
