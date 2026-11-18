#!/usr/bin/env python3
"""Convert PaddleOCR line output into the scan-key contract used by lookup_card.py."""

from __future__ import annotations

import re
import unicodedata
from statistics import mean
from typing import Any


NUMBER_RE = re.compile(r"(?<![A-Za-z0-9])([0-9OQIl|]{1,4})\s*[/\\|]\s*([0-9OQIl|]{1,4})(?![A-Za-z0-9])", re.IGNORECASE)
HP_RE = re.compile(
    r"\b(?:HP\s*[:.]?\s*([0-9OQIl|]{1,3})|([0-9OQIl|]{1,3})\s*HP)\b",
    re.IGNORECASE,
)
STAGE_RE = re.compile(r"\b(STAGE\s*[12]|BASIC)\b", re.IGNORECASE)
DELTA_SPECIES_RE = re.compile(r"DELTA\s+SPECIES", re.IGNORECASE)
LEVEL_RE = re.compile(r"\s+(?:LV|LEVEL)\.?\s*\d+.*$", re.IGNORECASE)
ATTACK_EFFECT_START_RE = re.compile(
    r"\b(?:flip\s+a\s+coin|choose\s+\d+|discard\b|move\s+an?\b|heal\b|"
    r"prevent\b|search\s+your\b|attach\b|put\b|remove\b|this\s+attack\b|"
    r"does\s+\d+\b|the\s+defending\b|each\s+player\b)",
    re.IGNORECASE,
)
ATTACK_CONTINUATION_RE = re.compile(
    r"^(?:heads?\b|tails\b|if\s+(?:heads?|tails?)\b|this\s+attack\b|does\s+\d+\b|"
    r"during\b|opponent(?:'s)?\b|attacks?\b)",
    re.IGNORECASE,
)


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return default


def _number_digits(value: str) -> str:
    table = str.maketrans({"O": "0", "Q": "0", "o": "0", "q": "0", "I": "1", "l": "1", "|": "1"})
    return re.sub(r"\D", "", value.translate(table))


def flatten_lines(payload: dict[str, Any]) -> list[dict[str, Any]]:
    width, height = (payload.get("image_size") or [0, 0])[:2]
    if not width or not height:
        return []
    lines: list[dict[str, Any]] = []
    for pass_data in payload.get("passes", []):
        region = pass_data.get("region") or [0, 0, width, height]
        scale = max(1, int(pass_data.get("scale", 1)))
        x0, y0 = float(region[0]), float(region[1])
        texts = pass_data.get("rec_texts") or []
        scores = pass_data.get("rec_scores") or []
        boxes = pass_data.get("rec_boxes") or []
        for index, raw_text in enumerate(texts):
            text = str(raw_text).strip()
            if not text:
                continue
            score = _as_float(scores[index]) if index < len(scores) else 0.0
            box = boxes[index] if index < len(boxes) else None
            if isinstance(box, (list, tuple)) and len(box) >= 4:
                bx0, by0, bx1, by1 = (float(v) for v in box[:4])
                bbox = [x0 + bx0 / scale, y0 + by0 / scale, x0 + bx1 / scale, y0 + by1 / scale]
            else:
                bbox = [0.0, 0.0, 0.0, 0.0]
            lines.append({
                "text": text,
                "confidence": score,
                "bbox": [round(v, 2) for v in bbox],
                "bbox_normalized": [round(bbox[0] / width, 5), round(bbox[1] / height, 5),
                                    round(bbox[2] / width, 5), round(bbox[3] / height, 5)],
                "pass_id": pass_data.get("pass_id", "full"),
            })
    return lines


