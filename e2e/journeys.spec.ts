import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { API, gotoTab, openApp } from "./helpers";

test.describe("Live stack (web + API)", () => {
  test("1. opens the dashboard", async ({ page }) => {
    await openApp(page);
    await expect(page).toHaveTitle(/RedReturn/);
    await expect(page.getByRole("tab")).toHaveCount(8);   // desktop nav visible; the mobile bottom nav is hidden by CSS
    await expect(page.locator(".legal")).toContainText("Not operational guidance");
    await expect(page.locator(".stat", { hasText: "Terrain resolution" })).toContainText("463 m");
    await expect(page.getByText("not certifiable").first()).toBeVisible();
  });

  test("2. displays real NASA MOLA terrain data", async ({ page, request }) => {
    await openApp(page);
    await gotoTab(page, "terrain");
    await expect(page.locator("canvas[aria-label^='Shaded relief']")).toBeVisible();
    await expect(page.getByText("NASA MGS MOLA 463 m DEM")).toBeVisible();
    await expect(page.locator(".stat", { hasText: "DEM resolution" })).toContainText("463 m");
    await expect(page.locator(".stat", { hasText: "Window coverage" })).toContainText("100.0%");
    await expect(page.getByText("Elevation profile and slope")).toBeVisible();
    await expect(page.locator(".recharts-line").first()).toBeVisible();
    // the API serves the raw MOLA value; -2644.46 m was cross-checked against an independent rasterio read
    const r = await request.get(`${API}/api/terrain/elevation`, { params: { lat: 18.38, lon: 77.58 } });
    const j = await r.json();
    expect(j.elevation_m).toBeCloseTo(-2644.464, 2);
    expect(j.interpolated).toBe(true);
    expect(j.units).toContain("MOLA areoid");
    // outside coverage must be a typed error, never a fabricated number
    const out = await request.get(`${API}/api/terrain/elevation`, { params: { lat: 0, lon: 0 } });
    expect(out.status()).toBe(404);
    expect((await out.json()).error.code).toBe("outside_dem_coverage");
  });

  test("3. compares routes and explains the recommendation", async ({ page }) => {
    await openApp(page);
    await gotoTab(page, "planner");
    const rows = page.locator("table.t", { hasText: "Ascent" }).first().locator("tbody tr");
    await expect(rows).toHaveCount(4);
    await expect(rows.filter({ hasText: "Shortest geometric" })).toContainText("max slope");
    await expect(page.locator(".badge", { hasText: "Recommended: Resource-conservative" })).toBeVisible();
    await expect(page.getByText("Why they differ")).toBeVisible();
    await expect(page.getByText(/has the largest limiting margin/)).toBeVisible();
    const shortest = await rows.filter({ hasText: "Shortest geometric" }).locator("td").nth(5).innerText();
    const terrain = await rows.filter({ hasText: "Terrain-aware" }).locator("td").nth(5).innerText();
    expect(Number(shortest)).toBeCloseTo(18.1, 1);
    expect(Number(terrain)).toBeCloseTo(6.9, 1);
  });

  test("4. runs mission risk analysis with honest labelling and reproducible numbers", async ({ page, request }) => {
    await openApp(page);
    await gotoTab(page, "risk");
    await expect(page.getByText("not a survival probability")).toBeVisible();
    const stat = page.locator(".stat", { hasText: "Scenarios satisfying constraints" });
    await expect(stat).toContainText(/\d+\.\d%/, { timeout: 30_000 });
    await expect(stat).toContainText("sampling error only");
    await expect(page.locator(".recharts-bar-rectangle").first()).toBeVisible();
    await expect(page.getByText("Why this result?")).toBeVisible();
    // the live number must equal the committed snapshot (same seed + request ⇒ same result)
    const snap = await (await request.get("/data/demo-snapshot.json")).json();
    const shown = (await stat.locator(".v").innerText()).replace("%", "");
    expect(Number(shown)).toBeCloseTo(snap.risk.fraction_satisfying_constraints * 100, 1);
    await expect(page.getByText(snap.risk.result_sha256.slice(0, 16))).toBeVisible();
  });

  test("5-6. injects a battery failure and produces a revised return decision", async ({ page }) => {
    await openApp(page);
    await gotoTab(page, "emergency");
    await expect(page.getByText("Nothing simulated yet")).toBeVisible();
    await page.getByRole("button", { name: /Simulate failure/ }).click();
    await expect(page.getByText("Original vs failure vs revised")).toBeVisible();
    await expect(page.locator(".badge", { hasText: "Revised plan feasible in model" })).toBeVisible();
    await expect(page.getByText(/Usable battery capacity reduced 35%/)).toBeVisible();
    const options = page.locator("table.t", { hasText: "Needs extra" });
    await expect(options.locator("tr", { hasText: "Continue as planned" })).toContainText("infeasible");
    await expect(options.locator("tr", { hasText: "Continue as planned" })).toContainText("Energy -19.7%");
    await expect(options.locator("tr", { hasText: "Abort now and return to base" })).toContainText("feasible");
    await expect(options.locator("tr", { hasText: "Abort now and return to base" })).toContainText("Energy 13.5%");
    await expect(page.getByText("Unavoidable uncertainty")).toBeVisible();
    await expect(page.getByText(/not operational emergency guidance/i)).toBeVisible();
  });

  test("6b. reports when no option satisfies the model and what extra is required", async ({ page }) => {
    await openApp(page);
    await gotoTab(page, "emergency");
    const mag = page.locator("input[type=number]").first();
    await mag.fill("95");
    await page.getByRole("button", { name: /Simulate failure/ }).click();
    await expect(page.locator(".badge", { hasText: "No option satisfies the model" })).toBeVisible();
    await expect(page.locator("table.t", { hasText: "Needs extra" })).toContainText(/energy kwh \+/i);
  });

  test("7. exports PDF, JSON (with reproducibility metadata) and GeoJSON", async ({ page }) => {
    await openApp(page);
    await gotoTab(page, "reports");
    const grab = async (name: RegExp) => {
      const [d] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), page.getByRole("button", { name }).click()]);
      const p = await d.path();
      return { name: d.suggestedFilename(), buf: fs.readFileSync(p!) };
    };
    const json = await grab(/JSON \+ reproducibility/);
    expect(json.name).toBe("redreturn-report.json");
    const rep = JSON.parse(json.buf.toString());
    expect(rep.certification).toBe("NOT_CERTIFIABLE");
    expect(rep.reproducibility.request_sha256).toMatch(/^[0-9a-f]{16}$/);
    expect(rep.reproducibility.dem_windows.jezero.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(rep.alternatives.routes).toHaveLength(4);
    const geo = await grab(/GeoJSON routes/);
    const g = JSON.parse(geo.buf.toString());
    expect(g.type).toBe("FeatureCollection");
    const lines = g.features.filter((f: any) => f.geometry.type === "LineString");
    expect(lines.length).toBe(4);
    for (const f of lines) for (const [lon, lat] of f.geometry.coordinates) { expect(lon).toBeGreaterThanOrEqual(-180); expect(lon).toBeLessThanOrEqual(180); expect(Math.abs(lat)).toBeLessThanOrEqual(90); }
    const pdf = await grab(/PDF report/);
    expect(pdf.name).toBe("redreturn-report.pdf");
    expect(pdf.buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.buf.length).toBeGreaterThan(4000);
    await expect(page.getByText("Challenge alignment")).toBeVisible();
  });

  test("ARES answers from calculations and labels provenance", async ({ page }) => {
    await openApp(page);
    await gotoTab(page, "ares");
    await page.getByRole("button", { name: "Why can the system not certify this mission?" }).click();
    await expect(page.locator(".msg .badge", { hasText: "Calculation-based" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/cannot certify this mission/)).toBeVisible();
  });
});

