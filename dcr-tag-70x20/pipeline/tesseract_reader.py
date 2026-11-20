#!/usr/bin/env python3
"""Produce PaddleOCR-compatible line records with Tesseract as an OCR fallback."""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import shutil
import subprocess
import sys
import time
import unicodedata
from pathlib import Path
from statistics import mean
from typing import Any

from PIL import Image, ImageEnhance, ImageOps


NUMBER_RE = re.compile(r"[0-9OQIl|]{1,4}\s*/\s*[0-9OQIl|]{1,4}", re.IGNORECASE)
LANGUAGES = "tha+eng"


def parse_tsv(output: str, image_size: tuple[int, int], title_band: bool = False) -> dict[str, list[Any]]:
    groups: dict[tuple[int, int, int, int], dict[str, Any]] = {}
    words = []
    for row in csv.DictReader(io.StringIO(output), delimiter="\t"):
        if row.get("level") != "5" or not row.get("text", "").strip():
            continue
        key = tuple(int(row[field]) for field in ("page_num", "block_num", "par_num", "line_num"))
        group = groups.setdefault(key, {"words": [], "scores": [], "boxes": []})
        text = row["text"].strip()
        group["words"].append(text)
        try:
            score = max(0.0, min(1.0, float(row["conf"]) / 100))
        except (TypeError, ValueError):
            score = 0.0
        group["scores"].append(score)
        left, top = int(row["left"]), int(row["top"])
        box = [left, top, left + int(row["width"]), top + int(row["height"])]
        group["boxes"].append(box)
        words.append({"text": text, "score": score, "box": box})

    ordered = [groups[key] for key in sorted(groups)]
    output_words = [
        (" ".join(group["words"]), round(mean(group["scores"]), 4), _union_box(group["boxes"]))
        for group in ordered
    ]
    if title_band:
        thai_words = [word for word in words if any("\u0e00" <= char <= "\u0e7f" for char in word["text"])]
        if thai_words:
            # Keep Tesseract's TSV reading order: Thai leading vowels can have
            # boxes that overlap the consonant they precede, so x-sorting can
            # swap glyphs even when the recognizer returned them correctly.
            output_words = [("".join(word["text"] for word in thai_words),
                             round(mean(word["score"] for word in thai_words), 4),
                             _union_box([word["box"] for word in thai_words]))]
        else:
            output_words.extend(_title_and_number_lines(words, image_size))
    else:
        output_words.extend(_title_and_number_lines(words, image_size))
    return {"rec_texts": [item[0] for item in output_words],
            "rec_scores": [item[1] for item in output_words],
            "rec_boxes": [item[2] for item in output_words], "rec_polys": []}


def _union_box(boxes: list[list[int]]) -> list[int]:
    return [min(box[0] for box in boxes), min(box[1] for box in boxes),
            max(box[2] for box in boxes), max(box[3] for box in boxes)]


def _title_and_number_lines(words: list[dict[str, Any]], image_size: tuple[int, int]) -> list[tuple[str, float, list[int]]]:
    width, height = image_size
    title_words = [word for word in words
                   if word["box"][1] < height * .18
                   and .22 <= (word["box"][0] + word["box"][2]) / (2 * width) <= .70
                   and any(char.isalpha() or unicodedata.category(char).startswith("M") for char in word["text"])]
    thai_words = [word for word in title_words if any("\u0e00" <= char <= "\u0e7f" for char in word["text"])]
    if thai_words:
        title = ("".join(word["text"] for word in sorted(thai_words, key=lambda item: item["box"][0])),
                 round(mean(word["score"] for word in thai_words), 4), _union_box([word["box"] for word in thai_words]))
    else:
        latin_words = [word for word in title_words if any(char.isalpha() for char in word["text"])]
        title = (" ".join(word["text"] for word in sorted(latin_words, key=lambda item: item["box"][0])),
                 round(mean(word["score"] for word in latin_words), 4), _union_box([word["box"] for word in latin_words])) if latin_words else None
    result = [title] if title else []
    result.extend((word["text"], word["score"], word["box"]) for word in words if NUMBER_RE.search(word["text"]))
    return result


def read_image(image_path: Path) -> tuple[Image.Image, int]:
    with Image.open(image_path) as source:
        orientation = source.getexif().get(274, 1)
        image = ImageOps.exif_transpose(source).convert("RGB")
    if image.width < 180 or image.height < 180:
        raise ValueError(f"Image is too small for card OCR: {image.width}x{image.height}")
    return image, orientation


