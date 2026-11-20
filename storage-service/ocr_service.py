#!/usr/bin/env python3
"""Private HTTP adapter for the existing OCR-first card identification pipeline."""

from __future__ import annotations

import hmac
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from ocr_service_matching import ServiceError, exact_candidates, run_lookup


TOOLKIT_ROOT = Path(os.environ.get("DCR_TOOLKIT_ROOT", "/opt/dcr-vault-ocr/dcr-tag-70x20")).resolve()
PIPELINE = TOOLKIT_ROOT / "pipeline" / "image_to_label.py"
MATCHER = TOOLKIT_ROOT / "lookup_card.py"
HOST = os.environ.get("DCR_OCR_BIND_HOST", "127.0.0.1")
PORT = int(os.environ.get("DCR_OCR_PORT", "8790"))
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_JSON_BYTES = 128 * 1024
IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
REQUEST_LOCK = threading.BoundedSemaphore(1)


def send_json(handler: BaseHTTPRequestHandler, status: int, body: dict[str, Any]) -> None:
    payload = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(payload)))
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.end_headers()
    handler.wfile.write(payload)


def require_token(handler: BaseHTTPRequestHandler) -> None:
    expected = os.environ.get("DCR_OCR_TOKEN", "")
    supplied = handler.headers.get("X-DCR-OCR-Token", "")
    valid_format = re.fullmatch(r"[0-9a-fA-F]{64}", expected) and re.fullmatch(r"[0-9a-fA-F]{64}", supplied)
    if not valid_format or not hmac.compare_digest(supplied, expected):
        raise ServiceError(403, "OCR service authorization failed.")


def read_body(handler: BaseHTTPRequestHandler, limit: int) -> bytes:
    try:
        length = int(handler.headers.get("Content-Length", "0"))
    except ValueError as exc:
        raise ServiceError(400, "Invalid request length.") from exc
    if length <= 0:
        raise ServiceError(400, "Request body is empty.")
    if length > limit:
        raise ServiceError(413, "Request body is too large.")
    body = handler.rfile.read(length)
    if len(body) != length:
        raise ServiceError(400, "Request body is incomplete.")
    return body


def validate_image(body: bytes, content_type: str) -> str:
    extension = IMAGE_TYPES.get(content_type.split(";", 1)[0].strip().lower())
    signatures = {
        ".jpg": body.startswith(b"\xff\xd8\xff"),
        ".png": body.startswith(b"\x89PNG\r\n\x1a\n"),
        ".webp": len(body) >= 12 and body[:4] == b"RIFF" and body[8:12] == b"WEBP",
    }
    if not extension or not signatures[extension]:
        raise ServiceError(415, "Image contents do not match a supported JPEG, PNG, or WebP type.")
    return extension


def read_json(body: bytes) -> dict[str, Any]:
    try:
        result = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ServiceError(400, "Request JSON is invalid.") from exc
    if not isinstance(result, dict):
        raise ServiceError(400, "Request JSON must be an object.")
    return result


