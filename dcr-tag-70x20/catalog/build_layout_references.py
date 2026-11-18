#!/usr/bin/env python3
"""Build a small, language-aware reference image library from the local catalog."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import datetime as dt
import hashlib
import json
import re
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


HERE = Path(__file__).resolve().parent
DATABASE = HERE / "cards.sqlite"
OUTPUT = HERE / "layout-references"
MANIFEST_PATH = OUTPUT / "manifest.json"
API_ROOT = "https://api.tcgdex.net/v2"
USER_AGENT = "DCR-Layout-Reference-Builder/1.0"
LANGUAGES = ("en", "th", "ko", "zh-tw", "zh-cn", "ja")
SPECIAL_NAME = re.compile(r"\b(?:ex|gx|v|vmax|vstar|mega|break|tag\s+team)\b", re.IGNORECASE)


class AssetNotFound(RuntimeError):
    pass


def read_json(path: Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def natural_id_key(value: str) -> tuple[Any, ...]:
    return tuple(int(part) if part.isdigit() else part.casefold() for part in re.split(r"(\d+)", str(value)))


def card_priority(row: sqlite3.Row) -> tuple[Any, ...]:
    raw = json.loads(row["card_raw"] or "{}")
    category = str(row["category"] or "").casefold()
    name = str(row["card_name"] or "")
    stage = str(raw.get("stage") or "").casefold()
    rarity = str(row["rarity"] or "").casefold()
    special = bool(raw.get("suffix")) or bool(SPECIAL_NAME.search(name))

    if category == "pokemon":
        category_rank = 0
        stage_rank = 0 if stage == "basic" else 1 if not stage else 2
        rarity_rank = 0 if rarity in {"common", "uncommon"} else 1 if not rarity else 2
        special_rank = 1 if special else 0
    elif category == "trainer":
        category_rank, stage_rank, special_rank = 1, 0, 0
        rarity_rank = 0 if rarity in {"common", "uncommon"} else 1
    elif category == "energy":
        category_rank, stage_rank, rarity_rank, special_rank = 2, 0, 0, 0
    else:
        category_rank, stage_rank, rarity_rank, special_rank = 3, 0, 0, 0
    return category_rank, special_rank, stage_rank, rarity_rank, natural_id_key(row["local_id"]), row["card_name"]


def load_sample_plan(database: Path, languages: list[str]) -> list[dict[str, Any]]:
    if not database.is_file():
        raise FileNotFoundError(f"Catalog database not found: {database}")
    connection = sqlite3.connect(f"file:{database.resolve().as_posix()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute(
            """SELECT l.source_path, l.language, l.card_name, l.set_id, l.local_id,
                      l.set_name, l.series_name, l.release_date, se.series_id,
                      c.api_id, c.category, c.rarity, c.raw_json AS card_raw
               FROM card_locales l
               JOIN cards c USING (source_path)
               LEFT JOIN sets s ON s.source_path = c.set_path
               LEFT JOIN series se ON se.source_path = s.series_path
               ORDER BY l.language, l.series_name, l.set_id"""
        ).fetchall()
    finally:
        connection.close()

    rows_by_pair: dict[tuple[str, str], list[sqlite3.Row]] = {}
    for row in rows:
        if row["language"] not in languages:
            continue
        rows_by_pair.setdefault((row["language"], row["set_id"]), []).append(row)

    selected: dict[tuple[str, str, str], dict[str, Any]] = {}

    def add(row: sqlite3.Row, role: str, fallback_rows: list[sqlite3.Row] | None = None) -> None:
        key = (row["language"], row["set_id"], row["api_id"])
        record = selected.get(key)
        if record is None:
            record = {
                "sample_key": "|".join(key),
                "language": row["language"],
                "set_id": row["set_id"],
                "set_name": row["set_name"],
                "series_name": row["series_name"],
                "series_id": row["series_id"],
                "release_date": row["release_date"],
                "api_id": row["api_id"],
                "local_id": row["local_id"],
                "card_name": row["card_name"],
                "category": row["category"],
                "rarity": row["rarity"],
                "roles": [],
                "layout_profile_id": None,
                "selection_source": "tcgdex local catalog",
                "fallback_api_candidates": [],
            }
            selected[key] = record
        if role not in record["roles"]:
            record["roles"].append(role)
        for candidate in fallback_rows or []:
            if candidate["api_id"] == row["api_id"]:
                continue
            fallback = {
                "api_id": candidate["api_id"],
                "local_id": candidate["local_id"],
                "card_name": candidate["card_name"],
                "category": candidate["category"],
            }
            if fallback not in record["fallback_api_candidates"]:
                record["fallback_api_candidates"].append(fallback)

    # One anchor for every localized set: ordinary Pokémon is preferred;
    # sets without one use a Trainer or Energy card.
    for pair_rows in rows_by_pair.values():
        ordered = sorted(pair_rows, key=card_priority)
        selected_category = ordered[0]["category"]
        same_category = [row for row in ordered if row["category"] == selected_category]
        add(ordered[0], "set_anchor", same_category)

    # Add one example of each structurally distinct card category per localized
    # series. This gives layout coverage without downloading every card in a set.
    rows_by_series: dict[tuple[str, str], list[sqlite3.Row]] = {}
    for row in rows:
        if row["language"] not in languages:
            continue
        rows_by_series.setdefault((row["language"], row["series_id"] or row["series_name"] or "(unknown)"), []).append(row)

    for series_rows in rows_by_series.values():
        for category, role in (("Trainer", "series_trainer"), ("Energy", "series_energy")):
            category_rows = [row for row in series_rows if str(row["category"] or "").casefold() == category.casefold()]
            if category_rows:
                ordered_category_rows = sorted(category_rows, key=card_priority)
                chosen = ordered_category_rows[0]
                same_set_rows = [row for row in rows_by_pair[(chosen["language"], chosen["set_id"])]
                                 if str(row["category"] or "").casefold() == category.casefold()]
                add(chosen, role, sorted(same_set_rows, key=card_priority))

        special_rows = []
        for row in series_rows:
            if str(row["category"] or "").casefold() != "pokemon":
                continue
            raw = json.loads(row["card_raw"] or "{}")
            if raw.get("suffix") or SPECIAL_NAME.search(str(row["card_name"] or "")):
                special_rows.append(row)
        if special_rows:
            ordered_special_rows = sorted(special_rows, key=card_priority)
            chosen = ordered_special_rows[0]
            same_set_specials = [row for row in rows_by_pair[(chosen["language"], chosen["set_id"])]
                                 if str(row["category"] or "").casefold() == "pokemon"
                                 and (json.loads(row["card_raw"] or "{}").get("suffix")
                                      or SPECIAL_NAME.search(str(row["card_name"] or "")))]
            add(chosen, "series_special_pokemon", sorted(same_set_specials, key=card_priority))

    return sorted(selected.values(), key=lambda item: (item["language"], item["series_name"] or "", item["set_id"], item["api_id"]))


def fetch_bytes(url: str, accept: str = "*/*", attempts: int = 2) -> tuple[bytes, str]:
    last_error: Exception | None = None
    for attempt in range(attempts):
        request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
        try:
            with urlopen(request, timeout=25) as response:
                content_type = str(response.headers.get("Content-Type", "")).split(";", 1)[0].strip().lower()
                data = response.read()
                if not data:
                    raise RuntimeError("Empty response body")
                return data, content_type
        except HTTPError as exc:
            if exc.code == 404:
                raise AssetNotFound(f"HTTP 404: {url}") from exc
            last_error = exc
        except (URLError, TimeoutError, OSError, RuntimeError) as exc:
            last_error = exc
        if attempt + 1 < attempts:
            time.sleep(0.35 * (attempt + 1))
    raise RuntimeError(f"Could not fetch {url}: {last_error}")


def safe_part(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", str(value)).strip("._")
    return cleaned or "unknown"


def download_asset(
    base_url: str | None,
    kind: str,
    destination_stem: Path,
    *,
    asset_language: str | None = None,
    force: bool = False,
) -> dict[str, Any]:
    if not base_url:
        return {"status": "missing_url", "url": None, "path": None}
    if kind == "card":
        candidates = [(f"{base_url.rstrip('/')}/high.webp", ".webp"),
                     (f"{base_url.rstrip('/')}/high.png", ".png"),
                     (f"{base_url.rstrip('/')}/high.jpg", ".jpg"),
                     (f"{base_url.rstrip('/')}/low.webp", ".webp")]
    else:
        root = base_url.rstrip("/")
        roots = []
        if "/univ/" in root and asset_language:
            roots.append(root.replace("/univ/", f"/{quote(asset_language, safe='-')}/", 1))
        roots.append(root)
        candidates = [
            (f"{candidate_root}{extension}", extension)
            for candidate_root in roots
            for extension in (".webp", ".png", ".jpg")
        ]

    failures: list[str] = []
    for url, extension in candidates:
        target = Path(f"{destination_stem}{extension}")
        if not force and target.is_file() and target.stat().st_size > 256:
            return {"status": "cached", "url": url, "path": target.as_posix(), "bytes": target.stat().st_size}
        try:
            data, content_type = fetch_bytes(url, accept="image/avif,image/webp,image/png,image/jpeg,*/*")
            if not content_type.startswith("image/"):
                raise RuntimeError(f"Expected image response, got {content_type or 'unknown content type'}")
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = Path(f"{target}.tmp")
            temporary.write_bytes(data)
            temporary.replace(target)
            return {"status": "downloaded", "url": url, "path": target.as_posix(), "bytes": len(data)}
        except AssetNotFound as exc:
            failures.append(str(exc))
        except Exception as exc:  # Keep one bad reference from aborting the whole library.
            failures.append(f"{url}: {type(exc).__name__}: {exc}")
    return {"status": "unavailable", "url": base_url, "path": None, "errors": failures}


def retrieve_sample(
    sample: dict[str, Any],
    output: Path,
    max_api_candidates: int,
    *,
    force: bool = False,
) -> dict[str, Any]:
    language = sample["language"]
    candidates = [{
        "api_id": sample["api_id"],
        "local_id": sample["local_id"],
        "card_name": sample["card_name"],
        "category": sample["category"],
    }, *sample.get("fallback_api_candidates", [])]
    # If the chosen card lacks an image, a later card in the same set can still
    # provide the set mark and a useful layout reference.
    card_details: dict[str, Any] | None = None
    attempts: list[dict[str, Any]] = []
    selected_candidate: dict[str, Any] | None = None
    for candidate in candidates[:max_api_candidates]:
        api_id = candidate["api_id"]
        url = f"{API_ROOT}/{quote(language, safe='-')}/cards/{quote(api_id, safe='.-_')}"
        try:
            data, content_type = fetch_bytes(url, accept="application/json")
            if "json" not in content_type and not data.lstrip().startswith(b"{"):
                raise RuntimeError(f"API returned unexpected content type: {content_type}")
            details = json.loads(data.decode("utf-8-sig"))
            card_details = details
            image_base = details.get("image")
            attempts.append({"api_id": api_id, "status": "metadata_found", "has_image": bool(image_base)})
            if not image_base:
                continue
            folder = output / "images" / "cards" / safe_part(language) / safe_part(sample["set_id"])
            image_result = download_asset(
                str(image_base), "card", folder / safe_part(api_id), force=force
            )
            attempts[-1]["image_status"] = image_result["status"]
            if image_result["path"]:
                selected_candidate = candidate
                break
        except AssetNotFound as exc:
            attempts.append({"api_id": api_id, "status": "not_found", "error": str(exc)})
        except Exception as exc:
            attempts.append({"api_id": api_id, "status": "error", "error": f"{type(exc).__name__}: {exc}"})
    else:
        selected_candidate = None
        image_result = {"status": "unavailable", "url": None, "path": None}

    # Download a set mark and logo when the card detail endpoint supplies them.
    set_data = (card_details or {}).get("set") or {}
    assets: dict[str, Any] = {}
    for asset_name in ("symbol", "logo"):
        asset_url = set_data.get(asset_name)
        if asset_url:
            digest = hashlib.sha256(str(asset_url).encode("utf-8")).hexdigest()[:16]
            asset_result = download_asset(
                str(asset_url),
                "set",
                output / "images" / "set-assets" / f"{digest}-{asset_name}",
                asset_language=language,
                force=force,
            )
            assets[asset_name] = {"source_url": asset_url, **asset_result}
        else:
            assets[asset_name] = {"source_url": None, "status": "missing_url", "path": None}

    result = dict(sample)
    result.update({
        "status": "available" if image_result.get("path") else "image_unavailable",
        "fetched_at_utc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "api_attempts": attempts,
        "selected_api_id": selected_candidate.get("api_id") if selected_candidate else None,
        "selected_local_id": selected_candidate.get("local_id") if selected_candidate else None,
        "selected_card_name": selected_candidate.get("card_name") if selected_candidate else None,
        "selected_category": selected_candidate.get("category") if selected_candidate else None,
        "image_base_url": (card_details or {}).get("image"),
        "card_image": image_result,
        "set_assets": assets,
        "api_card_name": (card_details or {}).get("name"),
        "api_set_id": set_data.get("id"),
        "api_set_name": set_data.get("name"),
        "layout_profile_hint": f"{language}:{sample.get('series_id') or sample.get('series_name') or 'unknown'}",
    })
    return result


def reuse_record(sample: dict[str, Any], old: dict[str, Any] | None) -> dict[str, Any] | None:
    if not old or old.get("sample_key") != sample.get("sample_key"):
        return None
    image = (old.get("card_image") or {}).get("path")
    reusable_available = old.get("status") == "available" and image and Path(image).is_file()
    reusable_unavailable = old.get("status") == "image_unavailable" and bool(old.get("api_attempts"))
    if reusable_available or reusable_unavailable:
        merged = dict(old)
        merged.update({key: sample[key] for key in sample if key not in {"sample_key"}})
        return merged
    return None


def make_contact_sheets(records: list[dict[str, Any]], output: Path, per_page: int = 20) -> int:
    try:
        from PIL import Image, ImageDraw, ImageFont, ImageOps
    except ImportError as exc:
        raise RuntimeError("Pillow is required to build contact sheets; install catalog image dependencies.") from exc

    by_language: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        image_path = (record.get("card_image") or {}).get("path")
        if record.get("status") == "available" and image_path and Path(image_path).is_file():
            by_language.setdefault(record["language"], []).append(record)

    columns, rows = 4, 5
    cell_w, cell_h = 230, 330
    sheet_count = 0
    for language, items in sorted(by_language.items()):
        font_names = {
            "en": ["arial.ttf"],
            "th": ["LeelawUI.ttf", "arial.ttf"],
            "ko": ["malgun.ttf", "arial.ttf"],
            "ja": ["YuGothM.ttc", "msgothic.ttc", "arial.ttf"],
            "zh-cn": ["msyh.ttc", "arial.ttf"],
            "zh-tw": ["msyh.ttc", "arial.ttf"],
        }.get(language, ["arial.ttf"])
        font = ImageFont.load_default()
        for font_name in font_names:
            font_path = Path("C:/Windows/Fonts") / font_name
            if font_path.is_file():
                try:
                    font = ImageFont.truetype(str(font_path), 14)
                    break
                except OSError:
                    continue
        items.sort(key=lambda item: (item.get("series_id") or "", item.get("series_name") or "", item.get("set_id") or "", item.get("selected_api_id") or ""))
        language_dir = output / "contact-sheets" / safe_part(language)
        language_dir.mkdir(parents=True, exist_ok=True)
        for page, start in enumerate(range(0, len(items), per_page), 1):
            sheet = Image.new("RGB", (columns * cell_w, rows * cell_h), "white")
            draw = ImageDraw.Draw(sheet)
            for offset, record in enumerate(items[start:start + per_page]):
                col, row = offset % columns, offset // columns
                x, y = col * cell_w, row * cell_h
                image_path = Path(record["card_image"]["path"])
                with Image.open(image_path) as source:
                    card = ImageOps.contain(source.convert("RGB"), (190, 258))
                px = x + (cell_w - card.width) // 2
                py = y + 30 + (258 - card.height) // 2
                sheet.paste(card, (px, py))
                label = f"{record['set_id']} / {record.get('selected_local_id') or record['local_id']}"
                draw.text((x + 6, y + 5), label[:34], fill="black", font=font)
                title = f"{record.get('selected_card_name') or record['card_name']} [{'+'.join(record['roles'])}]"
                draw.text((x + 6, y + 294), title[:34], fill="black", font=font)
                series = str(record.get("series_name") or "")
                draw.text((x + 6, y + 312), series[:34], fill="#555555", font=font)
            path = language_dir / f"page-{page:02d}.jpg"
            sheet.save(path, quality=88, optimize=True)
            sheet_count += 1
    return sheet_count


def make_set_asset_sheets(records: list[dict[str, Any]], output: Path, asset_name: str, per_page: int = 30) -> int:
    from PIL import Image, ImageDraw, ImageFont, ImageOps

    by_language: dict[str, dict[str, dict[str, Any]]] = {}
    for record in records:
        asset = (record.get("set_assets") or {}).get(asset_name) or {}
        image_path = asset.get("path")
        if image_path and Path(image_path).is_file():
            by_language.setdefault(record["language"], {}).setdefault(record["set_id"], record)

    font_names = {
        "en": "arial.ttf", "th": "LeelawUI.ttf", "ko": "malgun.ttf",
        "ja": "YuGothM.ttc", "zh-cn": "msyh.ttc", "zh-tw": "msyh.ttc",
    }
    columns, rows = 5, 6
    cell_w, cell_h = 190, 120
    sheet_count = 0
    for language, set_records in sorted(by_language.items()):
        font_path = Path("C:/Windows/Fonts") / font_names.get(language, "arial.ttf")
        try:
            font = ImageFont.truetype(str(font_path), 12) if font_path.is_file() else ImageFont.load_default()
        except OSError:
            font = ImageFont.load_default()
        items = sorted(set_records.values(), key=lambda item: (item.get("series_id") or "", item["set_id"]))
        language_dir = output / "contact-sheets" / safe_part(language)
        language_dir.mkdir(parents=True, exist_ok=True)
        for page, start in enumerate(range(0, len(items), per_page), 1):
            sheet = Image.new("RGB", (columns * cell_w, rows * cell_h), "white")
            draw = ImageDraw.Draw(sheet)
            for offset, record in enumerate(items[start:start + per_page]):
                col, row = offset % columns, offset // columns
                x, y = col * cell_w, row * cell_h
                asset = record["set_assets"][asset_name]
                with Image.open(asset["path"]) as source:
                    mark = ImageOps.contain(source.convert("RGBA"), (160, 78))
                px = x + (cell_w - mark.width) // 2
                py = y + 25 + (78 - mark.height) // 2
                sheet.paste(mark, (px, py), mark)
                label = f"{record['set_id']} | {record.get('set_name') or ''}"
                draw.text((x + 5, y + 5), label[:31], fill="black", font=font)
                draw.text((x + 5, y + 103), str(record.get("series_name") or "")[:30], fill="#555555", font=font)
            path = language_dir / f"{asset_name}-page-{page:02d}.jpg"
            sheet.save(path, quality=90, optimize=True)
            sheet_count += 1
    return sheet_count


def fill_missing_set_assets(records: list[dict[str, Any]], output: Path) -> None:
    for record in records:
        assets = record.get("set_assets") or {}
        for asset_name in ("symbol", "logo"):
            asset = assets.get(asset_name) or {}
            source_url = asset.get("source_url")
            current_path = asset.get("path")
            if not source_url or (current_path and Path(current_path).is_file()):
                continue
            digest = hashlib.sha256(str(source_url).encode("utf-8")).hexdigest()[:16]
            result = download_asset(
                str(source_url),
                "set",
                output / "images" / "set-assets" / f"{digest}-{asset_name}",
                asset_language=record["language"],
            )
            asset.update(result)
            assets[asset_name] = asset
        record["set_assets"] = assets


def summarize(records: list[dict[str, Any]], sheets: int | dict[str, int]) -> dict[str, Any]:
    by_language: dict[str, dict[str, int]] = {}
    for record in records:
        stats = by_language.setdefault(record["language"], {"samples": 0, "available": 0, "unavailable": 0})
        stats["samples"] += 1
        stats["available" if record.get("status") == "available" else "unavailable"] += 1
    sheet_breakdown = {"cards": sheets, "symbols": 0, "logos": 0} if isinstance(sheets, int) else dict(sheets)
    return {
        "schema_version": 1,
        "source": "TCGdex REST API, indexed from local catalog",
        "catalog_database": str(DATABASE.resolve()),
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "images_policy": "One anchor per localized set plus Trainer/Energy/special-Pokemon samples per localized series.",
        "layout_profiles_status": "reference-library-seeded; profiles require visual review",
        "summary": {
            "sample_records": len(records),
            "available_images": sum(record.get("status") == "available" for record in records),
            "unavailable_images": sum(record.get("status") != "available" for record in records),
            "contact_sheets": sum(sheet_breakdown.values()),
            "contact_sheet_breakdown": sheet_breakdown,
            "by_language": by_language,
        },
        "samples": records,
    }


def build_profile_suggestions(records: list[dict[str, Any]], output: Path) -> dict[str, Any]:
    groups: dict[str, dict[str, Any]] = {}
    for record in records:
        series_id = str(record.get("series_id") or "unknown")
        profile_id = f"{record['language']}:{series_id}"
        profile = groups.setdefault(profile_id, {
            "profile_id": profile_id,
            "language": record["language"],
            "series_id": record.get("series_id"),
            "series_name": record.get("series_name"),
            "set_ids": [],
            "sample_keys": [],
            "roles": [],
            "categories": [],
            "status": "needs_visual_review",
            "zones": {},
        })
        if record["set_id"] not in profile["set_ids"]:
            profile["set_ids"].append(record["set_id"])
        profile["sample_keys"].append(record["sample_key"])
        for role in record.get("roles", []):
            if role not in profile["roles"]:
                profile["roles"].append(role)
        category = str(record.get("category") or "unknown")
        if category not in profile["categories"]:
            profile["categories"].append(category)

    for profile in groups.values():
        profile["set_ids"].sort()
        profile["roles"].sort()
        profile["categories"].sort()
    payload = {
        "schema_version": 1,
        "generated_at_utc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "source_manifest": "manifest.json",
        "note": "Series IDs are grouping hints. Promote to a runtime layout profile only after reviewing card and set samples.",
        "profiles": groups,
    }
    write_json(output / "layout-profile-suggestions.json", payload)
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=DATABASE)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--languages", nargs="+", choices=LANGUAGES, default=list(LANGUAGES))
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--max-api-candidates", type=int, default=3,
                        help="Try this many ranked cards in the same set when the selected sample has no image.")
    parser.add_argument("--refresh", action="store_true", help="Refresh API metadata and re-download cached reference images.")
    parser.add_argument("--no-contact-sheets", action="store_true")
    args = parser.parse_args()
    if args.workers < 1 or args.workers > 8:
        parser.error("--workers must be between 1 and 8")
    if args.max_api_candidates < 1 or args.max_api_candidates > 5:
        parser.error("--max-api-candidates must be between 1 and 5")

    output = args.output.resolve()
    manifest_path = output / "manifest.json"
    old_payload = read_json(manifest_path) if not args.refresh else None
    old_records = {item.get("sample_key"): item for item in (old_payload or {}).get("samples", [])}
    plan = load_sample_plan(args.database.resolve(), args.languages)
    print(f"Selected {len(plan)} reference samples across {len(args.languages)} language(s).")

    results: dict[str, dict[str, Any]] = {}
    pending: list[dict[str, Any]] = []
    for sample in plan:
        reused = reuse_record(sample, old_records.get(sample["sample_key"]))
        if reused and not args.refresh:
            results[sample["sample_key"]] = reused
        else:
            pending.append(sample)
    print(f"Reusing {len(results)} cached records; fetching {len(pending)} samples.")

    if pending:
        output.mkdir(parents=True, exist_ok=True)
        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            futures = {
                executor.submit(retrieve_sample, sample, output, args.max_api_candidates, force=args.refresh): sample
                for sample in pending
            }
            completed = 0
            for future in as_completed(futures):
                sample = futures[future]
                try:
                    record = future.result()
                except Exception as exc:
                    record = dict(sample)
                    record.update({
                        "status": "error",
                        "fetched_at_utc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
                        "error": f"{type(exc).__name__}: {exc}",
                        "card_image": {"status": "error", "url": None, "path": None},
                    })
                results[sample["sample_key"]] = record
                completed += 1
                if completed % 25 == 0 or completed == len(pending):
                    interim = [results[key] for key in sorted(results)]
                    write_json(manifest_path, summarize(interim, 0))
                    print(f"Fetched {completed}/{len(pending)}; images available: {sum(x.get('status') == 'available' for x in interim)}")

    records = [results[sample["sample_key"]] for sample in plan]
    fill_missing_set_assets(records, output)
    sheet_count = {"cards": 0, "symbols": 0, "logos": 0}
    if not args.no_contact_sheets:
        sheet_count["cards"] = make_contact_sheets(records, output)
        sheet_count["symbols"] = make_set_asset_sheets(records, output, "symbol")
        sheet_count["logos"] = make_set_asset_sheets(records, output, "logo")
    payload = summarize(records, sheet_count)
    write_json(manifest_path, payload)
    suggestions = build_profile_suggestions(records, output)
    print(f"Reference images: {payload['summary']['available_images']}/{len(records)} available.")
    print(f"Contact sheets: {payload['summary']['contact_sheets']}; profile suggestions: {len(suggestions['profiles'])}; manifest: {manifest_path}")
    for language, stats in sorted(payload["summary"]["by_language"].items()):
        print(f"{language}: {stats['available']}/{stats['samples']} images")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Reference builder failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(2)
