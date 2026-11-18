#!/usr/bin/env python3
"""Render a DCR tag pair in memory from the approved front/back SVG masters."""
from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass
from pathlib import Path

try:
    import qrcode
    from barcode import Code128
    from lxml import etree
    from PIL import ImageFont
    from qrcode.constants import ERROR_CORRECT_M
except ImportError as exc:  # pragma: no cover - exercised by user installation
    raise SystemExit(
        f"Missing package: {exc.name}. Install dependencies with: "
        "python -m pip install -r dcr-tag-70x20/requirements.txt"
    ) from exc

ROOT = Path(__file__).resolve().parent
SVG_NS = "http://www.w3.org/2000/svg"
NS = {"svg": SVG_NS}
CONDITIONS = (
    "GEM MT", "MINT", "NM-MT+", "NM-MT", "NM+", "NM", "EX-MT+", "EX-MT",
    "EX+", "EX", "VG-EX+", "VG-EX", "VG+", "VG", "GOOD+", "GOOD", "FR", "PR",
)
BLACK = "#101010"
FRONT_TEXT_SIZE_MM = 2.57
FRONT_TEXT_GAP_MM = 0.5
FRONT_TEXT_IDS = (
    "front-year-series", "front-card-number", "front-card-name", "front-condition",
    "front-collection", "front-rarity", "front-serial",
)

def tag(name: str) -> str:
    return f"{{{SVG_NS}}}{name}"

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def one_by_id(tree: etree._ElementTree, element_id: str) -> etree._Element:
    matches = tree.xpath('//*[@id=$element_id]', element_id=element_id)
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one SVG element id={element_id!r}; got {len(matches)}")
    return matches[0]

def set_text(tree: etree._ElementTree, element_id: str, value: str) -> None:
    element = one_by_id(tree, element_id)
    if etree.QName(element).localname != "text":
        raise ValueError(f"SVG id={element_id!r} is not a text element")
    if len(element):
        raise ValueError(f"SVG text id={element_id!r} unexpectedly contains child elements")
    element.text = value

def validate_front_font_sizes(tree: etree._ElementTree) -> None:
    """Require the approved, uniform front typography from the master SVG."""
    for element_id in FRONT_TEXT_IDS:
        element = one_by_id(tree, element_id)
        raw_size = element.get("font-size")
        size = float(raw_size) if raw_size is not None else math.nan
        if not math.isfinite(size) or abs(size - FRONT_TEXT_SIZE_MM) > 0.0005:
            raise ValueError(
                f"Front template typography mismatch: {element_id!r} is {size:.3f} mm; "
                f"all front text must be {FRONT_TEXT_SIZE_MM:.2f} mm."
            )
        if element.get("font-weight") != "400" or element.get("letter-spacing") != "normal":
            raise ValueError(
                f"Front template typography mismatch: {element_id!r} must keep "
                'font-weight="400" and letter-spacing="normal".'
            )

