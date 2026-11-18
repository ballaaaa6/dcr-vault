#!/usr/bin/env python3
"""Download a resumable local TCGdex card-image cache and pHash index."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import datetime as dt
import hashlib
import heapq
import io
import json
import math
import re
import sqlite3
import sys
import threading
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from PIL import Image, ImageOps

try:
    import numpy as np
except ImportError:  # Keep the image library usable without NumPy.
    np = None

try:
    import requests
    from requests.adapters import HTTPAdapter
except ImportError:  # Keep compatibility with installations using urllib only.
    requests = None
    HTTPAdapter = None


HERE = Path(__file__).resolve().parent
DEFAULT_DATABASE = HERE / "cards.sqlite"
DEFAULT_OUTPUT = HERE / "card-image-library"
API_ROOT = "https://api.tcgdex.net/v2"
USER_AGENT = "DCR-Card-Image-Library/1.0"
LANGUAGES = ("en", "th", "ko", "zh-tw", "zh-cn", "ja")
DCT_SIZE = 32
DCT_LOW_FREQUENCIES = 8
COSINES = tuple(
    tuple(math.cos((2 * position + 1) * frequency * math.pi / (2 * DCT_SIZE))
          for position in range(DCT_SIZE))
    for frequency in range(DCT_LOW_FREQUENCIES)
)
SESSION_LOCAL = threading.local()


class NotFound(RuntimeError):
    pass


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def thread_session():
    """Return a thread-local keep-alive session when requests is installed."""
    if requests is None:
        return None
    session = getattr(SESSION_LOCAL, "session", None)
    if session is None:
        session = requests.Session()
        session.headers.update({"User-Agent": USER_AGENT})
        adapter = HTTPAdapter(pool_connections=4, pool_maxsize=2, max_retries=0)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        SESSION_LOCAL.session = session
    return session


def safe_part(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", str(value)).strip("._")
    return cleaned or "unknown"


def fetch_bytes(url: str, accept: str, attempts: int = 3) -> tuple[bytes, str]:
    last_error: Exception | None = None
    for attempt in range(attempts):
        if requests is not None:
            try:
                response = thread_session().get(url, headers={"Accept": accept}, timeout=(10, 30))
                if response.status_code == 404:
                    raise NotFound(f"HTTP 404: {url}")
                if response.status_code >= 400:
                    error = RuntimeError(f"HTTP {response.status_code}: {url}")
                    if response.status_code == 429 or response.status_code >= 500:
                        last_error = error
                    else:
                        raise error
                else:
                    data = response.content
                    if not data:
                        raise RuntimeError("empty response body")
                    content_type = str(response.headers.get("Content-Type", "")).split(";", 1)[0].strip().lower()
                    return data, content_type
            except NotFound:
                raise
            except requests.RequestException as exc:
                last_error = exc
        else:
            request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
            try:
                with urlopen(request, timeout=30) as response:
                    data = response.read()
                    if not data:
                        raise RuntimeError("empty response body")
                    content_type = str(response.headers.get("Content-Type", "")).split(";", 1)[0].strip().lower()
                    return data, content_type
            except HTTPError as exc:
                if exc.code == 404:
                    raise NotFound(f"HTTP 404: {url}") from exc
                last_error = exc
            except (URLError, TimeoutError, OSError, RuntimeError) as exc:
                last_error = exc
        if attempt + 1 < attempts:
            time.sleep(0.4 * (attempt + 1))
    raise RuntimeError(f"could not fetch {url}: {last_error}")


def image_phash(image_bytes: bytes, rotation: int = 0) -> tuple[str, int, int]:
    """Return a 64-bit DCT perceptual hash and decoded image dimensions."""
    with Image.open(io.BytesIO(image_bytes)) as opened:
        image = ImageOps.exif_transpose(opened)
        width, height = image.size
        if "A" in image.getbands():
            rgba = image.convert("RGBA")
            background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            background.alpha_composite(rgba)
            image = background.convert("RGB")
        else:
            image = image.convert("RGB")
        if rotation:
            image = image.rotate(rotation, expand=True)
        pixels_image = image.resize((DCT_SIZE, DCT_SIZE), Image.Resampling.LANCZOS).convert("L")
        pixels = pixels_image

    if np is not None:
        matrix = np.asarray(pixels, dtype=np.float64)
        cosine = np.asarray(COSINES, dtype=np.float64)
        coefficients = cosine @ matrix @ cosine.T
        low = [float(coefficients[v, u]) for v in range(DCT_LOW_FREQUENCIES)
               for u in range(DCT_LOW_FREQUENCIES) if v or u]
    else:
        rows = list(pixels.getdata())
        matrix_rows = [rows[start:start + DCT_SIZE] for start in range(0, len(rows), DCT_SIZE)]
        horizontal = [
            [sum(matrix_rows[y][x] * COSINES[u][x] for x in range(DCT_SIZE))
             for u in range(DCT_LOW_FREQUENCIES)]
            for y in range(DCT_SIZE)
        ]
        low = [
            sum(horizontal[y][u] * COSINES[v][y] for y in range(DCT_SIZE))
            for v in range(DCT_LOW_FREQUENCIES)
            for u in range(DCT_LOW_FREQUENCIES)
            if v or u
        ]

    threshold = sorted(low)[len(low) // 2]
    bits = 0
    for coefficient in low:
        bits = (bits << 1) | int(coefficient > threshold)
    return f"{bits:016x}", width, height


def hamming_distance(left: str, right: str) -> int:
    return (int(left, 16) ^ int(right, 16)).bit_count()


def connect_index(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=60)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA synchronous=NORMAL")
    connection.execute("PRAGMA busy_timeout=60000")
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS card_images (
            source_path TEXT NOT NULL,
            language TEXT NOT NULL,
            set_id TEXT NOT NULL,
            local_id TEXT NOT NULL,
            api_id TEXT NOT NULL,
            card_name TEXT NOT NULL,
            series_id TEXT,
            image_base_url TEXT,
            image_url_source TEXT,
            cached_image_url TEXT,
            image_path TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            api_status TEXT,
            http_status INTEGER,
            bytes INTEGER,
            sha256 TEXT,
            phash TEXT,
            width INTEGER,
            height INTEGER,
            fetched_at_utc TEXT,
            error TEXT,
            PRIMARY KEY (source_path, language)
        );
        CREATE INDEX IF NOT EXISTS idx_card_images_lookup
            ON card_images(language, set_id, local_id);
        CREATE INDEX IF NOT EXISTS idx_card_images_phash
            ON card_images(phash);
        CREATE TABLE IF NOT EXISTS locale_sets (
            language TEXT NOT NULL,
            set_id TEXT NOT NULL,
            status TEXT NOT NULL,
            card_count INTEGER,
            fetched_at_utc TEXT,
            error TEXT,
            PRIMARY KEY (language, set_id)
        );
        """
    )
    columns = {row[1] for row in connection.execute("PRAGMA table_info(card_images)")}
    if "series_id" not in columns:
        connection.execute("ALTER TABLE card_images ADD COLUMN series_id TEXT")
    if "image_url_source" not in columns:
        connection.execute("ALTER TABLE card_images ADD COLUMN image_url_source TEXT")
    connection.commit()
    return connection


