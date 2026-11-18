#!/usr/bin/env python3
"""Select a small, diverse image set for parser/layout review.

The output reuses local card images and catalog truth. It does not run OCR or
claim that unreviewed image boxes/roles are training annotations.
"""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import hashlib
import json
from pathlib import Path
from typing import Any


CARD_ROOT = Path(__file__).resolve().parents[1]
REFERENCE_ROOT = CARD_ROOT / "catalog" / "layout-references"
DEFAULT_INDEX = REFERENCE_ROOT / "layout-training-index.json"
DEFAULT_OUTPUT = REFERENCE_ROOT / "parser-sample-set.json"
FAILURE_CASE = REFERENCE_ROOT / "failure-cases" / "wurmple-xy6-3-20261020.json"

SPECS: tuple[dict[str, Any], ...] = (
    {"api_id": "xy10-1", "case_id": "shuckle-xy10-1", "planned_use": "holdout_candidate", "focus": ["no_damage_attack", "multi_line_effect", "flavor_text", "regular_xy"]},
    {"api_id": "xy5-1", "case_id": "weedle-xy5-1", "planned_use": "annotation_candidate", "focus": ["search_effect", "no_damage_attack", "regular_xy"]},
    {"api_id": "xy2-1", "case_id": "caterpie-xy2-1", "planned_use": "annotation_candidate", "focus": ["ability_and_attack", "regular_xy"]},
    {"api_id": "xy1-1", "case_id": "venusaur-ex-xy1-1", "planned_use": "annotation_candidate", "focus": ["special_pokemon_variant", "multi_attack", "rule_text"]},
    {"api_id": "bw10-78", "case_id": "caitlin-bw10-78", "planned_use": "annotation_candidate", "focus": ["trainer_supporter", "long_rule_text", "older_layout"]},
    {"api_id": "bw10-91", "case_id": "plasma-energy-bw10-91", "planned_use": "annotation_candidate", "focus": ["special_energy", "energy_rule_text", "older_layout"]},
    {"api_id": "base5-17", "case_id": "rainbow-energy-base5-17", "planned_use": "annotation_candidate", "focus": ["special_energy", "early_layout"]},
    {"api_id": "ecard3-119", "case_id": "ancient-ruins-ecard3-119", "planned_use": "annotation_candidate", "focus": ["trainer_stadium", "ecard_layout"]},
    {"api_id": "swsh10-001", "case_id": "beedrill-v-swsh10-001", "planned_use": "annotation_candidate", "focus": ["special_pokemon_variant", "effect_lines", "swsh_layout"]},
    {"api_id": "swsh5-140", "case_id": "rapid-strike-energy-swsh5-140", "planned_use": "annotation_candidate", "focus": ["special_energy", "energy_rule_text", "swsh_layout"]},
    {"api_id": "sv08-004", "case_id": "durant-ex-sv08-004", "planned_use": "annotation_candidate", "focus": ["special_pokemon_variant", "ability_and_attack", "sv_layout"]},
    {"api_id": "sv06.5-054", "case_id": "academy-at-night-sv06.5-054", "planned_use": "annotation_candidate", "focus": ["trainer_stadium", "sv_layout"]},
    {"language": "ja", "api_id": "SV10-001", "case_id": "ja-sv10-001", "planned_use": "annotation_candidate", "focus": ["japanese_script", "pokemon_layout", "modern_sv"]},
    {"language": "ja", "api_id": "SV7a-053", "case_id": "ja-sv7a-053", "planned_use": "annotation_candidate", "focus": ["japanese_script", "trainer_layout", "modern_sv"]},
    {"language": "th", "api_id": "S10a-001", "case_id": "th-s10a-001", "planned_use": "annotation_candidate", "focus": ["thai_script", "pokemon_layout", "modern_s"]},
    {"language": "zh-tw", "api_id": "S7D-056", "case_id": "zh-tw-s7d-056", "planned_use": "annotation_candidate", "focus": ["traditional_chinese_script", "trainer_layout", "modern_s"]},
    {"language": "zh-tw", "api_id": "SVAL-011", "case_id": "zh-tw-sval-011", "planned_use": "annotation_candidate", "focus": ["traditional_chinese_script", "energy_layout", "modern_sv"]},
)