def recognize(image_path: Path, page_segmentation_mode: int = 6, title_band: bool = False) -> dict[str, list[Any]]:
    executable = shutil.which("tesseract")
    if not executable:
        raise RuntimeError("Tesseract is not installed on this host.")
    command = [executable, str(image_path), "stdout", "-l", LANGUAGES,
               "--psm", str(page_segmentation_mode), "tsv"]
    result = subprocess.run(command, capture_output=True, text=True, timeout=75, check=False)
    if result.returncode:
        raise RuntimeError(f"Tesseract exited with status {result.returncode}: {result.stderr[-500:]}")
    with Image.open(image_path) as image:
        image_size = image.size
    return parse_tsv(result.stdout, image_size, title_band=title_band)


def confident_number(passes: list[dict[str, Any]]) -> bool:
    return any(score >= 0.65 and NUMBER_RE.search(text)
               for item in passes for text, score in zip(item["rec_texts"], item["rec_scores"]))


def number_crop(image: Image.Image, region: list[int], scale: int, path: Path) -> None:
    x0, y0, x1, y1 = region
    crop = image.crop((x0, y0, x1, y1))
    crop = ImageOps.autocontrast(ImageOps.grayscale(crop), cutoff=1)
    crop = ImageEnhance.Contrast(crop).enhance(1.6)
    crop = ImageEnhance.Sharpness(crop).enhance(1.8)
    crop.resize((crop.width * scale, crop.height * scale), Image.Resampling.LANCZOS).save(path)


def run(image_path: Path, output_path: Path, work_dir: Path) -> dict[str, Any]:
    started = time.perf_counter()
    if not image_path.is_file():
        raise FileNotFoundError(f"Image does not exist: {image_path}")
    work_dir.mkdir(parents=True, exist_ok=True)
    image, orientation = read_image(image_path)
    width, height = image.size
    normalized_path = image_path
    if orientation not in (None, 1):
        normalized_path = work_dir / "normalized-input.png"
        image.save(normalized_path)

    passes = [{"pass_id": "full", "region": [0, 0, width, height], "scale": 1,
               **recognize(normalized_path)}]
    crop_records = []

    # The name is a short, high-value identity field. On a full-card scan,
    # Tesseract joins the centered title to HP and stage text from either side.
    # Read the title band separately as one line and map its box back to the
    # original image so the normal parser can weigh it against full-card OCR.
    title_region = [int(width * .245), int(height * .09), int(width * .50), int(height * .17)]
    title_crop_path = work_dir / "title_band_3x.png"
    title_crop = image.crop(tuple(title_region))
    title_crop = ImageOps.autocontrast(ImageOps.grayscale(title_crop), cutoff=1)
    title_scale = 3
    title_crop.resize((title_crop.width * title_scale, title_crop.height * title_scale),
                      Image.Resampling.LANCZOS).save(title_crop_path)
    passes.append({"pass_id": "title_band_3x", "region": title_region, "scale": title_scale,
                   **recognize(title_crop_path, page_segmentation_mode=7, title_band=True)})
    crop_records.append({"path": str(title_crop_path), "region": title_region, "scale": title_scale,
                         "purpose": "card_title"})

    if not confident_number(passes):
        for pass_id, region in (("footer_left_4x", [int(width * .05), int(height * .85), int(width * .58), int(height * .99)]),
                                ("footer_right_4x", [int(width * .42), int(height * .85), int(width * .99), int(height * .99)])):
            crop_path = work_dir / f"{pass_id}.png"
            number_crop(image, region, 4, crop_path)
            passes.append({"pass_id": pass_id, "region": region, "scale": 4, **recognize(crop_path)})
            crop_records.append({"path": str(crop_path), "region": region, "scale": 4})
            if confident_number(passes):
                break

    return {"schema_version": 1, "image_path": str(image_path.resolve()), "image_size": [width, height],
            "orientation_exif": orientation, "model": "Tesseract tha+eng (CPU fallback)",
            "passes": passes, "crop_artifacts": crop_records,
            "timings": {"model_initialization_seconds": 0.0, "prediction_seconds": round(time.perf_counter() - started, 4),
                        "reader_seconds": round(time.perf_counter() - started, 4)}}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--output-json", required=True, type=Path)
    parser.add_argument("--work-dir", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = run(args.image, args.output_json, args.work_dir)
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.output_json.with_suffix(args.output_json.suffix + ".tmp")
        temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(args.output_json)
    except Exception as exc:
        print(f"Tesseract fallback failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 10
    print(f"Tesseract passes: {len(result['passes'])}; reader time: {result['timings']['reader_seconds']:.2f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