def load_catalog(database: Path) -> tuple[list[dict[str, str]], list[tuple[str, str]]]:
    if not database.is_file():
        raise FileNotFoundError(f"catalog database not found: {database}")
    connection = sqlite3.connect(f"file:{database.resolve().as_posix()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        rows = [dict(row) for row in connection.execute(
            """SELECT c.source_path, l.language, l.set_id, l.local_id, c.api_id,
                      COALESCE(l.card_name, c.api_id) AS card_name
               FROM card_locales l
               JOIN cards c USING (source_path)
               ORDER BY l.language, l.set_id, l.local_id"""
        )]
        series_by_set_path = {
            row["source_path"]: row["series_id"]
            for row in connection.execute(
                """SELECT s.source_path, se.series_id
                   FROM sets s JOIN series se ON se.source_path=s.series_path"""
            )
        }
        for row in rows:
            set_source_path = row["source_path"].rsplit("/", 1)[0] + ".ts"
            row["series_id"] = series_by_set_path.get(set_source_path, "")
    finally:
        connection.close()
    pairs = sorted({(row["language"], row["set_id"]) for row in rows})
    return rows, pairs


def initialize_rows(connection: sqlite3.Connection, records: list[dict[str, str]]) -> None:
    connection.execute("DROP TABLE IF EXISTS temp.current_catalog")
    connection.execute("CREATE TEMP TABLE current_catalog (source_path TEXT, language TEXT, PRIMARY KEY(source_path, language))")
    connection.executemany(
        "INSERT INTO temp.current_catalog VALUES (?, ?)",
        [(row["source_path"], row["language"]) for row in records],
    )
    connection.executemany(
        """INSERT INTO card_images
           (source_path, language, set_id, local_id, api_id, card_name, series_id, status)
           VALUES (:source_path, :language, :set_id, :local_id, :api_id, :card_name, :series_id, 'pending')
           ON CONFLICT(source_path, language) DO UPDATE SET
             set_id=excluded.set_id, local_id=excluded.local_id,
             api_id=excluded.api_id, card_name=excluded.card_name,
             series_id=excluded.series_id""",
        records,
    )
    connection.execute(
        """DELETE FROM card_images
           WHERE NOT EXISTS (
             SELECT 1 FROM temp.current_catalog c
             WHERE c.source_path=card_images.source_path
               AND c.language=card_images.language
           )"""
    )
    connection.commit()