def load_json(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def run_pipeline(image: Path, work: Path) -> dict[str, Any]:
    if not PIPELINE.is_file() or not MATCHER.is_file():
        raise ServiceError(503, "The card catalog pipeline is not installed.")
    scan_root = work / "scans"
    output_root = work / "outputs"
    command = [
        sys.executable, str(PIPELINE), str(image),
        "--strategy", "ocr-first", "--disable-image-recovery", "--lookup-only",
        "--scan-root", str(scan_root), "--output-root", str(output_root),
        "--ocr-timeout", os.environ.get("DCR_OCR_TIMEOUT_SECONDS", "150"),
        "--match-timeout", os.environ.get("DCR_MATCH_TIMEOUT_SECONDS", "45"),
    ]
    try:
        process = subprocess.run(command, capture_output=True, text=True, timeout=205, check=False)
    except subprocess.TimeoutExpired as exc:
        raise ServiceError(504, "The OCR pipeline timed out.") from exc
    run_dirs = list(scan_root.iterdir()) if scan_root.exists() else []
    result_path = next((item / "pipeline-result.json" for item in run_dirs if (item / "pipeline-result.json").is_file()), None)
    result = load_json(result_path) if result_path else None
    if result is None:
        if process.returncode == 3:
            raise ServiceError(503, "The PaddleOCR runtime is not configured.")
        raise ServiceError(502, "The card OCR pipeline did not return a result.")
    report_path = Path(str((result.get("artifacts") or {}).get("match_report") or ""))
    report = load_json(report_path) if report_path.is_file() else {}
    status = str(result.get("status") or "pipeline_error")
    if status in {"ocr_error", "ocr_timeout", "match_timeout", "pipeline_error", "configuration_error"}:
        raise ServiceError(503, "The OCR pipeline could not finish this scan.")
    return compact_result(result, report)


def compact_result(result: dict[str, Any], report: dict[str, Any] | None = None) -> dict[str, Any]:
    report = report or {}
    selected = result.get("selected") or (report.get("selected") or {}).get("summary")
    return {
        "status": result.get("status", "pipeline_error"),
        "reason": result.get("reason") or result.get("match_reason") or "",
        "blockers": result.get("blockers") or [],
        "scanKeys": result.get("scan_keys") or {},
        "selected": selected,
        "candidates": exact_candidates(report),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "DCR-OCR"
    sys_version = ""

    def do_GET(self) -> None:
        try:
            require_token(self)
            if self.path != "/v1/health":
                raise ServiceError(404, "Route not found.")
            send_json(self, 200, {"ok": True, "catalogReady": (TOOLKIT_ROOT / "catalog" / "cards.sqlite").is_file()})
        except ServiceError as exc:
            send_json(self, exc.status, {"error": str(exc)})

    def do_POST(self) -> None:
        try:
            require_token(self)
            if not REQUEST_LOCK.acquire(blocking=False):
                raise ServiceError(429, "The OCR service is processing another card.")
            try:
                if self.path == "/v1/identify":
                    self.identify()
                elif self.path == "/v1/resolve":
                    self.resolve()
                else:
                    raise ServiceError(404, "Route not found.")
            finally:
                REQUEST_LOCK.release()
        except ServiceError as exc:
            send_json(self, exc.status, {"error": str(exc)})
        except Exception as exc:
            print(f"OCR request failed: {type(exc).__name__}", file=sys.stderr, flush=True)
            send_json(self, 500, {"error": "The card OCR service could not complete the request."})

    def identify(self) -> None:
        body = read_body(self, MAX_IMAGE_BYTES)
        extension = validate_image(body, self.headers.get("Content-Type", ""))
        with tempfile.TemporaryDirectory(prefix="dcr-card-ocr-") as directory:
            work = Path(directory)
            image = work / f"front{extension}"
            image.write_bytes(body)
            send_json(self, 200, run_pipeline(image, work))

    def resolve(self) -> None:
        data = read_json(read_body(self, MAX_JSON_BYTES))
        scan = data.get("scanKeys")
        fields = data.get("fields")
        if not isinstance(scan, dict) or not isinstance(fields, dict):
            raise ServiceError(400, "OCR scan keys and Gemma fields are required.")
        with tempfile.TemporaryDirectory(prefix="dcr-card-resolve-") as directory:
            send_json(self, 200, run_lookup(scan, fields, Path(directory), MATCHER))

    def log_message(self, _format: str, *_args: Any) -> None:
        return


def main() -> None:
    if not re.fullmatch(r"[0-9a-fA-F]{64}", os.environ.get("DCR_OCR_TOKEN", "")):
        raise SystemExit("DCR_OCR_TOKEN must contain exactly 64 hexadecimal characters.")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.request_queue_size = 4
    server.serve_forever(poll_interval=0.5)


if __name__ == "__main__":
    main()