def write_sample_set(index_path: Path, output_path: Path) -> dict[str, Any]:
    index = json.loads(index_path.read_text(encoding="utf-8"))
    by_identity = {
        (
            str((sample.get("catalog_truth") or {}).get("language")),
            str((sample.get("catalog_truth") or {}).get("api_id")),
        ): sample
        for sample in index.get("samples", [])
        if (sample.get("catalog_truth") or {}).get("api_id")
    }
    cases: list[dict[str, Any]] = []

    failure_case = json.loads(FAILURE_CASE.read_text(encoding="utf-8"))
    failure_image = REFERENCE_ROOT / "failure-cases" / failure_case["source_image"]
    failure_exists = failure_image.is_file()
    failure_hash = hashlib.sha256(failure_image.read_bytes()).hexdigest() if failure_exists else None
    cases.append({
        "case_id": failure_case["case_id"],
        "planned_use": "regression_case_after_parser_fix",
        "focus": failure_case.get("failure_tags", []),
        "selection_source": "user-provided image and saved pipeline run",
        "image": {
            "path": failure_image.relative_to(CARD_ROOT).as_posix(),
            "sha256": failure_hash,
            "expected_sha256": failure_case.get("source_image_sha256"),
            "checksum_matches": bool(failure_exists and failure_hash == failure_case.get("source_image_sha256")),
            "status": (
                "available" if failure_exists and failure_hash == failure_case.get("source_image_sha256")
                else "missing" if not failure_exists
                else "checksum_mismatch"
            ),
        },
        "catalog_truth": failure_case.get("catalog_truth"),
        "annotation_status": failure_case.get("annotation_status", "not_annotated"),
        "draft_line_annotations": failure_case.get("draft_line_annotations", []),
        "initial_pipeline_result": failure_case.get("pipeline_result"),
        "replay_results": failure_case.get("replay_results", []),
        "scan_artifacts": failure_case.get("scan_artifacts", {}),
        "source_case": FAILURE_CASE.relative_to(CARD_ROOT).as_posix(),
    })

    missing: list[str] = []
    image_gaps: list[str] = []
    for spec in SPECS:
        language = str(spec.get("language") or "en")
        sample = by_identity.get((language, spec["api_id"]))
        if sample is None:
            missing.append(f"{language}:{spec['api_id']}")
            continue
        image = sample.get("image") or {}
        image_file = image.get("file") or {}
        image_path = CARD_ROOT / str(image_file.get("path") or "")
        image_exists = bool(image_file.get("path") and image_path.is_file())
        actual_sha256 = hashlib.sha256(image_path.read_bytes()).hexdigest() if image_exists else None
        expected_sha256 = image_file.get("sha256")
        checksum_matches = bool(image_exists and expected_sha256 and actual_sha256 == expected_sha256)
        image_status = "available" if checksum_matches else "missing" if not image_exists else "checksum_mismatch"
        if image_status != "available":
            image_gaps.append(f"{language}:{spec['api_id']}")
        cases.append({
            "case_id": spec["case_id"],
            "planned_use": spec["planned_use"],
            "focus": list(spec["focus"]),
            "selection_source": "local TCGdex image reference index",
            "image": {
                "path": image_file.get("path"),
                "sha256": actual_sha256,
                "expected_sha256": expected_sha256,
                "checksum_matches": checksum_matches,
                "source_url": image.get("source_url"),
                "status": image_status,
            },
            "catalog_truth": sample.get("catalog_truth"),
            "annotation_status": (sample.get("layout_annotation") or {}).get("status", "not_annotated"),
            "source_sample_key": sample.get("sample_key"),
        })

    counts = collections.Counter(
        str((case.get("catalog_truth") or {}).get("category") or "unknown") for case in cases
    )
    language_counts = collections.Counter(
        str((case.get("catalog_truth") or {}).get("language") or "unknown") for case in cases
    )
    result = {
        "schema_version": 1,
        "dataset_kind": "curated_parser_and_layout_review_samples",
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "source_index": index_path.relative_to(CARD_ROOT).as_posix(),
        "important": "Catalog text is reference truth; image line roles and boxes remain unreviewed unless explicitly annotated. This file is not a supervised training set.",
        "selection_gaps": missing,
        "image_gaps": image_gaps,
        "summary": {
            "cases": len(cases),
            "images_available": sum((case.get("image") or {}).get("status") == "available" for case in cases),
            "by_category": dict(sorted(counts.items())),
            "by_language": dict(sorted(language_counts.items())),
        },
        "cases": cases,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--index", type=Path, default=DEFAULT_INDEX)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    result = write_sample_set(args.index, args.output)
    print(f"Selected {result['summary']['cases']} parser/layout cases")
    print(f"Available images: {result['summary']['images_available']}")
    if result["selection_gaps"]:
        print(f"Missing sample IDs: {', '.join(result['selection_gaps'])}")
    print(f"Output: {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