def fetch_set(language: str, set_id: str) -> dict[str, Any]:
    url = f"{API_ROOT}/{quote(language, safe='-')}/sets/{quote(set_id, safe='.-_')}"
    data, content_type = fetch_bytes(url, "application/json")
    if "json" not in content_type and not data.lstrip().startswith(b"{"):
        raise RuntimeError(f"unexpected API content type: {content_type or 'unknown'}")
    value = json.loads(data.decode("utf-8-sig"))
    if not isinstance(value, dict) or not isinstance(value.get("cards"), list):
        raise RuntimeError("set response did not contain a card list")
    return value


def direct_image_base_url(language: str, series_id: str, set_id: str, local_id: str) -> str | None:
    """Build the deterministic TCGdex CDN path when set metadata omits an image URL."""
    if not series_id:
        return None
    parts = (language, series_id, set_id, local_id)
    return "https://assets.tcgdex.net/" + "/".join(quote(str(part), safe="-._~") for part in parts)


def file_is_cached(row: sqlite3.Row, output: Path) -> bool:
    if not row["image_path"] or not row["sha256"] or not row["phash"]:
        return False
    path = output / Path(row["image_path"])
    try:
        return path.is_file() and path.stat().st_size == row["bytes"]
    except OSError:
        return False


def update_set_records(
    connection: sqlite3.Connection,
    language: str,
    set_id: str,
    records: list[sqlite3.Row],
    set_value: dict[str, Any] | None,
    error: str | None,
    output: Path,
) -> None:
    now = utc_now()
    if error:
        connection.execute(
            """INSERT INTO locale_sets(language,set_id,status,card_count,fetched_at_utc,error)
               VALUES(?,?, 'error', NULL, ?, ?)
               ON CONFLICT(language,set_id) DO UPDATE SET
                 status='error', fetched_at_utc=excluded.fetched_at_utc, error=excluded.error""",
            (language, set_id, now, error[:1200]),
        )
        for row in records:
            existing = connection.execute(
                "SELECT * FROM card_images WHERE source_path=? AND language=?",
                (row["source_path"], language),
            ).fetchone()
            if file_is_cached(existing, output):
                status = "cached_set_api_error"
            else:
                fallback_url = direct_image_base_url(language, row["series_id"], set_id, row["local_id"])
                known_404 = bool(
                    existing and existing["status"] == "http_404"
                    and existing["image_url_source"] == "derived_cdn" and fallback_url
                )
                status = "http_404" if known_404 else ("pending" if fallback_url else "set_api_error")
            fallback_url = direct_image_base_url(language, row["series_id"], set_id, row["local_id"])
            connection.execute(
                """UPDATE card_images SET image_base_url=COALESCE(?,image_base_url),
                   image_url_source=CASE WHEN ? IS NULL THEN image_url_source ELSE 'derived_cdn' END,
                   status=?, api_status='error', error=? WHERE source_path=? AND language=?""",
                (fallback_url, fallback_url, status, error[:1200], row["source_path"], language),
            )
        connection.commit()
        return

    api_cards = set_value.get("cards") or []
    by_id = {str(item.get("id")): item for item in api_cards if isinstance(item, dict) and item.get("id") is not None}
    by_local = {str(item.get("localId")): item for item in api_cards if isinstance(item, dict) and item.get("localId") is not None}
    listed_ids: set[str] = set()
    for row in records:
        card = by_id.get(str(row["api_id"])) or by_local.get(str(row["local_id"]))
        existing = connection.execute(
            "SELECT * FROM card_images WHERE source_path=? AND language=?",
            (row["source_path"], language),
        ).fetchone()
        cached = file_is_cached(existing, output)
        fallback_url = direct_image_base_url(language, row["series_id"], set_id, row["local_id"])
        if card is None:
            same_failed_url = bool(
                existing and existing["status"] == "http_404"
                and fallback_url and existing["image_base_url"] == fallback_url
            )
            status = "cached_not_in_api_set" if cached else (
                "http_404" if same_failed_url else ("pending" if fallback_url else "not_in_api_set")
            )
            connection.execute(
                """UPDATE card_images SET image_base_url=COALESCE(?,image_base_url),
                   image_url_source=CASE WHEN ? IS NULL THEN image_url_source ELSE 'derived_cdn' END,
                   status=?, api_status='not_listed', error=NULL WHERE source_path=? AND language=?""",
                (fallback_url, fallback_url, status, row["source_path"], language),
            )
            continue

        listed_ids.add(str(card.get("id") or row["api_id"]))
        image_base_url = str(card.get("image") or "").strip() or fallback_url
        if not image_base_url:
            status = "cached_source_missing" if cached else "missing_url"
            connection.execute(
                """UPDATE card_images SET image_base_url=NULL, image_url_source=NULL,
                   status=?, api_status='missing_url', error=NULL
                   WHERE source_path=? AND language=?""",
                (status, row["source_path"], language),
            )
        else:
            cached_from_api_url = cached and existing["cached_image_url"] == image_base_url
            cached_from_fallback_url = cached and fallback_url and existing["cached_image_url"] == fallback_url
            same_cached_url = bool(cached_from_api_url or cached_from_fallback_url)
            if cached_from_fallback_url and not cached_from_api_url:
                image_url_source = "derived_cdn"
            else:
                image_url_source = "tcgdex_api" if card.get("image") else "derived_cdn"
            same_failed_url = bool(
                existing and existing["status"] == "http_404"
                and existing["image_base_url"] == image_base_url
            )
            status = "downloaded" if same_cached_url else ("http_404" if same_failed_url else "pending")
            connection.execute(
                """UPDATE card_images SET image_base_url=?, image_url_source=?, status=?,
                   api_status=?, error=NULL
                   WHERE source_path=? AND language=?""",
                (image_base_url, image_url_source, status,
                 "ok" if card.get("image") else "missing_url", row["source_path"], language),
            )

    connection.execute(
        """INSERT INTO locale_sets(language,set_id,status,card_count,fetched_at_utc,error)
           VALUES(?,?, 'ok', ?, ?, NULL)
           ON CONFLICT(language,set_id) DO UPDATE SET
             status='ok', card_count=excluded.card_count,
             fetched_at_utc=excluded.fetched_at_utc, error=NULL""",
        (language, set_id, len(api_cards), now),
    )
    connection.commit()


