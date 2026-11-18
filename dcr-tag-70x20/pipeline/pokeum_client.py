"""Local Pokeum API client with model and catalogue readiness gates."""

from __future__ import annotations

import math
import os
import sqlite3
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import requests


PIPELINE_DIR = Path(__file__).resolve().parent
CARD_ROOT = PIPELINE_DIR.parent
WORKSPACE_ROOT = CARD_ROOT.parent
DEFAULT_POKEUM_ROOT = WORKSPACE_ROOT / ".tmp" / "pokeum-eval"
DEFAULT_POKEUM_DATA = WORKSPACE_ROOT / ".tmp" / "pokeum-data"
DEFAULT_MODEL_PATH = DEFAULT_POKEUM_ROOT / "data" / "models" / "dinov2s-ft-v1.onnx"
DEFAULT_EMBEDDER_ID = "histogram-v1"
MIN_CONFIDENCE = 0.80
MIN_MARGIN = 0.10
DEFAULT_MIN_CATALOG_COVERAGE = 0.95


def _local_catalog_ids(database: Path, language: str) -> set[str]:
    """Return unique TCGdex IDs from the local catalogue for one language."""
    local_uri = f"file:{database.resolve().as_posix()}?mode=ro"
    with sqlite3.connect(local_uri, uri=True) as connection:
        rows = connection.execute(
            """
            SELECT DISTINCT cards.api_id
            FROM cards
            JOIN card_locales
              ON cards.set_id = card_locales.set_id
             AND cards.local_id = card_locales.local_id
            WHERE card_locales.language = ?
              AND cards.api_id IS NOT NULL
              AND cards.api_id != ''
            """,
            (language,),
        )
        return {str(row[0]) for row in rows}


def _pokeum_index_state(data_dir: Path) -> tuple[set[str], str | None]:
    """Read Pokeum's card IDs and embedder fingerprint from its SQLite store."""
    database = data_dir / "reference.db"
    if not database.is_file():
        raise FileNotFoundError(f"Pokeum reference database is missing: {database}")
    uri = f"file:{database.resolve().as_posix()}?mode=ro"
    with sqlite3.connect(uri, uri=True) as connection:
        cards = {
            str(row[0])
            for row in connection.execute("SELECT id FROM cards WHERE id IS NOT NULL")
        }
        row = connection.execute(
            "SELECT value FROM meta WHERE key = 'embedder_id'"
        ).fetchone()
    return cards, str(row[0]) if row and row[0] else None


def _api_root(value: str) -> str:
    """Normalize a server URL that may already include the /api path."""
    root = value.strip().rstrip("/")
    parts = urlsplit(root)
    if (
        parts.scheme != "http"
        or parts.hostname not in {"localhost", "127.0.0.1", "::1"}
        or parts.username
        or parts.password
        or parts.query
        or parts.fragment
    ):
        raise ValueError("Pokeum must use an unauthenticated HTTP URL on loopback only.")
    path = parts.path.rstrip("/")
    if not path.endswith("/api"):
        path = f"{path}/api" if path else "/api"
    return urlunsplit((parts.scheme, parts.netloc, path, "", ""))


def _local_request(method: str, url: str, **kwargs: Any) -> requests.Response:
    """Make a loopback request without environment proxies or redirects."""
    with requests.Session() as session:
        session.trust_env = False
        response = session.request(method, url, allow_redirects=False, **kwargs)
        if response.is_redirect:
            response.close()
            raise requests.RequestException("Pokeum redirects are not followed.")
        return response


def _readiness(
    database: Path,
    language: str,
    *,
    data_dir: Path,
    model_path: Path,
    expected_embedder_id: str,
    min_coverage: float,
) -> dict[str, Any]:
    """Ensure Pokeum has the expected encoder index and near-complete coverage."""
    if not 0.0 < min_coverage <= 1.0:
        return {"ready": False, "reason": "DCR_POKEUM_MIN_CATALOG_COVERAGE must be in (0, 1]."}
    try:
        local_ids = _local_catalog_ids(database, language)
        pokeum_ids, embedder_id = _pokeum_index_state(data_dir)
    except (OSError, sqlite3.Error) as error:
        return {"ready": False, "reason": f"Could not read Pokeum/local catalogue readiness: {error}"}

    covered_count = len(local_ids & pokeum_ids)
    coverage = covered_count / len(local_ids) if local_ids else 0.0
    state = {
        "ready": False,
        "model_path": str(model_path),
        "embedder_id": embedder_id,
        "expected_embedder_id": expected_embedder_id,
        "model_available": model_path.is_file(),
        "cards_indexed": len(pokeum_ids),
        "local_catalog_cards": len(local_ids),
        "catalog_cards_covered": covered_count,
        "catalog_coverage": round(coverage, 4),
        "minimum_catalog_coverage": min_coverage,
    }
    if not local_ids:
        state["reason"] = f"The local catalogue has no TCGdex IDs for {language!r} cards."
    elif expected_embedder_id.startswith("onnx:") and not model_path.is_file():
        state["reason"] = f"Pokeum's configured ONNX model is missing: {model_path}"
    elif embedder_id != expected_embedder_id:
        state["reason"] = (
            f"Pokeum index uses {embedder_id or 'no embedder metadata'}; "
            f"expected {expected_embedder_id}. Rebuild the index with the configured encoder."
        )
    elif coverage < min_coverage:
        state["reason"] = (
            f"Pokeum catalogue is incomplete ({covered_count}/{len(local_ids)} shared card IDs, "
            f"{coverage:.1%}); at least {min_coverage:.0%} coverage is required."
        )
    else:
        state.update(ready=True, reason="Expected encoder index and catalogue coverage are ready.")
    return state


