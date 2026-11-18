#!/usr/bin/env python3
"""Match scan keys to the local TCGdex catalog and optionally create a DCR tag."""

from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import secrets
import sqlite3
import subprocess
import sys
import traceback
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote


ROOT = Path(__file__).resolve().parent
DEFAULT_DB = ROOT / "catalog" / "cards.sqlite"
DEFAULT_RULES = ROOT / "catalog-label-rules.json"
DEFAULT_PSA_PROFILES = ROOT / "psa-label-profiles.json"
DEFAULT_REPORT_ROOT = ROOT / "lookup-results"
DEFAULT_OUTPUT_ROOT = ROOT / "outputs"
GENERATOR = ROOT / "create_tag.py"

EXIT_OK = 0
EXIT_INPUT_ERROR = 2
EXIT_CATALOG_ERROR = 3
EXIT_NO_MATCH = 4
EXIT_REVIEW_REQUIRED = 5
EXIT_GENERATION_ERROR = 6
EXIT_OUTPUT_EXISTS = 7

LANGUAGE_ALIASES = {
    "en": "en", "english": "en",
    "th": "th", "thai": "th",
    "ko": "ko", "korean": "ko",
    "ja": "ja", "japanese": "ja",
    "zh-tw": "zh-tw", "zh_tw": "zh-tw", "traditional chinese": "zh-tw",
    "zh-cn": "zh-cn", "zh_cn": "zh-cn", "simplified chinese": "zh-cn",
}

CORE_NAME_WEIGHT = 25
CORE_NUMBER_WEIGHT = 25
LANGUAGE_WEIGHT = 10
SET_ID_WEIGHT = 15
SET_NAME_WEIGHT = 10
DENOMINATOR_WEIGHT = 5
SECONDARY_WEIGHTS = {
    "hp": 5,
    "illustrator": 4,
    "types": 3,
    "stage": 2,
    "ability_names": 4,
    "attacks": 5,
    "weaknesses": 2,
    "resistances": 2,
    "evolves_from": 3,
    "retreat": 1,
}

REQUIRED_TABLE_COLUMNS = {
    "cards": {
        "source_path", "set_path", "api_id", "set_id", "local_id", "category",
        "rarity", "illustrator", "raw_json",
    },
    "card_locales": {
        "source_path", "language", "card_name", "set_id", "local_id",
        "set_name", "series_name", "release_date",
    },
    "sets": {"set_id", "series_path", "raw_json"},
    "series": {"source_path", "series_id", "raw_json"},
    "catalog_meta": {"key", "value"},
}

IMAGE_KEYS = {
    "image", "images", "imageurl", "image_url", "imageurls", "image_urls",
    "smallimage", "small_image", "largeimage", "large_image", "thumbnail",
    "thumbnailurl", "thumbnail_url", "artworkurl", "artwork_url",
}


class InputProblem(ValueError):
    pass


class CatalogProblem(RuntimeError):
    pass


class MatchProblem(RuntimeError):
    pass


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def new_run_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + secrets.token_hex(4)


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = unicodedata.normalize("NFKD", str(value)).casefold()
    without_marks = "".join(char for char in text if not unicodedata.combining(char))
    return " ".join("".join(char if char.isalnum() else " " for char in without_marks).split())


def normalize_local_id(value: Any) -> str:
    if value is None:
        return ""
    text = unicodedata.normalize("NFKC", str(value)).strip().upper()
    text = re.sub(r"^\s*#", "", text)
    text = re.sub(r"\s+", "", text)
    if text.isdigit():
        return str(int(text))
    return text


def parse_collector_number(value: Any) -> tuple[str, str | None, str]:
    if value is None:
        raise InputProblem("Missing required key: collector_number (or number)")
    raw = unicodedata.normalize("NFKC", str(value)).strip()
    raw = re.sub(r"^\s*#", "", raw)
    pieces = re.split(r"\s*/\s*", raw, maxsplit=1)
    local_id = normalize_local_id(pieces[0])
    denominator = normalize_local_id(pieces[1]) if len(pieces) == 2 else None
    if not local_id:
        raise InputProblem("collector_number must include a card number, such as 57 or 57/100")
    return local_id, denominator or None, raw


def confidence_for(confidence: dict[str, Any], key: str) -> float:
    aliases = {
        "collector_number": ("collector_number", "number", "local_id"),
        "illustrator": ("illustrator", "artist"),
        "set_name": ("set_name", "set"),
        "ability_names": ("ability_names", "abilities"),
    }
    raw: Any = 1.0
    for alias in aliases.get(key, (key,)):
        if alias in confidence:
            raw = confidence[alias]
            break
    try:
        number = float(raw)
    except (TypeError, ValueError):
        return 1.0
    return max(0.0, min(1.0, number))


def list_of_strings(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value] if value.strip() else []
    if isinstance(value, (list, tuple)):
        return [str(item) for item in value if item is not None and str(item).strip()]
    return [str(value)]


def normalize_language(value: Any) -> str:
    if value is None:
        raise InputProblem("Missing required key: language")
    key = normalize_text(value)
    if key == "zh tw" or key == "zh tw chinese traditional":
        return "zh-tw"
    if key == "zh cn" or key == "zh cn chinese simplified":
        return "zh-cn"
    raw = str(value).strip().casefold().replace("_", "-")
    language = LANGUAGE_ALIASES.get(raw) or LANGUAGE_ALIASES.get(key)
    if language:
        return language
    if key in {"chinese", "zh"}:
        raise InputProblem("Language 'Chinese' is ambiguous; use zh-tw or zh-cn")
    raise InputProblem(f"Unsupported language {value!r}; catalog languages are en, th, ko, zh-tw, zh-cn, ja")


def read_scan_payload(path: Path) -> tuple[dict[str, Any], dict[str, float], list[str], str]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except OSError as exc:
        raise InputProblem(f"Cannot read scan-key JSON {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise InputProblem(f"Invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}") from exc
    if not isinstance(payload, dict):
        raise InputProblem("Scan-key JSON must contain an object")

    schema_version = payload.get("schema_version", 1)
    if schema_version != 1:
        raise InputProblem(f"Unsupported scan-key schema_version {schema_version!r}; expected 1")
    source = payload.get("keys", payload.get("scan", payload))
    if not isinstance(source, dict):
        raise InputProblem("The keys field must be an object")

    name = source.get("name", source.get("card_name"))
    if not isinstance(name, str) or not name.strip():
        raise InputProblem("Missing required key: name (or card_name)")
    language = normalize_language(source.get("language"))
    local_id, denominator, number_raw = parse_collector_number(
        source.get("collector_number", source.get("number", source.get("local_id")))
    )
    confidence = payload.get("confidence", source.get("confidence", {}))
    if not isinstance(confidence, dict):
        confidence = {}

    keys: dict[str, Any] = {
        "language": language,
        "name": name.strip(),
        "collector_number": number_raw,
        "local_id": local_id,
        "denominator": denominator,
    }
    for key in ("set_id", "set_name", "hp", "stage", "retreat"):
        value = source.get(key)
        if value not in (None, ""):
            keys[key] = value
    if "set" in source and "set_name" not in keys:
        keys["set_name"] = source["set"]
    if "artist" in source and "illustrator" not in source:
        source = {**source, "illustrator": source["artist"]}
    for key in ("illustrator",):
        value = source.get(key)
        if value not in (None, ""):
            keys[key] = str(value).strip()
    for key in ("types", "ability_names", "weaknesses", "resistances"):
        value = source.get(key)
        if value not in (None, "", []):
            keys[key] = value
    if source.get("evolves_from") not in (None, ""):
        keys["evolves_from"] = source["evolves_from"]
    elif source.get("evolvesFrom") not in (None, ""):
        keys["evolves_from"] = source["evolvesFrom"]
    if "abilities" in source and "ability_names" not in keys:
        abilities = source["abilities"]
        if isinstance(abilities, list):
            keys["ability_names"] = [
                item.get("name") if isinstance(item, dict) else item
                for item in abilities
            ]
        else:
            keys["ability_names"] = abilities
    attacks = source.get("attacks")
    if attacks not in (None, "", []):
        if not isinstance(attacks, list):
            attacks = [attacks]
        keys["attacks"] = attacks
    for key in ("finish", "finish_note"):
        value = source.get(key)
        if value not in (None, ""):
            keys[key] = value

    source_urls = payload.get("source_urls", source.get("source_urls", []))
    if isinstance(source_urls, str):
        source_urls = [source_urls]
    if not isinstance(source_urls, list):
        source_urls = []
    source_urls = [str(item) for item in source_urls if item]

    scan_id = str(payload.get("scan_id", "")).strip()
    return keys, confidence, source_urls, scan_id