def download_card(row: dict[str, Any], output: Path) -> dict[str, Any]:
    image_base_url = str(row["image_base_url"])
    candidates = [(image_base_url, str(row.get("image_url_source") or "tcgdex_api"))]
    fallback_url = direct_image_base_url(
        row["language"], row.get("series_id") or "", row["set_id"], row["local_id"]
    )
    if fallback_url and fallback_url != image_base_url:
        candidates.append((fallback_url, "derived_cdn"))
    relative_path = Path("images") / safe_part(row["language"]) / safe_part(row["set_id"]) / f"{safe_part(row['api_id'])}.webp"
    target = output / relative_path
    last_not_found: NotFound | None = None
    for candidate_base_url, candidate_source in candidates:
        image_url = f"{candidate_base_url.rstrip('/')}/low.webp"
        try:
            data, content_type = fetch_bytes(image_url, "image/webp,image/*;q=0.8,*/*;q=0.5")
            if content_type and content_type not in {"image/webp", "application/octet-stream"}:
                raise RuntimeError(f"expected WebP, got {content_type}")
            phash, width, height = image_phash(data)
            with Image.open(io.BytesIO(data)) as opened:
                if opened.format != "WEBP":
                    raise RuntimeError(f"expected WebP data, got {opened.format or 'unknown format'}")
            digest = hashlib.sha256(data).hexdigest()
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = Path(f"{target}.tmp")
            temporary.write_bytes(data)
            temporary.replace(target)
            return {
                "status": "downloaded", "api_status": row.get("api_status") or "ok", "http_status": 200,
                "image_path": relative_path.as_posix(), "cached_image_url": candidate_base_url,
                "image_url_source": candidate_source,
                "bytes": len(data), "sha256": digest, "phash": phash,
                "width": width, "height": height, "error": None,
            }
        except NotFound as exc:
            last_not_found = exc
            continue
        except Exception as exc:
            return {
                "status": "download_error", "api_status": row.get("api_status") or "ok", "http_status": None,
                "image_path": None, "cached_image_url": None, "image_url_source": candidate_source,
                "bytes": None, "sha256": None, "phash": None, "width": None, "height": None,
                "error": f"{type(exc).__name__}: {exc}"[:1200],
            }
    if last_not_found:
        return {
            "status": "http_404", "api_status": row.get("api_status") or "ok", "http_status": 404,
            "image_path": None, "cached_image_url": None, "image_url_source": candidates[-1][1],
            "bytes": None, "sha256": None, "phash": None, "width": None, "height": None,
            "error": str(last_not_found),
        }
    return {
        "status": "download_error", "api_status": row.get("api_status") or "ok", "http_status": None,
        "image_path": None, "cached_image_url": None, "image_url_source": None, "bytes": None,
        "sha256": None, "phash": None, "width": None, "height": None,
        "error": "no image URL available",
    }