test.describe("API unavailable (safe fallback)", () => {
  test("8. falls back to a clearly labelled snapshot and never invents numbers", async ({ page }) => {
    await openApp(page, { offline: true });
    await expect(page.locator(".chip", { hasText: "Precomputed snapshot" })).toBeVisible();
    await gotoTab(page, "terrain");
    await expect(page.locator("canvas[aria-label^='Shaded relief']")).toBeVisible();
    await gotoTab(page, "planner");
    await expect(page.locator("table.t", { hasText: "Ascent" }).first().locator("tbody tr")).toHaveCount(4);
    await gotoTab(page, "risk");
    await expect(page.locator(".stat", { hasText: "Scenarios satisfying constraints" })).toContainText(/\d+\.\d%/, { timeout: 30_000 });
    await gotoTab(page, "emergency");
    await page.getByRole("button", { name: /Simulate failure/ }).click();
    await expect(page.locator(".badge", { hasText: "Revised plan feasible in model" })).toBeVisible();
    await gotoTab(page, "ares");
    await page.getByRole("button", { name: "Which assumption contributes the most uncertainty?" }).click();
    await expect(page.getByText(/precomputed snapshot/).first()).toBeVisible();
    // export still works offline and says so
    await gotoTab(page, "reports");
    const [d] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /JSON \+ reproducibility/ }).click()]);
    expect(d.suggestedFilename()).toBe("redreturn-report-offline.json");
    // a non-demo input cannot be answered offline: explicit error, no fabricated route
    await gotoTab(page, "explorer");
    await page.getByLabel("Lat").nth(1).fill("18.7");
    await gotoTab(page, "planner");
    await expect(page.getByText("API offline").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("table.t", { hasText: "Ascent" })).toHaveCount(0);
  });
});

