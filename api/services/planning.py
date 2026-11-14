"""Orchestration: tile lookup, route alternatives, mission evaluation per route. No HTTP concerns here."""
from __future__ import annotations

import hashlib
import json
from functools import lru_cache

from ..errors import ApiError
from ..scientific import dem
from ..scientific.mission import RouteSummary, evaluate
from ..scientific.routing import Mobility, optimised_route, shortest_route

LIMITATIONS = [
    "463 m elevation grid: rover-scale slopes, rocks, dunes and soft soil are not resolved or modelled.",
    "A route that satisfies the slope cap on this grid is terrain-evaluated, never terrain-safe or mission-safe.",
    "Resource rates, speed derating and constraint limits are editable assumptions, not validated vehicle data.",
    "This prototype cannot certify any route or mission for human exploration.",
]


def require_tile(points: list[tuple[float, float]]) -> dem.DemTile:
    tile = dem.tile_for_points(points)
    if tile is None:
        raise ApiError(422, "outside_dem_coverage",
                       "Origin and destination must both lie inside one cached MOLA window.",
                       {"windows": [t.coverage()["bounds"] | {"id": t.id} for t in dem.all_tiles().values()]})
    return tile


def stops_key(stops) -> tuple:
    return tuple((s.lat, s.lon, s.dwell_hours, s.weight, s.name or "") for s in stops)


def stops_from_key(key: tuple) -> list[dict]:
    return [{"lat": a, "lon": b, "dwell_hours": c, "weight": d, "name": e or None} for a, b, c, d, e in key]


@lru_cache(maxsize=256)
def plan_cached(tile_id: str, strategy: str, a: tuple, b: tuple, mob: Mobility, skey: tuple) -> dict:
    tile = dem.all_tiles()[tile_id]
    if strategy == "shortest":
        return shortest_route(tile, a, b, mob)
    return optimised_route(tile, strategy, a, b, mob, stops=stops_from_key(skey))


def public(route: dict) -> dict:
    return {k: v for k, v in route.items() if not k.startswith("_")}


def config_for(route: dict, cfg):
    """Science route adds the dwell of declared stops to the science budget."""
    visited = route.get("science_stops_visited") or []
    extra = sum(s["dwell_hours"] for s in visited)
    return cfg.model_copy(update={"science_hours": cfg.science_hours + extra}) if extra else cfg


def summary_of(route: dict) -> RouteSummary:
    return route["_summary_obj"]


def science_value(route: dict, stops: list[dict]) -> float:
    return 1.0 + sum(s["weight"] for s in (route.get("science_stops_visited") or []))


def alternatives(origin, dest, cfg, stops, strategies) -> dict:
    a, b = (origin.lat, origin.lon), (dest.lat, dest.lon)
    tile = require_tile([a, b])
    mob = Mobility.from_config(cfg)
    skey = stops_key(stops)
    out = []
    for st in strategies:
        route = plan_cached(tile.id, st, a, b, mob, skey)
        cfg_r = config_for(route, cfg)
        mission = evaluate(summary_of(route), cfg_r)
        item = public(route)
        item["mission"] = mission
        item["science_value"] = science_value(route, skey) if st == "science" and route["status"] == "ok" else 1.0
        item["mission_config_science_hours"] = cfg_r.science_hours
        out.append(item)
    rec, why = recommend(out)
    return {"tile": tile.coverage(), "resolution": dem.resolution_disclosure(tile), "routes": out, "recommended": rec,
            "comparison": compare(out), "reason": why, "limitations": LIMITATIONS,
            "certification": "NOT_CERTIFIABLE"}


def _viable(r: dict) -> bool:
    return r["status"] != "failed" and not r["constraints_violated"] and r["mission"]["feasible_within_model"]


def recommend(routes: list[dict]) -> tuple[str | None, str]:
    viable = [r for r in routes if _viable(r)]
    if viable:
        best = max(viable, key=lambda r: (r["mission"]["limiting_margin_percent"], -r["mission"]["duration_hours"]))
        others = [r for r in routes if r is not best]
        parts = [f"{best['strategy']} has the largest limiting margin ({best['mission']['limiting_margin_percent']:.1f}% on "
                 f"{best['mission']['limiting_factor']}) among routes with no slope/data violations that satisfy every modelled constraint."]
        for o in others:
            if o["constraints_violated"]:
                parts.append(f"{o['strategy']} violates: " + "; ".join(v["id"] for v in o["constraints_violated"]) + ".")
            elif not o["mission"]["feasible_within_model"]:
                parts.append(f"{o['strategy']} fails modelled constraints ({o['mission']['limiting_factor']}).")
            else:
                d = o["mission"]["limiting_margin_percent"] - best["mission"]["limiting_margin_percent"]
                parts.append(f"{o['strategy']} is feasible but its limiting margin differs by {d:+.1f} points.")
        return best["strategy"], " ".join(parts)
    least = min(routes, key=lambda r: (len(r["constraints_violated"]), -r["mission"]["limiting_margin_percent"]))
    return None, ("No route satisfies all modelled constraints. Closest: " + least["strategy"] +
                  f" (limiting factor {least['mission']['limiting_factor']}, margin {least['mission']['limiting_margin_percent']:.1f}%).")


def compare(routes: list[dict]) -> list[dict]:
    """Normalised components so the UI can show why alternatives differ."""
    keys = [("distance_km", "Distance (km)"), ("one_way_travel_hours", "One-way time (h)"),
            ("elevation_gain_m", "Ascent (m)"), ("max_slope_deg", "Max slope (°)")]
    rows = []
    for k, label in keys:
        vals = {r["strategy"]: (r["metrics"].get(k) or 0.0) for r in routes}
        hi = max(vals.values()) or 1.0
        rows.append({"metric": k, "label": label, "values": vals, "normalised": {s: v / hi for s, v in vals.items()}})
    en = {r["strategy"]: r["mission"]["energy_used_kwh"] for r in routes}
    hi = max(en.values()) or 1.0
    rows.append({"metric": "energy_used_kwh", "label": "Round-trip energy (kWh)", "values": en, "normalised": {s: v / hi for s, v in en.items()}})
    return rows


def request_hash(model) -> str:
    return hashlib.sha256(json.dumps(model.model_dump(), sort_keys=True).encode()).hexdigest()[:16]