def identify_pokeum(
    image_path: Path,
    language: str,
    local_catalog: Path,
    *,
    enabled: bool = True,
    base_url: str | None = None,
    timeout_seconds: float = 5.0,
) -> dict[str, Any]:
    """Call the local Pokeum service; return evidence without accepting identity."""
    started = time.perf_counter()
    url = base_url or os.environ.get("DCR_POKEUM_URL", "http://127.0.0.1:8765")
    service_language = os.environ.get("DCR_POKEUM_LANGUAGE", "en").strip().lower()
    data_dir = Path(
        os.environ.get("DCR_POKEUM_DATA_DIR", str(DEFAULT_POKEUM_DATA))
    ).expanduser().resolve()
    model_path = Path(
        os.environ.get("DCR_POKEUM_MODEL_PATH", str(DEFAULT_MODEL_PATH))
    ).expanduser().resolve()
    expected_embedder_id = os.environ.get("DCR_POKEUM_EXPECTED_EMBEDDER_ID", "").strip()
    if not expected_embedder_id:
        expected_embedder_id = (
            f"onnx:{model_path.name}" if model_path.is_file() else DEFAULT_EMBEDDER_ID
        )
    try:
        min_coverage = float(
            os.environ.get("DCR_POKEUM_MIN_CATALOG_COVERAGE", str(DEFAULT_MIN_CATALOG_COVERAGE))
        )
    except ValueError:
        min_coverage = -1.0

    try:
        api_root = _api_root(url)
    except ValueError as error:
        return {
            "method": "Pokeum local API",
            "service_url": url,
            "language": language,
            "status": "invalid_configuration",
            "accepted": False,
            "reason": str(error),
            "elapsed_seconds": round(time.perf_counter() - started, 4),
        }

    report: dict[str, Any] = {
        "method": "Pokeum local API",
        "service_url": api_root,
        "language": language,
        "status": "not_ready",
        "accepted": False,
    }
    if not enabled:
        report.update(status="disabled", reason="Pokeum was disabled for this run.")
    elif language.strip().lower() != service_language:
        report.update(
            status="language_unavailable",
            reason=f"Pokeum is configured for {service_language!r}, not {language!r}.",
        )
    else:
        readiness = _readiness(
            local_catalog,
            language,
            data_dir=data_dir,
            model_path=model_path,
            expected_embedder_id=expected_embedder_id,
            min_coverage=min_coverage,
        )
        report["readiness"] = readiness
        if not readiness.get("ready"):
            report.update(status="not_ready", reason=readiness.get("reason"))
        else:
            try:
                health_response = _local_request(
                    "GET",
                    f"{api_root}/health",
                    timeout=(1.0, min(timeout_seconds, 3.0)),
                )
                health_response.raise_for_status()
                health = health_response.json()
                report["health"] = health
                if (
                    not isinstance(health, dict)
                    or health.get("status") != "ok"
                    or not health.get("embedder_loaded")
                ):
                    report.update(
                        status="service_not_ready",
                        reason="Pokeum health check did not report a ready embedder.",
                    )
                elif int(health.get("cards_indexed", 0)) != int(readiness["cards_indexed"]):
                    report.update(
                        status="service_catalog_incomplete",
                        reason="The running Pokeum service does not have the validated local index loaded.",
                    )
                else:
                    with image_path.open("rb") as image_file:
                        response = _local_request(
                            "POST",
                            f"{api_root}/identify",
                            params={"top_k": 5},
                            files={
                                "file": (
                                    image_path.name,
                                    image_file,
                                    (
                                        "image/jpeg"
                                        if image_path.suffix.lower() in {".jpg", ".jpeg"}
                                        else "application/octet-stream"
                                    ),
                                )
                            },
                            timeout=(1.0, timeout_seconds),
                        )
                    response.raise_for_status()
                    result = response.json()
                    if not isinstance(result, dict):
                        raise ValueError("Pokeum returned a non-object JSON response.")
                    report["response"] = result
                    match = result.get("match")
                    alternates = result.get("alternates") or []
                    confidence = float(match.get("confidence", 0.0)) if isinstance(match, dict) else 0.0
                    runner_up = (
                        float(alternates[0].get("confidence", 0.0))
                        if alternates and isinstance(alternates[0], dict)
                        else 0.0
                    )
                    margin = confidence - runner_up
                    report.update(
                        confidence=round(confidence, 4),
                        runner_up_confidence=round(runner_up, 4),
                        confidence_margin=round(margin, 4),
                    )
                    if (
                        result.get("status") == "confident"
                        and isinstance(match, dict)
                        and math.isfinite(confidence)
                        and math.isfinite(margin)
                        and confidence >= MIN_CONFIDENCE
                        and (not alternates or margin >= MIN_MARGIN)
                    ):
                        report.update(status="confident", accepted=True)
                    else:
                        report.update(
                            status=str(result.get("status") or "uncertain"),
                            reason=(
                                "Pokeum did not clear its confident status and score/margin gates."
                            ),
                        )
            except (OSError, requests.RequestException, ValueError, TypeError, KeyError) as error:
                report.update(
                    status="unavailable",
                    reason=f"Pokeum request failed; continuing with the existing workflow: {error}",
                )

    report["elapsed_seconds"] = round(time.perf_counter() - started, 4)
    return report