test.describe("Guided tour", () => {
  test("shows on first visit, walks the sections, and is remembered", async ({ page }) => {
    await openApp(page, { tour: true });
    const dlg = page.getByRole("dialog", { name: /Guided tour/ });
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText("Welcome to RedReturn");
    await dlg.getByRole("button", { name: "Take the tour" }).click();
    await dlg.getByRole("button", { name: "Next" }).click();           // Explorer
    await dlg.getByRole("button", { name: "Next" }).click();           // Terrain
    await expect(dlg).toContainText("3 · Terrain");
    await expect(page.getByRole("heading", { name: "Terrain", level: 1 })).toBeVisible();   // the tour navigates for you
    await dlg.getByRole("button", { name: "Back" }).click();
    await expect(dlg).toContainText("2 · Mars Explorer");
    await page.keyboard.press("Escape");                                 // skip
    await expect(dlg).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { name: /Can the crew reach the target/ })).toBeVisible();
    await expect(page.getByRole("dialog", { name: /Guided tour/ })).toBeHidden();   // remembered
    await page.getByRole("button", { name: "Show guided tour" }).click();           // replay from the ? button
    await expect(page.getByRole("dialog", { name: /Guided tour/ })).toContainText("Welcome to RedReturn");
  });
});

test.describe("Terrain map", () => {
  test("relief map and 3D mesh both render with routes, colour bar and exaggeration control", async ({ page }) => {
    await openApp(page);
    await gotoTab(page, "terrain");
    await expect(page.locator("canvas[aria-label^='Shaded relief']")).toBeVisible();
    await expect(page.locator(".cbar")).toBeVisible();
    await page.getByRole("button", { name: "3D mesh" }).click();
    await expect(page.locator("#main .mesh canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Vertical exaggeration")).toBeVisible();
    // A blank/black WebGL view compresses to a few hundred bytes; a rendered terrain with routes is far larger.
    await page.waitForTimeout(1500);
    const png = await page.locator("#main .mesh canvas").screenshot();
    expect(png.length).toBeGreaterThan(20_000);
  });
});
