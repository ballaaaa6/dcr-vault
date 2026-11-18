#!/usr/bin/env python3
"""Create a DCR 70 x 20 mm Pokémon tag from the read-only SVG masters."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image
    import zxingcpp
except ImportError as exc:  # pragma: no cover - exercised by user installation
    raise SystemExit(
        f"Missing package: {exc.name}. Install dependencies with: "
        "python -m pip install -r dcr-tag-70x20/requirements.txt"
    ) from exc


ROOT = Path(__file__).resolve().parent

from label_renderer import CONDITIONS, FRONT_TEXT_GAP_MM, FRONT_TEXT_SIZE_MM, render_label_svg_pair, sha256


def find_edge() -> Path:
    candidates = (
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    )
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise RuntimeError("Could not find Microsoft Edge or Google Chrome to render PNG previews")


def render_png(svg_path: Path, png_path: Path, browser: Path) -> None:
    # Render from a short temporary path because Chromium's Windows file URL
    # handling fails on deeply nested output paths, even when Python can write them.
    with tempfile.TemporaryDirectory(prefix="dcr-tag-render-") as render_dir:
        render_root = Path(render_dir)
        render_svg = render_root / "label.svg"
        wrapper = render_root / "render.html"
        rendered_png = render_root / "preview.png"
        shutil.copy2(svg_path, render_svg)
        wrapper.write_text(
            "<!doctype html><html><head><meta charset='utf-8'><style>"
            "*{box-sizing:border-box}html,body{margin:0;width:1400px;height:400px;overflow:hidden}"
            "img{display:block;width:1400px;height:400px}</style></head><body>"
            f"<img src='{html.escape(render_svg.name, quote=True)}'></body></html>",
            encoding="utf-8",
        )
        with tempfile.TemporaryDirectory(prefix="dcr-tag-edge-") as profile:
            cmd = [
                str(browser), "--headless=new", "--disable-gpu", "--no-first-run",
                "--disable-extensions", "--disable-background-networking", "--hide-scrollbars",
                "--force-device-scale-factor=1", "--window-size=1400,400",
                f"--user-data-dir={profile}", f"--screenshot={rendered_png}", wrapper.resolve().as_uri(),
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=90, check=False)
            if result.returncode != 0 or not rendered_png.is_file():
                raise RuntimeError(f"Browser PNG render failed: {result.stderr[-1500:]}")
        with rendered_png.open("rb") as image:
            header = image.read(24)
        if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
            raise RuntimeError(f"Renderer did not produce a valid PNG: {rendered_png}")
        width, height = int.from_bytes(header[16:20], "big"), int.from_bytes(header[20:24], "big")
        if (width, height) != (1400, 400):
            raise RuntimeError(f"Expected 1400 x 400 PNG, got {width} x {height}: {rendered_png}")
        shutil.copy2(rendered_png, png_path)


def verify_codes(front_png: Path, back_png: Path, serial: str, payload: str) -> None:
    decoded: dict[str, set[str]] = {"front": set(), "back": set()}
    for side, path in (("front", front_png), ("back", back_png)):
        for result in zxingcpp.read_barcodes(Image.open(path)):
            decoded[side].add(f"{result.format.name}:{result.text}")
    expected_barcode = f"Code128:{serial}"
    expected_qr = f"QRCode:{payload}"
    if expected_barcode not in decoded["front"]:
        raise RuntimeError(f"Front Code 128 did not decode to {serial}: {sorted(decoded['front'])}")
    if expected_barcode not in decoded["back"]:
        raise RuntimeError(f"Back Code 128 did not decode to {serial}: {sorted(decoded['back'])}")
    if expected_qr not in decoded["back"]:
        raise RuntimeError(f"Back QR did not decode to {payload}: {sorted(decoded['back'])}")


def random_serial() -> str:
    records = "\n".join(p.read_text(encoding="utf-8", errors="ignore") for p in (ROOT / "outputs").glob("**/card-record.md"))
    for _ in range(1000):
        value = f"{secrets.randbelow(90_000_000) + 10_000_000:08d}"
        if value not in records:
            return value
    raise RuntimeError("Could not allocate a unique mockup serial")


def safe_slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    if not slug:
        raise ValueError("card.slug must contain letters or numbers")
    if len(slug) > 55:
        suffix = hashlib.sha256(slug.encode("utf-8")).hexdigest()[:10]
        slug = f"{slug[:44].rstrip('-')}-{suffix}"
    return slug


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--card-json", required=True, type=Path, help="Verified card facts in JSON")
    parser.add_argument("--mode", choices=("mockup",), default="mockup", help="Mockup mode uses random test grade/serial/QR values")
    parser.add_argument("--output-root", type=Path, default=ROOT / "outputs")
    parser.add_argument(
        "--front-serial-alignment",
        choices=("template", "centered"),
        default="template",
        help="Keep the master front serial baseline or center its visible ink in the barcode band",
    )
    parser.add_argument(
        "--mockup-serial",
        help="Use a fixed 8-digit test serial instead of a random one (useful for visual comparisons)",
    )
    parser.add_argument(
        "--mockup-condition",
        choices=CONDITIONS,
        help="Use a fixed mockup condition instead of a random one (useful for visual comparisons)",
    )
    args = parser.parse_args()

    data = json.loads(args.card_json.read_text(encoding="utf-8"))
    required = ("slug", "name", "year_series", "display_number", "full_number", "collection", "rarity", "language", "finish_note", "sources")
    missing = [key for key in required if not data.get(key)]
    if missing:
        raise ValueError(f"Missing card JSON fields: {', '.join(missing)}")
    canonical_name = str(data["name"]).strip()
    display_name = str(data.get("display_name") or canonical_name).strip().upper()

    slug = safe_slug(data["slug"])
    out = args.output_root.resolve() / f"{slug}-dcr-tag"
    if out.exists():
        raise FileExistsError(f"Output folder already exists and will not be overwritten: {out}")
    master_front = ROOT / "source" / "dcr-tag-front.svg"
    master_back = ROOT / "source" / "dcr-tag-back.svg"
    master_hashes = {master_front: sha256(master_front), master_back: sha256(master_back)}

    if args.mockup_serial is not None and not re.fullmatch(r"\d{8}", args.mockup_serial):
        raise ValueError("--mockup-serial must be exactly 8 digits")
    serial = args.mockup_serial or random_serial()
    condition = args.mockup_condition or secrets.choice(CONDITIONS)
    payload = f"DCR-TEST:{serial}"
    rendered = render_label_svg_pair(data, serial, condition, args.front_serial_alignment)
    front_bounds = rendered.front_bounds
    back_bounds = rendered.back_bounds
    qr_bounds = rendered.qr_bounds
    qr_box = rendered.qr_box
    qr_box = rendered.qr_box
    serial_baseline_change = rendered.serial_baseline_change


    browser = find_edge()
    out.mkdir(parents=True, exist_ok=False)
    front_path = out / f"{slug}-dcr-tag-front.svg"
    back_path = out / f"{slug}-dcr-tag-back.svg"
    front_path.write_bytes(rendered.front_svg)
    back_path.write_bytes(rendered.back_svg)
    front_png = out / f"{slug}-dcr-tag-front.png"
    back_png = out / f"{slug}-dcr-tag-back.png"
    render_png(front_path, front_png, browser)
    render_png(back_path, back_png, browser)
    verify_codes(front_png, back_png, serial, payload)

    source_lines = "\n".join(f"- {source}" for source in data["sources"])
    display_name_kind = data.get("display_name_kind", "canonical")
    psa_label = data.get("psa_label_profile")
    if display_name_kind == "psa_subject" and psa_label:
        display_name_note = (
            f" (PSA Subject; {psa_label.get('subject_status', 'draft')}; "
            f"{psa_label.get('subject_source', 'source not recorded')})"
        )
    elif display_name_kind == "approved_alias":
        display_name_note = " (approved display alias)"
    else:
        display_name_note = ""

    psa_profile_record = ""
    if isinstance(psa_label, dict):
        psa_evidence_lines = "\n".join(
            f"  - {item.get('kind', 'Source')}: {item['url']}"
            + (
                f" (fields: {', '.join(item['fields'])})"
                if isinstance(item.get("fields"), list) and item["fields"]
                else ""
            )
            for item in psa_label.get("evidence", [])
            if isinstance(item, dict) and item.get("url")
        )
        psa_profile_record = f"""- PSA label profile: {psa_label.get('profile_id', 'unknown')} — {psa_label.get('status', 'draft')} (set profile: {psa_label.get('profile_status', 'unknown')})
