#!/usr/bin/env python3
"""Run local PaddleOCR on a card image and retry the small collector-number area."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import Any

from PIL import Image, ImageEnhance, ImageOps
from paddleocr import PaddleOCR


NUMBER_RE = re.compile(r"[0-9OQIl|]{1,4}\s*/\s*[0-9OQIl|]{1,4}", re.IGNORECASE)


def compact_result(result: Any, pass_id: str, region: list[int], scale: int) -> dict[str, Any]:
    data = result.json if hasattr(result, "json") else result
    if isinstance(data, str):
        data = json.loads(data)
    if not isinstance(data, dict):
        data = {}
    res = data.get("res", data)
    if not isinstance(res, dict):
        res = {}
    return {
        "pass_id": pass_id,
        "region": region,
        "scale": scale,
        "rec_texts": res.get("rec_texts", []) or [],
        "rec_scores": res.get("rec_scores", []) or [],
        "rec_boxes": res.get("rec_boxes", []) or [],
        "rec_polys": res.get("rec_polys", []) or [],
    }


def has_confident_number(passes: list[dict[str, Any]], threshold: float = 0.72) -> bool:
    for item in passes:
        texts = item["rec_texts"]
        scores = item["rec_scores"]
        for index, text in enumerate(texts):
            score = float(scores[index]) if index < len(scores) else 0.0
            if score >= threshold and NUMBER_RE.search(str(text)):
                return True
    return False


def run(image_path: Path, output_path: Path, work_dir: Path) -> dict[str, Any]:
    if not image_path.is_file():
        raise FileNotFoundError(f"Image does not exist: {image_path}")

    work_dir.mkdir(parents=True, exist_ok=True)
    with Image.open(image_path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        width, height = image.size
        if width < 180 or height < 180:
            raise ValueError(f"Image is too small for card OCR: {width}x{height}")
        orientation = source.getexif().get(274, 1)
    normalized_path = image_path
    if orientation not in (None, 1):
        normalized_path = work_dir / "normalized-input.png"
        image.save(normalized_path)

    model_start = time.perf_counter()
    ocr = PaddleOCR(
        device="cpu",
        text_detection_model_name="PP-OCRv6_medium_det",
        text_recognition_model_name="PP-OCRv6_medium_rec",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )
    model_seconds = time.perf_counter() - model_start

    passes: list[dict[str, Any]] = []
    predict_seconds = 0.0
    started = time.perf_counter()
    full_results = ocr.predict(str(normalized_path))
    predict_seconds += time.perf_counter() - started
    for result in full_results:
        passes.append(compact_result(result, "full", [0, 0, width, height], 1))

    crop_records: list[dict[str, Any]] = []
    if not has_confident_number(passes):
        # Card photos used by this workflow place the collector number in the
        # lower-right footer. Upscale that strip so small print gets more pixels.
        x0, y0 = int(width * 0.60), int(height * 0.89)
        x1, y1 = max(x0 + 1, int(width * 0.99)), max(y0 + 1, int(height * 0.99))
        crop = image.crop((x0, y0, x1, y1))
        crop = ImageOps.autocontrast(ImageOps.grayscale(crop), cutoff=1)
        crop = ImageEnhance.Contrast(crop).enhance(1.6)
        crop = ImageEnhance.Sharpness(crop).enhance(1.8)
        scale = 4
        crop = crop.resize((crop.width * scale, crop.height * scale), Image.Resampling.LANCZOS)
        crop_path = work_dir / "footer-number-4x.png"
        crop.save(crop_path)
        crop_records.append({"path": str(crop_path), "region": [x0, y0, x1, y1], "scale": scale})
        started = time.perf_counter()
        crop_results = ocr.predict(str(crop_path))
        predict_seconds += time.perf_counter() - started
        for result in crop_results:
            passes.append(compact_result(result, "footer_number_4x", [x0, y0, x1, y1], scale))

    if not has_confident_number(passes):
        # A wider crop is a fallback for cards with extra margins or unusually
        # small number text. It runs only when the first retry still found no
        # plausible card-number pattern.
        x0, y0 = int(width * 0.22), int(height * 0.89)
        x1, y1 = max(x0 + 1, int(width * 0.99)), max(y0 + 1, int(height * 0.995))
        crop = image.crop((x0, y0, x1, y1))
        crop = ImageOps.autocontrast(ImageOps.grayscale(crop), cutoff=1)
        crop = ImageEnhance.Contrast(crop).enhance(1.6)
        scale = 3
        crop = crop.resize((crop.width * scale, crop.height * scale), Image.Resampling.LANCZOS)
        crop_path = work_dir / "footer-wide-3x.png"
        crop.save(crop_path)
        crop_records.append({"path": str(crop_path), "region": [x0, y0, x1, y1], "scale": scale})
        started = time.perf_counter()
        crop_results = ocr.predict(str(crop_path))
        predict_seconds += time.perf_counter() - started
        for result in crop_results:
            passes.append(compact_result(result, "footer_wide_3x", [x0, y0, x1, y1], scale))

    return {
        "schema_version": 1,
        "image_path": str(image_path.resolve()),
        "image_size": [width, height],
        "orientation_exif": orientation,
        "model": "PaddleOCR PP-OCRv6_medium_det + PP-OCRv6_medium_rec (CPU)",
        "passes": passes,
        "crop_artifacts": crop_records,
        "timings": {
            "model_initialization_seconds": round(model_seconds, 4),
            "prediction_seconds": round(predict_seconds, 4),
            "reader_seconds": round(time.perf_counter() - model_start, 4),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--output-json", required=True, type=Path)
    parser.add_argument("--work-dir", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = run(args.image, args.output_json, args.work_dir)
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        args.output_json.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as exc:
        print(f"PaddleOCR failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 10
    print(f"PaddleOCR passes: {len(result['passes'])}; reader time: {result['timings']['reader_seconds']:.2f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
