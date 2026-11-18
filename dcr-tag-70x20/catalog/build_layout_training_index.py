#!/usr/bin/env python3
"""Build a local, catalog-grounded index for layout annotation and later training.

This indexes existing reference images and exact catalog text. It does not run
OCR, call a network service, or claim any pixel/box annotation is complete.
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any


CARD_ROOT = Path(__file__).resolve().parents[1]
REFERENCE_ROOT = CARD_ROOT / "catalog" / "layout-references"
DEFAULT_MANIFEST = REFERENCE_ROOT / "manifest.json"
DEFAULT_DATABASE = CARD_ROOT / "catalog" / "cards.sqlite"
DEFAULT_OUTPUT = REFERENCE_ROOT / "layout-training-index.json"


def localize(value: Any, language: str) -> Any:
    if isinstance(value, dict):
        return value.get(language) or value.get("en")
    return value


def relative_path(value: str | None) -> dict[str, Any] | None:
    if not value:
        return None
    path = Path(value)
    if not path.is_absolute():
        path = (Path.cwd() / path).resolve()
    try:
        stored_path = path.relative_to(CARD_ROOT).as_posix()
    except ValueError:
        stored_path = path.as_posix()
    return {
        "path": stored_path,
        "available": path.is_file(),
        "bytes": path.stat().st_size if path.is_file() else None,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None,
    }


def project_relative(path: Path) -> str:
    resolved = path.resolve()
    try:
        return resolved.relative_to(CARD_ROOT).as_posix()
    except ValueError:
        return resolved.as_posix()


def get_card_truth(
    connection: sqlite3.Connection,
    api_id: str | None,
    language: str,
    set_id: str,
    local_id: str,
) -> dict[str, Any] | None:
    row = None
    if api_id:
        row = connection.execute(
            """SELECT l.*, c.api_id, c.category, c.rarity, c.illustrator,
                      c.raw_json AS card_raw
               FROM cards c JOIN card_locales l USING(source_path)
               WHERE c.api_id = ? AND l.language = ? LIMIT 1""",
            (api_id, language),
        ).fetchone()
    if row is None:
        row = connection.execute(
            """SELECT l.*, c.api_id, c.category, c.rarity, c.illustrator,
                      c.raw_json AS card_raw
               FROM card_locales l JOIN cards c USING(source_path)
               WHERE l.language = ? AND l.set_id = ? AND l.local_id = ? LIMIT 1""",
            (language, set_id, local_id),
        ).fetchone()
    if row is None:
        return None

    try:
        raw = json.loads(row["card_raw"] or "{}")
    except json.JSONDecodeError:
        raw = {}

    attacks = []
    for item in raw.get("attacks") or []:
        if not isinstance(item, dict):
            continue
        attacks.append({
            "name": localize(item.get("name"), language),
            "cost": item.get("cost") or [],
            "damage": item.get("damage"),
            "effect": localize(item.get("effect"), language),
        })

    abilities = []
    for item in raw.get("abilities") or []:
        if not isinstance(item, dict):
            continue
        abilities.append({
            "name": localize(item.get("name"), language),
            "type": localize(item.get("type"), language),
            "effect": localize(item.get("effect"), language),
        })

    return {
        "source": "local catalog cards.raw_json + card_locales",
        "source_path": row["source_path"],
        "api_id": row["api_id"],
        "language": row["language"],
        "name": row["card_name"],
        "collector_number": row["local_id"],
        "set_id": row["set_id"],
        "set_name": row["set_name"],
        "series_name": row["series_name"],
        "release_date": row["release_date"],
        "category": row["category"],
        "rarity": row["rarity"],
        "illustrator": row["illustrator"],
        "hp": raw.get("hp"),
        "stage": raw.get("stage"),
        "types": raw.get("types") or [],
        "attacks": attacks,
        "abilities": abilities,
        "weaknesses": raw.get("weaknesses") or [],
        "resistances": raw.get("resistances") or [],
        "retreat": raw.get("retreat"),
        "description": localize(raw.get("description"), language),
        "trainer_type": raw.get("trainerType") or raw.get("trainer_type"),
        "regulation_mark": raw.get("regulationMark"),
    }


def build(manifest_path: Path, database_path: Path, output_path: Path) -> dict[str, Any]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    connection = sqlite3.connect(f"file:{database_path.resolve().as_posix()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    records = []
    summary_by_language: dict[str, dict[str, int]] = collections.defaultdict(
        lambda: {"samples": 0, "images_available": 0, "images_missing": 0}
    )
    summary_by_category: collections.Counter[str] = collections.Counter()
    unresolved_truth = []

    for sample in manifest.get("samples", []):
        image_id = sample.get("selected_api_id") or sample.get("api_id")
        truth = get_card_truth(
            connection,
            image_id,
            sample["language"],
            sample["set_id"],
            str(sample.get("selected_local_id") or sample.get("local_id") or ""),
        )
        if truth is None:
            unresolved_truth.append(sample.get("sample_key"))

        image = sample.get("card_image") or {}
        image_ref = relative_path(image.get("path"))
        image_available = bool(image_ref and image_ref["available"])
        stats = summary_by_language[sample["language"]]
        stats["samples"] += 1
        stats["images_available" if image_available else "images_missing"] += 1
        summary_by_category[str((truth or {}).get("category") or sample.get("category") or "unknown")] += 1

        assets = {}
        for asset_name, asset in (sample.get("set_assets") or {}).items():
            assets[asset_name] = {
                "source_url": asset.get("source_url"),
                "status": asset.get("status"),
                "file": relative_path(asset.get("path")),
            }

        records.append({
            "sample_key": sample.get("sample_key"),
            "selection": {
                "roles": sample.get("roles") or [],
                "source": sample.get("selection_source"),
                "requested_api_id": sample.get("api_id"),
                "image_api_id": image_id,
                "fallback_candidates": sample.get("fallback_api_candidates") or [],
            },
            "grouping": {
                "language": sample["language"],
                "set_id": sample["set_id"],
                "series_id": sample.get("series_id"),
                "series_name": sample.get("series_name"),
                "category": (truth or {}).get("category") or sample.get("category"),
                "recommended_split_group": f"{sample['language']}:{sample.get('series_id') or sample.get('series_name') or 'unknown'}",
                "split": None,
            },
            "image": {
                "status": "available" if image_available else "missing",
                "file": image_ref,
                "source_url": image.get("url") or sample.get("image_base_url"),
                "bytes": image.get("bytes"),
            },
            "set_assets": assets,
            "catalog_truth": truth,
            "layout_annotation": {
                "status": "not_annotated" if image_available else "blocked_missing_image",
                "layout_family_id": None,
                "card_variant": None,
                "regions": [],
                "text_lines": [],
                "review_notes": [],
            },
        })
    connection.close()

    challenge_cases = []
    for case_path in sorted((REFERENCE_ROOT / "failure-cases").glob("*.json")):
        case = json.loads(case_path.read_text(encoding="utf-8"))
        challenge_cases.append({
            "case_id": case.get("case_id"),
            "file": project_relative(case_path),
            "case_type": case.get("case_type"),
            "annotation_status": case.get("annotation_status"),
            "card_api_id": (case.get("catalog_truth") or {}).get("api_id"),
            "language": (case.get("catalog_truth") or {}).get("language"),
            "failure_tags": case.get("failure_tags") or [],
            "pipeline_status": (case.get("pipeline_result") or {}).get("status"),
            "label_generated": (case.get("pipeline_result") or {}).get("label_generated"),
            "replay_results": case.get("replay_results") or [],
        })

    result = {
        "schema_version": 1,
        "dataset_kind": "reference_index_for_layout_annotation",
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "source_manifest": project_relative(manifest_path),
        "source_catalog": project_relative(database_path),
        "important": "Catalog text is lexical ground truth only. Layout regions and line roles remain unannotated unless a record says otherwise.",
        "annotation_conventions": {
            "bbox": "normalized [x0,y0,x1,y1] in the original image coordinate space, each coordinate from 0 to 1",
            "required_roles": [
                "stage", "name", "hp", "type", "artwork", "ability_name", "ability_effect",
                "attack_cost", "attack_name", "attack_damage", "attack_effect",
                "trainer_rule_text", "energy_rule_text", "weakness", "resistance", "retreat",
                "flavor_text", "collector_number", "set_symbol", "illustrator", "copyright",
            ],
            "line_role_fields": ["raw_ocr_text", "corrected_text", "role", "bbox", "ocr_confidence", "role_confidence", "reviewer", "review_status"],
            "holdout_rule": "Split by set/layout family, not random card rows, to measure generalization to unseen collections.",
        },
        "summary": {
            "samples": len(records),
            "images_available": sum(record["image"]["status"] == "available" for record in records),
            "images_missing": sum(record["image"]["status"] != "available" for record in records),
            "challenge_cases": len(challenge_cases),
            "unresolved_catalog_truth": unresolved_truth,
            "by_language": dict(sorted(summary_by_language.items())),
            "by_category": dict(sorted(summary_by_category.items())),
        },
        "challenge_cases": challenge_cases,
        "samples": records,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    result = build(args.manifest, args.database, args.output)
    print(json.dumps(result["summary"], ensure_ascii=False, indent=2))
    print(f"index: {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