- PSA Brand/Title: {psa_label.get('brand_title', 'not recorded')}
- PSA Subject: {psa_label.get('subject', display_name)} — {psa_label.get('subject_status', 'draft')}
- PSA Variety/Pedigree: {psa_label.get('variety_pedigree') or 'not mapped'} — {psa_label.get('variety_status', 'draft')}
- Label evidence:
{psa_evidence_lines}
"""
    record = f"""# {data['name']} — {data['collection']}\n
- Language: {data['language']}
- Year / era: {data['year_series']}
- Set: {data['collection']}
- Full catalog card name: {canonical_name}
- Card name displayed on front: {display_name}{display_name_note}
- Collector number: {data['full_number']} (tag displays `{data['display_number']}`)
- Front text font size: {FRONT_TEXT_SIZE_MM:.3f} mm for all seven front fields; left-to-right fields keep at least {FRONT_TEXT_GAP_MM:.2f} mm clearance.
- Catalog rarity: {data['rarity_name']} (tag code `{data['rarity']}`)
- Finish: {data['finish_note']}
- DCR condition: `{condition}` — {'fixed for repeatable visual comparison' if args.mockup_condition else 'randomly selected'} mockup value, not an assessment or PSA grade.
- DCR serial: `{serial}` — {'fixed for repeatable visual comparison' if args.mockup_serial else 'randomly generated'} mockup data, not registered.
- Front serial alignment: {'visible digit ink centered in the barcode band' if serial_baseline_change else 'master-template baseline'}.
- Code 128: encodes `{serial}` on front and back.
- QR payload: `{payload}` — test-only, not linked to a collection registry.
- Geometry: Code 128 ink bounds were replaced in the source placeholder bounds; QR active artwork retains the master bounds `{qr_bounds}`. The QR white backing remains at `{qr_box}` from the master. Master back artwork is unchanged.
- Template source hashes unchanged: `{master_hashes[master_front]}`, `{master_hashes[master_back]}`.

{psa_profile_record}

Sources:
{source_lines}
"""
    (out / "card-record.md").write_text(record, encoding="utf-8")

    for path, digest in master_hashes.items():
        if sha256(path) != digest:
            raise RuntimeError(f"Master SVG unexpectedly changed: {path}")
    print(f"Created {out}")
    print(f"Condition: {condition} (mockup); serial: {serial}; QR: {payload}")
    print(f"Front Code 128 bounds: {front_bounds}; back Code 128 bounds: {back_bounds}")
    if serial_baseline_change:
        print(
            f"Front serial baseline: {serial_baseline_change[0]:.3f} mm -> "
            f"{serial_baseline_change[1]:.3f} mm (visible ink centered in barcode band)"
        )
    print(f"QR active artwork bounds: {qr_bounds}; output white field: {qr_box}")
    print(f"Rendered with {browser.name} at 1400 x 400 px; QR and both Code 128 symbols decoded successfully")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, RuntimeError, OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