def library_summary(connection: sqlite3.Connection, database: Path, output: Path) -> dict[str, Any]:
    grouped = connection.execute(
        "SELECT language,status,COUNT(*) AS rows,SUM(CASE WHEN sha256 IS NOT NULL THEN bytes ELSE 0 END) AS bytes FROM card_images GROUP BY language,status ORDER BY language,status"
    ).fetchall()
    by_language: dict[str, dict[str, Any]] = {}
    for row in grouped:
        item = by_language.setdefault(row["language"], {"total": 0, "statuses": {}, "cached_images": 0, "cached_bytes": 0})
        item["total"] += row["rows"]
        item["statuses"][row["status"]] = row["rows"]
        if row["status"] in {"downloaded", "cached_source_missing", "cached_set_api_error", "cached_not_in_api_set", "cached_download_error"}:
            item["cached_images"] += row["rows"]
        item["cached_bytes"] += row["bytes"] or 0

    totals = connection.execute(
        """SELECT COUNT(*) AS records,
                  SUM(CASE WHEN sha256 IS NOT NULL THEN 1 ELSE 0 END) AS cached_images,
                  SUM(CASE WHEN sha256 IS NOT NULL THEN bytes ELSE 0 END) AS cached_bytes,
                  SUM(CASE WHEN status='missing_url' THEN 1 ELSE 0 END) AS missing_urls,
                  SUM(CASE WHEN status='http_404' THEN 1 ELSE 0 END) AS image_404,
                  SUM(CASE WHEN status IN ('download_error','set_api_error') THEN 1 ELSE 0 END) AS errors,
                  SUM(CASE WHEN status='cached_set_api_error' THEN 1 ELSE 0 END) AS cached_set_api_error,
                  SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending
           FROM card_images"""
    ).fetchone()
    set_totals = connection.execute("SELECT COUNT(*) AS total, SUM(CASE WHEN status='ok' THEN 1 ELSE 0 END) AS ok FROM locale_sets").fetchone()
    set_errors = connection.execute("SELECT COUNT(*) FROM locale_sets WHERE status='error'").fetchone()[0]
    source_totals = connection.execute(
        """SELECT image_url_source, COUNT(*) AS images
           FROM card_images WHERE sha256 IS NOT NULL
           GROUP BY image_url_source ORDER BY image_url_source"""
    ).fetchall()
    payload = {
        "schema_version": 1,
        "generated_at_utc": utc_now(),
        "source": "TCGdex localized set API and card asset CDN",
        "catalog_database": str(database.resolve()),
        "image_quality": "low.webp (TCGdex 245x337 asset variant)",
        "phash": "64-bit DCT perceptual hash, stored as 16 hexadecimal characters",
        "output_root": str(output.resolve()),
        "index_database": "image-index.sqlite",
        "image_directory": "images/",
        "locale_sets": {
            "total": set_totals["total"] or 0,
            "metadata_ok": set_totals["ok"] or 0,
            "metadata_errors": set_errors,
        },
        "image_url_sources": {row["image_url_source"] or "unknown": row["images"] for row in source_totals},
        "summary": {
            "catalog_records": totals["records"] or 0,
            "cached_images": totals["cached_images"] or 0,
            "cached_bytes": totals["cached_bytes"] or 0,
            "cached_megabytes_decimal": round((totals["cached_bytes"] or 0) / 1_000_000, 2),
            "missing_image_urls": totals["missing_urls"] or 0,
            "image_http_404": totals["image_404"] or 0,
            "errors": totals["errors"] or 0,
            "cached_images_from_set_api_error": totals["cached_set_api_error"] or 0,
            "pending": totals["pending"] or 0,
        },
        "by_language": by_language,
    }
    return payload


