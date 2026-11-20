#!/usr/bin/env python3
"""Catalog matching helpers shared by the private OCR service."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any


def load_json(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


class ServiceError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def exact_candidates(report: dict[str, Any]) -> list[dict[str, Any]]:
    candidates = []
    for item in report.get("candidates", []):
        match = item.get("match") or {}
        if match.get("core_name_exact") and match.get("core_number_exact") and not match.get("hard_conflicts"):
            candidates.append(item)
    candidates.sort(key=lambda item: float((item.get("match") or {}).get("score", 0)), reverse=True)
    return [item.get("summary", {}) for item in candidates[:6]]


def bounded_text(value: Any, limit: int = 120) -> str:
    if isinstance(value, (str, int, float)) and not isinstance(value, bool):
        return str(value).strip()[:limit]
    return ""


def bounded_list(value: Any, limit: int = 8) -> list[str]:
    if not isinstance(value, list):
        return []
    return [text for item in value if (text := bounded_text(item, 100))][:limit]


def field_confidence(fields: dict[str, Any], name: str) -> float:
    confidence = fields.get("fieldConfidence")
    value = confidence.get(name, 0.75) if isinstance(confidence, dict) else 0.75
    try:
        return max(0.0, min(0.98, float(value)))
    except (TypeError, ValueError):
        return 0.75


def gemma_value(fields: dict[str, Any], source: str) -> Any:
    if source == "attacks":
        rows = fields.get(source)
        if not isinstance(rows, list):
            return None
        return [
            {"name": names[0], "damage": bounded_text(row.get("damage"), 12), "cost": bounded_list(row.get("cost"), 6)}
            for row in rows if isinstance(row, dict)
            if (names := bounded_list(row.get("names") or row.get("name"), 4))
        ]
    if source in {"types", "abilities"}:
        return bounded_list(fields.get(source), 8) or None
    if source in {"weaknesses", "resistances"}:
        values = fields.get(source)
        if not isinstance(values, list):
            return None
        return [
            {"type": bounded_text(row.get("type"), 32), "value": bounded_text(row.get("value"), 16)}
            for row in values if isinstance(row, dict)
        ] or None
    return bounded_text(fields.get(source), 120) or None


def merge_scan_keys(scan: dict[str, Any], fields: dict[str, Any]) -> dict[str, Any]:
    merged = json.loads(json.dumps(scan)) if isinstance(scan, dict) else {}
    keys = merged.setdefault("keys", {})
    confidence = merged.setdefault("confidence", {})
    if not isinstance(keys, dict) or not isinstance(confidence, dict):
        raise ServiceError(400, "OCR scan-key format is invalid.")
    mapping = {
        "name": "name", "setName": "set_name", "cardNumber": "collector_number", "language": "language",
        "rarity": "rarity", "hp": "hp", "illustrator": "illustrator", "stage": "stage", "types": "types",
        "attacks": "attacks", "abilities": "ability_names", "weaknesses": "weaknesses",
        "resistances": "resistances", "retreat": "retreat", "evolvesFrom": "evolves_from",
    }
    for source, target in mapping.items():
        value = gemma_value(fields, source)
        if value in (None, "", []):
            continue
        observed = float(confidence.get(target, 0.0) or 0.0)
        model = field_confidence(fields, source)
        is_default_language = target == "language" and keys.get(target) == "en"
        if not keys.get(target) or is_default_language or observed < 0.80 and model > observed:
            keys[target] = value
            confidence[target] = model
    return merged


def run_lookup(scan: dict[str, Any], fields: dict[str, Any], work: Path, matcher: Path) -> dict[str, Any]:
    if not matcher.is_file():
        raise ServiceError(503, "The card catalog matcher is not installed.")
    merged = merge_scan_keys(scan, fields)
    scan_path = work / "resolved-scan-keys.json"
    scan_path.write_text(json.dumps(merged, ensure_ascii=False), encoding="utf-8")
    report_root = work / "reports"
    command = [sys.executable, str(matcher), "--scan-json", str(scan_path), "--report-root", str(report_root),
        "--output-root", str(work / "outputs"), "--max-candidates", "900", "--lookup-only"]
    try:
        subprocess.run(command, capture_output=True, text=True, timeout=60, check=False)
    except subprocess.TimeoutExpired as exc:
        raise ServiceError(504, "The catalog matcher timed out.") from exc
    report_path = next(report_root.rglob("match-report.json"), None) if report_root.exists() else None
    report = load_json(report_path) if report_path else None
    if report is None:
        raise ServiceError(503, "The catalog matcher did not return a result.")
    status = report.get("status")
    mapped = "matched_preview" if status == "matched" else "review_required" if status in {"ambiguous", "conflict"} else "no_match"
    return {
        "status": mapped, "reason": report.get("decision") or "", "scanKeys": merged,
        "selected": (report.get("selected") or {}).get("summary"),
        "candidates": exact_candidates(report),
    }