def preflight_front_text(
    tree: etree._ElementTree,
    element_id: str,
    right_element_id: str,
    value: str,
    gap_mm: float = FRONT_TEXT_GAP_MM,
    canonical_value: str | None = None,
) -> float:
    """Preflight a left field at the fixed front size without silently shrinking it."""
    element = one_by_id(tree, element_id)
    right = one_by_id(tree, right_element_id)
    if etree.QName(element).localname != "text" or etree.QName(right).localname != "text":
        raise ValueError("Text fitting requires two SVG text elements")
    if element.get("text-anchor", "start") != "start" or right.get("text-anchor") != "end":
        raise ValueError(f"Unexpected text anchors for {element_id!r} and {right_element_id!r}")

    element.text = value
    font_paths = (
        Path(r"C:\Windows\Fonts\arial.ttf"),
        Path("/usr/share/fonts/truetype/msttcorefonts/Arial.ttf"),
        Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"),
    )
    font_path = next((path for path in font_paths if path.is_file()), None)
    if font_path is None:
        raise RuntimeError("Could not find Arial-compatible font to fit complete label text")

    def font_at(size_mm: float) -> ImageFont.FreeTypeFont:
        return ImageFont.truetype(str(font_path), max(1, round(size_mm * 20)))

    base_size = float(element.get("font-size"))
    right_size = float(right.get("font-size"))
    if abs(base_size - FRONT_TEXT_SIZE_MM) > 0.0005 or abs(right_size - FRONT_TEXT_SIZE_MM) > 0.0005:
        raise ValueError(
            f"Front template typography mismatch for {element_id!r}/{right_element_id!r}; "
            f"both fields must be {FRONT_TEXT_SIZE_MM:.2f} mm."
        )
    px_per_mm = 20.0  # 1400 px rendered across the 70 mm SVG width.
    fixed_font = font_at(FRONT_TEXT_SIZE_MM)
    right_width_mm = fixed_font.getlength(right.text or "") / px_per_mm
    max_width_mm = float(right.get("x")) - float(element.get("x")) - right_width_mm - gap_mm
    if max_width_mm <= 0:
        raise ValueError(f"No horizontal room remains for {element_id!r}")

    width_mm = fixed_font.getlength(value) / px_per_mm
    if width_mm > max_width_mm:
        if element_id == "front-card-name":
            remediation = (
                "Add a reviewed display_name_overrides entry for this stable card ID; "
                "the full canonical name stays in label-input.json and card-record.md."
            )
        else:
            remediation = "Keep the complete text and review its approved catalog mapping."
        full_note = (
            f"; full catalog name is {canonical_value!r}"
            if canonical_value and canonical_value != value else ""
        )
        raise ValueError(
            f"FRONT_LAYOUT_BLOCKED: {element_id!r} text {value!r}{full_note} needs "
            f"{width_mm:.3f} mm, but only {max_width_mm:.3f} mm is available at fixed "
            f"{FRONT_TEXT_SIZE_MM:.2f} mm text size with a {gap_mm:.2f} mm safety gap "
            f"before {right_element_id!r}. {remediation}"
        )
    return FRONT_TEXT_SIZE_MM

def center_text_baseline_in_band(
    element: etree._Element,
    band_y: float,
    band_height: float,
) -> tuple[float, float]:
    """Set an SVG text baseline so the rendered glyph ink centers in a band."""
    text = element.text or ""
    if not text:
        raise ValueError("Cannot center an empty serial")
    font_paths = (
        Path(r"C:\Windows\Fonts\arial.ttf"),
        Path("/usr/share/fonts/truetype/msttcorefonts/Arial.ttf"),
        Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"),
    )
    font_path = next((path for path in font_paths if path.is_file()), None)
    if font_path is None:
        raise RuntimeError("Could not find Arial-compatible font to center the front serial")

    px_per_mm = 20.0  # The renderer produces 1400 px across the 70 mm tag.
    font_size = float(element.get("font-size"))
    font = ImageFont.truetype(str(font_path), max(1, round(font_size * px_per_mm)))
    # SVG y is the text baseline; PIL's "ls" anchor reports visible glyph ink
    # relative to that baseline. Center the ink bounds, not the font line box.
    ink_bbox = font.getbbox(text, anchor="ls")
    ink_center_from_baseline_px = (ink_bbox[1] + ink_bbox[3]) / 2
    old_baseline = float(element.get("y"))
    target_center_mm = band_y + band_height / 2
    new_baseline = target_center_mm - ink_center_from_baseline_px / px_per_mm
    element.set("y", f"{new_baseline:.3f}")
    return old_baseline, new_baseline

def rect_bounds(rects: list[etree._Element]) -> tuple[float, float, float, float]:
    if not rects:
        raise ValueError("Cannot determine geometry from an empty placeholder")
    xs, ys, x2s, y2s = [], [], [], []
    for rect in rects:
        x, y = float(rect.get("x")), float(rect.get("y"))
        w, h = float(rect.get("width")), float(rect.get("height"))
        xs.append(x)
        ys.append(y)
        x2s.append(x + w)
        y2s.append(y + h)
    return min(xs), min(ys), max(x2s), max(y2s)

def code128_pattern(value: str) -> str:
    pattern = Code128(value).build()[0]
    if not pattern or set(pattern) - {"0", "1"}:
        raise ValueError("Code 128 encoder returned an invalid bar pattern")
    return pattern