def save_summary(connection: sqlite3.Connection, database: Path, output: Path) -> dict[str, Any]:
    payload = library_summary(connection, database, output)
    write_json(output / "manifest.json", payload)
    return payload


def sync_library(database: Path, output: Path, workers: int) -> int:
    records, pairs = load_catalog(database)
    output.mkdir(parents=True, exist_ok=True)
    (output / ".gitignore").write_text("images/\nimage-index.sqlite\nimage-index.sqlite-shm\nimage-index.sqlite-wal\n*.tmp\n", encoding="utf-8")
    index_path = output / "image-index.sqlite"
    connection = connect_index(index_path)
    try:
        initialize_rows(connection, records)
        print(f"Catalog: {len(records):,} localized card records in {len(pairs):,} language/set pairs.")

        pair_rows: dict[tuple[str, str], list[sqlite3.Row]] = {}
        for row in records:
            pair_rows.setdefault((row["language"], row["set_id"]), []).append(row)  # type: ignore[arg-type]

        print(f"Refreshing card image URLs from {len(pairs):,} localized set records...")
        with ThreadPoolExecutor(max_workers=min(6, workers)) as executor:
            future_map = {
                executor.submit(fetch_set, language, set_id): (language, set_id)
                for language, set_id in pairs
            }
            complete = 0
            for future in as_completed(future_map):
                language, set_id = future_map[future]
                try:
                    value = future.result()
                    update_set_records(connection, language, set_id, pair_rows[(language, set_id)], value, None, output)
                except Exception as exc:
                    error = f"{type(exc).__name__}: {exc}"
                    update_set_records(connection, language, set_id, pair_rows[(language, set_id)], None, error, output)
                complete += 1
                if complete % 25 == 0 or complete == len(pairs):
                    save_summary(connection, database, output)
                    print(f"Set metadata: {complete:,}/{len(pairs):,}")

        pending = [dict(row) for row in connection.execute(
            """SELECT * FROM card_images
               WHERE image_base_url IS NOT NULL
                 AND status NOT IN ('downloaded','http_404','cached_set_api_error','cached_not_in_api_set')
               ORDER BY language,set_id,local_id"""
        )]
        print(f"Downloading {len(pending):,} low-resolution card images with {workers} workers.")
        total = len(pending)
        completed = 0
        batch_size = max(100, workers * 25)
        with ThreadPoolExecutor(max_workers=workers) as executor:
            for start in range(0, total, batch_size):
                batch = pending[start:start + batch_size]
                futures = {executor.submit(download_card, row, output): row for row in batch}
                for future in as_completed(futures):
                    row = futures[future]
                    try:
                        result = future.result()
                    except Exception as exc:
                        result = {"status": "download_error", "api_status": "ok", "http_status": None,
                                  "image_path": None, "cached_image_url": None, "bytes": None,
                                  "image_url_source": None,
                                  "sha256": None, "phash": None, "width": None, "height": None,
                                  "error": f"{type(exc).__name__}: {exc}"[:1200]}
                    now = utc_now()
                    connection.execute(
                        """UPDATE card_images SET
                             status=:status, api_status=:api_status, http_status=:http_status,
                             image_path=COALESCE(:image_path,image_path),
                             cached_image_url=COALESCE(:cached_image_url,cached_image_url),
                             image_url_source=COALESCE(:image_url_source,image_url_source),
                             bytes=COALESCE(:bytes,bytes), sha256=COALESCE(:sha256,sha256),
                             phash=COALESCE(:phash,phash), width=COALESCE(:width,width),
                             height=COALESCE(:height,height), fetched_at_utc=:fetched_at_utc,
                             error=:error
                           WHERE source_path=:source_path AND language=:language""",
                        {**result, "fetched_at_utc": now, "source_path": row["source_path"], "language": row["language"]},
                    )
                    completed += 1
                connection.commit()
                save_summary(connection, database, output)
                print(f"Images: {completed:,}/{total:,}")

        payload = save_summary(connection, database, output)
        summary = payload["summary"]
        print(
            f"Complete: {summary['cached_images']:,}/{summary['catalog_records']:,} images cached; "
            f"{summary['cached_megabytes_decimal']:.2f} MB; "
            f"{summary['missing_image_urls']:,} no URL; {summary['image_http_404']:,} HTTP 404; "
            f"{summary['errors']:,} errors; {summary['pending']:,} pending."
        )
        print(f"Manifest: {output / 'manifest.json'}")
        print(f"Index: {index_path}")
        return 0 if not summary["errors"] and not summary["pending"] else 2
    except KeyboardInterrupt:
        connection.commit()
        save_summary(connection, database, output)
        print("Interrupted. Completed downloads and hashes were saved; rerun the same sync command to resume.", file=sys.stderr)
        return 130
    finally:
        connection.close()