def parse_card_keys(
    payload: dict[str, Any],
    language: str = "en",
    scan_id: str = "",
    attack_mode: str = "primary",
    layout_profile: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    if attack_mode not in {"primary", "layout_recovery"}:
        raise ValueError(f"Unsupported attack parser mode: {attack_mode}")

    lines = flatten_lines(payload)
    width, height = payload.get("image_size", [0, 0])[:2]
    keys: dict[str, Any] = {"language": language}
    confidence: dict[str, float] = {"language": 1.0}
    evidence: dict[str, Any] = {"schema_version": 1, "scan_id": scan_id or None, "lines": lines, "fields": {}}

    profile_id = str((layout_profile or {}).get("profile_id") or "")
    profile_calibrated = bool(
        layout_profile
        and layout_profile.get("status") in {"pilot", "calibrated"}
        and layout_profile.get("attack_y_max") is not None
    )
    attack_y_min = _as_float((layout_profile or {}).get("attack_y_min"), 0.50) if profile_calibrated else 0.50
    attack_y_max = (
        _as_float((layout_profile or {}).get("attack_y_max"), 0.80 if attack_mode == "layout_recovery" else 0.86)
        if profile_calibrated else (0.86 if attack_mode == "primary" else 0.80)
    )
    evidence["layout_profile"] = {
        "profile_id": profile_id or None,
        "status": (layout_profile or {}).get("status", "unavailable"),
        "applied": profile_calibrated,
        "attack_y_min": round(attack_y_min, 4),
        "attack_y_max": round(attack_y_max, 4),
        "source_examples": (layout_profile or {}).get("source_examples", []),
    }

    def add(field: str, raw: str, value: Any, score: float, line: dict[str, Any]) -> None:
        keys[field] = value
        confidence[field] = round(_as_float(score), 4)
        evidence["fields"][field] = {
            "raw_text": raw,
            "normalized_value": value,
            "confidence": confidence[field],
            "bbox": line.get("bbox"),
            "bbox_normalized": line.get("bbox_normalized"),
            "pass_id": line.get("pass_id"),
        }

    # Card title area: keep alphabetic header text and remove printed level suffixes.
    title_candidates: list[tuple[float, int, dict[str, Any], str]] = []
    delta_species_markers: list[dict[str, Any]] = []
    for line in lines:
        x0, y0, x1, y1 = line["bbox_normalized"]
        raw = line["text"].strip()
        if y0 > 0.18 or not re.search(r"[A-Za-z]", raw):
            continue
        if DELTA_SPECIES_RE.search(raw):
            delta_species_markers.append(line)
            continue
        if re.fullmatch(r"(?:BASIC|STAGE\s*[12]|STAGE[Il])", raw, re.IGNORECASE):
            continue
        if re.search(r"\bHP\b", raw, re.IGNORECASE):
            continue
        cleaned = LEVEL_RE.sub("", raw).strip(" .,:;|-")
        cleaned = re.sub(r"\s+", " ", cleaned)
        if cleaned and len(cleaned) <= 32:
            # Prefer a centered title line over stage text or a corner symbol.
            center_x = (x0 + x1) / 2
            center_penalty = abs(center_x - 0.48)
            title_candidates.append((line["confidence"] - center_penalty * 0.3, int(y0 * 10000), line, cleaned))
    if title_candidates:
        _, _, line, name = max(title_candidates, key=lambda item: item[0])
        delta_marker = max(delta_species_markers, key=lambda item: item["confidence"], default=None)
        name_confidence = line["confidence"]
        if delta_marker and delta_marker["confidence"] >= 0.70 and not name.casefold().rstrip().endswith(("δ", "delta")):
            name = f"{name} δ"
            name_confidence = min(name_confidence, delta_marker["confidence"])
        add("name", line["text"], name, name_confidence, line)
        if delta_marker and name.endswith(" δ"):
            evidence["fields"]["name"]["variant_marker"] = {
                "raw_text": delta_marker["text"],
                "normalized_value": "δ",
                "confidence": round(_as_float(delta_marker["confidence"]), 4),
                "bbox": delta_marker.get("bbox"),
                "bbox_normalized": delta_marker.get("bbox_normalized"),
                "pass_id": delta_marker.get("pass_id"),
            }

    # Full collector number is a critical identity key; don't infer a denominator.
    number_candidates: list[tuple[float, dict[str, Any], str]] = []
    for line in lines:
        match = NUMBER_RE.search(line["text"])
        if not match:
            continue
        local_id = _number_digits(match.group(1))
        denominator = _number_digits(match.group(2))
        if not local_id or not denominator:
            continue
        value = f"{int(local_id)}/{int(denominator)}"
        # Prefer evidence from a crop designed for the footer over a stray body string.
        pass_bonus = 0.03 if line["pass_id"].startswith("footer") else 0.0
        number_candidates.append((min(1.0, line["confidence"] + pass_bonus), line, value))
    if number_candidates:
        score, line, value = max(number_candidates, key=lambda item: item[0])
        add("collector_number", line["text"], value, score, line)

    stage_candidates: list[tuple[float, dict[str, Any], str]] = []
    for line in lines:
        match = STAGE_RE.search(line["text"].upper().replace("STAGEI", "STAGE1").replace("STAGE L", "STAGE1"))
        if not match:
            continue
        token = re.sub(r"\s+", "", match.group(1).upper())
        value = "Basic" if token == "BASIC" else "Stage1" if token.endswith("1") else "Stage2"
        stage_candidates.append((line["confidence"], line, value))
    if stage_candidates:
        score, line, value = max(stage_candidates, key=lambda item: item[0])
        add("stage", line["text"], value, score, line)

    hp_candidates: list[tuple[float, dict[str, Any], str]] = []
    for line in lines:
        raw = line["text"]
        match = HP_RE.search(raw)
        if match:
            hp_digits = _number_digits(match.group(1) or match.group(2))
            if hp_digits:
                hp_candidates.append((line["confidence"], line, hp_digits))
                continue
        x0, y0, x1, y1 = line["bbox_normalized"]
        if y1 <= 0.16 and (x0 + x1) / 2 >= 0.72 and re.fullmatch(r"[0-9OQIl|]{2,3}", raw.strip()):
            hp_digits = _number_digits(raw)
            if hp_digits:
                hp_candidates.append((line["confidence"], line, hp_digits))
    if hp_candidates:
        score, line, hp = max(hp_candidates, key=lambda item: item[0])
        add("hp", line["text"], int(hp), score, line)

    illustrator_candidates: list[tuple[float, dict[str, Any], str]] = []
    for line in lines:
        match = re.search(r"(?:illus\.?|illustrator)\s*[:.]?\s*(.+)$", line["text"], re.IGNORECASE)
        if match and match.group(1).strip():
            illustrator_candidates.append((line["confidence"], line, match.group(1).strip()))
    if illustrator_candidates:
        score, line, illustrator = max(illustrator_candidates, key=lambda item: item[0])
        add("illustrator", line["text"], illustrator, score, line)

    attack_candidates: list[dict[str, Any]] = []
    attack_decisions: list[dict[str, Any]] = []
    ignored_attack_lines = re.compile(r"\b(?:weakness|resistance|retreat|cost|illus|pokemon|pok[eé]mon|hp)\b", re.IGNORECASE)
    sentence_like = re.compile(
        r"^(?:you\b|your\b|this\b|the\b|if\b|when\b|during\b|flip\b|does\b|prevent\b|heal\b|discard\b)",
        re.IGNORECASE,
    )
    damage_rows: list[float] = []
    for line in lines:
        x0, y0, x1, y1 = line["bbox_normalized"]
        raw = line["text"].strip(" .,:;|-")
        if x0 >= 0.76 and attack_y_min <= y0 <= min(0.90, attack_y_max + 0.02) and re.fullmatch(r"\d{1,3}(?:\+|×|x)?", raw, re.IGNORECASE):
            damage_rows.append((y0 + y1) / 2)

    for line_index, line in enumerate(lines):
        x0, y0, x1, y1 = line["bbox_normalized"]
        raw = line["text"].strip(" .,:;|-")
        candidate_name = raw
        extraction_reason = None
        center_x = (x0 + x1) / 2
        center_y = (y0 + y1) / 2
        if not (attack_y_min <= y0 <= 0.90) or not 0.25 <= center_x <= 0.82:
            continue

        reason = None
        if y0 > attack_y_max:
            if profile_calibrated:
                reason = "below_profile_attack_band"
            else:
                reason = "below_attack_band" if attack_mode == "layout_recovery" else "outside_primary_attack_band"
        elif ATTACK_CONTINUATION_RE.search(raw):
            reason = "attack_effect_continuation"
        else:
            effect_start = ATTACK_EFFECT_START_RE.search(raw)
            if effect_start and effect_start.start() > 0:
                prefix = raw[:effect_start.start()].strip(" .,:;|-")
                if 3 <= len(prefix) <= 30 and not ignored_attack_lines.search(prefix):
                    candidate_name = prefix
                    extraction_reason = "attack_title_prefix_before_effect_text"

        if reason is None and len(candidate_name) < 3:
            reason = "too_short_for_attack_name"
        elif reason is None and len(candidate_name) > 34:
            reason = "sentence_or_description_too_long"
        elif reason is None and ignored_attack_lines.search(candidate_name):
            reason = "contains_non_attack_marker"
        elif reason is None and not re.search(r"[A-Za-z]", candidate_name):
            reason = "no_name_text"
        elif reason is None and attack_mode == "layout_recovery" and sentence_like.search(candidate_name):
            reason = "sentence_like_text"

        aligned_damage = any(abs(center_y - row_y) <= 0.035 for row_y in damage_rows)
        if reason:
            attack_decisions.append({
                "line_index": line_index,
                "text": line["text"],
                "decision": "excluded",
                "reason": reason,
                "bbox_normalized": line.get("bbox_normalized"),
                "recognition_confidence": line["confidence"],
                "pass_id": line.get("pass_id"),
            })
            continue
        if candidate_name not in [entry["name"] for entry in attack_candidates]:
            role_confidence = 0.92 if aligned_damage else 0.78
            if y0 > 0.80:
                role_confidence = min(role_confidence, 0.35)
            attack_candidates.append({"name": candidate_name, "_line": line, "_role_confidence": role_confidence})
            decision = {
                "line_index": line_index,
                "text": line["text"],
                "decision": "attack_name_candidate",
                "reason": extraction_reason or (
                    "short_centered_text_with_damage_alignment" if aligned_damage else "short_centered_text_in_attack_band"
                ),
                "bbox_normalized": line.get("bbox_normalized"),
                "recognition_confidence": line["confidence"],
                "role_confidence": role_confidence,
                "pass_id": line.get("pass_id"),
                "layout_profile_id": profile_id or None,
            }
            if extraction_reason:
                decision["extracted_name"] = candidate_name
            attack_decisions.append(decision)
    if attack_candidates:
        attacks = [{"name": item["name"]} for item in attack_candidates]
        score = mean(item["_line"]["confidence"] for item in attack_candidates)
        role_score = mean(item["_role_confidence"] for item in attack_candidates)
        keys["attacks"] = attacks
        confidence["attacks"] = round(_as_float(score), 4)
        evidence["fields"]["attacks"] = {
            "raw_text": [item["_line"]["text"] for item in attack_candidates],
            "normalized_value": attacks,
            # OCR recognition confidence measures the text itself; role confidence
            # separately measures whether the line is an attack header.
            "confidence": confidence["attacks"],
            "recognition_confidence": confidence["attacks"],
            "role_confidence": round(_as_float(role_score), 4),
            "parser_mode": attack_mode,
            "bboxes": [item["_line"]["bbox"] for item in attack_candidates],
            "pass_ids": [item["_line"]["pass_id"] for item in attack_candidates],
            "line_decisions": attack_decisions,
        }

    scan_json = {
        "schema_version": 1,
        "scan_id": scan_id or None,
        "keys": keys,
        "confidence": confidence,
        "source_urls": [],
    }
    evidence["image_size"] = [width, height]
    return scan_json, evidence
