#!/usr/bin/env python3
"""One-command Pokeum-first card match, pHash/OCR fallback, and DCR label mockup."""

from __future__ import annotations

import argparse
import copy
import difflib
import json
import os
import re
import secrets
import shutil
import sqlite3
import subprocess
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from card_key_parser import parse_card_keys
from pokeum_client import identify_pokeum


PIPELINE_DIR = Path(__file__).resolve().parent
CARD_ROOT = PIPELINE_DIR.parent
WORKSPACE_ROOT = CARD_ROOT.parent
PADDLE_READER = PIPELINE_DIR / "paddle_reader.py"
LOOKUP_SCRIPT = CARD_ROOT / "lookup_card.py"
LAYOUT_PROFILES_PATH = CARD_ROOT / "catalog" / "layout-profiles.json"
IMAGE_INDEX_PATH = CARD_ROOT / "catalog" / "card-image-library" / "image-index.sqlite"


def utc_run_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + secrets.token_hex(4)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def resolve_ocr_python(argument: str | None) -> Path:
    configured = argument or os.environ.get("DCR_PADDLE_PYTHON")
    if configured:
        candidate = Path(configured).expanduser().resolve()
        if not candidate.is_file():
            raise FileNotFoundError(f"Configured PaddleOCR Python was not found: {candidate}")
        return candidate

    candidates = [
        CARD_ROOT / ".venv-paddle" / "Scripts" / "python.exe",
        WORKSPACE_ROOT / ".tmp" / "image-ocr-eval" / "paddleocr-env" / "Scripts" / "python.exe",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()
    return Path(sys.executable).resolve()


def find_match_report(report_root: Path) -> Path | None:
    reports = list(report_root.rglob("match-report.json")) if report_root.exists() else []
    return max(reports, key=lambda item: item.stat().st_mtime_ns) if reports else None


def read_match_report(report_root: Path) -> tuple[Path | None, dict[str, Any] | None]:
    report_path = find_match_report(report_root)
    if not report_path:
        return None, None
    try:
        return report_path, json.loads(report_path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return report_path, None


def run_matcher(
    scan_path: Path,
    report_root: Path,
    output_root: Path,
    process_path: Path,
    args: argparse.Namespace,
    *,
    lookup_only: bool,
) -> tuple[list[str], subprocess.CompletedProcess[str] | None, Path | None, dict[str, Any] | None, str | None]:
    command = [
        sys.executable, str(LOOKUP_SCRIPT),
        "--scan-json", str(scan_path),
        "--report-root", str(report_root),
        "--output-root", str(output_root),
        "--max-candidates", str(args.max_candidates),
    ]
    if lookup_only:
        command.append("--lookup-only")
    try:
        process = subprocess.run(command, capture_output=True, text=True, check=False, timeout=args.match_timeout)
    except subprocess.TimeoutExpired as exc:
        write_json(process_path, {"command": command, "timeout": args.match_timeout, "stdout": exc.stdout, "stderr": exc.stderr})
        return command, None, None, None, f"Local match/label step exceeded {args.match_timeout}s"
    write_json(process_path, {
        "command": command,
        "return_code": process.returncode,
        "stdout": process.stdout,
        "stderr": process.stderr,
    })
    report_path, report = read_match_report(report_root)
    return command, process, report_path, report, None


def attack_conflict_candidate(report: dict[str, Any] | None, scan_payload: dict[str, Any]) -> dict[str, Any] | None:
    """Return one exact card identity whose only hard conflict is attack interpretation."""
    if not report or report.get("status") != "conflict":
        return None
    observed = {
        _norm(item.get("name") if isinstance(item, dict) else item)
        for item in (scan_payload.get("keys", {}).get("attacks") or [])
    }
    observed.discard("")
    exact_candidates = []
    for candidate in report.get("candidates", []):
        match = candidate.get("match") or {}
        conflicts = {item.get("field") for item in (match.get("hard_conflicts") or [])}
        if not match.get("core_name_exact") or not match.get("core_number_exact") or conflicts != {"attacks"}:
            continue
        summary = candidate.get("summary") or {}
        catalog_attacks = {_norm(item) for item in (summary.get("attack_names") or [])}
        catalog_attacks.discard("")
        # Catalog-guided recovery is only safe if every catalog attack is
        # already present as an OCR line candidate. This lets us discard
        # extra effect/flavor lines without inventing a missed attack name.
        if not catalog_attacks or not catalog_attacks <= observed:
            continue
        corroboration = set(match.get("matches") or []) & {"hp", "stage", "illustrator"}
        if len(corroboration) < 2:
            continue
        exact_candidates.append(candidate)
    return exact_candidates[0] if len(exact_candidates) == 1 else None


def recover_attacks_from_exact_catalog_candidate(
    scan_payload: dict[str, Any],
    evidence: dict[str, Any],
    candidate: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]] | None:
    """Reclassify OCR attack-zone lines against all attacks of one exact card.

    This does not call OCR again. It requires a unique exact name/number card,
    two independent matching fields, and one unambiguous OCR line matching
    every catalog attack name exactly after normalization.
    """
    summary = candidate.get("summary") or {}
    expected_names = [str(name).strip() for name in (summary.get("attack_names") or []) if str(name).strip()]
    normalized_expected = [_norm(name) for name in expected_names]
    if not normalized_expected or "" in normalized_expected or len(set(normalized_expected)) != len(normalized_expected):
        return None

    attack_evidence = evidence.get("fields", {}).get("attacks", {})
    decisions = attack_evidence.get("line_decisions") or []
    candidates = [
        item for item in decisions
        if item.get("decision") == "attack_name_candidate" and str(item.get("text") or "").strip()
    ]
    selected: list[dict[str, Any]] = []
    used_line_indices: set[int] = set()
    source_lines = evidence.get("lines") or []
    source_line_by_index = {index: line for index, line in enumerate(source_lines)}
    for expected in expected_names:
        matches = [
            item for item in candidates
            if _norm(item.get("text")) == _norm(expected)
            and isinstance(item.get("line_index"), int)
            and item.get("line_index") not in used_line_indices
        ]
        if len(matches) != 1:
            return None
        line = matches[0]
        line_index = line["line_index"]
        if line_index not in source_line_by_index:
            return None
        if float(line.get("recognition_confidence", 0.0)) < 0.55:
            return None
        used_line_indices.add(line_index)
        selected.append(line)

    recovered_scan = copy.deepcopy(scan_payload)
    recovered_evidence = copy.deepcopy(evidence)
    names = [{"name": name} for name in expected_names]
    recognition = sum(float(item.get("recognition_confidence", 0.0)) for item in selected) / len(selected)
    line_decisions = recovered_evidence.get("fields", {}).get("attacks", {}).get("line_decisions") or []
    excluded_candidates: list[str] = []
    for item in line_decisions:
        if item.get("decision") != "attack_name_candidate":
            continue
        if item.get("line_index") in used_line_indices:
            item.update(
                decision="attack_name_candidate",
                reason="exact_normalized_match_to_catalog_attack_name",
                role_confidence=0.99,
                catalog_candidate_id=summary.get("api_id"),
            )
        else:
            excluded_candidates.append(str(item.get("text") or ""))
            item.update(
                decision="excluded",
                reason="not_an_attack_name_for_the_exact_catalog_candidate",
                role_confidence=0.05,
                catalog_candidate_id=summary.get("api_id"),
            )

    recovered_scan.setdefault("keys", {})["attacks"] = names
    recovered_scan.setdefault("confidence", {})["attacks"] = round(recognition, 4)
    recovered_evidence.setdefault("fields", {})["attacks"] = {
        "raw_text": [str(item.get("text") or "") for item in selected],
        "normalized_value": names,
        "confidence": round(recognition, 4),
        "recognition_confidence": round(recognition, 4),
        "role_confidence": 0.99,
        "parser_mode": "catalog_anchored_recovery",
        "bboxes": [source_line_by_index[item["line_index"]].get("bbox") for item in selected],
        "bboxes_normalized": [item.get("bbox_normalized") for item in selected],
        "pass_ids": [source_line_by_index[item["line_index"]].get("pass_id") for item in selected],
        "line_decisions": line_decisions,
        "catalog_anchor": {
            "candidate_id": summary.get("api_id"),
            "exact_name_and_number": True,
            "corroborating_fields": sorted(
                set((candidate.get("match") or {}).get("matches") or []) & {"hp", "stage", "illustrator"}
            ),
            "expected_attack_names": expected_names,
            "matched_ocr_lines": [str(item.get("text") or "") for item in selected],
            "excluded_ocr_candidates": excluded_candidates,
        },
    }
    recovered_evidence["interpretation"] = {
        "mode": "catalog_anchored_recovery",
        "raw_ocr_reused": True,
        "recovery_trigger": "exact identity with attacks-only conflict",
        "expected_candidate_id": summary.get("api_id"),
    }
    return recovered_scan, recovered_evidence


def recovery_removes_only_low_role_lines(
    primary_evidence: dict[str, Any],
    recovery_evidence: dict[str, Any],
    expected_attack_names: list[str],
) -> bool:
    """Allow a retry only when it removes a low-role-confidence footer/body line."""
    primary_attacks = primary_evidence.get("fields", {}).get("attacks", {})
    recovery_attacks = recovery_evidence.get("fields", {}).get("attacks", {})
    primary_names = {_norm(item.get("name")) for item in (primary_attacks.get("normalized_value") or [])}
    recovery_names = {_norm(item.get("name")) for item in (recovery_attacks.get("normalized_value") or [])}
    removed = primary_names - recovery_names
    expected = {_norm(item) for item in expected_attack_names}
    if not removed or len(recovery_names) < 2 or not recovery_names <= expected:
        return False

    decisions = primary_attacks.get("line_decisions") or []
    removed_decisions = [
        item for item in decisions
        if item.get("decision") == "attack_name_candidate" and _norm(item.get("text")) in removed
    ]
    if len(removed_decisions) != len(removed):
        return False
    return all(
        float(item.get("role_confidence", 1.0)) <= 0.40
        and float((item.get("bbox_normalized") or [0, 0])[1]) >= 0.82
        for item in removed_decisions
    )


def _norm(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).casefold()
    text = "".join(char for char in text if not unicodedata.combining(char))
    return " ".join("".join(char if char.isalnum() else " " for char in text).split())


def _localized(value: Any, language: str) -> str:
    if isinstance(value, dict):
        return str(value.get(language) or value.get("en") or "")
    return str(value or "")


def _stage_key(value: Any) -> str:
    normalized = _norm(value).replace(" ", "")
    return {"basic": "basic", "stage1": "stage1", "stage2": "stage2"}.get(normalized, normalized)


def find_layout_profile(
    database: Path,
    language: str,
    set_id: str | None,
    series_id_hint: str | None = None,
) -> dict[str, Any] | None:
    """Resolve a catalog candidate's upstream series and its reviewed layout profile."""
    if not set_id or not database.is_file():
        return None
    uri = f"file:{database.resolve().as_posix()}?mode=ro"
    try:
        connection = sqlite3.connect(uri, uri=True)
        rows = connection.execute(
            """SELECT DISTINCT se.series_id, l.series_name
               FROM card_locales l
               JOIN cards c USING (source_path)
               LEFT JOIN sets s ON s.source_path = c.set_path
               LEFT JOIN series se ON se.source_path = s.series_path
               WHERE l.language = ? AND l.set_id = ?""",
            (language, set_id),
        ).fetchall()
    except sqlite3.Error:
        rows = []
    finally:
        try:
            connection.close()
        except (UnboundLocalError, sqlite3.Error):
            pass
    series_ids = {str(row[0]) for row in rows if row[0]}
    if series_id_hint:
        series_ids.add(str(series_id_hint))
        series_ids.intersection_update({str(series_id_hint)})
    if len(series_ids) != 1:
        return None
    series_id = next(iter(series_ids))
    profile_id = f"{language}:{series_id}"
    try:
        index = json.loads(LAYOUT_PROFILES_PATH.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        index = {}
    profile = (index.get("profiles") or {}).get(profile_id)
    if not isinstance(profile, dict):
        profile = {
            "profile_id": profile_id,
            "language": language,
            "series_id": series_id,
            "status": "reference_only",
            "source_examples": [],
        }
    else:
        profile = dict(profile)
        profile.setdefault("profile_id", profile_id)
    profile["matched_set_id"] = set_id
    return profile


def recover_printing_from_catalog(
    scan_payload: dict[str, Any],
    evidence: dict[str, Any],
    database: Path,
    number_threshold: float,
) -> dict[str, Any] | None:
    """Infer a missing/weak collector number only from one uniquely corroborated local record."""
    keys = scan_payload["keys"]
    confidence = scan_payload["confidence"]
    old_number = keys.get("collector_number")
    old_number_confidence = float(confidence.get("collector_number", 0.0))
    if old_number and old_number_confidence >= number_threshold and "/" in str(old_number):
        return None

    observed_number = None
    observed_number_confidence = old_number_confidence if old_number else 0.0
    old_evidence = evidence.get("fields", {}).pop("collector_number", None)
    if old_evidence:
        observed_number = old_evidence.get("raw_text")
    if old_number:
        observed_number = old_evidence.get("raw_text") if old_evidence else str(old_number)
    if not observed_number:
        # Preserve a weak footer fragment such as "101" for auditability even
        # when OCR failed to read the slash and set denominator.
        footer_fragments = [
            line for line in evidence.get("lines", [])
            if (line.get("bbox_normalized") or [0, 0])[1] >= 0.85
            and re.fullmatch(r"[0-9OQIl|]{1,4}", str(line.get("text", "")).strip(), re.IGNORECASE)
        ]
        if footer_fragments:
            fragment = max(footer_fragments, key=lambda line: float(line.get("confidence", 0.0)))
            observed_number = fragment["text"].strip()
            observed_number_confidence = float(fragment.get("confidence", 0.0))
    keys.pop("collector_number", None)
    confidence.pop("collector_number", None)
    keys.pop("set_name", None)
    keys.pop("set_id", None)
    confidence.pop("set_name", None)
    confidence.pop("set_id", None)

    name = str(keys.get("name", "")).strip()
    name_confidence = float(confidence.get("name", 0.0))
    language = str(keys.get("language", "en"))
    if not name or name_confidence < 0.80 or not database.is_file():
        return None

    uri = f"file:{database.resolve().as_posix()}?mode=ro"
    try:
        connection = sqlite3.connect(uri, uri=True)
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """SELECT l.card_name, l.set_id, l.set_name, l.local_id, l.language,
                      c.api_id, c.illustrator, c.raw_json AS card_raw,
                      s.raw_json AS set_raw
               FROM card_locales l
               JOIN cards c USING (source_path)
               LEFT JOIN sets s ON s.source_path = c.set_path
               WHERE l.language = ?""",
            (language,),
        ).fetchall()
    except sqlite3.Error:
        try:
            connection.close()
        except (UnboundLocalError, sqlite3.Error):
            pass
        return None
    finally:
        try:
            connection.close()
        except (UnboundLocalError, sqlite3.Error):
            pass

    observed_attacks = keys.get("attacks") or []
    observed_attack_names = [_norm(item.get("name") if isinstance(item, dict) else item) for item in observed_attacks]
    observed_attack_names = [value for value in observed_attack_names if value]
    observed_attack_confidence = float(confidence.get("attacks", 0.0))
    ranked: list[dict[str, Any]] = []

    for row in rows:
        name_ratio = difflib.SequenceMatcher(None, _norm(name), _norm(row["card_name"])).ratio()
        if name_ratio < 0.94:
            continue
        try:
            card = json.loads(row["card_raw"] or "{}")
            set_data = json.loads(row["set_raw"] or "{}") if row["set_raw"] else {}
        except json.JSONDecodeError:
            continue

        matched: list[str] = []
        conflicts: list[str] = []
        score = name_ratio * 3.0

        if "hp" in keys and float(confidence.get("hp", 0.0)) >= 0.70:
            if str(keys["hp"]) == str(card.get("hp")):
                matched.append("hp")
                score += 2.0
            else:
                conflicts.append("hp")
        if "stage" in keys and float(confidence.get("stage", 0.0)) >= 0.70:
            if _stage_key(keys["stage"]) == _stage_key(card.get("stage")):
                matched.append("stage")
                score += 1.0
            else:
                conflicts.append("stage")

        card_attack_names = {
            _norm(_localized(item.get("name"), language))
            for item in card.get("attacks", [])
            if isinstance(item, dict)
        }
        attack_matches = [attack for attack in observed_attack_names if attack in card_attack_names]
        if observed_attack_names and observed_attack_confidence >= 0.70:
            if len(attack_matches) == len(observed_attack_names):
                matched.append("attacks")
                score += 4.0 + len(attack_matches) * 0.25
            else:
                conflicts.append("attacks")

        illustrator = str(row["illustrator"] or "")
        if keys.get("illustrator") and float(confidence.get("illustrator", 0.0)) >= 0.80:
            if _norm(keys["illustrator"]) == _norm(illustrator):
                matched.append("illustrator")
                score += 2.0
            else:
                conflicts.append("illustrator")

        # Require at least two observed details, including an attack, or three
        # independent details when OCR could not recover an attack name.
        if conflicts or len(matched) < 2 or ("attacks" not in matched and len(matched) < 3):
            continue

        set_count = (set_data.get("cardCount") or {}).get("official")
        local_id = str(row["local_id"])
        if not local_id or not str(set_count or "").isdigit():
            continue
        ranked.append({
            "name": row["card_name"],
            "api_id": row["api_id"],
            "set_id": row["set_id"],
            "set_name": row["set_name"],
            "local_id": local_id,
            "denominator": str(set_count),
            "collector_number": f"{local_id}/{set_count}",
            "score": round(score, 4),
            "matched_fields": matched,
        })

    ranked.sort(key=lambda item: (-item["score"], item["set_id"], item["local_id"]))
    if len(ranked) != 1:
        evidence["catalog_recovery"] = {
            "status": "ambiguous" if ranked else "no_candidate",
            "observed_number_fragment": observed_number,
            "observed_number_confidence": round(observed_number_confidence, 4),
            "qualified_candidates": ranked[:10],
            "reason": "A missing/weak collector number is inferred only when exactly one catalog printing matches the observed card details.",
        }
        return None

    chosen = ranked[0]
    # 0.90 here represents a uniquely corroborated catalog inference, not OCR
    # confidence. The evidence file retains that distinction explicitly.
    inferred_confidence = 0.90
    keys["collector_number"] = chosen["collector_number"]
    keys["set_id"] = chosen["set_id"]
    keys["set_name"] = chosen["set_name"]
    confidence["collector_number"] = inferred_confidence
    confidence["set_id"] = inferred_confidence
    confidence["set_name"] = inferred_confidence
    scan_payload["field_origins"] = {
        **scan_payload.get("field_origins", {}),
        "collector_number": "catalog_inferred_from_unique_observed_details",
        "set_id": "catalog_inferred_from_unique_observed_details",
        "set_name": "catalog_inferred_from_unique_observed_details",
    }
    evidence["fields"]["collector_number"] = {
        "raw_text": observed_number,
        "normalized_value": chosen["collector_number"],
        "confidence": inferred_confidence,
        "observed_ocr_confidence": round(observed_number_confidence, 4),
        "source": "catalog_inferred_from_unique_observed_details",
        "corroborating_fields": chosen["matched_fields"],
        "catalog_record": chosen["api_id"],
    }
    for field in ("set_id", "set_name"):
        evidence["fields"][field] = {
            "raw_text": None,
            "normalized_value": chosen[field],
            "confidence": inferred_confidence,
            "source": "same_unique_catalog_record",
            "corroborating_fields": chosen["matched_fields"],
        }
    recovery = {
        "status": "inferred_unique",
        "observed_number_fragment": observed_number,
        "observed_number_confidence": round(observed_number_confidence, 4),
        "selected_catalog_record": chosen,
        "corroborating_fields": chosen["matched_fields"],
        "reason": "Exactly one printing matched the confidently read name and at least two independent card details.",
    }
    evidence["catalog_recovery"] = recovery
    return recovery


def image_candidate_record(database: Path, hit: dict[str, Any]) -> dict[str, Any] | None:
    """Load one localized catalog row named by the local image index."""
    if not database.is_file():
        return None
    uri = f"file:{database.resolve().as_posix()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    try:
        row = connection.execute(
            """SELECT l.card_name,l.set_id,l.local_id,l.language,l.set_name,
                      l.series_name,l.release_date,c.api_id,c.illustrator,
                      c.source_path,c.raw_json AS card_raw,s.raw_json AS set_raw
               FROM card_locales l
               JOIN cards c USING (source_path)
               LEFT JOIN sets s ON s.source_path = c.set_path
               WHERE c.api_id = ? AND l.language = ? AND l.set_id = ? AND l.local_id = ?
               LIMIT 1""",
            (hit["api_id"], hit["language"], hit["set_id"], hit["local_id"]),
        ).fetchone()
        if not row:
            return None
        record = dict(row)
        record["card_raw"] = json.loads(record.get("card_raw") or "{}")
        record["set_raw"] = json.loads(record.get("set_raw") or "{}")
        return record
    finally:
        connection.close()


def corroborate_image_candidate(
    scan_payload: dict[str, Any],
    evidence: dict[str, Any],
    record: dict[str, Any],
) -> dict[str, Any]:
    """Require a clear OCR name and independent card-text/details before accepting pHash."""
    keys = scan_payload.get("keys") or {}
    confidence = scan_payload.get("confidence") or {}
    card = record.get("card_raw") or {}
    observed_name = str(keys.get("name") or "").strip()
    name_confidence = float(confidence.get("name", 0.0) or 0.0)
    name_ratio = difflib.SequenceMatcher(None, _norm(observed_name), _norm(record.get("card_name"))).ratio()
    result: dict[str, Any] = {
        "name_confidence": round(name_confidence, 4),
        "name_similarity": round(name_ratio, 4),
        "matched_fields": [],
        "matched_ocr_lines": [],
        "conflicts": [],
    }
    if name_confidence < 0.80 or name_ratio < 0.94:
        result["reason"] = "The pHash candidate does not agree with a confidently read card name."
        return result

    lines = []
    for line in evidence.get("lines", []):
        text = str(line.get("text") or "").strip()
        try:
            line_confidence = float(line.get("confidence", 0.0))
        except (TypeError, ValueError):
            line_confidence = 0.0
        if text and line_confidence >= 0.70:
            lines.append({"text": text, "normalized": _norm(text), "confidence": line_confidence})
    line_texts = {line["normalized"]: line for line in lines}

    def confident(key: str, threshold: float = 0.70) -> bool:
        try:
            return float(confidence.get(key, 0.0) or 0.0) >= threshold
        except (TypeError, ValueError):
            return False

    def compare_exact(field: str, observed: Any, actual: Any, threshold: float = 0.70) -> None:
        if observed in (None, "", []):
            return
        if not confident(field, threshold):
            return
        if _norm(observed) == _norm(actual):
            result["matched_fields"].append(field)
        else:
            result["conflicts"].append(field)

    if keys.get("hp") not in (None, "") and confident("hp"):
        try:
            hp_matches = float(keys["hp"]) == float(card.get("hp"))
        except (TypeError, ValueError):
            hp_matches = str(keys["hp"]) == str(card.get("hp"))
        (result["matched_fields"] if hp_matches else result["conflicts"]).append("hp")

    if keys.get("stage") not in (None, "") and confident("stage"):
        stage_matches = _stage_key(keys["stage"]) == _stage_key(card.get("stage"))
        (result["matched_fields"] if stage_matches else result["conflicts"]).append("stage")

    observed_types = keys.get("types")
    if observed_types not in (None, "", []) and confident("types"):
        observed_list = observed_types if isinstance(observed_types, list) else [observed_types]
        actual_types = card.get("types") or []
        if {_norm(value) for value in observed_list} == {_norm(value) for value in actual_types}:
            result["matched_fields"].append("types")
        else:
            result["conflicts"].append("types")

    actual_abilities = {
        _norm(_localized(item.get("name"), record["language"]))
        for item in (card.get("abilities") or []) if isinstance(item, dict)
    }
    actual_abilities.discard("")
    observed_abilities = keys.get("ability_names") or []
    if isinstance(observed_abilities, str):
        observed_abilities = [observed_abilities]
    explicit_abilities = {_norm(item) for item in observed_abilities if _norm(item)}
    line_abilities = explicit_abilities | (set(line_texts) & actual_abilities)
    if line_abilities & actual_abilities:
        result["matched_fields"].append("ability_names")
        result["matched_ocr_lines"].extend(
            line_texts[value]["text"] for value in sorted(set(line_texts) & actual_abilities)
        )
    elif explicit_abilities and confident("ability_names", 0.80):
        result["conflicts"].append("ability_names")

    actual_attacks = {
        _norm(_localized(item.get("name"), record["language"]))
        for item in (card.get("attacks") or []) if isinstance(item, dict)
    }
    actual_attacks.discard("")
    structured_attacks = keys.get("attacks") or []
    if not isinstance(structured_attacks, list):
        structured_attacks = [structured_attacks]
    structured_attack_names = {
        _norm(item.get("name") if isinstance(item, dict) else item)
        for item in structured_attacks
    }
    attack_matches = (set(line_texts) & actual_attacks) | (structured_attack_names & actual_attacks)
    if attack_matches:
        result["matched_fields"].append("attacks")
        result["matched_ocr_lines"].extend(
            line_texts[value]["text"] for value in sorted(set(line_texts) & actual_attacks)
        )

    for field, actual in (
        ("illustrator", record.get("illustrator") or card.get("illustrator")),
        ("evolves_from", _localized(card.get("evolveFrom"), record["language"])),
        ("retreat", card.get("retreat")),
    ):
        compare_exact(field, keys.get(field), actual, 0.80 if field == "illustrator" else 0.70)

    # One exact OCR ability/attack title is a strong anchor; without either,
    # require three independent details such as HP, stage, and type.
    matched = sorted(set(result["matched_fields"]))
    text_anchor = bool({"attacks", "ability_names"} & set(matched))
    result["matched_fields"] = matched
    result["matched_ocr_lines"] = list(dict.fromkeys(result["matched_ocr_lines"]))
    if result["conflicts"]:
        result["reason"] = "A high-confidence OCR detail conflicts with the pHash candidate."
    elif len(matched) < 2 or (not text_anchor and len(matched) < 3):
        result["reason"] = "Not enough independent OCR details corroborate the pHash candidate."
    else:
        result["confirmed"] = True
        result["reason"] = "The pHash candidate agrees with the card name and enough independent OCR details."
    return result


def recover_printing_from_image_library(
    scan_payload: dict[str, Any],
    evidence: dict[str, Any],
    image_path: Path | None,
    database: Path,
    index_path: Path,
    *,
    max_distance: int,
    min_gap: int,
    candidate_limit: int,
) -> dict[str, Any]:
    """Use local pHash as a conservative missing-number fallback, then OCR-confirm it."""
    result: dict[str, Any] = {
        "status": "unavailable",
        "thresholds": {"max_distance": max_distance, "min_gap": min_gap},
    }
    if not image_path or not image_path.is_file():
        result["reason"] = "The original card image is unavailable for local image matching."
        return result
    if not database.is_file():
        result["reason"] = f"Local card catalog not found: {database}"
        return result
    try:
        if str(CARD_ROOT) not in sys.path:
            sys.path.insert(0, str(CARD_ROOT))
        from catalog.card_image_library import rank_image_candidates

        ranked = rank_image_candidates(
            image_path,
            index_path,
            language=str((scan_payload.get("keys") or {}).get("language") or "en"),
            limit=candidate_limit,
        )
    except (ImportError, FileNotFoundError, OSError, sqlite3.Error, ValueError, RuntimeError) as exc:
        result["reason"] = f"Local image matching is unavailable: {type(exc).__name__}: {exc}"
        return result

    result["index_path"] = str(index_path)
    result["image_path"] = str(image_path)
    result["nearest_candidates"] = ranked[:5]
    if not ranked:
        result.update(status="no_candidate", reason="No cached reference image is available for this language.")
        return result

    best = ranked[0]
    runner_up = ranked[1] if len(ranked) > 1 else None
    gap = int(runner_up["distance"] - best["distance"]) if runner_up else None
    result["best_candidate"] = best
    result["runner_up_distance"] = runner_up["distance"] if runner_up else None
    result["distance_gap"] = gap
    if best["distance"] > max_distance:
        result.update(status="no_candidate", reason="Nearest pHash candidate is outside the configured distance limit.")
        return result
    if gap is not None and gap < min_gap:
        result.update(status="ambiguous", reason="The nearest pHash candidates are too close to distinguish safely.")
        return result

    try:
        record = image_candidate_record(database, best)
    except (sqlite3.Error, OSError, json.JSONDecodeError) as exc:
        result.update(status="unavailable", reason=f"Could not read the candidate from the local catalog: {exc}")
        return result
    if not record:
        result.update(status="unavailable", reason="The pHash result is absent from the local card catalog.")
        return result

    corroboration = corroborate_image_candidate(scan_payload, evidence, record)
    result["ocr_corroboration"] = corroboration
    if not corroboration.get("confirmed"):
        result.update(status="review_required", reason=corroboration.get("reason"))
        return result

    set_raw = record.get("set_raw") or {}
    count = (set_raw.get("cardCount") or {}).get("official")
    local_id = str(record.get("local_id") or "")
    if not local_id or not str(count or "").isdigit():
        result.update(
            status="review_required",
            reason="The catalog does not provide a complete collector-number denominator for this candidate.",
        )
        return result

    keys = scan_payload.setdefault("keys", {})
    confidence = scan_payload.setdefault("confidence", {})
    observed_number = keys.get("collector_number")
    prior_number_evidence = evidence.get("fields", {}).get("collector_number") or {}
    if not observed_number:
        observed_number = prior_number_evidence.get("raw_text")
    observed_number_confidence = float(confidence.get("collector_number", 0.0) or 0.0)
    collector_number = f"{local_id}/{count}"
    inferred_confidence = 0.90
    keys["collector_number"] = collector_number
    keys["set_id"] = record["set_id"]
    keys["set_name"] = record["set_name"]
    confidence["collector_number"] = inferred_confidence
    confidence["set_id"] = inferred_confidence
    confidence["set_name"] = inferred_confidence
    scan_payload["field_origins"] = {
        **scan_payload.get("field_origins", {}),
        "collector_number": "image_library_candidate_confirmed_by_ocr",
        "set_id": "image_library_candidate_confirmed_by_ocr",
        "set_name": "image_library_candidate_confirmed_by_ocr",
    }
    candidate_evidence = {
        "api_id": record["api_id"],
        "language": record["language"],
        "set_id": record["set_id"],
        "set_name": record["set_name"],
        "local_id": local_id,
        "collector_number": collector_number,
        "distance": best["distance"],
        "runner_up_distance": runner_up["distance"] if runner_up else None,
        "distance_gap": gap,
    }
    recovery = {
        **result,
        "status": "inferred_unique",
        "selected_catalog_record": candidate_evidence,
        "corroborating_fields": corroboration["matched_fields"],
        "reason": "One nearest image candidate passed the pHash gates and OCR corroboration rules.",
    }
    evidence["fields"]["collector_number"] = {
        "raw_text": observed_number,
        "normalized_value": collector_number,
        "confidence": inferred_confidence,
        "observed_ocr_confidence": round(observed_number_confidence, 4),
        "source": "image_library_candidate_confirmed_by_ocr",
        "corroborating_fields": corroboration["matched_fields"],
        "catalog_record": record["api_id"],
        "visual_match": candidate_evidence,
    }
    for field in ("set_id", "set_name"):
        evidence["fields"][field] = {
            "raw_text": None,
            "normalized_value": record[field],
            "confidence": inferred_confidence,
            "source": "same_image_and_OCR_confirmed_catalog_record",
            "corroborating_fields": corroboration["matched_fields"],
        }
    evidence["image_recovery"] = recovery
    scan_payload["image_recovery"] = recovery
    return recovery


def match_image_first(
    image_path: Path,
    language: str,
    database: Path,
    index_path: Path,
    *,
    max_distance: int,
    min_gap: int,
    candidate_limit: int,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """Select a local catalog record from a strong, unambiguous full-card pHash match."""
    result: dict[str, Any] = {
        "status": "unavailable",
        "method": "64-bit DCT pHash over four rotations",
        "thresholds": {"max_distance": max_distance, "min_gap": min_gap},
        "image_path": str(image_path),
        "index_path": str(index_path),
    }
    try:
        if str(CARD_ROOT) not in sys.path:
            sys.path.insert(0, str(CARD_ROOT))
        from catalog.card_image_library import rank_image_candidates

        ranked = rank_image_candidates(
            image_path,
            index_path,
            language=language,
            limit=candidate_limit,
        )
    except (ImportError, FileNotFoundError, OSError, sqlite3.Error, ValueError, RuntimeError) as exc:
        result["reason"] = f"Local image matching is unavailable: {type(exc).__name__}: {exc}"
        return result, None

    result["nearest_candidates"] = ranked[:5]
    if not ranked:
        result.update(status="no_candidate", reason="No cached reference image is available for this language.")
        return result, None

    best = ranked[0]
    runner_up = ranked[1] if len(ranked) > 1 else None
    gap = int(runner_up["distance"] - best["distance"]) if runner_up else None
    result["best_candidate"] = best
    result["runner_up_distance"] = runner_up["distance"] if runner_up else None
    result["distance_gap"] = gap
    if best["distance"] > max_distance:
        result.update(status="no_candidate", reason="Nearest pHash candidate is outside the configured distance limit.")
        return result, None
    if gap is not None and gap < min_gap:
        result.update(status="ambiguous", reason="The nearest pHash candidates are too close to distinguish safely.")
        return result, None

    try:
        record = image_candidate_record(database, best)
    except (sqlite3.Error, OSError, json.JSONDecodeError) as exc:
        result.update(status="unavailable", reason=f"Could not read the candidate from the local catalog: {exc}")
        return result, None
    if not record:
        result.update(status="unavailable", reason="The pHash result is absent from the local card catalog.")
        return result, None

    set_raw = record.get("set_raw") or {}
    official_count = (set_raw.get("cardCount") or {}).get("official")
    local_id = str(record.get("local_id") or "")
    if not local_id or not str(official_count or "").isdigit() or not record.get("card_name"):
        result.update(
            status="review_required",
            reason="The image candidate lacks a complete catalog identity or official card count.",
        )
        return result, None

    result.update(
        status="matched",
        selected_catalog_record={
            "api_id": record["api_id"],
            "language": record["language"],
            "set_id": record["set_id"],
            "set_name": record["set_name"],
            "local_id": local_id,
            "collector_number": f"{local_id}/{official_count}",
            "distance": best["distance"],
            "runner_up_distance": runner_up["distance"] if runner_up else None,
            "distance_gap": gap,
        },
        reason="The nearest pHash candidate passed the configured distance and runner-up gap gates.",
    )
    return result, record


def _normalized_collector_number(value: Any) -> str:
    """Normalize a printed number while preserving non-numeric collector IDs."""
    parts = [part.strip() for part in str(value or "").split("/", 1)]
    normalized = []
    for part in parts:
        text = _norm(part).replace(" ", "")
        normalized.append(str(int(text)) if text.isdigit() else text)
    return "/".join(normalized)


def validate_pokeum_candidate(
    pokeum_match: dict[str, Any],
    database: Path,
    language: str,
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """Accept a confident Pokeum identity only after exact local-catalog checks."""
    if not pokeum_match.get("accepted"):
        return pokeum_match, None

    response = pokeum_match.get("response") or {}
    candidate = response.get("match") or {}
    if not isinstance(candidate, dict):
        pokeum_match.update(
            status="catalog_validation_failed",
            accepted=False,
            reason="Pokeum returned no usable top candidate.",
        )
        return pokeum_match, None
    card_id = str(candidate.get("card_id") or "")
    set_data = candidate.get("set") or {}
    if not isinstance(set_data, dict):
        pokeum_match.update(
            status="catalog_validation_failed",
            accepted=False,
            reason="Pokeum returned malformed set metadata.",
        )
        return pokeum_match, None
    set_id = str(set_data.get("id") or "")
    prefix = f"{set_id}-" if set_id else ""
    if not card_id or not set_id or not prefix or not card_id.startswith(prefix):
        pokeum_match.update(
            status="catalog_validation_failed",
            accepted=False,
            reason="Pokeum returned an ID that cannot be mapped to a local set/card record.",
        )
        return pokeum_match, None

    local_id = card_id[len(prefix):]
    try:
        record = image_candidate_record(
            database,
            {
                "api_id": card_id,
                "language": language,
                "set_id": set_id,
                "local_id": local_id,
            },
        )
    except (sqlite3.Error, OSError, json.JSONDecodeError) as error:
        record = None
        catalog_error = str(error)
    else:
        catalog_error = ""
    if not record:
        pokeum_match.update(
            status="catalog_validation_failed",
            accepted=False,
            reason=(
                "Pokeum's candidate does not resolve to a card in the local catalog."
                + (f" {catalog_error}" if catalog_error else "")
            ),
        )
        return pokeum_match, None

    set_raw = record.get("set_raw") or {}
    card_count = set_raw.get("cardCount") or {}
    official_count = card_count.get("official") if isinstance(card_count, dict) else None
    if (
        record.get("api_id") != card_id
        or record.get("language") != language
        or record.get("set_id") != set_id
        or not record.get("card_name")
        or not str(official_count or "").isdigit()
    ):
        pokeum_match.update(
            status="catalog_validation_failed",
            accepted=False,
            reason="The local catalog record is missing complete identity or official-number data.",
        )
        return pokeum_match, None

    expected_number = f"{record['local_id']}/{official_count}"
    candidate_number = str(candidate.get("number") or "")
    if (
        _norm(candidate.get("name")) != _norm(record.get("card_name"))
        or _norm(set_data.get("name")) != _norm(record.get("set_name"))
        or _normalized_collector_number(candidate_number)
        != _normalized_collector_number(expected_number)
    ):
        pokeum_match.update(
            status="catalog_validation_failed",
            accepted=False,
            reason=(
                "Pokeum's name, set, or full collector number conflicts with the local catalog."
            ),
        )
        return pokeum_match, None

    ocr = response.get("ocr") or {}
    if not isinstance(ocr, dict):
        ocr = {}
    ocr_confidence = float(ocr.get("confidence", 0.0) or 0.0)
    if ocr_confidence >= 0.80:
        if ocr.get("number") and _normalized_collector_number(ocr["number"]) != _normalized_collector_number(record["local_id"]):
            pokeum_match.update(
                status="catalog_validation_failed",
                accepted=False,
                reason="Pokeum's high-confidence footer OCR conflicts with its selected card number.",
            )
            return pokeum_match, None
        if ocr.get("number_total") and str(ocr["number_total"]) != str(official_count):
            pokeum_match.update(
                status="catalog_validation_failed",
                accepted=False,
                reason="Pokeum's high-confidence footer OCR conflicts with the set's official total.",
            )
            return pokeum_match, None

    selected = {
        "api_id": record["api_id"],
        "language": record["language"],
        "set_id": record["set_id"],
        "set_name": record["set_name"],
        "local_id": str(record["local_id"]),
        "collector_number": expected_number,
        "confidence": pokeum_match.get("confidence"),
        "confidence_margin": pokeum_match.get("confidence_margin"),
    }
    pokeum_match.update(
        status="matched",
        accepted=True,
        selected_catalog_record=selected,
        reason="Pokeum was confident and its full identity matched the local catalog.",
    )
    return pokeum_match, record


def scan_payload_from_image_candidate(
    record: dict[str, Any],
    image_match: dict[str, Any],
    run_id: str,
    *,
    identity_source: str = "local_image_library_pHash",
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build matcher input from a selected catalog row without invoking OCR."""
    language = str(record.get("language") or "en")
    card = record.get("card_raw") or {}
    selected = image_match.get("selected_catalog_record") or {}
    keys: dict[str, Any] = {
        "language": language,
        "name": str(record.get("card_name") or ""),
        "collector_number": str(selected.get("collector_number") or ""),
        "set_id": str(record.get("set_id") or ""),
        "set_name": str(record.get("set_name") or ""),
    }
    optional = {
        "hp": card.get("hp"),
        "stage": card.get("stage"),
        "illustrator": record.get("illustrator") or card.get("illustrator"),
        "types": card.get("types"),
        "retreat": card.get("retreat"),
        "evolves_from": _localized(card.get("evolveFrom"), language),
        "attacks": [
            {"name": _localized(item.get("name"), language)}
            for item in (card.get("attacks") or [])
            if isinstance(item, dict) and _localized(item.get("name"), language)
        ],
        "ability_names": [
            _localized(item.get("name"), language)
            for item in (card.get("abilities") or [])
            if isinstance(item, dict) and _localized(item.get("name"), language)
        ],
    }
    for key, value in optional.items():
        if value not in (None, "", []):
            keys[key] = value

    field_source = (
        "pokeum_confident_catalog_match"
        if identity_source == "pokeum"
        else "local_catalog_record_selected_by_pHash"
    )
    origins = {key: field_source for key in keys}
    confidence = {key: 1.0 for key in keys}
    scan_payload = {
        "schema_version": 1,
        "scan_id": run_id,
        "keys": keys,
        "confidence": confidence,
        "source_urls": [],
        "identity_source": identity_source,
        "field_origins": origins,
    }
    if identity_source == "pokeum":
        scan_payload["pokeum_match"] = image_match
    else:
        scan_payload["image_match"] = image_match
    field_evidence = {
        key: {
            "raw_text": None,
            "normalized_value": value,
            "confidence": 1.0,
            "source": field_source,
        }
        for key, value in keys.items()
    }
    evidence = {
        "schema_version": 1,
        "scan_id": run_id,
        "lines": [],
        "fields": field_evidence,
        "interpretation": {
            "mode": "pokeum_first" if identity_source == "pokeum" else "image_first",
            "raw_ocr_reused": False,
            "raw_ocr_source": (
                "not_run_pokeum_match_accepted"
                if identity_source == "pokeum"
                else "not_run_image_match_accepted"
            ),
        },
    }
    evidence["pokeum_match" if identity_source == "pokeum" else "image_match"] = image_match
    return scan_payload, evidence


def run_pipeline(args: argparse.Namespace) -> tuple[int, dict[str, Any]]:
    started = time.perf_counter()
    run_id = utc_run_id()
    image_path = args.image.expanduser().resolve() if args.image else None
    source_raw_path = args.from_raw_ocr.expanduser().resolve() if args.from_raw_ocr else None
    run_dir = args.scan_root.resolve() / run_id
    run_dir.mkdir(parents=True, exist_ok=False)
    result_path = run_dir / "pipeline-result.json"
    timings: dict[str, float] = {}
    result: dict[str, Any] = {
        "schema_version": 1,
        "run_id": run_id,
        "status": "starting",
        "image_path": str(image_path) if image_path else None,
        "language": args.language,
        "strategy": "ocr-first" if source_raw_path else getattr(args, "strategy", "image-first"),
        "artifacts": {},
        "timings": timings,
    }

    raw_ocr_path = run_dir / "raw-ocr.json"
    image_first_payload: dict[str, Any] | None = None
    image_first_evidence: dict[str, Any] | None = None
    image_first_match: dict[str, Any] | None = None
    if result["strategy"] == "image-first" and not getattr(args, "disable_image_recovery", False):
        if image_path and image_path.is_file():
            if getattr(args, "disable_pokeum", False):
                result["pokeum"] = {
                    "status": "disabled",
                    "accepted": False,
                    "reason": "Pokeum was disabled for this run.",
                }
            else:
                pokeum_start = time.perf_counter()
                pokeum_report = identify_pokeum(
                    image_path,
                    args.language,
                    CARD_ROOT / "catalog" / "cards.sqlite",
                    enabled=True,
                    base_url=args.pokeum_url,
                    timeout_seconds=args.pokeum_timeout,
                )
                pokeum_report, pokeum_candidate = validate_pokeum_candidate(
                    pokeum_report,
                    CARD_ROOT / "catalog" / "cards.sqlite",
                    args.language,
                )
                timings["pokeum_seconds"] = round(time.perf_counter() - pokeum_start, 4)
                result["pokeum"] = pokeum_report
                pokeum_report_path = run_dir / "pokeum-result.json"
                write_json(pokeum_report_path, pokeum_report)
                result["artifacts"]["pokeum_result"] = str(pokeum_report_path)
                if pokeum_candidate:
                    image_first_payload, image_first_evidence = scan_payload_from_image_candidate(
                        pokeum_candidate,
                        pokeum_report,
                        run_id,
                        identity_source="pokeum",
                    )
                    result["identity_source"] = "pokeum"
                    result["ocr_skipped"] = True
                    result["image_first"] = {
                        "status": "skipped",
                        "reason": "Pokeum returned a confident identity validated against the local catalog.",
                    }
                    write_json(
                        run_dir / "ocr-process.json",
                        {
                            "mode": "skipped_pokeum_confident_match",
                            "reader_invoked": False,
                            "reason": pokeum_report.get("reason"),
                        },
                    )

            if image_first_payload is None:
                image_start = time.perf_counter()
                image_first_match, image_candidate = match_image_first(
                    image_path,
                    args.language,
                    CARD_ROOT / "catalog" / "cards.sqlite",
                    IMAGE_INDEX_PATH,
                    max_distance=args.image_match_max_distance,
                    min_gap=args.image_match_min_gap,
                    candidate_limit=args.image_match_limit,
                )
                timings["image_match_seconds"] = round(time.perf_counter() - image_start, 4)
                result["image_first"] = image_first_match
                if image_candidate:
                    image_first_payload, image_first_evidence = scan_payload_from_image_candidate(
                        image_candidate,
                        image_first_match,
                        run_id,
                    )
                    result["identity_source"] = "local_image_library_pHash"
                    result["ocr_skipped"] = True
                    write_json(run_dir / "ocr-process.json", {
                        "mode": "skipped_image_first_match",
                        "reader_invoked": False,
                        "reason": image_first_match.get("reason"),
                    })
        else:
            image_first_match = {
                "status": "unavailable",
                "reason": "The card image is unavailable for local image matching.",
            }
            result["image_first"] = image_first_match
    elif result["strategy"] == "image-first":
        image_first_match = {
            "status": "disabled",
            "reason": "Image-first matching was disabled; continuing with OCR.",
        }
        result["image_first"] = image_first_match

    if image_first_payload is not None:
        raw_ocr: dict[str, Any] | None = None
        timings["ocr_seconds"] = 0.0
        scan_payload = image_first_payload
        evidence = image_first_evidence or {}
        timings["parse_seconds"] = 0.0
        timings["catalog_recovery_seconds"] = 0.0
        catalog_recovery = None
        image_recovery = image_first_match
    elif source_raw_path:
        if not source_raw_path.is_file():
            result.update(status="input_error", reason=f"Raw OCR JSON not found: {source_raw_path}")
            timings["total_seconds"] = round(time.perf_counter() - started, 4)
            write_json(result_path, result)
            return 2, result
        try:
            shutil.copy2(source_raw_path, raw_ocr_path)
            raw_ocr = json.loads(raw_ocr_path.read_text(encoding="utf-8-sig"))
        except (OSError, json.JSONDecodeError) as exc:
            result.update(status="ocr_error", reason=f"Invalid raw OCR JSON: {exc}")
            timings["total_seconds"] = round(time.perf_counter() - started, 4)
            write_json(result_path, result)
            return 10, result
        if not image_path and raw_ocr.get("image_path"):
            image_path = Path(raw_ocr["image_path"]).expanduser()
            result["image_path"] = str(image_path)
        result["ocr_reused"] = True
        result["identity_source"] = "saved_ocr"
        result["source_raw_ocr"] = str(source_raw_path)
        timings["ocr_seconds"] = 0.0
        write_json(run_dir / "ocr-process.json", {
            "mode": "reused_raw_ocr",
            "source_raw_ocr": str(source_raw_path),
            "reader_invoked": False,
        })
    else:
        if not image_path or not image_path.is_file():
            result.update(status="input_error", reason=f"Image not found: {image_path}")
            timings["total_seconds"] = round(time.perf_counter() - started, 4)
            write_json(result_path, result)
            return 2, result
        try:
            ocr_python = resolve_ocr_python(args.ocr_python)
        except (OSError, FileNotFoundError) as exc:
            result.update(status="configuration_error", reason=str(exc))
            timings["total_seconds"] = round(time.perf_counter() - started, 4)
            write_json(result_path, result)
            return 3, result

        reader_work_dir = run_dir / "reader-work"
        command = [
            str(ocr_python), str(PADDLE_READER),
            "--image", str(image_path),
            "--output-json", str(raw_ocr_path),
            "--work-dir", str(reader_work_dir),
        ]
        ocr_start = time.perf_counter()
        try:
            ocr_process = subprocess.run(command, capture_output=True, text=True, check=False, timeout=args.ocr_timeout)
        except subprocess.TimeoutExpired as exc:
            timings["ocr_seconds"] = round(time.perf_counter() - ocr_start, 4)
            result.update(status="ocr_timeout", reason=f"PaddleOCR exceeded {args.ocr_timeout}s")
            result["ocr_error"] = str(exc)
            timings["total_seconds"] = round(time.perf_counter() - started, 4)
            write_json(run_dir / "ocr-process.json", {"command": command, "stdout": exc.stdout, "stderr": exc.stderr})
            write_json(result_path, result)
            return 10, result
        timings["ocr_seconds"] = round(time.perf_counter() - ocr_start, 4)
        result["identity_source"] = "ocr"
        write_json(run_dir / "ocr-process.json", {
            "command": command,
            "return_code": ocr_process.returncode,
            "stdout": ocr_process.stdout,
            "stderr": ocr_process.stderr,
        })
        if ocr_process.returncode != 0 or not raw_ocr_path.is_file():
            result.update(status="ocr_error", reason="PaddleOCR did not produce a result", ocr_exit_code=ocr_process.returncode)
            result["ocr_stderr"] = (ocr_process.stderr or "")[-4000:]
            timings["total_seconds"] = round(time.perf_counter() - started, 4)
            write_json(result_path, result)
            return 10, result
        try:
            raw_ocr = json.loads(raw_ocr_path.read_text(encoding="utf-8-sig"))
        except (OSError, json.JSONDecodeError) as exc:
            result.update(status="ocr_error", reason=f"Invalid OCR result JSON: {exc}")
            timings["total_seconds"] = round(time.perf_counter() - started, 4)
            write_json(result_path, result)
            return 10, result

    if image_first_payload is None:
        parse_start = time.perf_counter()
        scan_payload, evidence = parse_card_keys(raw_ocr or {}, args.language, run_id, attack_mode="primary")
        evidence["interpretation"] = {
            "mode": "primary",
            "raw_ocr_reused": bool(source_raw_path),
            "raw_ocr_source": str(source_raw_path) if source_raw_path else "fresh_ocr",
        }
        timings["parse_seconds"] = round(time.perf_counter() - parse_start, 4)
        recovery_start = time.perf_counter()
        catalog_recovery = recover_printing_from_catalog(
            scan_payload,
            evidence,
            CARD_ROOT / "catalog" / "cards.sqlite",
            args.minimum_number_confidence,
        )
        timings["catalog_recovery_seconds"] = round(time.perf_counter() - recovery_start, 4)
        image_recovery = None
        recovered_keys = scan_payload.get("keys") or {}
        has_complete_number = bool(
            recovered_keys.get("collector_number")
            and "/" in str(recovered_keys.get("collector_number"))
            and float((scan_payload.get("confidence") or {}).get("collector_number", 0.0) or 0.0)
                >= args.minimum_number_confidence
        )
        if not catalog_recovery and not has_complete_number:
            image_start = time.perf_counter()
            if args.disable_image_recovery:
                image_recovery = {
                    "status": "disabled",
                    "reason": "Image-library fallback was disabled by the command line.",
                }
            else:
                image_recovery = recover_printing_from_image_library(
                    scan_payload,
                    evidence,
                    image_path,
                    CARD_ROOT / "catalog" / "cards.sqlite",
                    IMAGE_INDEX_PATH,
                    max_distance=args.image_match_max_distance,
                    min_gap=args.image_match_min_gap,
                    candidate_limit=args.image_match_limit,
                )
            timings["image_recovery_seconds"] = round(time.perf_counter() - image_start, 4)
            result["image_recovery"] = image_recovery
    scan_path = run_dir / "scan-keys.json"
    evidence_path = run_dir / "field-evidence.json"
    write_json(scan_path, scan_payload)
    write_json(evidence_path, evidence)
    result["scan_keys"] = scan_payload
    if "catalog_recovery" in evidence:
        result["catalog_recovery"] = evidence["catalog_recovery"]
    result_artifacts = {
        "field_evidence": str(evidence_path),
        "scan_keys": str(scan_path),
        "ocr_process": str(run_dir / "ocr-process.json"),
    }
    if raw_ocr_path.is_file():
        result_artifacts["raw_ocr"] = str(raw_ocr_path)
    result["artifacts"].update(result_artifacts)

    keys = scan_payload["keys"]
    confidence = scan_payload["confidence"]
    blockers: list[str] = []
    if not keys.get("name"):
        blockers.append("Card name was not read from the title area.")
    elif confidence.get("name", 0) < args.minimum_name_confidence:
        blockers.append(f"Name confidence {confidence['name']:.3f} is below {args.minimum_name_confidence:.3f}.")
    if not keys.get("collector_number") or "/" not in str(keys.get("collector_number", "")):
        blockers.append("A full collector number including denominator was not read.")
    elif confidence.get("collector_number", 0) < args.minimum_number_confidence:
        blockers.append(f"Collector-number confidence {confidence['collector_number']:.3f} is below {args.minimum_number_confidence:.3f}.")

    if blockers:
        result.update(status="review_required", reason="Required identity fields need a clearer scan.", blockers=blockers)
        timings["total_seconds"] = round(time.perf_counter() - started, 4)
        write_json(result_path, result)
        return 5, result

    match_start = time.perf_counter()
    _, match_process, report_path, match_report, match_error = run_matcher(
        scan_path,
        run_dir / "lookup-reports" / "primary",
        args.output_root.resolve(),
        run_dir / "match-process.json",
        args,
        lookup_only=args.lookup_only,
    )
    timings["match_and_label_seconds"] = round(time.perf_counter() - match_start, 4)
    if match_error:
        result.update(status="match_timeout", reason=match_error, match_error=match_error)
        timings["total_seconds"] = round(time.perf_counter() - started, 4)
        write_json(result_path, result)
        return 11, result
    result["artifacts"].update({
        "match_process": str(run_dir / "match-process.json"),
        "match_report": str(report_path) if report_path else None,
        "primary_match_process": str(run_dir / "match-process.json"),
        "primary_match_report": str(report_path) if report_path else None,
    })

    selected_process = match_process
    selected_report_path = report_path
    selected_report = match_report
    recovery_details: dict[str, Any] | None = None
    candidate = None if image_first_payload is not None else attack_conflict_candidate(match_report, scan_payload)
    if candidate:
        candidate_summary = candidate.get("summary") or {}
        expected_id = candidate_summary.get("api_id")
        expected_attacks = candidate_summary.get("attack_names") or []
        candidate_set_id = candidate_summary.get("set_id")
        recovery_start = time.perf_counter()
        catalog_recovery = recover_attacks_from_exact_catalog_candidate(
            scan_payload,
            evidence,
            candidate,
        )
        layout_profile = None
        if catalog_recovery:
            recovery_scan, recovery_evidence = catalog_recovery
            recovery_method = "catalog_anchored_recovery"
        else:
            layout_profile = find_layout_profile(
                CARD_ROOT / "catalog" / "cards.sqlite",
                args.language,
                candidate_set_id,
                candidate_summary.get("series_id"),
            )
            recovery_scan, recovery_evidence = parse_card_keys(
                raw_ocr,
                args.language,
                run_id,
                attack_mode="layout_recovery",
                layout_profile=layout_profile,
            )
            recovery_method = "layout_recovery"
        timings["recovery_parse_seconds"] = round(time.perf_counter() - recovery_start, 4)
        identity_unchanged = all(
            recovery_scan.get("keys", {}).get(field) == scan_payload.get("keys", {}).get(field)
            for field in ("name", "collector_number", "hp", "stage")
        )
        safe_recovery = identity_unchanged and (
            recovery_method == "catalog_anchored_recovery"
            or recovery_removes_only_low_role_lines(evidence, recovery_evidence, expected_attacks)
        )
        recovery_details = {
            "attempted": True,
            "trigger": "unique exact name/number candidate has an attacks-only conflict",
            "recovery_method": recovery_method,
            "expected_candidate_id": expected_id,
            "expected_set_id": candidate_set_id,
            "layout_profile": (
                recovery_evidence.get("layout_profile")
                if recovery_method == "layout_recovery"
                else {"applied": False, "reason": "exact catalog identity supplied attack-name anchors"}
            ),
            "primary_attacks": scan_payload.get("keys", {}).get("attacks"),
            "recovery_attacks": recovery_scan.get("keys", {}).get("attacks"),
            "safe_to_retry": safe_recovery,
        }
        if safe_recovery:
            recovery_evidence.setdefault("interpretation", {}).update({
                "mode": recovery_method,
                "raw_ocr_reused": True,
                "recovery_trigger": "attack role conflict",
                "expected_candidate_id": expected_id,
            })
            recovery_scan_path = run_dir / "scan-keys-recovery.json"
            recovery_evidence_path = run_dir / "field-evidence-recovery.json"
            write_json(recovery_scan_path, recovery_scan)
            write_json(recovery_evidence_path, recovery_evidence)
            recovery_validation_start = time.perf_counter()
            _, validation_process, validation_path, validation_report, validation_error = run_matcher(
                recovery_scan_path,
                run_dir / "lookup-reports" / "recovery-validation",
                args.output_root.resolve(),
                run_dir / "recovery-validation-process.json",
                args,
                lookup_only=True,
            )
            timings["match_and_label_seconds"] = round(
                timings["match_and_label_seconds"] + time.perf_counter() - recovery_validation_start, 4
            )
            validation_selected = (validation_report or {}).get("selected") or {}
            validation_summary = validation_selected.get("summary") or {}
            validation_match = validation_selected.get("match") or {}
            recovery_validated = (
                not validation_error
                and (validation_report or {}).get("status") == "matched"
                and validation_summary.get("api_id") == expected_id
                and validation_match.get("core_name_exact")
                and validation_match.get("core_number_exact")
                and not validation_match.get("hard_conflicts")
            )
            recovery_details.update({
                "validation_status": (validation_report or {}).get("status") or ("timeout" if validation_error else "missing_report"),
                "validation_candidate_id": validation_summary.get("api_id"),
                "validation_report": str(validation_path) if validation_path else None,
                "validation_passed": recovery_validated,
            })
            result["artifacts"].update({
                "recovery_validation_process": str(run_dir / "recovery-validation-process.json"),
                "recovery_validation_report": str(validation_path) if validation_path else None,
                "scan_keys_recovery": str(recovery_scan_path),
                "field_evidence_recovery": str(recovery_evidence_path),
            })
            if recovery_validated and args.lookup_only:
                selected_process = validation_process
                selected_report_path = validation_path
                selected_report = validation_report
                scan_payload = recovery_scan
                evidence = recovery_evidence
                result["scan_keys"] = scan_payload
                scan_path = recovery_scan_path
                evidence_path = recovery_evidence_path
                result["artifacts"]["match_process"] = str(run_dir / "recovery-validation-process.json")
                result["artifacts"]["field_evidence"] = str(evidence_path)
                result["artifacts"]["scan_keys"] = str(scan_path)
            elif recovery_validated:
                recovery_generation_start = time.perf_counter()
                _, generation_process, generation_path, generation_report, generation_error = run_matcher(
                    recovery_scan_path,
                    run_dir / "lookup-reports" / "recovery-generation",
                    args.output_root.resolve(),
                    run_dir / "recovery-match-process.json",
                    args,
                    lookup_only=False,
                )
                timings["match_and_label_seconds"] = round(
                    timings["match_and_label_seconds"] + time.perf_counter() - recovery_generation_start, 4
                )
                generation_selected = (generation_report or {}).get("selected") or {}
                generation_summary = generation_selected.get("summary") or {}
                generation_passed = (
                    not generation_error
                    and (generation_report or {}).get("status") in {"created", "output_exists"}
                    and generation_summary.get("api_id") == expected_id
                )
                recovery_details.update({
                    "generation_status": (generation_report or {}).get("status") or ("timeout" if generation_error else "missing_report"),
                    "generation_candidate_id": generation_summary.get("api_id"),
                    "generation_passed": generation_passed,
                })
                if generation_passed:
                    selected_process = generation_process
                    selected_report_path = generation_path
                    selected_report = generation_report
                    scan_payload = recovery_scan
                    evidence = recovery_evidence
                    result["scan_keys"] = scan_payload
                    scan_path = recovery_scan_path
                    evidence_path = recovery_evidence_path
                    result["artifacts"].update({
                        "match_process": str(run_dir / "recovery-match-process.json"),
                        "match_report": str(generation_path) if generation_path else None,
                        "field_evidence": str(evidence_path),
                        "scan_keys": str(scan_path),
                        "recovery_match_process": str(run_dir / "recovery-match-process.json"),
                    })
            if not recovery_details.get("validation_passed"):
                recovery_details["reason"] = "The recovered interpretation did not uniquely validate against the expected catalog card."
            elif not recovery_details.get("generation_passed", args.lookup_only):
                recovery_details["reason"] = "Validation passed, but label generation did not finish for the expected catalog card."
        else:
            recovery_details["reason"] = "Recovery would remove a line without sufficient layout evidence."
        write_json(run_dir / "interpretation-recovery.json", recovery_details)
        result["artifacts"]["interpretation_recovery"] = str(run_dir / "interpretation-recovery.json")
        result["interpretation_recovery"] = recovery_details

    result["matcher_exit_code"] = selected_process.returncode if selected_process else None
    result["matcher_stdout"] = selected_process.stdout if selected_process else ""
    if selected_report:
        result["match_status"] = selected_report.get("status")
        result["match_reason"] = selected_report.get("decision")
        result["selected"] = (selected_report.get("selected") or {}).get("summary")
        result["match_score"] = ((selected_report.get("selected") or {}).get("match") or {}).get("score")
        if result.get("identity_source") == "local_image_library_pHash":
            result["match_score_semantics"] = (
                "Catalog-key agreement for the selected image candidate; image similarity is represented by pHash distance and runner-up gap."
            )
        elif result.get("identity_source") == "pokeum":
            result["match_score_semantics"] = (
                "Catalog-key agreement for the Pokeum-selected local record; visual confidence and margin are recorded in pokeum-result.json."
            )
        output_path = selected_report.get("output_path")
        if output_path:
            result["artifacts"]["label_output"] = output_path
            output_dir = Path(output_path)
            result["artifacts"]["front_png"] = str(next(iter(output_dir.glob("*-front.png")), "")) or None
            result["artifacts"]["back_png"] = str(next(iter(output_dir.glob("*-back.png")), "")) or None
    result["artifacts"]["match_report"] = str(selected_report_path) if selected_report_path else None
    if selected_process:
        result["artifacts"]["match_process"] = result["artifacts"].get("match_process", str(run_dir / "match-process.json"))
    mapped_status = (selected_report or {}).get("status")
    if mapped_status == "created":
        result["status"] = "label_created"
    elif mapped_status in {"ambiguous", "conflict"}:
        result["status"] = "review_required"
    elif mapped_status == "no_match":
        result["status"] = "no_match"
    elif mapped_status == "output_exists":
        result["status"] = "output_exists"
    elif mapped_status == "layout_blocked":
        result["status"] = "layout_blocked"
    elif mapped_status == "generation_failed":
        result["status"] = "generation_failed"
    elif args.lookup_only and mapped_status == "matched":
        result["status"] = "matched_preview"
    else:
        result["status"] = "pipeline_error"
        result["reason"] = (selected_process.stderr if selected_process else "")[-4000:] or "Matcher did not return a recognized result."
    result["reason"] = result.get("match_reason", result.get("reason"))
    timings["total_seconds"] = round(time.perf_counter() - started, 4)
    result["scan_keys"] = scan_payload
    write_json(result_path, result)
    result["artifacts"]["pipeline_result"] = str(result_path)
    write_json(result_path, result)

    if result["status"] in {"label_created", "matched_preview"}:
        return 0, result
    if result["status"] == "no_match":
        return 4, result
    if result["status"] in {"review_required", "output_exists"}:
        return 5, result
    return 6, result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", nargs="?", type=Path, help="Path to one upright, fully visible card image")
    parser.add_argument("--from-raw-ocr", type=Path, help="Reinterpret a saved raw-ocr.json without invoking PaddleOCR")
    parser.add_argument("--language", default="en", help="Card language (default: en)")
    parser.add_argument(
        "--strategy",
        choices=("image-first", "ocr-first"),
        default="image-first",
        help="Try Pokeum, local pHash, and then OCR (default), or use the previous OCR-first flow.",
    )
    parser.add_argument(
        "--disable-pokeum",
        action="store_true",
        help="Skip Pokeum and continue with the local pHash then OCR workflow.",
    )
    parser.add_argument(
        "--pokeum-url",
        default=os.environ.get("DCR_POKEUM_URL", "http://127.0.0.1:8765"),
        help="Base URL of the local Pokeum API (default: DCR_POKEUM_URL or loopback port 8765).",
    )
    parser.add_argument(
        "--pokeum-timeout",
        type=float,
        default=float(os.environ.get("DCR_POKEUM_TIMEOUT_SECONDS", "5")),
        help="Maximum seconds to wait for one Pokeum identification request (default: 5).",
    )
    parser.add_argument("--ocr-python", help="Python executable containing PaddleOCR; defaults to DCR_PADDLE_PYTHON or detected project env")
    parser.add_argument("--scan-root", type=Path, default=CARD_ROOT / "scan-results")
    parser.add_argument("--output-root", type=Path, default=CARD_ROOT / "outputs")
    parser.add_argument("--max-candidates", type=int, default=900)
    parser.add_argument("--minimum-name-confidence", type=float, default=0.65)
    parser.add_argument("--minimum-number-confidence", type=float, default=0.55)
    parser.add_argument(
        "--disable-image-recovery",
        action="store_true",
        help="Skip Pokeum and local pHash matching; use the OCR-first path.",
    )
    parser.add_argument(
        "--image-match-max-distance",
        type=int,
        default=8,
        help="Maximum 64-bit pHash distance accepted for automatic image-first identity selection (default: 8).",
    )
    parser.add_argument(
        "--image-match-min-gap",
        type=int,
        default=4,
        help="Minimum distance gap over the next image candidate (default: 4).",
    )
    parser.add_argument(
        "--image-match-limit",
        type=int,
        default=10,
        help="How many nearest local image candidates to inspect (default: 10).",
    )
    parser.add_argument("--ocr-timeout", type=int, default=180)
    parser.add_argument("--match-timeout", type=int, default=120)
    parser.add_argument("--lookup-only", action="store_true", help="Match and report without generating a label")
    args = parser.parse_args()
    if bool(args.image) == bool(args.from_raw_ocr):
        parser.error("provide exactly one card image or --from-raw-ocr path")
    if args.max_candidates < 1 or args.max_candidates > 900:
        parser.error("--max-candidates must be between 1 and 900")
    if args.pokeum_timeout <= 0:
        parser.error("--pokeum-timeout must be greater than zero")
    if not 0 <= args.minimum_name_confidence <= 1 or not 0 <= args.minimum_number_confidence <= 1:
        parser.error("confidence thresholds must be between 0 and 1")
    if not 0 <= args.image_match_max_distance <= 63:
        parser.error("--image-match-max-distance must be between 0 and 63")
    if not 0 <= args.image_match_min_gap <= 63:
        parser.error("--image-match-min-gap must be between 0 and 63")
    if not 2 <= args.image_match_limit <= 100:
        parser.error("--image-match-limit must be between 2 and 100 so the runner-up can be checked")

    code, result = run_pipeline(args)
    print(f"Pipeline status: {result['status']}")
    if result.get("scan_keys", {}).get("keys"):
        keys = result["scan_keys"]["keys"]
        print(f"Scan keys: {keys.get('name', '?')} {keys.get('collector_number', '?')} HP {keys.get('hp', '?')}")
    if result.get("selected"):
        selected = result["selected"]
        if result.get("identity_source") in {"local_image_library_pHash", "pokeum"}:
            print(
                f"Catalog record: {selected.get('name')} — {selected.get('set_name')} "
                f"#{selected.get('local_id')} (catalog-key match {result.get('match_score')}%)"
            )
        else:
            print(f"Matched: {selected.get('name')} — {selected.get('set_name')} #{selected.get('local_id')} ({result.get('match_score')}%)")
    pokeum = result.get("pokeum") or {}
    if pokeum.get("status") == "matched":
        selected_pokeum = pokeum.get("selected_catalog_record") or {}
        print(
            "Pokeum identity: "
            f"{selected_pokeum.get('api_id')} at confidence {pokeum.get('confidence')}; "
            f"margin {pokeum.get('confidence_margin')} — catalog verified."
        )
    elif pokeum and pokeum.get("status") not in {"disabled", "not_used"}:
        print(
            f"Pokeum: {pokeum.get('status')} — {pokeum.get('reason')}; "
            "continuing with local pHash/OCR."
        )
    image_first = result.get("image_first") or {}
    if image_first.get("status") == "matched":
        selected_image = image_first.get("selected_catalog_record") or {}
        print(
            "Image-first identity: "
            f"{selected_image.get('api_id')} at pHash {selected_image.get('distance')}/63; "
            f"runner-up gap {selected_image.get('distance_gap')}; OCR skipped."
        )
    elif image_first and image_first.get("status") not in {"disabled", "unavailable", "skipped"}:
        print(f"Image-first: {image_first.get('status')} — continuing with OCR ({image_first.get('reason')}).")
    elif result.get("strategy") == "image-first" and image_first.get("status") == "unavailable":
        print(f"Image-first unavailable — continuing with OCR ({image_first.get('reason')}).")
    image_recovery = result.get("image_recovery") or {}
    if image_recovery.get("status") == "inferred_unique":
        selected_image = image_recovery.get("selected_catalog_record") or {}
        print(
            "Image-assisted identity: "
            f"{selected_image.get('api_id')} at pHash {selected_image.get('distance')}/63; "
            f"OCR corroborated {', '.join(image_recovery.get('corroborating_fields') or [])}."
        )
    elif image_recovery and image_recovery.get("status") != "disabled":
        print(f"Image-assisted recovery: {image_recovery.get('status')} — {image_recovery.get('reason')}")
    if result.get("blockers"):
        for blocker in result["blockers"]:
            print(f"Needs review: {blocker}")
    timings = result.get("timings", {})
    if result.get("ocr_skipped"):
        if result.get("identity_source") == "pokeum":
            print(
                f"OCR: skipped (Pokeum accepted the catalog identity); "
                f"Pokeum: {timings.get('pokeum_seconds', 0):.2f}s; "
                f"match+label: {timings.get('match_and_label_seconds', 0):.2f}s; "
                f"total: {timings.get('total_seconds', 0):.2f}s"
            )
        else:
            print(
                f"OCR: skipped (image match accepted); image match: {timings.get('image_match_seconds', 0):.2f}s; "
                f"match+label: {timings.get('match_and_label_seconds', 0):.2f}s; total: {timings.get('total_seconds', 0):.2f}s"
            )
    elif result.get("ocr_reused"):
        print(f"OCR: skipped (raw OCR reused); match+label: {timings.get('match_and_label_seconds', 0):.2f}s; total: {timings.get('total_seconds', 0):.2f}s")
    else:
        print(
            f"OCR: {timings.get('ocr_seconds', 0):.2f}s; "
            f"Pokeum: {timings.get('pokeum_seconds', 0):.2f}s; "
            f"image-first: {timings.get('image_match_seconds', 0):.2f}s; "
            f"match+label: {timings.get('match_and_label_seconds', 0):.2f}s; total: {timings.get('total_seconds', 0):.2f}s"
        )
    if result.get("interpretation_recovery"):
        recovery = result["interpretation_recovery"]
        print(f"Interpretation recovery: attempted={recovery.get('attempted')} safe={recovery.get('safe_to_retry')} validated={recovery.get('validation_passed', False)}")
    for key in ("front_png", "back_png", "pipeline_result", "match_report", "raw_ocr", "scan_keys", "pokeum_result"):
        path = result.get("artifacts", {}).get(key)
        if path:
            print(f"{key}: {path}")
    if result.get("reason"):
        print(f"Reason: {result['reason']}")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