def add_code128(
    parent: etree._Element,
    pattern: str,
    x: float,
    y: float,
    width: float,
    height: float,
) -> None:
    """Draw bars scaled to the placeholder's exact ink bounds."""
    module = width / len(pattern)
    i = 0
    while i < len(pattern):
        if pattern[i] == "0":
            i += 1
            continue
        j = i + 1
        while j < len(pattern) and pattern[j] == "1":
            j += 1
        etree.SubElement(
            parent,
            tag("rect"),
            x=f"{x + i * module:.6f}",
            y=f"{y:.6f}",
            width=f"{(j - i) * module:.6f}",
            height=f"{height:.6f}",
            fill=BLACK,
        )
        i = j

def front_barcode(tree: etree._ElementTree, pattern: str) -> tuple[float, float, float, float]:
    group = one_by_id(tree, "front-barcode-placeholder")
    rects = [child for child in group if etree.QName(child).localname == "rect"]
    bounds = rect_bounds(rects)
    if len(rects) < 20 or abs(bounds[1] - 13.5) > 0.001 or abs((bounds[3] - bounds[1]) - 3.05) > 0.001:
        raise ValueError(f"Front barcode placeholder geometry changed: bars={len(rects)}, bounds={bounds}")
    for child in list(group):
        group.remove(child)
    group.set("aria-label", "Code 128 DCR test serial")
    add_code128(group, pattern, bounds[0], bounds[1], bounds[2] - bounds[0], bounds[3] - bounds[1])
    return bounds

def back_barcode(tree: etree._ElementTree, pattern: str) -> tuple[float, float, float, float]:
    serial = one_by_id(tree, "back-serial")
    bars = []
    for rect in tree.xpath('//svg:rect[@fill="#101010"]', namespaces=NS):
        try:
            x, y = float(rect.get("x")), float(rect.get("y"))
            if abs(y - 16.725) < 0.001 and 3.6 <= x <= 22.5:
                bars.append(rect)
        except (TypeError, ValueError):
            continue
    bounds = rect_bounds(bars)
    if len(bars) < 20 or abs(bounds[1] - 16.725) > 0.001 or abs((bounds[3] - bounds[1]) - 2.8) > 0.001:
        raise ValueError(f"Back barcode placeholder geometry changed: bars={len(bars)}, bounds={bounds}")
    parent = bars[0].getparent()
    for rect in bars:
        rect.getparent().remove(rect)
    group = etree.Element(tag("g"), id="back-barcode-test", attrib={"aria-label": "Code 128 DCR test serial"})
    serial.addprevious(group)
    add_code128(group, pattern, bounds[0], bounds[1], bounds[2] - bounds[0], bounds[3] - bounds[1])
    return bounds

def make_qr(tree: etree._ElementTree, payload: str) -> tuple[tuple[float, float, float, float], tuple[float, float, float, float]]:
    group = one_by_id(tree, "qr-visual-placeholder")
    rects = [node for node in group.iter() if etree.QName(node).localname == "rect"]
    active = rect_bounds(rects)
    active_w, active_h = active[2] - active[0], active[3] - active[1]
    if abs(active_w - 11.881) > 0.01 or abs(active_h - 11.881) > 0.01:
        raise ValueError(f"Master QR artwork bounds changed: {active}")

    qr = qrcode.QRCode(version=1, error_correction=ERROR_CORRECT_M, border=0, box_size=1)
    qr.add_data(payload, optimize=0)
    qr.make(fit=True)
    matrix = qr.get_matrix()
    if len(matrix) != 21:
        raise ValueError(f"QR payload requires version {((len(matrix) - 17) // 4)}; expected version 1")

    # Preserve the actual black-art bounds and center measured from the approved master.
    module = active_w / len(matrix)
    for child in list(group):
        group.remove(child)
    group.set("fill", BLACK)
    group.set("aria-label", f"QR test payload {payload}")
    for row, values in enumerate(matrix):
        for col, dark in enumerate(values):
            if dark:
                etree.SubElement(
                    group,
                    tag("rect"),
                    x=f"{active[0] + col * module:.6f}",
                    y=f"{active[1] + row * module:.6f}",
                    width=f"{module:.6f}",
                    height=f"{module:.6f}",
                )

    backing = None
    parent = group.getparent()
    for sibling in parent:
        if etree.QName(sibling).localname != "rect":
            continue
        try:
            if (
                abs(float(sibling.get("x")) - 50.55) < 0.001
                and abs(float(sibling.get("y")) - 1.35) < 0.001
                and abs(float(sibling.get("width")) - 13.3) < 0.001
                and abs(float(sibling.get("height")) - 13.3) < 0.001
                and sibling.get("fill") == "#FFFFFF"
            ):
                backing = sibling
                break
        except (TypeError, ValueError):
            continue
    if backing is None:
        raise ValueError("Could not find the QR white backing rectangle in the master")

    box = tuple(float(backing.get(key)) for key in ("x", "y")) + (
        float(backing.get("x")) + float(backing.get("width")),
        float(backing.get("y")) + float(backing.get("height")),
    )
    expected_box = (50.55, 1.35, 63.85, 14.65)
    if any(abs(actual - expected) > 0.001 for actual, expected in zip(box, expected_box)):
        raise ValueError(f"Master QR backing geometry changed: {box}; expected {expected_box}")
    # Preserve the QR white backing from the master exactly. Do not resize it
    # to force a quiet zone; scan the rendered output and report failures.
    return active, box

