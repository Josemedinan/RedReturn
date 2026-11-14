# Verification record

Only commands and checks **actually executed** are listed. Date: 2026-11-14. Machine: macOS (Darwin 25.5), Node v25.9.0, npm 11.12.1, Python 3.12.11 (venv), Next.js 15.5.27, Vitest 3.2.7, pytest 9.2.0.

## Automated (all executed, all passed)
| Command | Result |
|---|---|
| `npm ci` | PASS – 215 packages installed |
| `npm run typecheck` (`tsc --noEmit`) | PASS – no errors |
| `npm test` | PASS – 23/23 Vitest cases (geodesy, TS mission mirror, **golden parity with Python**, conceptual terrain, catalog) |
| `npm run build` | PASS – "Compiled successfully", types valid, static export 4/4 pages, `/` 270 kB (373 kB first load), `out/` 3.1 MB |
| `.venv/bin/python -m pytest api -q` | PASS – 74 passed (includes the 6 legacy cases in `api/test_main.py`) |
| `.venv/bin/python -m pytest api/test_main.py -q` | PASS – 6 passed |
| clean venv from `api/requirements.txt` (`uv venv` + install + pytest) | PASS – 74 passed |
| `ruff check api scripts --select F,E9` | PASS |
| `python scripts/gen_golden.py && git diff --exit-code tests/golden` | PASS – no drift |

Coverage of required checks: great-circle, longitude normalisation, antimeridian, polar (`test_geodesy.py`, Vitest); DEM sampling at known cells incl. independent rasterio cross-check, nodata propagation, slope of a known plane, outside coverage (`test_dem.py`); terrain-aware pathfinding, blocked route, nodata blocking, strategy cost differences on the real DEM, science stops/downgrade, obstruction (`test_routing.py`); oxygen/water/energy accounting, return trip, reserve boundary, impossible missions, climb energy (`test_mission_risk_emergency.py`); Monte Carlo reproducibility and sensitivity (same file); emergency recalculation incl. zero-incident identity (same file); frontend/backend parity (golden vectors, both runtimes); API error contracts, rate/body limits, CORS, OpenAPI, GeoJSON validity, JSON report reproducibility (`test_api_contracts.py`).

## Real-data checks (executed)
- `scripts/build_mola_windows.py` read the remote 2.1 GB GeoTIFF via range requests (~43 s) → two 1025×1025 windows, valid fraction 1.0, Jezero −4865…+1660 m.
- Jezero reference point (18.38°N, 77.58°E) = −2644 m above the areoid (plausible for the crater floor).
- NASA Trek: 5 layers × 2 level-0 tiles returned HTTP 200 with `Access-Control-Allow-Origin: *`.
- Official challenge/FAQ pages read in the built-in browser; Global Offers page is login-gated (not read).

## Browser QA (manual, built-in browser, executed)
- Live API: Overview, Terrain (relief map + elevation/slope charts), Planner, Risk Lab (3,000-run result rendered), Emergency (simulate → ORIGINAL/FAILURE/REVISED rendered), Explorer (globe + map) all rendered with data.
- **Offline fallback observed:** with the API unreachable the header showed "API offline · Precomputed snapshot" and the Terrain tab still rendered the demo scenario.
- Mobile (375×812 emulation): `scrollWidth − clientWidth = 0` on all eight tabs; Overview screenshot reviewed.
- Globe mount/unmount ×2: no uncaught errors (checked with an in-page error listener) after replacing drei `<Html>` labels (which had thrown a `removeChild` error).
- Defects found and fixed during QA: header overflowing the viewport; top tabs unreachable at 800 px (bottom nav now ≤ 1100 px); globe atmosphere too strong; label overlap.

## NOT executed / unverified
- Playwright end-to-end suite (not written); automated accessibility (axe/Lighthouse); visual regression; tablet-size and real-device checks.
- Docker image builds (`Dockerfile`, `api/Dockerfile`) and `render.yaml` deployment – not run.
- Optional language-model path (`OPENAI_API_KEY`/`OPENAI_MODEL`) – no key; code path unexercised (the unavailable branch *is* tested).
- `npm audit` / dependency vulnerability scan.
- Official judging rubric and submission guide (not accessible).
- Any validation of the physical model against real mission data.