def load_rules(path: Path) -> dict[str, Any]:
    try:
        rules = json.loads(path.read_text(encoding="utf-8-sig"))
    except OSError as exc:
        raise CatalogProblem(f"Cannot read label rule config {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise CatalogProblem(f"Invalid label rule JSON at line {exc.lineno}, column {exc.colno}") from exc
    if not isinstance(rules, dict):
        raise CatalogProblem("Label rule config must contain a JSON object")
    rules.setdefault("language_rarity_codes", {})
    for key in (
        "language_names",
        "series_labels",
        "set_overrides",
        "rarity_codes",
        "language_rarity_codes",
    ):
        if not isinstance(rules.get(key), dict):
            raise CatalogProblem(f"Label rule config field {key!r} must be an object")
    for language, localized_codes in rules["language_rarity_codes"].items():
        if not isinstance(language, str) or not isinstance(localized_codes, dict) or any(
            not isinstance(rarity, str)
            or not isinstance(code, str)
            or not code.strip()
            for rarity, code in localized_codes.items()
        ):
            raise CatalogProblem(
                "Label rule config field 'language_rarity_codes' must map language codes "
                "to rarity-name/code objects"
            )
    display_name_overrides = rules.setdefault("display_name_overrides", {})
    if not isinstance(display_name_overrides, dict):
        raise CatalogProblem("Label rule config field 'display_name_overrides' must be an object")
    for card_id, localized_names in display_name_overrides.items():
        if not isinstance(localized_names, dict) or any(
            not isinstance(language, str) or not isinstance(name, str) or not name.strip()
            for language, name in localized_names.items()
        ):
            raise CatalogProblem(
                f"Display-name override for card ID {card_id!r} must map language codes to non-empty names"
            )
    return rules


def load_psa_profiles(path: Path) -> dict[str, Any]:
    try:
        profiles = json.loads(path.read_text(encoding="utf-8-sig"))
    except OSError as exc:
        raise CatalogProblem(f"Cannot read PSA label profiles {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise CatalogProblem(
            f"Invalid PSA label profile JSON at line {exc.lineno}, column {exc.colno}"
        ) from exc
    if not isinstance(profiles, dict) or profiles.get("schema_version") != 1:
        raise CatalogProblem("PSA label profiles must be an object with schema_version 1")
    set_profiles = profiles.get("profiles")
    card_labels = profiles.get("card_labels")
    if not isinstance(set_profiles, dict) or not isinstance(card_labels, dict):
        raise CatalogProblem("PSA label profiles must contain profiles and card_labels objects")

    def evidence_list(value: Any, label: str) -> None:
        if not isinstance(value, list) or any(
            not isinstance(item, dict)
            or not isinstance(item.get("url"), str)
            or not item["url"].strip()
            for item in value
        ):
            raise CatalogProblem(f"{label} must be a list of evidence objects with URLs")

    allowed_statuses = {"verified", "partial", "draft"}
    for profile_id, profile in set_profiles.items():
        if not isinstance(profile, dict):
            raise CatalogProblem(f"PSA set profile {profile_id!r} must be an object")
        if profile.get("status") not in allowed_statuses:
            raise CatalogProblem(f"PSA set profile {profile_id!r} has an invalid status")
        expected_id = f"{profile.get('language')}:{profile.get('set_id')}"
        if profile_id != expected_id:
            raise CatalogProblem(
                f"PSA set profile key {profile_id!r} does not match {expected_id!r}"
            )
        tag_fields = profile.get("tag_fields")
        if (
            not isinstance(profile.get("psa_brand_title"), str)
            or not profile["psa_brand_title"].strip()
            or not isinstance(tag_fields, dict)
            or any(
                not isinstance(tag_fields.get(field), str) or not tag_fields[field].strip()
                for field in ("year_series", "collection")
            )
        ):
            raise CatalogProblem(f"PSA set profile {profile_id!r} has incomplete label fields")
        evidence_list(profile.get("evidence"), f"PSA set profile {profile_id!r} evidence")
        rarity_terms = profile.get("rarity_terms", {})
        if not isinstance(rarity_terms, dict):
            raise CatalogProblem(f"PSA set profile {profile_id!r} rarity_terms must be an object")
        for rarity, term in rarity_terms.items():
            if (
                not isinstance(rarity, str)
                or not isinstance(term, dict)
                or term.get("status") not in allowed_statuses
                or not isinstance(term.get("psa_variety_pedigree"), str)
                or not term["psa_variety_pedigree"].strip()
                or not isinstance(term.get("dcr_rarity_code"), str)
                or not term["dcr_rarity_code"].strip()
            ):
                raise CatalogProblem(
                    f"PSA set profile {profile_id!r} has an invalid rarity term"
                )
            evidence_list(
                term.get("evidence"),
                f"PSA set profile {profile_id!r} rarity {rarity!r} evidence",
            )

    for card_key, card_label in card_labels.items():
        if (
            not isinstance(card_label, dict)
            or card_label.get("status") not in allowed_statuses
            or not isinstance(card_label.get("subject"), str)
            or not card_label["subject"].strip()
        ):
            raise CatalogProblem(f"PSA card label {card_key!r} is incomplete")
        evidence_list(card_label.get("evidence"), f"PSA card label {card_key!r} evidence")
    return profiles


def open_catalog(path: Path) -> tuple[sqlite3.Connection, dict[str, str]]:
    if not path.is_file():
        raise CatalogProblem(f"Catalog database not found: {path}")
    connection: sqlite3.Connection | None = None
    try:
        uri = path.resolve().as_uri() + "?mode=ro"
        connection = sqlite3.connect(uri, uri=True, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA query_only=ON")
        tables = {
            row["name"]
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        for table, required in REQUIRED_TABLE_COLUMNS.items():
            if table not in tables:
                raise CatalogProblem(f"Catalog is missing required table {table!r}")
            columns = {row["name"] for row in connection.execute(f"PRAGMA table_info({table})")}
            missing = required - columns
            if missing:
                raise CatalogProblem(f"Catalog table {table!r} is missing columns: {', '.join(sorted(missing))}")
        meta = dict(connection.execute("SELECT key, value FROM catalog_meta"))
        return connection, meta
    except sqlite3.Error as exc:
        if connection is not None:
            connection.close()
        raise CatalogProblem(f"Cannot open catalog read-only: {exc}") from exc
    except CatalogProblem:
        if connection is not None:
            connection.close()
        raise


def json_object(value: Any, label: str) -> dict[str, Any]:
    if value in (None, ""):
        return {}
    try:
        result = json.loads(value)
    except (TypeError, json.JSONDecodeError) as exc:
        raise CatalogProblem(f"Invalid JSON in catalog field {label}: {exc}") from exc
    if not isinstance(result, dict):
        raise CatalogProblem(f"Catalog field {label} is not a JSON object")
    return result


def remove_image_fields(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: remove_image_fields(item)
            for key, item in value.items()
            if str(key).casefold() not in IMAGE_KEYS
        }
    if isinstance(value, list):
        return [remove_image_fields(item) for item in value]
    return value


def candidate_rows(connection: sqlite3.Connection, keys: dict[str, Any], max_candidates: int) -> tuple[list[dict[str, Any]], bool]:
    rows = connection.execute(
        """SELECT source_path, language, card_name, set_id, local_id, set_name,
                  series_name, release_date
           FROM card_locales
           WHERE language = ?""",
        (keys["language"],),
    ).fetchall()
    query_name = normalize_text(keys["name"])
    query_id = normalize_local_id(keys["local_id"])
    query_set_id = normalize_text(keys.get("set_id"))
    query_set_name = normalize_text(keys.get("set_name"))

    scored: list[tuple[int, float, dict[str, Any]]] = []
    for row in rows:
        item = dict(row)
        name_ratio = difflib.SequenceMatcher(None, query_name, normalize_text(item["card_name"])).ratio()
        id_match = normalize_local_id(item["local_id"]) == query_id
        name_match = name_ratio >= 0.95
        set_id_match = bool(query_set_id and normalize_text(item["set_id"]) == query_set_id)
        set_name_match = bool(query_set_name and normalize_text(item["set_name"]) == query_set_name)
        if id_match or name_match or (name_ratio >= 0.78 and (set_id_match or set_name_match)):
            priority = (8 if name_match and id_match else 0) + (4 if id_match else 0) + (3 if name_match else 0)
            priority += 2 if set_id_match or set_name_match else 0
            scored.append((priority, name_ratio, item))

    scored.sort(key=lambda entry: (-entry[0], -entry[1], entry[2]["set_id"], entry[2]["local_id"]))
    truncated = len(scored) > max_candidates
    selected = [entry[2] for entry in scored[:max_candidates]]
    return selected, truncated


def load_candidate_records(
    connection: sqlite3.Connection,
    locale_candidates: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not locale_candidates:
        return []
    source_paths = list(dict.fromkeys(item["source_path"] for item in locale_candidates))
    placeholders = ",".join("?" for _ in source_paths)
    query = f"""SELECT c.source_path, c.api_id, c.source_scope, c.set_path, c.set_id,
                       c.local_id, c.category, c.rarity, c.illustrator, c.raw_json AS card_raw,
                       l.language, l.card_name, l.set_name, l.series_name, l.release_date,
                       s.source_path AS set_source_path, s.series_path, s.raw_json AS set_raw,
                       sr.series_id, sr.source_path AS series_source_path,
                       sr.raw_json AS series_raw
                FROM cards c
                JOIN card_locales l USING (source_path)
                LEFT JOIN sets s ON s.source_path = c.set_path
                LEFT JOIN series sr ON sr.source_path = s.series_path
                WHERE c.source_path IN ({placeholders}) AND l.language = ?"""
    try:
        rows = connection.execute(query, (*source_paths, locale_candidates[0]["language"])).fetchall()
    except sqlite3.Error as exc:
        raise CatalogProblem(f"Catalog lookup query failed: {exc}") from exc

    records: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item["card_raw"] = json_object(item["card_raw"], f"{item['source_path']} raw card data")
        item["set_raw"] = json_object(item["set_raw"], f"{item['set_id']} raw set data")
        item["series_raw"] = json_object(item["series_raw"], f"{item['series_id']} raw series data")
        item["api_id"] = item["api_id"] or f"{item['set_id']}-{item['local_id']}"
        records.append(item)
    return records


def localized(value: Any, language: str) -> Any:
    if isinstance(value, dict):
        return value.get(language) or value.get("en") or next(iter(value.values()), None)
    return value


def localized_label_value(value: Any, language: str) -> Any:
    """Use a label value only when it matches the scan language or English."""
    if isinstance(value, dict):
        return value.get(language) or value.get("en")
    return value


def release_year(value: Any, language: str) -> str:
    """Extract a year from a scalar date or unanimous localized date values."""
    def year_from_scalar(item: Any) -> str | None:
        if item is None:
            return None
        match = re.match(r"^\s*(\d{4})(?:[-/]\d{1,2}[-/]\d{1,2})?\s*$", str(item))
        return match.group(1) if match else None

    if isinstance(value, dict):
        preferred = year_from_scalar(value.get(language) or value.get("en"))
        if preferred:
            return preferred
        years = {year for item in value.values() if (year := year_from_scalar(item))}
        return next(iter(years)) if len(years) == 1 else ""
    return year_from_scalar(value) or ""


def scalar_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (int, float)):
        return str(value).rstrip("0").rstrip(".") if isinstance(value, float) else str(value)
    return str(value).strip()


def compare_text(observed: Any, actual: Any) -> float:
    left = normalize_text(observed)
    right = normalize_text(actual)
    if not left or not right:
        return 0.0
    return difflib.SequenceMatcher(None, left, right).ratio()


def attacks_from_card(raw: dict[str, Any], language: str) -> list[dict[str, Any]]:
    output = []
    for attack in raw.get("attacks", []) or []:
        if not isinstance(attack, dict):
            continue
        output.append({
            "name": localized(attack.get("name"), language),
            "damage": attack.get("damage"),
            "cost": attack.get("cost"),
        })
    return output


def ability_names_from_card(raw: dict[str, Any], language: str) -> list[str]:
    result = []
    for ability in raw.get("abilities", []) or []:
        if isinstance(ability, dict):
            name = localized(ability.get("name"), language)
            if name:
                result.append(str(name))
    return result


def compare_attack_lists(observed: list[Any], actual: list[dict[str, Any]]) -> float:
    if not observed or not actual:
        return 0.0
    ratios: list[float] = []
    for item in observed:
        item = {"name": item} if isinstance(item, str) else item
        if not isinstance(item, dict) or not item.get("name"):
            continue
        name = normalize_text(item.get("name"))
        wanted_damage = item.get("damage")
        best = 0.0
        for attack in actual:
            actual_name = normalize_text(attack.get("name"))
            name_score = difflib.SequenceMatcher(None, name, actual_name).ratio()
            if name_score < 0.75:
                continue
            damage_score = 1.0
            if wanted_damage not in (None, "") and attack.get("damage") not in (None, ""):
                damage_score = 1.0 if normalize_text(wanted_damage) == normalize_text(attack["damage"]) else 0.0
            best = max(best, name_score * damage_score)
        ratios.append(best)
    return sum(ratios) / len(ratios) if ratios else 0.0


def compare_string_lists(observed: list[Any], actual: list[Any]) -> float:
    wanted = [normalize_text(value) for value in observed if normalize_text(value)]
    have = [normalize_text(value) for value in actual if normalize_text(value)]
    if not wanted or not have:
        return 0.0
    return sum(1.0 if value in have else max((difflib.SequenceMatcher(None, value, other).ratio() for other in have), default=0.0) for value in wanted) / len(wanted)


def compare_weakness_lists(observed: list[Any], actual: list[Any]) -> float:
    def normalized(item: Any) -> tuple[str, str]:
        if isinstance(item, dict):
            value = str(item.get("value", "")).replace("×", "x")
            return normalize_text(item.get("type", "")), normalize_text(value)
        return normalize_text(item), ""

    wanted = [normalized(item) for item in observed]
    have = [normalized(item) for item in actual]
    if not wanted or not have:
        return 0.0
    matches = 0
    for type_name, value in wanted:
        if any(
            type_name == actual_type
            and (not value or not actual_value or value == actual_value)
            for actual_type, actual_value in have
        ):
            matches += 1
    return matches / len(wanted)


def evaluate_candidate(
    candidate: dict[str, Any],
    keys: dict[str, Any],
    confidence: dict[str, Any],
) -> dict[str, Any]:
    raw = candidate["card_raw"]
    language = keys["language"]
    actual_name = candidate["card_name"]
    actual_id = candidate["local_id"]
    set_raw = candidate["set_raw"]
    count = (set_raw.get("cardCount") or {}).get("official")

    metrics: dict[str, Any] = {
        "matches": [],
        "partial_matches": [],
        "conflicts": [],
        "unknown": [],
        "score": 0,
        "coverage": 0,
    }
    score_points = 0.0
    available_weight = 0.0
    observed_weight = 0.0

    def compare_field(
        field: str,
        observed: Any,
        actual: Any,
        weight: float,
        comparator: Any = None,
        exact_threshold: float = 0.95,
    ) -> float | None:
        nonlocal score_points, available_weight, observed_weight
        if observed in (None, "", []):
            return None
        observed_weight += weight
        if actual in (None, "", []):
            metrics["unknown"].append(field)
            return None
        available_weight += weight
        ratio = comparator(observed, actual) if comparator else compare_text(observed, actual)
        conf = confidence_for(confidence, field)
        score_points += weight * ratio * conf
        if ratio >= exact_threshold:
            metrics["matches"].append(field)
        elif ratio >= 0.75:
            metrics["partial_matches"].append(field)
        elif conf >= 0.80:
            metrics["conflicts"].append({
                "field": field,
                "observed": observed,
                "catalog": actual,
                "confidence": round(conf, 3),
            })
        return ratio

    name_ratio = compare_field("name", keys["name"], actual_name, CORE_NAME_WEIGHT)
    number_ratio = compare_field(
        "collector_number",
        keys["local_id"],
        actual_id,
        CORE_NUMBER_WEIGHT,
        comparator=lambda observed, actual: 1.0 if normalize_local_id(observed) == normalize_local_id(actual) else 0.0,
    )
    compare_field("language", language, candidate["language"], LANGUAGE_WEIGHT)

    if keys.get("set_id"):
        compare_field(
            "set_id",
            keys["set_id"],
            candidate["set_id"],
            SET_ID_WEIGHT,
            comparator=lambda observed, actual: 1.0 if normalize_text(observed) == normalize_text(actual) else 0.0,
        )
    if keys.get("set_name"):
        compare_field("set_name", keys["set_name"], candidate["set_name"], SET_NAME_WEIGHT)
    if (
        keys.get("denominator")
        and str(keys["denominator"]).isdigit()
        and str(count).isdigit()
    ):
        compare_field(
            "denominator",
            keys["denominator"],
            count,
            DENOMINATOR_WEIGHT,
            comparator=lambda observed, actual: 1.0 if int(observed) == int(actual) else 0.0,
        )

    actual_hp = raw.get("hp")
    actual_types = raw.get("types") or []
    actual_stage = raw.get("stage")
    actual_illustrator = candidate.get("illustrator") or raw.get("illustrator")
    actual_evolves_from = localized(raw.get("evolveFrom"), language)
    actual_abilities = ability_names_from_card(raw, language)
    actual_attacks = attacks_from_card(raw, language)

    for field, actual in (
        ("hp", actual_hp),
        ("illustrator", actual_illustrator),
        ("stage", actual_stage),
        ("evolves_from", actual_evolves_from),
        ("retreat", raw.get("retreat")),
    ):
        compare_field(
            field,
            keys.get(field),
            actual,
            SECONDARY_WEIGHTS[field],
            comparator=lambda observed, value: 1.0 if normalize_text(observed) == normalize_text(value) else 0.0,
        )
    if keys.get("types"):
        compare_field(
            "types",
            list_of_strings(keys["types"]),
            actual_types,
            SECONDARY_WEIGHTS["types"],
            comparator=compare_string_lists,
        )
    if keys.get("ability_names"):
        compare_field(
            "ability_names",
            list_of_strings(keys["ability_names"]),
            actual_abilities,
            SECONDARY_WEIGHTS["ability_names"],
            comparator=compare_string_lists,
        )
    if keys.get("attacks"):
        compare_field(
            "attacks",
            keys["attacks"],
            actual_attacks,
            SECONDARY_WEIGHTS["attacks"],
            comparator=compare_attack_lists,
        )
    if keys.get("weaknesses"):
        observed_weaknesses = keys["weaknesses"]
        actual_weaknesses = raw.get("weaknesses") or []
        if isinstance(observed_weaknesses, (str, dict)):
            observed_weaknesses = [observed_weaknesses]
        compare_field(
            "weaknesses",
            observed_weaknesses,
            actual_weaknesses,
            SECONDARY_WEIGHTS["weaknesses"],
            comparator=compare_weakness_lists,
        )
    if keys.get("resistances"):
        observed_resistances = keys["resistances"]
        actual_resistances = raw.get("resistances") or []
        if isinstance(observed_resistances, (str, dict)):
            observed_resistances = [observed_resistances]
        compare_field(
            "resistances",
            observed_resistances,
            actual_resistances,
            SECONDARY_WEIGHTS["resistances"],
            comparator=compare_weakness_lists,
        )

    metrics["score"] = round(100 * score_points / available_weight) if available_weight else 0
    metrics["coverage"] = round(100 * available_weight / observed_weight) if observed_weight else 0
    metrics["core_name_exact"] = bool(name_ratio is not None and name_ratio >= 0.95)
    metrics["core_number_exact"] = bool(number_ratio is not None and number_ratio >= 0.95)
    metrics["hard_conflicts"] = [
        conflict for conflict in metrics["conflicts"]
        if conflict["confidence"] >= 0.80
    ]
    supporting_fields = {"hp", "illustrator", "types", "stage", "evolves_from", "ability_names", "attacks", "weaknesses", "resistances", "retreat"}
    metrics["secondary_matches"] = [
        field for field in metrics["matches"]
        if field in supporting_fields and confidence_for(confidence, field) >= 0.75
    ]
    metrics["set_matches"] = [
        field for field in ("set_id", "set_name")
        if field in metrics["matches"]
    ]

    return {
        **candidate,
        "match": metrics,
        "summary": {
            "api_id": candidate["api_id"],
            "name": candidate["card_name"],
            "language": candidate["language"],
            "set_id": candidate["set_id"],
            "set_name": candidate["set_name"],
            "local_id": candidate["local_id"],
            "series_id": candidate["series_id"],
            "series_name": candidate["series_name"],
            "release_date": candidate["release_date"],
            "rarity": candidate["rarity"] or raw.get("rarity"),
            "illustrator": actual_illustrator,
            "hp": actual_hp,
            "types": actual_types,
            "stage": actual_stage,
            "attack_names": [item.get("name") for item in actual_attacks],
            "ability_names": actual_abilities,
            "source_path": candidate["source_path"],
        },
    }


def choose_match(
    candidates: list[dict[str, Any]],
    keys: dict[str, Any],
    confidence: dict[str, Any],
    truncated: bool,
) -> tuple[str, dict[str, Any] | None, str]:
    if not candidates:
        return "no_match", None, "No catalog records matched the scan name or collector number."

    evaluated = [
        candidate if isinstance(candidate.get("match"), dict)
        else evaluate_candidate(candidate, keys, confidence)
        for candidate in candidates
    ]
    evaluated.sort(
        key=lambda item: (
            -item["match"]["score"],
            -int(item["match"]["core_name_exact"] and item["match"]["core_number_exact"]),
            -len(item["match"]["matches"]),
            len(item["match"]["hard_conflicts"]),
            item["set_id"],
            item["local_id"],
        )
    )
    exact_core = [
        item for item in evaluated
        if item["match"]["core_name_exact"] and item["match"]["core_number_exact"]
    ]
    clean_core = [item for item in exact_core if not item["match"]["hard_conflicts"]]
    if truncated:
        return "ambiguous", None, "Candidate search reached its safety cap; increase --max-candidates or provide the set."
    if not exact_core:
        if any(
            item["match"]["core_name_exact"] or item["match"]["core_number_exact"]
            for item in evaluated
        ):
            return "conflict", None, "The scan name or number matched catalog records, but the full identity did not agree."
        if any(item["match"]["partial_matches"] for item in evaluated):
            return "ambiguous", None, "Only partial name/number matches were found; no automatic label was created."
        return "no_match", None, "Candidates were found, but none matched both the scanned name and card number."
    if not clean_core:
        return "conflict", None, "Name and number matched, but one or more high-confidence scan keys conflict with catalog data."

    confident_set_keys = []
    for field in ("set_id", "set_name"):
        if keys.get(field) and confidence_for(confidence, field) >= 0.80:
            confident_set_keys.append(field)
    if confident_set_keys:
        matching_sets = [
            item for item in clean_core
            if all(field in item["match"]["set_matches"] for field in confident_set_keys)
        ]
        if len(matching_sets) == 1:
            return "matched", matching_sets[0], "Exact name, collector number, and provided set key identify one catalog record."
        if not matching_sets:
            return "conflict", None, "No exact name/number candidate agrees with the high-confidence scanned set."
        return "ambiguous", None, "More than one record agrees with the scanned set, name, and number."

    if len(clean_core) == 1 and clean_core[0]["match"]["secondary_matches"]:
        return "matched", clean_core[0], "One exact name/number record also matches independent card details."
    if len(clean_core) == 1:
        return "ambiguous", None, "One name/number candidate exists, but no independent detail confirms its printing."
    return "ambiguous", None, "Several records share the scanned name and number; provide a set or more card details."


def series_label(
    series_id: Any,
    rules: dict[str, Any],
    series_raw: dict[str, Any] | None = None,
) -> str | None:
    labels = rules.get("series_labels", {})
    if not isinstance(labels, dict):
        return None
    source_names = (series_raw or {}).get("name")
    source_name = source_names.get("en") if isinstance(source_names, dict) else source_names
    if isinstance(source_name, str) and source_name.strip():
        return source_name.strip().upper()
    if series_id is None:
        return None
    return labels.get(str(series_id).casefold())


def build_label_input(
    chosen: dict[str, Any],
    keys: dict[str, Any],
    source_urls: list[str],
    catalog_meta: dict[str, str],
    rules: dict[str, Any],
    psa_profiles: dict[str, Any],
    run_id: str,
) -> tuple[dict[str, Any] | None, list[str]]:
    blocked: list[str] = []
    set_id = str(chosen["set_id"])
    set_raw = chosen["set_raw"]
    card_raw = chosen["card_raw"]
    series_raw = chosen["series_raw"]
    language = keys["language"]
    psa_profile_id = f"{language}:{set_id}"
    psa_profile = (psa_profiles.get("profiles") or {}).get(psa_profile_id)
    if language != "en" and not psa_profile:
        blocked.append(
            f"No PSA label profile for {psa_profile_id}; add a sourced language/set entry to psa-label-profiles.json."
        )
    override = (rules.get("set_overrides") or {}).get(set_id, {})
    if not isinstance(override, dict):
        override = {}

    release_date = chosen.get("release_date") or set_raw.get("releaseDate")
    year = release_year(release_date, keys["language"])
    if psa_profile:
        year_series = psa_profile["tag_fields"]["year_series"]
    elif override.get("year_series"):
        year_series = str(override["year_series"])
    else:
        label = series_label(chosen.get("series_id"), rules, series_raw)
        if not label:
            blocked.append(
                f"No approved label-series mapping for series_id={chosen.get('series_id')!r}; add it to catalog-label-rules.json."
            )
            year_series = ""
        elif not year:
            blocked.append("Catalog record has no release year for the label header.")
            year_series = ""
        else:
            year_prefix = "" if normalize_text(label).startswith("pokemon ") else "POKÉMON "
            year_series = f"{year} {year_prefix}{label}"

    if psa_profile:
        collection = psa_profile["tag_fields"]["collection"]
    else:
        collection = str(override.get("collection") or chosen.get("set_name") or "")
    if not collection and not psa_profile:
        set_name = localized_label_value(set_raw.get("name") or {}, keys["language"])
        collection = str(set_name or "")
    if not collection and not psa_profile:
        blocked.append("Catalog record has no set name in the scanned language.")

    rarity_name = chosen.get("rarity") or card_raw.get("rarity")
    rarity_codes = rules.get("rarity_codes", {})
    rarity_code = None
    card_label_key = f"{language}:{chosen.get('api_id')}"
    card_label = (psa_profiles.get("card_labels") or {}).get(card_label_key)
    rarity_term = None
    if psa_profile and rarity_name:
        rarity_term = (psa_profile.get("rarity_terms") or {}).get(
            normalize_text(rarity_name)
        )
    if language != "en" and card_label:
        rarity_code = card_label.get("dcr_rarity_code")
    if not rarity_code and rarity_term:
        rarity_code = rarity_term.get("dcr_rarity_code")
    if rarity_name:
        localized_rarity_codes = rules.get("language_rarity_codes", {}).get(
            keys["language"], {}
        )
        if not rarity_code:
            rarity_code = localized_rarity_codes.get(normalize_text(rarity_name))
        if not rarity_code:
            rarity_code = rarity_codes.get(normalize_text(rarity_name))
    if not rarity_code:
        blocked.append(
            f"No approved tag code for catalog rarity {rarity_name!r}; add an explicit mapping instead of guessing."
        )

    local_id = str(chosen["local_id"])
    count = (set_raw.get("cardCount") or {}).get("official")
    observed_number = str(keys.get("collector_number") or "").strip()
    if "/" in observed_number:
        full_number = re.sub(r"\s+", "", observed_number).lstrip("#")
    elif observed_number:
        full_number = observed_number.lstrip("#")
        if count not in (None, "") and local_id.isdigit():
            full_number = f"{local_id}/{count}"
    elif count not in (None, "") and local_id.isdigit():
        full_number = f"{local_id}/{count}"
    else:
        full_number = local_id

    language_names = rules.get("language_names", {})
    language_name = language_names.get(keys["language"], keys["language"])
    display_name = chosen["card_name"]
    display_name_source = "canonical catalog name"
    display_name_kind = "canonical"
    localized_display_names = (rules.get("display_name_overrides") or {}).get(str(chosen["api_id"]), {})
    if isinstance(localized_display_names, dict):
        display_override = localized_display_names.get(keys["language"])
        if isinstance(display_override, str) and display_override.strip():
            display_name = display_override.strip()
            display_name_source = f"catalog-label-rules.json:display_name_overrides:{chosen['api_id']}"
            display_name_kind = "approved_alias"

    subject_evidence: list[dict[str, Any]] = []
    subject_status = None
    subject_source = None
    if language != "en":
        if card_label:
            display_name = card_label["subject"].strip()
            display_name_source = f"psa-label-profiles.json:card_labels:{card_label_key}"
            display_name_kind = "psa_subject"
            subject_status = card_label["status"]
            subject_source = "PSA card-label profile"
            subject_evidence = card_label.get("evidence", [])
        else:
            english_name = next(
                (
                    str(item.get("card_name")).strip()
                    for item in chosen.get("all_locales", [])
                    if item.get("language") == "en"
                    and isinstance(item.get("card_name"), str)
                    and item["card_name"].strip()
                ),
                None,
            )
            if not english_name:
                raw_name = card_raw.get("name")
                if isinstance(raw_name, dict):
                    raw_name = raw_name.get("en")
                if isinstance(raw_name, str) and raw_name.strip():
                    english_name = raw_name.strip()
            if english_name:
                display_name = english_name
                display_name_source = "TCGdex English card name; PSA Subject not directly sourced"
                display_name_kind = "psa_subject"
                subject_status = "draft"
                subject_source = "TCGdex English catalog name (draft PSA Subject)"
                subject_evidence = [{
                    "kind": "TCGdex English locale (draft Subject fallback)",
                    "url": f"https://api.tcgdex.net/v2/en/cards/{chosen['api_id']}",
                    "fields": ["English card name"],
                }]
            else:
                blocked.append(
                    f"No card-specific PSA Subject or English catalog card name is available for {card_label_key}."
                )
    slug_name = re.sub(r"[’']", "", keys["name"])
    slug_set = re.sub(r"[’']", "", str(chosen.get("set_name") or set_id))
    slug_source = f"{slug_name}-{slug_set}-{local_id}"
    if keys["language"] != "en":
        slug_source += f"-{keys['language']}"
    slug = re.sub(r"[^a-z0-9]+", "-", slug_source.casefold()).strip("-")[:100]
    if not slug:
        slug = re.sub(
            r"[^a-z0-9]+",
            "-",
            f"card-{chosen['api_id']}-{keys['language']}".casefold(),
        ).strip("-")
    # Keep rendered filenames short enough for Windows even when the full card name is long.
    if len(slug) > 55:
        id_slug = re.sub(r"[^a-z0-9]+", "-", str(chosen["api_id"]).casefold()).strip("-")
        language_suffix = f"-{keys['language']}" if keys["language"] != "en" else ""
        prefix_length = max(1, 55 - len(id_slug) - len(language_suffix) - 1)
        slug = f"{slug[:prefix_length].rstrip('-')}-{id_slug}{language_suffix}"

    if not chosen.get("api_id"):
        blocked.append("Catalog record does not contain a stable API card ID.")

    finish_note = keys.get("finish_note")
    if not finish_note:
        if keys.get("finish"):
            finish_note = f"Finish noted from scan as {keys['finish']!r}; it is not independently verified."
        else:
            finish_note = "Finish/print variant was not determined from the scan keys; left unverified."

    if blocked:
        return None, blocked

    commit = catalog_meta.get("source_commit", "")
    source_path = str(chosen["source_path"])
    snapshot_url = (
        f"https://github.com/tcgdex/cards-database/blob/{commit}/"
        f"{quote(source_path, safe='/')}"
        if commit else f"TCGdex local source: {source_path}"
    )
    api_url = f"https://api.tcgdex.net/v2/{keys['language']}/cards/{chosen['api_id']}"
    sources = [
        f"{api_url} (TCGdex card metadata; matched against scan keys)",
        f"{snapshot_url} (downloaded TCGdex snapshot {commit or 'version not recorded'})",
    ]
    sources.extend(source_urls)

    psa_label_profile = None
    if language != "en" and psa_profile:
        variety_value = (
            card_label.get("variety_pedigree")
            if card_label and card_label.get("variety_pedigree")
            else rarity_term.get("psa_variety_pedigree") if rarity_term else None
        )
        variety_status = (
            card_label.get("status")
            if card_label and card_label.get("variety_pedigree")
            else rarity_term.get("status") if rarity_term else "draft"
        )
        variety_evidence = (
            card_label.get("evidence", [])
            if card_label and card_label.get("variety_pedigree")
            else rarity_term.get("evidence", []) if rarity_term else []
        )
        subject_status = subject_status or "draft"
        profile_status = psa_profile["status"]
        component_statuses = {profile_status, subject_status, variety_status}
        overall_status = (
            "draft" if "draft" in component_statuses
            else "partial" if "partial" in component_statuses
            else "verified"
        )
        evidence_by_url: dict[str, dict[str, Any]] = {}
        for item in (
            psa_profile.get("evidence", [])
            + subject_evidence
            + variety_evidence
        ):
            if isinstance(item, dict) and item.get("url"):
                existing = evidence_by_url.get(item["url"])
                if existing is None:
                    evidence_by_url[item["url"]] = dict(item)
                else:
                    existing["fields"] = list(dict.fromkeys(
                        list(existing.get("fields", [])) + list(item.get("fields", []))
                    ))
                    note = str(item.get("note") or "")
                    existing_note = str(existing.get("note") or "")
                    if note and note not in existing_note:
                        existing["note"] = " ".join(
                            part for part in (existing_note, note) if part
                        )
                if item["url"] not in sources:
                    sources.append(item["url"])
        psa_label_profile = {
            "profile_id": psa_profile_id,
            "status": overall_status,
            "profile_status": profile_status,
            "brand_title": psa_profile["psa_brand_title"],
            "subject": display_name,
            "subject_status": subject_status,
            "subject_source": subject_source,
            "variety_pedigree": variety_value,
            "variety_status": variety_status,
            "dcr_rarity_code": rarity_code,
            "evidence": list(evidence_by_url.values()),
        }

    locales = []
    all_locale_rows = chosen.get("all_locales") or []
    for item in all_locale_rows:
        locales.append(item)

    card_json = {
        "schema_version": 1,
        "slug": slug,
        "name": chosen["card_name"],
        "display_name": display_name,
        "display_name_source": display_name_source,
        "display_name_kind": display_name_kind,
        "language": language_name,
        "year_series": year_series,
        "collection": collection,
        "display_number": f"#{local_id}",
        "full_number": full_number,
        "rarity": rarity_code,
        "rarity_name": str(rarity_name),
        "finish_note": finish_note,
        "sources": sources,
        "catalog_metadata": {
            "provider": catalog_meta.get("source", "TCGdex local catalog"),
            "snapshot_commit": commit,
            "imported_at_utc": catalog_meta.get("imported_at_utc"),
            "card_id": chosen["api_id"],
            "front_name_display": {
                "canonical": chosen["card_name"],
                "display": display_name,
                "abbreviated": display_name_kind == "approved_alias",
                "kind": display_name_kind,
                "rule": display_name_source,
            },
            "source_path": source_path,
            "set_id": set_id,
            "series_id": chosen.get("series_id"),
            "release_date": release_date,
            "official_set_card_count": count,
            "locales": locales,
            "raw_card_data": remove_image_fields(card_raw),
            "raw_set_data": remove_image_fields(set_raw),
            "raw_series_data": remove_image_fields(series_raw),
        },
        "match_provenance": {
            "run_id": run_id,
            "status": "matched",
            "score": chosen["match"]["score"],
            "coverage": chosen["match"]["coverage"],
            "matched_fields": chosen["match"]["matches"],
            "partial_fields": chosen["match"]["partial_matches"],
            "catalog_commit": commit,
        },
    }
    if psa_label_profile:
        card_json["psa_label_profile"] = psa_label_profile
    return card_json, []


def safe_json_write(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_name(path.name + f".{secrets.token_hex(4)}.tmp")
    temp_path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp_path, path)


def public_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    return {
        "summary": candidate["summary"],
        "match": candidate["match"],
    }


def finalize_input(
    keys: dict[str, Any],
    confidence: dict[str, Any],
    source_urls: list[str],
    scan_id: str,
    run_id: str,
    database: Path,
    rules_path: Path,
    psa_profiles_path: Path,
    report_root: Path,
    output_root: Path,
    lookup_only: bool,
    max_candidates: int,
) -> int:
    report_dir = report_root.resolve() / run_id
    report_path = report_dir / "match-report.json"
    report: dict[str, Any] = {
        "schema_version": 1,
        "run_id": run_id,
        "scan_id": scan_id or None,
        "created_at_utc": utc_now(),
        "status": "starting",
        "label_ready": False,
        "scan_keys": keys,
        "confidence": confidence,
        "source_urls": source_urls,
        "catalog_path": str(database.resolve()),
        "rules_path": str(rules_path.resolve()),
        "psa_profiles_path": str(psa_profiles_path.resolve()),
        "candidates": [],
    }

    connection: sqlite3.Connection | None = None
    try:
        rules = load_rules(rules_path)
        psa_profiles = (
            load_psa_profiles(psa_profiles_path)
            if keys["language"] != "en"
            else {"profiles": {}, "card_labels": {}}
        )
        connection, catalog_meta = open_catalog(database)
        report["catalog"] = {
            "source": catalog_meta.get("source"),
            "source_commit": catalog_meta.get("source_commit"),
            "imported_at_utc": catalog_meta.get("imported_at_utc"),
            "languages": catalog_meta.get("languages"),
        }
        locale_candidates, truncated = candidate_rows(connection, keys, max_candidates)
        candidates = load_candidate_records(connection, locale_candidates)

        # Preserve all available localized card/set names for the selected card,
        # without fetching images or opening a network connection.
        for candidate in candidates:
            candidate["all_locales"] = [
                dict(row)
                for row in connection.execute(
                    """SELECT language, card_name, set_name, series_name, release_date
                       FROM card_locales WHERE source_path = ? ORDER BY language""",
                    (candidate["source_path"],),
                ).fetchall()
            ]

        candidates = [evaluate_candidate(candidate, keys, confidence) for candidate in candidates]
        status, chosen, reason = choose_match(candidates, keys, confidence, truncated)
        report["status"] = status
        report["decision"] = reason
        report["candidate_search_truncated"] = truncated
        report["candidates"] = [public_candidate(item) for item in candidates]

        label_input: dict[str, Any] | None = None
        if chosen:
            report["selected"] = public_candidate(chosen)
            psa_profile_id = f"{keys['language']}:{chosen['set_id']}"
            if keys["language"] != "en":
                set_profile = (psa_profiles.get("profiles") or {}).get(psa_profile_id)
                card_label_key = f"{keys['language']}:{chosen.get('api_id')}"
                card_label = (psa_profiles.get("card_labels") or {}).get(card_label_key)
                report["psa_label"] = {
                    "profile_id": psa_profile_id,
                    "profile_status": set_profile.get("status") if set_profile else "missing",
                    "brand_title": set_profile.get("psa_brand_title") if set_profile else None,
                    "card_label_key": card_label_key,
                    "card_label_status": card_label.get("status") if card_label else "missing",
                    "profiles_path": str(psa_profiles_path.resolve()),
                }
            label_input, blocked = build_label_input(
                chosen, keys, source_urls, catalog_meta, rules, psa_profiles, run_id
            )
            report["label_ready"] = label_input is not None
            if blocked:
                report["label_blockers"] = blocked
            else:
                if label_input.get("psa_label_profile"):
                    report["psa_label"] = label_input["psa_label_profile"]
                report["front_card_name"] = {
                    "canonical": label_input["name"],
                    "display": label_input["display_name"],
                    "abbreviated": label_input.get("display_name_kind") == "approved_alias",
                    "kind": label_input.get("display_name_kind", "canonical"),
                    "rule": label_input["display_name_source"],
                }
                safe_json_write(report_dir / "label-input.json", label_input)
        safe_json_write(report_path, report)

        print(f"Match status: {status}")
        print(f"Reason: {reason}")
        if chosen:
            summary = chosen["summary"]
            print(
                f"Selected: {summary['name']} — {summary['set_name']} "
                f"#{summary['local_id']} ({summary['api_id']}); "
                f"match score {chosen['match']['score']}%, coverage {chosen['match']['coverage']}%"
            )
        if report.get("label_blockers"):
            for blocker in report["label_blockers"]:
                print(f"Label blocked: {blocker}")
        print(f"Lookup report: {report_path}")

        if status == "no_match":
            return EXIT_NO_MATCH
        if status in {"ambiguous", "conflict"}:
            return EXIT_REVIEW_REQUIRED
        if not chosen:
            return EXIT_NO_MATCH
        if not label_input:
            return EXIT_OK if lookup_only else EXIT_REVIEW_REQUIRED
        if lookup_only:
            print(f"Prepared label data: {report_dir / 'label-input.json'}")
            return EXIT_OK

        slug = label_input["slug"]
        output_root = output_root.resolve()
        final_output = output_root / f"{slug}-dcr-tag"
        if final_output.exists():
            report["status"] = "output_exists"
            report["label_ready"] = True
            report["output_path"] = str(final_output)
            report["decision"] = "Output folder already exists; it was not overwritten."
            safe_json_write(report_path, report)
            print(f"ERROR: Output already exists and was left untouched: {final_output}", file=sys.stderr)
            print(f"Use --lookup-only to inspect the match; report: {report_path}")
            return EXIT_OUTPUT_EXISTS

        output_root.mkdir(parents=True, exist_ok=True)
        stage_parent = output_root / ".staging"
        stage_parent.mkdir(parents=True, exist_ok=True)
        stage_run = stage_parent / run_id
        stage_run.mkdir(parents=True, exist_ok=False)
        safe_json_write(stage_run / "label-input.json", label_input)
        safe_json_write(stage_run / "match-report.json", report)
        safe_json_write(stage_run / "scan-keys.json", {
            "schema_version": 1,
            "scan_id": scan_id or None,
            "keys": keys,
            "confidence": confidence,
        })
        staged_output_root = stage_run / "rendered"
        command = [
            sys.executable,
            str(GENERATOR),
            "--card-json",
            str((stage_run / "label-input.json").resolve()),
            "--mode",
            "mockup",
            "--output-root",
            str(staged_output_root.resolve()),
        ]
        try:
            result = subprocess.run(
                command,
                cwd=str(ROOT.parent),
                capture_output=True,
                text=True,
                check=False,
            )
        except OSError as exc:
            report["status"] = "generation_failed"
            report["decision"] = str(exc)
            safe_json_write(report_path, report)
            safe_json_write(stage_run / "generation-error.json", {
                "error": str(exc),
                "command": command,
                "created_at_utc": utc_now(),
            })
            print(f"ERROR: Label generator did not complete: {exc}", file=sys.stderr)
            print(f"Staging files were preserved at {stage_run}")
            return EXIT_GENERATION_ERROR

        generation_log = (result.stdout or "") + (("\n" + result.stderr) if result.stderr else "")
        safe_json_write(stage_run / "generation-log.json", {
            "return_code": result.returncode,
            "output": generation_log,
            "created_at_utc": utc_now(),
        })
        staged_output = staged_output_root / f"{slug}-dcr-tag"
        if result.returncode != 0 or not staged_output.is_dir():
            layout_blocked = "FRONT_LAYOUT_BLOCKED:" in generation_log
            report["status"] = "layout_blocked" if layout_blocked else "generation_failed"
            report["decision"] = (
                "A front text field did not fit at the approved fixed size; no label was rendered. "
                "Staged files were preserved for review."
                if layout_blocked else
                "create_tag.py failed; staged files were preserved for diagnosis."
            )
            if layout_blocked:
                report["generation_failure_kind"] = "front_layout_preflight"
            report["staging_path"] = str(stage_run)
            safe_json_write(report_path, report)
            print(generation_log, file=sys.stderr)
            print(f"ERROR: Tag generation failed; staging files preserved at {stage_run}", file=sys.stderr)
            return EXIT_GENERATION_ERROR

        # Keep the exact keys and full matched metadata next to the generated label.
        safe_json_write(staged_output / "label-input.json", label_input)
        safe_json_write(staged_output / "match-report.json", report)
        safe_json_write(staged_output / "scan-keys.json", {
            "schema_version": 1,
            "scan_id": scan_id or None,
            "keys": keys,
            "confidence": confidence,
        })
        safe_json_write(staged_output / "generation-log.json", {
            "return_code": result.returncode,
            "output": generation_log,
            "created_at_utc": utc_now(),
        })
        if final_output.exists():
            report["status"] = "output_exists"
            report["decision"] = "Output folder appeared during generation; staged label was preserved and not moved."
            report["staging_path"] = str(stage_run)
            safe_json_write(report_path, report)
            print(f"ERROR: Output appeared during generation; nothing was overwritten: {final_output}", file=sys.stderr)
            print(f"Staging files were preserved at {stage_run}")
            return EXIT_OUTPUT_EXISTS

        try:
            staged_output.rename(final_output)
        except OSError as exc:
            report["status"] = "generation_failed"
            report["decision"] = f"Could not move completed output into place: {exc}"
            report["staging_path"] = str(stage_run)
            safe_json_write(report_path, report)
            print(f"ERROR: Could not finalize label: {exc}", file=sys.stderr)
            print(f"Completed staging files were preserved at {stage_run}")
            return EXIT_GENERATION_ERROR

        report["status"] = "created"
        report["label_ready"] = True
        report["output_path"] = str(final_output)
        report["decision"] = reason + " Label generated successfully."
        safe_json_write(report_path, report)
        safe_json_write(final_output / "match-report.json", report)
        # Remove only the files created in this run, then remove its now-empty
        # staging directories. Failed runs retain their staging data for review.
        try:
            for staged_file in (
                stage_run / "label-input.json",
                stage_run / "match-report.json",
                stage_run / "scan-keys.json",
                stage_run / "generation-log.json",
            ):
                staged_file.unlink(missing_ok=True)
            staged_output_root.rmdir()
            stage_run.rmdir()
        except OSError:
            pass
        print(generation_log)
        print(f"Label output: {final_output}")
        print(f"Lookup report: {report_path}")
        return EXIT_OK
    finally:
        if connection is not None:
            connection.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Match visible card details against the local TCGdex SQLite catalog and optionally create a DCR label."
    )
    parser.add_argument("--scan-json", required=True, type=Path, help="JSON object containing scan keys")
    parser.add_argument("--database", type=Path, default=DEFAULT_DB, help=f"Local catalog SQLite database (default: {DEFAULT_DB})")
    parser.add_argument("--rules", type=Path, default=DEFAULT_RULES, help=f"Label mapping rules (default: {DEFAULT_RULES})")
    parser.add_argument(
        "--psa-profiles",
        type=Path,
        default=DEFAULT_PSA_PROFILES,
        help=f"PSA language/set/card label profiles (default: {DEFAULT_PSA_PROFILES})",
    )
    parser.add_argument("--report-root", type=Path, default=DEFAULT_REPORT_ROOT, help=f"Lookup reports folder (default: {DEFAULT_REPORT_ROOT})")
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT, help=f"Tag output folder (default: {DEFAULT_OUTPUT_ROOT})")
    parser.add_argument("--lookup-only", action="store_true", help="Find and prepare data, but do not create a label")
    parser.add_argument("--max-candidates", type=int, default=200, help="Safety cap for candidate records (default: 200)")
    args = parser.parse_args(argv)

    if args.max_candidates < 1 or args.max_candidates > 900:
        print("ERROR: --max-candidates must be between 1 and 900", file=sys.stderr)
        return EXIT_INPUT_ERROR
    run_id = new_run_id()
    try:
        keys, confidence, source_urls, scan_id = read_scan_payload(args.scan_json)
    except InputProblem as exc:
        print(f"INPUT ERROR: {exc}", file=sys.stderr)
        try:
            report_path = args.report_root.resolve() / run_id / "match-report.json"
            safe_json_write(report_path, {
                "schema_version": 1,
                "run_id": run_id,
                "created_at_utc": utc_now(),
                "status": "input_error",
                "input_path": str(args.scan_json.resolve()),
                "error": str(exc),
                "catalog_path": str(args.database.resolve()),
                "rules_path": str(args.rules.resolve()),
                "psa_profiles_path": str(args.psa_profiles.resolve()),
            })
            print(f"Diagnostic report: {report_path}")
        except OSError as report_error:
            print(f"Could not save diagnostic report: {report_error}", file=sys.stderr)
        return EXIT_INPUT_ERROR

    try:
        return finalize_input(
            keys,
            confidence,
            source_urls,
            scan_id,
            run_id,
            args.database,
            args.rules,
            args.psa_profiles,
            args.report_root,
            args.output_root,
            args.lookup_only,
            args.max_candidates,
        )
    except CatalogProblem as exc:
        print(f"CATALOG ERROR: {exc}", file=sys.stderr)
        try:
            report_path = args.report_root.resolve() / run_id / "match-report.json"
            safe_json_write(report_path, {
                "schema_version": 1,
                "run_id": run_id,
                "created_at_utc": utc_now(),
                "status": "catalog_error",
                "error": str(exc),
                "scan_keys": keys,
                "catalog_path": str(args.database.resolve()),
                "rules_path": str(args.rules.resolve()),
                "psa_profiles_path": str(args.psa_profiles.resolve()),
            })
            print(f"Diagnostic report: {report_path}")
        except OSError as report_error:
            print(f"Could not save diagnostic report: {report_error}", file=sys.stderr)
        return EXIT_CATALOG_ERROR
    except (OSError, sqlite3.Error, ValueError, TypeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        try:
            report_path = args.report_root.resolve() / run_id / "match-report.json"
            safe_json_write(report_path, {
                "schema_version": 1,
                "run_id": run_id,
                "created_at_utc": utc_now(),
                "status": "internal_error",
                "error": str(exc),
                "scan_keys": keys,
                "catalog_path": str(args.database.resolve()),
                "rules_path": str(args.rules.resolve()),
                "psa_profiles_path": str(args.psa_profiles.resolve()),
            })
            print(f"Diagnostic report: {report_path}")
        except OSError as report_error:
            print(f"Could not save diagnostic report: {report_error}", file=sys.stderr)
        return EXIT_CATALOG_ERROR
    except Exception as exc:
        print(f"UNEXPECTED ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        try:
            report_path = args.report_root.resolve() / run_id / "match-report.json"
            safe_json_write(report_path, {
                "schema_version": 1,
                "run_id": run_id,
                "created_at_utc": utc_now(),
                "status": "internal_error",
                "error_type": type(exc).__name__,
                "error": str(exc),
                "traceback": traceback.format_exc(),
                "scan_keys": keys,
                "catalog_path": str(args.database.resolve()),
                "rules_path": str(args.rules.resolve()),
                "psa_profiles_path": str(args.psa_profiles.resolve()),
            })
            print(f"Diagnostic report: {report_path}")
        except OSError as report_error:
            print(f"Could not save diagnostic report: {report_error}", file=sys.stderr)
        return EXIT_CATALOG_ERROR


if __name__ == "__main__":
    raise SystemExit(main())