@dataclass(frozen=True)
class RenderedLabel:
    front_svg: bytes
    back_svg: bytes
    front_bounds: tuple[float, float, float, float]
    back_bounds: tuple[float, float, float, float]
    qr_bounds: tuple[float, float, float, float]
    qr_box: tuple[float, float, float, float]
    serial_baseline_change: tuple[float, float] | None


def render_label_svg_pair(
    data: dict,
    serial: str,
    condition: str,
    front_serial_alignment: str = "template",
) -> RenderedLabel:
    """Fill both approved SVG templates and return the complete SVG bytes without writing per-label files."""
    required = ("name", "year_series", "display_number", "collection", "rarity")
    missing = [key for key in required if not data.get(key)]
    if missing:
        raise ValueError(f"Missing fields required by tag SVG templates: {', '.join(missing)}")
    if len(serial) != 8 or not serial.isdigit():
        raise ValueError("Mockup serial must be exactly 8 digits")
    if condition not in CONDITIONS:
        raise ValueError(f"Unknown mockup condition: {condition!r}")
    if front_serial_alignment not in {"template", "centered"}:
        raise ValueError(f"Unknown front serial alignment: {front_serial_alignment!r}")

    master_front = ROOT / "source" / "dcr-tag-front.svg"
    master_back = ROOT / "source" / "dcr-tag-back.svg"
    pattern = code128_pattern(serial)
    front = etree.parse(str(master_front), etree.XMLParser(remove_blank_text=False))
    validate_front_font_sizes(front)
    canonical_name = str(data["name"]).strip()
    display_name_value = data.get("display_name")
    display_name = str(display_name_value).strip() if display_name_value is not None else canonical_name
    if not display_name:
        raise ValueError("The front card display name must not be empty")
    display_name = display_name.upper()
    set_text(front, "front-year-series", str(data["year_series"]))
    set_text(front, "front-card-number", str(data["display_number"]))
    set_text(front, "front-card-name", display_name)
    set_text(front, "front-condition", condition)
    set_text(front, "front-collection", str(data["collection"]).upper())
    set_text(front, "front-rarity", str(data["rarity"]))
    set_text(front, "front-serial", serial)
    preflight_front_text(front, "front-year-series", "front-card-number", str(data["year_series"]))
    preflight_front_text(
        front, "front-card-name", "front-condition", display_name,
        canonical_value=canonical_name.upper(),
    )
    preflight_front_text(front, "front-collection", "front-rarity", str(data["collection"]).upper())
    front_bounds = front_barcode(front, pattern)
    serial_baseline_change = None
    if front_serial_alignment == "centered":
        serial_baseline_change = center_text_baseline_in_band(
            one_by_id(front, "front-serial"), front_bounds[1], front_bounds[3] - front_bounds[1]
        )

    back = etree.parse(str(master_back), etree.XMLParser(remove_blank_text=False))
    set_text(back, "back-serial", serial)
    back_bounds = back_barcode(back, pattern)
    qr_bounds, qr_box = make_qr(back, f"DCR-TEST:{serial}")
    return RenderedLabel(
        front_svg=etree.tostring(front.getroot(), encoding="UTF-8", xml_declaration=False),
        back_svg=etree.tostring(back.getroot(), encoding="UTF-8", xml_declaration=False),
        front_bounds=front_bounds,
        back_bounds=back_bounds,
        qr_bounds=qr_bounds,
        qr_box=qr_box,
        serial_baseline_change=serial_baseline_change,
    )