def rank_image_candidates(
    image_path: Path,
    index_path: Path,
    language: str | None = None,
    set_id: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Rank cached card images by pHash without printing or opening a network connection."""
    if not image_path.is_file():
        raise FileNotFoundError(f"Image not found: {image_path}")
    if not index_path.is_file():
        raise FileNotFoundError(f"Image index not found: {index_path}. Run the sync command first.")
    if limit < 1:
        raise ValueError("limit must be at least 1")

    image_bytes = image_path.read_bytes()
    query_hashes = [image_phash(image_bytes, rotation) for rotation in (0, 90, 180, 270)]
    query_values = [item[0] for item in query_hashes]
    where = ["phash IS NOT NULL", "sha256 IS NOT NULL"]
    parameters: list[Any] = []
    if language:
        where.append("language=?")
        parameters.append(language)
    if set_id:
        where.append("set_id=?")
        parameters.append(set_id)
    connection = sqlite3.connect(f"file:{index_path.resolve().as_posix()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        cursor = connection.execute(
            "SELECT language,set_id,local_id,api_id,card_name,image_path,phash FROM card_images WHERE " + " AND ".join(where),
            parameters,
        )
        best: list[tuple[int, str, sqlite3.Row]] = []
        for row in cursor:
            distance = min(hamming_distance(query_hash, row["phash"]) for query_hash in query_values)
            tie_breaker = f"{row['language']}|{row['set_id']}|{row['local_id']}|{row['api_id']}"
            if len(best) < limit:
                heapq.heappush(best, (-distance, tie_breaker, row))
            elif distance < -best[0][0]:
                heapq.heapreplace(best, (-distance, tie_breaker, row))
        ranked = sorted(((-negative_distance, row) for negative_distance, _key, row in best),
                        key=lambda item: (item[0], item[1]["language"], item[1]["set_id"], item[1]["local_id"]))
    finally:
        connection.close()

    return [
        {
            "distance": int(distance),
            "language": str(row["language"]),
            "set_id": str(row["set_id"]),
            "local_id": str(row["local_id"]),
            "api_id": str(row["api_id"]),
            "card_name": str(row["card_name"]),
            "image_path": str(row["image_path"]),
            "phash": str(row["phash"]),
        }
        for distance, row in ranked
    ]


def search_library(image_path: Path, index_path: Path, language: str | None, set_id: str | None, limit: int) -> int:
    try:
        ranked = rank_image_candidates(image_path, index_path, language, set_id, limit)
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    print("pHash nearest candidates (ranking aid only; confirm with OCR/card details):")
    print(f"Query: {image_path} | rotations checked: 0, 90, 180, 270 degrees")
    for item in ranked:
        print(
            f"distance={item['distance']:02d}/63  {item['language']}  "
            f"{item['set_id']}-{item['local_id']}  {item['card_name']}  "
            f"[{item['api_id']}]  {item['image_path']}"
        )
    if not ranked:
        print("No indexed reference images matched the requested filters.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    sync = subparsers.add_parser("sync", help="download or resume the complete local card-image library")
    sync.add_argument("--database", type=Path, default=DEFAULT_DATABASE)
    sync.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    sync.add_argument("--workers", type=int, default=32, help="parallel CDN downloads (1-32; default: 32)")
    search = subparsers.add_parser("search", help="rank local card images against a card-face scan")
    search.add_argument("image", type=Path, help="card-face image; crop/straighten it first for best results")
    search.add_argument("--index", type=Path, default=DEFAULT_OUTPUT / "image-index.sqlite")
    search.add_argument("--language", choices=LANGUAGES)
    search.add_argument("--set-id")
    search.add_argument("--limit", type=int, default=10)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if args.command == "sync":
        if not 1 <= args.workers <= 32:
            parser.error("--workers must be between 1 and 32")
        return sync_library(args.database.resolve(), args.output.resolve(), args.workers)
    if args.limit < 1 or args.limit > 100:
        parser.error("--limit must be between 1 and 100")
    return search_library(args.image.expanduser().resolve(), args.index.resolve(), args.language, args.set_id, args.limit)


if __name__ == "__main__":
    raise SystemExit(main())
