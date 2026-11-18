#!/usr/bin/env python3
"""Build a portrait A4 sheet of 40 approved DCR tag label pairs."""

from __future__ import annotations

import argparse
import base64
import copy
import csv
import hashlib
import json
import os
import re
import shutil
import sys
import subprocess
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

import zxingcpp
from PIL import Image, ImageDraw
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from label_renderer import CONDITIONS, render_label_svg_pair

PACKAGE_ROOT = Path(__file__).resolve().parent
DEFAULT_TEMPLATE = PACKAGE_ROOT / "source" / "a4-40up-portrait.svg"

SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", XLINK_NS)

EXPECTED_ROWS = 4
EXPECTED_COLUMNS = 10
PNG_SIZE = (1400, 400)
MOCKUP_QR_PREFIX = "DCR-TEST:"


class BuildError(Exception):
    """Raised for invalid inputs or layout definitions."""


@dataclass(frozen=True)
class SheetSpec:
    page_width_mm: float
    page_height_mm: float
    rows: int
    columns: int
    margin_left_mm: float
    margin_right_mm: float
    margin_top_mm: float
    margin_bottom_mm: float
    cell_width_mm: float
    cell_height_mm: float
    label_width_mm: float
    label_height_mm: float
    source_png_width_px: int
    source_png_height_px: int
    rotation_deg: float
    duplex_flip: str
    cut_guides: str
    guide_length_mm: float
    guide_outer_width_mm: float
    guide_internal_width_mm: float
    guide_color: str
    source_resolution_dpi: int


@dataclass(frozen=True)
class Slot:
    row: int
    col: int
    x_mm: float
    y_mm: float
    width_mm: float
    height_mm: float


@dataclass(frozen=True)
class GuideSegment:
    guide_id: str
    axis: str
    boundary: str
    x1_mm: float
    y1_mm: float
    x2_mm: float
    y2_mm: float
    width_mm: float


@dataclass(frozen=True)
class CardAsset:
    record: dict[str, str]
    label_dir: Path
    front_png: Path
    back_png: Path
    front_svg: Path
    back_svg: Path


@dataclass(frozen=True)
class DirectCard:
    record: dict[str, Any]
    data: dict[str, Any]
    rendered: Any


def close(a: float, b: float, tolerance: float = 0.001) -> bool:
    return abs(a - b) <= tolerance


def number_attr(element: ET.Element, name: str) -> float:
    try:
        return float(element.attrib[name])
    except (KeyError, ValueError) as exc:
        raise BuildError(f"SVG element is missing a valid {name} attribute") from exc


def mm_text(value: float) -> str:
    return f"{value:.3f}".rstrip("0").rstrip(".")


def guide_segments(spec: SheetSpec) -> list[GuideSegment]:
    """Return short external ticks at every vertical and horizontal cut boundary."""
    segments: list[GuideSegment] = []
    left = spec.margin_left_mm
    right = spec.page_width_mm - spec.margin_right_mm
    top = spec.margin_top_mm
    bottom = spec.page_height_mm - spec.margin_bottom_mm
    half_length = spec.guide_length_mm

    for index in range(spec.columns + 1):
        x = left + index * spec.cell_width_mm
        boundary = "outer" if index in (0, spec.columns) else "internal"
        width = spec.guide_outer_width_mm if boundary == "outer" else spec.guide_internal_width_mm
        half_width = width / 2
        segments.extend(
            (
                GuideSegment(
                    f"vertical-{index + 1:02d}-top",
                    "vertical",
                    boundary,
                    x,
                    top - half_length,
                    x,
                    top - half_width,
                    width,
                ),
                GuideSegment(
                    f"vertical-{index + 1:02d}-bottom",
                    "vertical",
                    boundary,
                    x,
                    bottom + half_width,
                    x,
                    bottom + half_length,
                    width,
                ),
            )
        )

    for index in range(spec.rows + 1):
        y = top + index * spec.cell_height_mm
        boundary = "outer" if index in (0, spec.rows) else "internal"
        width = spec.guide_outer_width_mm if boundary == "outer" else spec.guide_internal_width_mm
        half_width = width / 2
        segments.extend(
            (
                GuideSegment(
                    f"horizontal-{index + 1:02d}-left",
                    "horizontal",
                    boundary,
                    left - half_length,
                    y,
                    left - half_width,
                    y,
                    width,
                ),
                GuideSegment(
                    f"horizontal-{index + 1:02d}-right",
                    "horizontal",
                    boundary,
                    right + half_width,
                    y,
                    right + half_length,
                    y,
                    width,
                ),
            )
        )
    return segments


def validate_template_guide_layer(root: ET.Element, guide_group: ET.Element, spec: SheetSpec) -> None:
    expected = {segment.guide_id: segment for segment in guide_segments(spec)}
    actual_ids: set[str] = set()
    layer_nodes = list(guide_group)
    for node in layer_nodes:
        if node.tag != f"{{{SVG_NS}}}line":
            raise BuildError("The cut-guides layer may contain only line marks")
        guide_id = node.get("data-guide-id", "")
        segment = expected.get(guide_id)
        if segment is None or guide_id in actual_ids:
            raise BuildError(f"Unknown or repeated cut-guide mark: {guide_id!r}")
        actual_ids.add(guide_id)
        coordinates = (
            number_attr(node, "x1"),
            number_attr(node, "y1"),
            number_attr(node, "x2"),
            number_attr(node, "y2"),
            number_attr(node, "stroke-width"),
        )
        expected_coordinates = (
            segment.x1_mm,
            segment.y1_mm,
            segment.x2_mm,
            segment.y2_mm,
            segment.width_mm,
        )
        if any(not close(actual, target) for actual, target in zip(coordinates, expected_coordinates)):
            raise BuildError(f"Cut-guide geometry disagrees with sheet settings: {guide_id}")
        if node.get("data-axis") != segment.axis or node.get("data-boundary") != segment.boundary:
            raise BuildError(f"Cut-guide classification disagrees with sheet settings: {guide_id}")
        if node.get("stroke") != spec.guide_color or node.get("stroke-linecap") != "butt":
            raise BuildError(f"Cut-guide style disagrees with sheet settings: {guide_id}")

    if actual_ids != set(expected):
        missing = sorted(set(expected) - actual_ids)
        extra = sorted(actual_ids - set(expected))
        raise BuildError(f"Template cut-guide layer is incomplete; missing={missing}, extra={extra}")

    layer_node_ids = {id(node) for node in layer_nodes}
    outside_lines = [
        node
        for node in root.iter(f"{{{SVG_NS}}}line")
        if id(node) not in layer_node_ids
    ]
    if outside_lines or any(node.tag == f"{{{SVG_NS}}}polyline" for node in root.iter()):
        raise BuildError("Divider lines are allowed only as external marks in the cut-guides layer")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_cli_path(path: Path) -> Path:
    return path.expanduser().resolve()


def load_template(template_path: Path) -> tuple[ET.Element, SheetSpec, dict[tuple[int, int], Slot]]:
    if not template_path.is_file():
        raise BuildError(f"Template SVG does not exist: {template_path}")

    try:
        root = ET.parse(template_path).getroot()
    except ET.ParseError as exc:
        raise BuildError(f"Could not parse template SVG: {exc}") from exc

    if root.tag != f"{{{SVG_NS}}}svg":
        raise BuildError("Template root must be an SVG element")

    metadata = next(
        (node for node in root if node.tag == f"{{{SVG_NS}}}metadata" and node.get("id") == "sheet-spec"),
        None,
    )
    if metadata is None:
        raise BuildError("Template SVG has no sheet-spec metadata")

    try:
        spec = SheetSpec(
            page_width_mm=float(metadata.attrib["page-width-mm"]),
            page_height_mm=float(metadata.attrib["page-height-mm"]),
            rows=int(metadata.attrib["rows"]),
            columns=int(metadata.attrib["columns"]),
            margin_left_mm=float(metadata.attrib["margin-left-mm"]),
            margin_right_mm=float(metadata.attrib["margin-right-mm"]),
            margin_top_mm=float(metadata.attrib["margin-top-mm"]),
            margin_bottom_mm=float(metadata.attrib["margin-bottom-mm"]),
            cell_width_mm=float(metadata.attrib["cell-width-mm"]),
            cell_height_mm=float(metadata.attrib["cell-height-mm"]),
            label_width_mm=float(metadata.attrib["source-label-width-mm"]),
            label_height_mm=float(metadata.attrib["source-label-height-mm"]),
            source_png_width_px=int(metadata.attrib["source-png-width-px"]),
            source_png_height_px=int(metadata.attrib["source-png-height-px"]),
            rotation_deg=float(metadata.attrib["rotation-deg"]),
            duplex_flip=metadata.attrib["duplex-flip"],
            cut_guides=metadata.attrib["cut-guides"],
            guide_length_mm=float(metadata.attrib["guide-length-mm"]),
            guide_outer_width_mm=float(metadata.attrib["guide-outer-width-mm"]),
            guide_internal_width_mm=float(metadata.attrib["guide-internal-width-mm"]),
            guide_color=metadata.attrib["guide-color"],
            source_resolution_dpi=int(metadata.attrib["source-resolution-dpi"]),
        )
    except (KeyError, ValueError) as exc:
        raise BuildError(f"Invalid sheet-spec metadata: {exc}") from exc

    expected = {
        "page": (spec.page_width_mm, spec.page_height_mm, 210.0, 297.0),
        "grid": (spec.rows, spec.columns, EXPECTED_ROWS, EXPECTED_COLUMNS),
        "cells": (spec.cell_width_mm, spec.cell_height_mm, 20.0, 70.0),
        "source label": (spec.label_width_mm, spec.label_height_mm, 70.0, 20.0),
        "source PNG": (spec.source_png_width_px, spec.source_png_height_px, *PNG_SIZE),
    }
    for name, values in expected.items():
        if name in ("grid", "source PNG"):
            matches = values[:2] == values[2:]
        else:
            matches = close(float(values[0]), float(values[2])) and close(
                float(values[1]), float(values[3])
            )
        if not matches:
            raise BuildError(f"Template {name} dimensions do not match the approved 40-up profile")

    if spec.duplex_flip != "long-edge":
        raise BuildError("This builder supports the approved portrait long-edge duplex layout only")
    if spec.cut_guides != "external-registration-ticks":
        raise BuildError("The approved sheet template must use external registration ticks")
    if not close(spec.guide_length_mm, 4.0):
        raise BuildError("External registration ticks must be 4 mm long")
    if not close(spec.guide_outer_width_mm, 0.15) or not close(spec.guide_internal_width_mm, 0.30):
        raise BuildError("Guide weights must be 0.15 mm at outer edges and 0.30 mm at internal cuts")
    if not (spec.guide_color.startswith("#") and len(spec.guide_color) == 7):
        raise BuildError("Guide color must be a six-digit SVG hex color")
    if not close(spec.rotation_deg, -90.0):
        raise BuildError("The approved label rotation must remain 90 degrees clockwise")
    if not close(spec.margin_left_mm, 5.0) or not close(spec.margin_right_mm, 5.0):
        raise BuildError("The approved left and right page margins are 5 mm")
    if not close(spec.margin_top_mm, 8.5) or not close(spec.margin_bottom_mm, 8.5):
        raise BuildError("The approved top and bottom page margins are 8.5 mm")
    if spec.guide_length_mm + spec.guide_internal_width_mm / 2 > min(
        spec.margin_left_mm, spec.margin_right_mm, spec.margin_top_mm, spec.margin_bottom_mm
    ):
        raise BuildError("External registration ticks do not fit inside the page margins")

    if not close(
        spec.margin_left_mm + spec.columns * spec.cell_width_mm + spec.margin_right_mm,
        spec.page_width_mm,
    ):
        raise BuildError("Column geometry does not fit the declared A4 page width")
    if not close(
        spec.margin_top_mm + spec.rows * spec.cell_height_mm + spec.margin_bottom_mm,
        spec.page_height_mm,
    ):
        raise BuildError("Row geometry does not fit the declared A4 page height")

    guide_group = next(
        (node for node in root.iter(f"{{{SVG_NS}}}g") if node.get("id") == "cut-guides"),
        None,
    )
    if guide_group is None:
        raise BuildError("Template must include a cut-guides layer")
    validate_template_guide_layer(root, guide_group, spec)

    slots: dict[tuple[int, int], Slot] = {}
    for node in root.iter(f"{{{SVG_NS}}}g"):
        if node.get("data-slot") != "true":
            continue
        try:
            row = int(node.attrib["data-row"])
            col = int(node.attrib["data-col"])
        except (KeyError, ValueError) as exc:
            raise BuildError("Each slot needs integer data-row and data-col attributes") from exc
        key = (row, col)
        if key in slots:
            raise BuildError(f"Duplicate slot anchor: row {row}, column {col}")
        if not (1 <= row <= spec.rows and 1 <= col <= spec.columns):
            raise BuildError(f"Slot is outside the grid: row {row}, column {col}")

        slot = Slot(
            row=row,
            col=col,
            x_mm=number_attr(node, "data-x-mm"),
            y_mm=number_attr(node, "data-y-mm"),
            width_mm=number_attr(node, "data-width-mm"),
            height_mm=number_attr(node, "data-height-mm"),
        )
        expected_x = spec.margin_left_mm + (col - 1) * spec.cell_width_mm
        expected_y = spec.margin_top_mm + (row - 1) * spec.cell_height_mm
        if not close(slot.x_mm, expected_x) or not close(slot.y_mm, expected_y):
            raise BuildError(f"Slot anchor position disagrees with sheet geometry: row {row}, column {col}")
        if not close(slot.width_mm, spec.cell_width_mm) or not close(slot.height_mm, spec.cell_height_mm):
            raise BuildError(f"Slot size disagrees with sheet geometry: row {row}, column {col}")
        slots[key] = slot

    expected_keys = {(row, col) for row in range(1, spec.rows + 1) for col in range(1, spec.columns + 1)}
    if set(slots) != expected_keys:
        missing = sorted(expected_keys - set(slots))
        extra = sorted(set(slots) - expected_keys)
        raise BuildError(f"Template must define all 40 slots; missing={missing}, extra={extra}")

    return root, spec, slots


def validate_codes(path: Path, serial: str, side: str) -> list[str]:
    try:
        with Image.open(path) as image:
            decoded = {
                f"{result.format.name}:{result.text}"
                for result in zxingcpp.read_barcodes(image.convert("RGB"))
            }
    except Exception as exc:
        raise BuildError(f"Could not scan codes in {path}: {exc}") from exc

    expected_barcode = f"Code128:{serial}"
    if expected_barcode not in decoded:
        raise BuildError(f"{side} Code 128 does not decode to {serial}: {sorted(decoded)}")
    if side == "back":
        expected_qr = f"QRCode:{MOCKUP_QR_PREFIX}{serial}"
        if expected_qr not in decoded:
            raise BuildError(f"Back QR does not decode to {MOCKUP_QR_PREFIX}{serial}: {sorted(decoded)}")
    return sorted(decoded)


def load_manifest(
    manifest_path: Path,
    spec: SheetSpec,
    slots: dict[tuple[int, int], Slot],
) -> list[CardAsset]:
    if not manifest_path.is_file():
        raise BuildError(f"Input manifest does not exist: {manifest_path}")

    required_fields = {
        "front_row",
        "front_col",
        "TCGdex_card_id",
        "card_name",
        "set_name",
        "collector_number",
        "official_checklist_rarity",
        "DCR_rarity_code",
        "mockup_serial",
        "official_checklist_url",
        "label_dir",
    }
    try:
        with manifest_path.open("r", encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            fields = set(reader.fieldnames or ())
            missing_fields = sorted(required_fields - fields)
            if missing_fields:
                raise BuildError(f"Manifest is missing columns: {missing_fields}")
            raw_records = list(reader)
    except OSError as exc:
        raise BuildError(f"Could not read manifest: {exc}") from exc

    expected_count = spec.rows * spec.columns
    if len(raw_records) != expected_count:
        raise BuildError(f"Manifest must contain exactly {expected_count} cards; got {len(raw_records)}")

    seen_slots: set[tuple[int, int]] = set()
    seen_ids: set[str] = set()
    seen_serials: set[str] = set()
    cards: list[CardAsset] = []

    for line_number, raw in enumerate(raw_records, start=2):
        record = {str(k): (v or "").strip() for k, v in raw.items() if k is not None}
        try:
            row = int(record["front_row"])
            col = int(record["front_col"])
        except ValueError as exc:
            raise BuildError(f"Invalid front position on manifest line {line_number}") from exc

        key = (row, col)
        if key not in slots:
            raise BuildError(f"Manifest line {line_number} points outside the template grid: {key}")
        if key in seen_slots:
            raise BuildError(f"Manifest repeats front position row {row}, column {col}")
        seen_slots.add(key)

        card_id = record["TCGdex_card_id"]
        serial = record["mockup_serial"]
        if not card_id or card_id in seen_ids:
            raise BuildError(f"Card ID is empty or duplicated on manifest line {line_number}: {card_id!r}")
        if len(serial) != 8 or not serial.isdigit() or serial in seen_serials:
            raise BuildError(f"Mockup serial must be a unique eight-digit number on line {line_number}: {serial!r}")
        if not record["card_name"] or not record["set_name"] or not record["collector_number"]:
            raise BuildError(f"Card metadata is incomplete on manifest line {line_number}")
        if not record["DCR_rarity_code"]:
            raise BuildError(f"DCR rarity code is empty on manifest line {line_number}")

        label_dir_raw = Path(record["label_dir"])
        if label_dir_raw.is_absolute():
            raise BuildError(f"label_dir must be relative to the DCR tag project: {record['label_dir']}")
        label_dir = (PACKAGE_ROOT / label_dir_raw).resolve()
        try:
            label_dir.relative_to(PACKAGE_ROOT)
        except ValueError as exc:
            raise BuildError(f"label_dir escapes the DCR tag project: {record['label_dir']}") from exc
        if not label_dir.is_dir():
            raise BuildError(f"Label output folder does not exist: {label_dir}")

        stem = label_dir.name
        front_png = label_dir / f"{stem}-front.png"
        back_png = label_dir / f"{stem}-back.png"
        front_svg = label_dir / f"{stem}-front.svg"
        back_svg = label_dir / f"{stem}-back.svg"
        for asset_path in (front_png, back_png, front_svg, back_svg):
            if not asset_path.is_file():
                raise BuildError(f"Expected front/back SVG and PNG label assets: {asset_path}")

        for side_path in (front_png, back_png):
            try:
                with Image.open(side_path) as image:
                    image.verify()
                with Image.open(side_path) as image:
                    if image.size != (spec.source_png_width_px, spec.source_png_height_px):
                        raise BuildError(
                            f"Expected {spec.source_png_width_px} x {spec.source_png_height_px} PNG, "
                            f"got {image.size}: {side_path}"
                        )
            except OSError as exc:
                raise BuildError(f"Could not read label PNG {side_path}: {exc}") from exc

        validate_codes(front_png, serial, "front")
        validate_codes(back_png, serial, "back")

        seen_ids.add(card_id)
        seen_serials.add(serial)
        cards.append(CardAsset(record, label_dir, front_png, back_png, front_svg, back_svg))

    if seen_slots != set(slots):
        missing = sorted(set(slots) - seen_slots)
        raise BuildError(f"Manifest does not fill every front slot; missing={missing}")

    return sorted(cards, key=lambda item: (int(item.record["front_row"]), int(item.record["front_col"])))


def mappings(
    cards: list[CardAsset],
    spec: SheetSpec,
) -> tuple[dict[tuple[int, int], CardAsset], dict[tuple[int, int], CardAsset]]:
    front: dict[tuple[int, int], CardAsset] = {}
    back: dict[tuple[int, int], CardAsset] = {}
    for card in cards:
        row = int(card.record["front_row"])
        col = int(card.record["front_col"])
        front[(row, col)] = card
        back[(row, spec.columns + 1 - col)] = card

    if len(front) != spec.rows * spec.columns or len(back) != spec.rows * spec.columns:
        raise BuildError("Front or back placement did not produce exactly 40 unique slots")
    return front, back


def embedded_data_uri(path: Path) -> str:
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def add_svg_cut_guides(root: ET.Element, spec: SheetSpec) -> None:
    guide_group = next(
        (node for node in root.iter(f"{{{SVG_NS}}}g") if node.get("id") == "cut-guides"),
        None,
    )
    if guide_group is None:
        raise BuildError("Template is missing the cut-guides layer")
    guide_group.clear()
    guide_group.set("id", "cut-guides")
    guide_group.set("data-guide-layer", spec.cut_guides)
    guide_group.set("aria-label", "Short cut registration ticks in page margins only")
    for segment in guide_segments(spec):
        ET.SubElement(
            guide_group,
            f"{{{SVG_NS}}}line",
            {
                "data-guide-id": segment.guide_id,
                "data-axis": segment.axis,
                "data-boundary": segment.boundary,
                "x1": mm_text(segment.x1_mm),
                "y1": mm_text(segment.y1_mm),
                "x2": mm_text(segment.x2_mm),
                "y2": mm_text(segment.y2_mm),
                "stroke": spec.guide_color,
                "stroke-width": mm_text(segment.width_mm),
                "stroke-linecap": "butt",
                "fill": "none",
            },
        )


def create_sheet_svg(
    template_path: Path,
    output_path: Path,
    title_text: str,
    description_text: str,
    spec: SheetSpec,
    slots: dict[tuple[int, int], Slot],
    assignments: dict[tuple[int, int], CardAsset],
    side: str,
) -> None:
    root = ET.parse(template_path).getroot()
    title = root.find(f"{{{SVG_NS}}}title")
    desc = root.find(f"{{{SVG_NS}}}desc")
    if title is not None:
        title.text = title_text
    if desc is not None:
        desc.text = description_text

    for node in root.iter(f"{{{SVG_NS}}}g"):
        if node.get("data-slot") != "true":
            continue
        row = int(node.attrib["data-row"])
        col = int(node.attrib["data-col"])
        slot = slots[(row, col)]
        card = assignments[(row, col)]
        node.set(
            "transform",
            f"translate({mm_text(slot.x_mm + slot.width_mm)} {mm_text(slot.y_mm)}) "
            f"rotate({mm_text(abs(spec.rotation_deg))})",
        )
        image_path = card.front_png if side == "front" else card.back_png
        data_uri = embedded_data_uri(image_path)
        image = ET.SubElement(
            node,
            f"{{{SVG_NS}}}image",
            {
                "x": "0",
                "y": "0",
                "width": mm_text(spec.label_width_mm),
                "height": mm_text(spec.label_height_mm),
                "preserveAspectRatio": "none",
            },
        )
        image.set("href", data_uri)
        image.set(f"{{{XLINK_NS}}}href", data_uri)

    add_svg_cut_guides(root, spec)

    output_path.write_bytes(
        ET.tostring(root, encoding="utf-8", xml_declaration=True, short_empty_elements=True)
    )


def draw_pdf_cut_guides(page: canvas.Canvas, spec: SheetSpec) -> None:
    points_per_mm = 72.0 / 25.4
    page.saveState()
    page.setStrokeColor(HexColor(spec.guide_color))
    page.setLineCap(0)
    for segment in guide_segments(spec):
        page.setLineWidth(segment.width_mm * points_per_mm)
        x1 = segment.x1_mm * points_per_mm
        y1 = (spec.page_height_mm - segment.y1_mm) * points_per_mm
        x2 = segment.x2_mm * points_per_mm
        y2 = (spec.page_height_mm - segment.y2_mm) * points_per_mm
        page.line(x1, y1, x2, y2)
    page.restoreState()


def create_pdf(
    output_path: Path,
    spec: SheetSpec,
    slots: dict[tuple[int, int], Slot],
    front: dict[tuple[int, int], CardAsset],
    back: dict[tuple[int, int], CardAsset],
) -> None:
    page = canvas.Canvas(
        str(output_path),
        pagesize=(spec.page_width_mm * 72.0 / 25.4, spec.page_height_mm * 72.0 / 25.4),
        pageCompression=1,
    )
    page.setTitle("DCR Tag A4 40-up Portrait - Front and Back")
    page.setAuthor("DCR Tag mockup")
    page.setSubject("40 unique labels; portrait A4; back positions mirrored for long-edge duplex.")
    page.setFillColor(white)

    for side, assignments in (("front", front), ("back", back)):
        page.setFillColor(white)
        page.rect(
            0,
            0,
            spec.page_width_mm * 72.0 / 25.4,
            spec.page_height_mm * 72.0 / 25.4,
            stroke=0,
            fill=1,
        )
        for key in sorted(slots):
            slot = slots[key]
            card = assignments[key]
            image_path = card.front_png if side == "front" else card.back_png
            x_pt = slot.x_mm * 72.0 / 25.4
            y_bottom_mm = spec.page_height_mm - slot.y_mm - slot.height_mm
            y_top_pt = (y_bottom_mm + slot.height_mm) * 72.0 / 25.4
            page.saveState()
            page.translate(x_pt, y_top_pt)
            page.rotate(spec.rotation_deg)
            page.drawImage(
                ImageReader(str(image_path)),
                0,
                0,
                width=spec.label_width_mm * 72.0 / 25.4,
                height=spec.label_height_mm * 72.0 / 25.4,
                preserveAspectRatio=False,
                mask="auto",
            )
            page.restoreState()
        draw_pdf_cut_guides(page, spec)
        page.showPage()

    page.save()


def create_preview(
    output_path: Path,
    dpi: int,
    spec: SheetSpec,
    slots: dict[tuple[int, int], Slot],
    assignments: dict[tuple[int, int], CardAsset],
    side: str,
) -> None:
    scale = dpi / 25.4
    page_width_px = round(spec.page_width_mm * scale)
    page_height_px = round(spec.page_height_mm * scale)
    preview = Image.new("RGB", (page_width_px, page_height_px), "white")

    for key in sorted(slots):
        slot = slots[key]
        card = assignments[key]
        image_path = card.front_png if side == "front" else card.back_png
        x0 = round(slot.x_mm * scale)
        y0 = round(slot.y_mm * scale)
        x1 = round((slot.x_mm + slot.width_mm) * scale)
        y1 = round((slot.y_mm + slot.height_mm) * scale)
        with Image.open(image_path) as source:
            rotated = source.convert("RGB").rotate(-90, expand=True)
        if rotated.size != (spec.source_png_height_px, spec.source_png_width_px):
            raise BuildError(f"Rotated preview has unexpected size: {image_path}")
        resized = rotated.resize((x1 - x0, y1 - y0), Image.Resampling.LANCZOS)
        preview.paste(resized, (x0, y0))

    draw = ImageDraw.Draw(preview)
    color = tuple(int(spec.guide_color[index : index + 2], 16) for index in (1, 3, 5))
    for segment in guide_segments(spec):
        coordinates = (
            round(segment.x1_mm * scale),
            round(segment.y1_mm * scale),
            round(segment.x2_mm * scale),
            round(segment.y2_mm * scale),
        )
        width_px = max(1, round(segment.width_mm * scale))
        draw.line(coordinates, fill=color, width=width_px)

    preview.save(output_path, format="PNG", dpi=(dpi, dpi), optimize=True)


def write_layout_manifest(
    output_path: Path,
    cards: list[CardAsset],
    spec: SheetSpec,
) -> None:
    fieldnames = [
        "front_slot",
        "front_row",
        "front_col",
        "back_slot",
        "back_row",
        "back_col",
        "TCGdex_card_id",
        "card_name",
        "set_name",
        "collector_number",
        "official_checklist_rarity",
        "DCR_rarity_code",
        "mockup_serial",
        "official_checklist_url",
        "label_dir",
    ]
    with output_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for card in cards:
            record = card.record
            row = int(record["front_row"])
            col = int(record["front_col"])
            back_col = spec.columns + 1 - col
            writer.writerow(
                {
                    **record,
                    "front_slot": (row - 1) * spec.columns + col,
                    "back_slot": (row - 1) * spec.columns + back_col,
                    "back_row": row,
                    "back_col": back_col,
                }
            )


def write_readme(output_dir: Path, spec: SheetSpec, preview_dpi: int) -> None:
    content = f"""# A4 40-up portrait print run

- Paper: A4 portrait, {spec.page_width_mm:g} x {spec.page_height_mm:g} mm.
- Grid: {spec.columns} columns x {spec.rows} rows = {spec.columns * spec.rows} unique labels.
- Original label size: {spec.label_width_mm:g} x {spec.label_height_mm:g} mm, rotated {abs(spec.rotation_deg):g} degrees clockwise into {spec.cell_width_mm:g} x {spec.cell_height_mm:g} mm cells.
- Margins: left/right {spec.margin_left_mm:g} mm; top/bottom {spec.margin_top_mm:g} mm.
- Gutter: 0 mm. {len(guide_segments(spec))} short cut registration ticks are placed in page margins; none cross label artwork.
- Guide marks: {spec.guide_length_mm:g} mm long; outer width {spec.guide_outer_width_mm:g} mm; internal cut width {spec.guide_internal_width_mm:g} mm; color {spec.guide_color}.
- Back: columns mirrored within each row for portrait long-edge duplex printing.
- PDF: print.pdf, two pages (front then back), exact A4 portrait.
- Preview PNGs: rendered at {preview_dpi} dpi; use the PDF for printing.
- Print at 100% / Actual Size. Turn off Fit to page and Shrink to fit. Choose duplex flip on the long edge.
- The label serial, QR payload, Code 128, and condition values are generated mockup data, not registered or production data.
"""
    (output_dir / "README.md").write_text(content, encoding="utf-8")


def write_report(
    output_path: Path,
    template_path: Path,
    manifest_path: Path,
    cards: list[CardAsset],
    spec: SheetSpec,
    preview_dpi: int,
) -> None:
    report: dict[str, Any] = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "template": str(template_path),
        "template_sha256": sha256_file(template_path),
        "manifest": str(manifest_path),
        "manifest_sha256": sha256_file(manifest_path),
        "geometry": {
            "paper": "A4 portrait",
            "page_mm": [spec.page_width_mm, spec.page_height_mm],
            "grid": [spec.columns, spec.rows],
            "cell_mm": [spec.cell_width_mm, spec.cell_height_mm],
            "source_label_mm": [spec.label_width_mm, spec.label_height_mm],
            "margins_mm": {
                "left": spec.margin_left_mm,
                "right": spec.margin_right_mm,
                "top": spec.margin_top_mm,
                "bottom": spec.margin_bottom_mm,
            },
            "duplex_flip": spec.duplex_flip,
            "cut_guides": {
                "style": spec.cut_guides,
                "segments": len(guide_segments(spec)),
                "length_mm": spec.guide_length_mm,
                "outer_width_mm": spec.guide_outer_width_mm,
                "internal_width_mm": spec.guide_internal_width_mm,
                "color": spec.guide_color,
                "inside_label_area": 0,
            },
            "preview_dpi": preview_dpi,
        },
        "validation": {
            "cards": len(cards),
            "unique_card_ids": len({card.record["TCGdex_card_id"] for card in cards}),
            "unique_mockup_serials": len({card.record["mockup_serial"] for card in cards}),
            "source_png_dimensions": list(PNG_SIZE),
            "code128_and_back_qr_scanned": len(cards),
            "overlaps": 0,
            "cut_guides": len(guide_segments(spec)),
            "guide_marks_inside_label_area": 0,
        },
        "source_assets": [
            {
                "card_id": card.record["TCGdex_card_id"],
                "front_png_sha256": sha256_file(card.front_png),
                "back_png_sha256": sha256_file(card.back_png),
                "front_svg_sha256": sha256_file(card.front_svg),
                "back_svg_sha256": sha256_file(card.back_svg),
            }
            for card in cards
        ],
    }
    output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def copy_pdf_without_overwrite(source: Path, destination: Path) -> None:
    if destination.exists():
        raise BuildError(f"PDF destination already exists and will not be overwritten: {destination}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix=f".{destination.name}.",
            suffix=".tmp",
            dir=destination.parent,
            delete=False,
        ) as temp_file:
            temp_path = Path(temp_file.name)
        shutil.copyfile(source, temp_path)
        if destination.exists():
            raise BuildError(f"PDF destination appeared during build; refusing to overwrite: {destination}")
        os.replace(temp_path, destination)
    finally:
        if temp_path is not None and temp_path.exists():
            temp_path.unlink()


def load_data_manifest(
    manifest_path: Path,
    spec: SheetSpec,
    slots: dict[tuple[int, int], Slot],
) -> tuple[dict[str, Any], list[DirectCard]]:
    if not manifest_path.is_file():
        raise BuildError(f"Data manifest does not exist: {manifest_path}")
    try:
        document = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        raise BuildError(f"Could not read JSON data manifest: {exc}") from exc
    if not isinstance(document, dict) or document.get("schema_version") != 1:
        raise BuildError("Data manifest must be an object with schema_version 1")
    sheet = document.get("sheet")
    raw_cards = document.get("cards")
    if not isinstance(sheet, dict) or sheet.get("profile") != "a4-40up-portrait":
        raise BuildError("Data manifest sheet.profile must be 'a4-40up-portrait'")
    if sheet.get("duplex_flip") != spec.duplex_flip:
        raise BuildError(
            f"Manifest duplex_flip {sheet.get('duplex_flip')!r} does not match template {spec.duplex_flip!r}"
        )
    if not isinstance(raw_cards, list) or len(raw_cards) != spec.rows * spec.columns:
        raise BuildError(f"Data manifest must contain exactly {spec.rows * spec.columns} cards")

    required_data = (
        "name", "year_series", "display_number", "full_number", "collection",
        "rarity", "rarity_name", "language", "finish_note", "sources",
    )
    seen_slots: set[tuple[int, int]] = set()
    seen_ids: set[str] = set()
    seen_serials: set[str] = set()
    cards: list[DirectCard] = []
    for index, raw in enumerate(raw_cards, start=1):
        if not isinstance(raw, dict):
            raise BuildError(f"Card entry {index} must be an object")
        try:
            row, col = int(raw["front_row"]), int(raw["front_col"])
        except (KeyError, TypeError, ValueError) as exc:
            raise BuildError(f"Card entry {index} has an invalid front_row/front_col") from exc
        key = (row, col)
        if key not in slots or key in seen_slots:
            raise BuildError(f"Card entry {index} points outside or repeats a sheet slot: {key}")
        card_id = str(raw.get("card_id", "")).strip()
        serial = str(raw.get("mockup_serial", "")).strip()
        condition = str(raw.get("mockup_condition", "")).strip()
        data = raw.get("card")
        if not card_id or card_id in seen_ids:
            raise BuildError(f"Card ID is empty or duplicated in entry {index}: {card_id!r}")
        if not re.fullmatch(r"\d{8}", serial) or serial in seen_serials:
            raise BuildError(f"Mockup serial must be a unique 8-digit value in entry {index}: {serial!r}")
        if condition not in CONDITIONS:
            raise BuildError(f"Unknown mockup condition in entry {index}: {condition!r}")
        if not isinstance(data, dict):
            raise BuildError(f"Card entry {index} has no nested card data object")
        missing = [field for field in required_data if field not in data or data[field] in (None, "")]
        if missing:
            raise BuildError(f"Card entry {index} is missing card fields: {missing}")
        if not isinstance(data["sources"], list) or not data["sources"]:
            raise BuildError(f"Card entry {index} must include at least one source")
        metadata = data.get("catalog_metadata")
        if isinstance(metadata, dict) and metadata.get("card_id") not in (None, card_id):
            raise BuildError(f"Card entry {index} card_id disagrees with its catalog_metadata.card_id")
        try:
            rendered = render_label_svg_pair(data, serial, condition, "template")
        except (RuntimeError, ValueError, KeyError) as exc:
            raise BuildError(f"Could not render card {card_id} in slot {row},{col}: {exc}") from exc

        record = {
            "front_row": row,
            "front_col": col,
            "TCGdex_card_id": card_id,
            "card_name": str(data["name"]),
            "display_name": str(data.get("display_name") or data["name"]),
            "set_name": str(data["collection"]),
            "collector_number": str(data["full_number"]),
            "official_checklist_rarity": str(data["rarity_name"]),
            "DCR_rarity_code": str(data["rarity"]),
            "mockup_serial": serial,
            "mockup_condition": condition,
            "official_checklist_url": str(data.get("official_checklist_url", "")),
        }
        cards.append(DirectCard(record, data, rendered))
        seen_slots.add(key)
        seen_ids.add(card_id)
        seen_serials.add(serial)

    if seen_slots != set(slots):
        raise BuildError(f"Data manifest does not fill every sheet slot: missing={sorted(set(slots) - seen_slots)}")
    return sheet, sorted(cards, key=lambda card: (card.record["front_row"], card.record["front_col"]))


def direct_mappings(
    cards: list[DirectCard], spec: SheetSpec,
) -> tuple[dict[tuple[int, int], DirectCard], dict[tuple[int, int], DirectCard]]:
    front: dict[tuple[int, int], DirectCard] = {}
    back: dict[tuple[int, int], DirectCard] = {}
    for card in cards:
        row, col = card.record["front_row"], card.record["front_col"]
        front[(row, col)] = card
        back[(row, spec.columns + 1 - col)] = card
    expected = spec.rows * spec.columns
    if len(front) != expected or len(back) != expected:
        raise BuildError(f"Expected {expected} unique positions on each sheet side")
    return front, back


def namespace_svg_ids(
    root: ET.Element,
    prefix: str,
    external_ids: dict[str, str] | None = None,
) -> dict[str, str]:
    identifiers = {
        node.get("id")
        for node in root.iter()
        if node.get("id")
    }
    mapping = {identifier: f"{prefix}{identifier}" for identifier in identifiers}
    url_ref = re.compile(r"url\(\s*#([^\s)]+)\s*\)")
    for node in root.iter():
        identifier = node.get("id")
        if identifier in mapping:
            node.set("id", mapping[identifier])
        for key, value in list(node.attrib.items()):
            local_name = key.rsplit("}", 1)[-1]
            def resolve_ref(target: str) -> str:
                return mapping.get(target, (external_ids or {}).get(target, target))

            updated = url_ref.sub(lambda match: f"url(#{resolve_ref(match.group(1))})", value)
            if local_name == "href" and updated.startswith("#"):
                target = updated[1:]
                updated = "#" + resolve_ref(target)
            elif local_name in {"aria-labelledby", "aria-describedby"}:
                updated = " ".join(resolve_ref(part) for part in updated.split())
            if updated != value:
                node.set(key, updated)
    return mapping


def shared_static_groups(cards: list[DirectCard], side: str) -> dict[str, ET.Element]:
    """Find large direct artwork groups that are byte-identical for every card."""
    if not cards:
        return {}
    svg_attr = "front_svg" if side == "front" else "back_svg"
    first_root = ET.fromstring(getattr(cards[0].rendered, svg_attr))
    first_group = next((node for node in first_root if node.tag == f"{{{SVG_NS}}}g"), None)
    if first_group is None:
        raise BuildError(f"{side} tag master has no artwork group")
    candidates = {
        child.get("id"): ET.tostring(child, encoding="utf-8", short_empty_elements=True)
        for child in first_group
        if child.get("id") and len(ET.tostring(child, encoding="utf-8", short_empty_elements=True)) >= 20000
    }
    shared: dict[str, ET.Element] = {}
    for card in cards[1:]:
        root = ET.fromstring(getattr(card.rendered, svg_attr))
        group = next((node for node in root if node.tag == f"{{{SVG_NS}}}g"), None)
        if group is None:
            raise BuildError(f"{side} tag master has no artwork group for {card.record['TCGdex_card_id']}")
        for candidate_id, expected_bytes in list(candidates.items()):
            node = next((item for item in group if item.get("id") == candidate_id), None)
            if node is None or ET.tostring(node, encoding="utf-8", short_empty_elements=True) != expected_bytes:
                candidates.pop(candidate_id)
    for candidate_id in candidates:
        node = next((item for item in first_group if item.get("id") == candidate_id), None)
        if node is not None:
            shared[candidate_id] = copy.deepcopy(node)
    return shared


def create_direct_sheet_svg(
    template_path: Path,
    output_path: Path,
    title_text: str,
    description_text: str,
    spec: SheetSpec,
    slots: dict[tuple[int, int], Slot],
    assignments: dict[tuple[int, int], DirectCard],
    side: str,
) -> None:
    root = ET.parse(template_path).getroot()
    title = root.find(f"{{{SVG_NS}}}title")
    desc = root.find(f"{{{SVG_NS}}}desc")
    if title is not None:
        title.text = title_text
    if desc is not None:
        desc.text = description_text

    svg_attr = "front_svg" if side == "front" else "back_svg"
    first_card_root = ET.fromstring(getattr(next(iter(assignments.values())).rendered, svg_attr))
    master_defs = next((node for node in first_card_root if node.tag == f"{{{SVG_NS}}}defs"), None)
    if master_defs is None:
        raise BuildError(f"{side} tag master is missing shared definitions")
    page_defs = ET.Element(f"{{{SVG_NS}}}defs", {"id": f"shared-{side}-definitions"})
    shared_defs_copy = copy.deepcopy(master_defs)
    shared_defs_ids = namespace_svg_ids(shared_defs_copy, f"shared-{side}-def-")
    for child in list(shared_defs_copy):
        page_defs.append(child)

    shared_groups = shared_static_groups(list(assignments.values()), side)
    shared_group_ids: dict[str, str] = {}
    shared_group_refs: dict[str, str] = {}
    for index, (original_id, source_node) in enumerate(shared_groups.items(), start=1):
        shared_copy = copy.deepcopy(source_node)
        shared_mapping = namespace_svg_ids(
            shared_copy,
            f"shared-{side}-art-{index:02d}-",
            shared_defs_ids,
        )
        shared_group_ids[original_id] = shared_mapping[original_id]
        shared_group_refs.update(shared_mapping)
        page_defs.append(shared_copy)
    shared_group_refs.update(shared_group_ids)
    root.insert(3, page_defs)

    for node in root.iter(f"{{{SVG_NS}}}g"):
        if node.get("data-slot") != "true":
            continue
        row, col = int(node.attrib["data-row"]), int(node.attrib["data-col"])
        slot = slots[(row, col)]
        card = assignments[(row, col)]
        node.set(
            "transform",
            f"translate({mm_text(slot.x_mm + slot.width_mm)} {mm_text(slot.y_mm)}) "
            f"rotate({mm_text(abs(spec.rotation_deg))})",
        )
        nested = ET.SubElement(
            node,
            f"{{{SVG_NS}}}svg",
            {
                "x": "0",
                "y": "0",
                "width": mm_text(spec.label_width_mm),
                "height": mm_text(spec.label_height_mm),
                "viewBox": f"0 0 {mm_text(spec.label_width_mm)} {mm_text(spec.label_height_mm)}",
                "preserveAspectRatio": "none",
                "overflow": "hidden",
                "data-card-id": card.record["TCGdex_card_id"],
                "data-sheet-side": side,
            },
        )
        source_bytes = getattr(card.rendered, svg_attr)
        card_root = ET.fromstring(source_bytes)
        artwork = next((child for child in card_root if child.tag == f"{{{SVG_NS}}}g"), None)
        if artwork is None:
            raise BuildError(f"Could not find artwork group for {card.record['TCGdex_card_id']}")
        artwork_copy = copy.deepcopy(artwork)
        card_static_refs = dict(shared_group_refs)
        for child_index, child in enumerate(list(artwork_copy)):
            original_id = child.get("id")
            if original_id not in shared_group_ids:
                continue
            use = ET.Element(f"{{{SVG_NS}}}use")
            use.set("href", f"#{shared_group_ids[original_id]}")
            use.set(f"{{{XLINK_NS}}}href", f"#{shared_group_ids[original_id]}")
            use.tail = child.tail
            artwork_copy.remove(child)
            artwork_copy.insert(child_index, use)
        namespace_svg_ids(artwork_copy, f"{side}-r{row:02d}-c{col:02d}-", card_static_refs)
        nested.append(artwork_copy)

    add_svg_cut_guides(root, spec)
    ids = [node.get("id") for node in root.iter() if node.get("id")]
    if len(ids) != len(set(ids)):
        raise BuildError(f"Duplicate SVG ids remain in {side} sheet after cloning template artwork")
    placed = [node for node in root.iter(f"{{{SVG_NS}}}svg") if node.get("data-sheet-side") == side]
    if len(placed) != spec.rows * spec.columns:
        raise BuildError(f"Expected {spec.rows * spec.columns} in-memory label SVGs on {side} sheet")
    output_path.write_bytes(ET.tostring(root, encoding="utf-8", xml_declaration=True, short_empty_elements=True))


def find_browser() -> Path:
    candidates = (
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    )
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise BuildError("Could not find Microsoft Edge or Google Chrome for SVG sheet rendering")


def render_sheet_raster(svg_path: Path, png_path: Path, spec: SheetSpec, dpi: int, browser: Path) -> tuple[int, int]:
    width_px = round(spec.page_width_mm * dpi / 25.4)
    height_px = round(spec.page_height_mm * dpi / 25.4)
    html_path = png_path.with_suffix(".html")
    profile = png_path.with_name(png_path.stem + "-browser-profile")
    html_path.write_text(
        "<!doctype html><html><head><meta charset=\"utf-8\"><style>"
        f"html,body{{margin:0;padding:0;width:{width_px}px;height:{height_px}px;overflow:hidden;background:#fff}}"
        f"img{{display:block;width:{width_px}px;height:{height_px}px}}"
        "</style></head><body><img src=\""
        + svg_path.resolve().as_uri()
        + "\"></body></html>",
        encoding="utf-8",
    )
    try:
        result = subprocess.run(
            [
                str(browser), "--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                "--hide-scrollbars", "--force-device-scale-factor=1", f"--window-size={width_px},{height_px}",
                f"--user-data-dir={profile.resolve()}", f"--screenshot={png_path.resolve()}", html_path.resolve().as_uri(),
            ],
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
        if result.returncode != 0 or not png_path.is_file():
            raise BuildError(f"Browser failed to render {svg_path}: {result.stderr[-1500:]}")
        with Image.open(png_path) as image:
            actual = image.size
        if actual != (width_px, height_px):
            raise BuildError(f"Rendered sheet dimensions {actual} do not match expected {(width_px, height_px)}")
        return actual
    finally:
        html_path.unlink(missing_ok=True)
        if profile.exists():
            resolved_profile = profile.resolve()
            resolved_output_parent = png_path.parent.resolve()
            if resolved_profile.parent != resolved_output_parent or not resolved_profile.name.startswith(png_path.stem + "-browser-profile"):
                raise BuildError(f"Refusing to remove an unexpected browser profile directory: {resolved_profile}")
            shutil.rmtree(profile, ignore_errors=True)


def validate_direct_page_codes(
    png_path: Path,
    assignments: dict[tuple[int, int], DirectCard],
    spec: SheetSpec,
    slots: dict[tuple[int, int], Slot],
    side: str,
    dpi: int,
) -> list[dict[str, str]]:
    scale = dpi / 25.4
    results: list[dict[str, str]] = []
    with Image.open(png_path) as page_image:
        for key in sorted(slots):
            slot = slots[key]
            card = assignments[key]
            left, top = round(slot.x_mm * scale), round(slot.y_mm * scale)
            right = round((slot.x_mm + slot.width_mm) * scale)
            bottom = round((slot.y_mm + slot.height_mm) * scale)
            label_image = page_image.crop((left, top, right, bottom)).rotate(90, expand=True).convert("RGB")
            if label_image.size != (spec.source_png_width_px, spec.source_png_height_px):
                raise BuildError(f"Unexpected rotated label raster size in slot {key}: {label_image.size}")
            decoded = {
                f"{result.format.name}:{result.text}"
                for result in zxingcpp.read_barcodes(label_image)
            }
            serial = card.record["mockup_serial"]
            if f"Code128:{serial}" not in decoded:
                raise BuildError(f"{side} Code 128 failed to decode for {card.record['TCGdex_card_id']} at {key}: {sorted(decoded)}")
            if side == "back" and f"QRCode:DCR-TEST:{serial}" not in decoded:
                raise BuildError(f"{side} QR failed to decode for {card.record['TCGdex_card_id']} at {key}: {sorted(decoded)}")
            results.append({"card_id": card.record["TCGdex_card_id"], "side": side, "serial": serial})
    return results


def create_direct_pdf(output_path: Path, front_png: Path, back_png: Path, spec: SheetSpec) -> None:
    page_width_pt = spec.page_width_mm * 72.0 / 25.4
    page_height_pt = spec.page_height_mm * 72.0 / 25.4
    page = canvas.Canvas(str(output_path), pagesize=(page_width_pt, page_height_pt), pageCompression=1)
    page.setTitle("DCR Tag A4 40-up Portrait - Front and Back")
    page.setAuthor("DCR Tag mockup")
    page.setSubject("Data manifest rendered directly into the approved portrait sheet template.")
    for raster in (front_png, back_png):
        page.drawImage(ImageReader(str(raster)), 0, 0, width=page_width_pt, height=page_height_pt, preserveAspectRatio=False)
        page.showPage()
    page.save()
    from pypdf import PdfReader
    reader = PdfReader(str(output_path))
    if len(reader.pages) != 2:
        raise BuildError(f"Direct print PDF must contain 2 pages; got {len(reader.pages)}")
    expected = (page_width_pt, page_height_pt)
    for index, pdf_page in enumerate(reader.pages, start=1):
        actual = (float(pdf_page.mediabox.width), float(pdf_page.mediabox.height))
        if any(abs(a - b) > 0.5 for a, b in zip(actual, expected)):
            raise BuildError(f"PDF page {index} dimensions {actual} do not match A4 points {expected}")


def write_direct_preview(source_path: Path, output_path: Path, dpi: int, spec: SheetSpec) -> None:
    size = (round(spec.page_width_mm * dpi / 25.4), round(spec.page_height_mm * dpi / 25.4))
    with Image.open(source_path) as image:
        preview = image.convert("RGB").resize(size, Image.Resampling.LANCZOS)
        preview.save(output_path, format="PNG", dpi=(dpi, dpi), optimize=True)


def write_direct_layout_manifest(output_path: Path, cards: list[DirectCard], spec: SheetSpec) -> None:
    fields = [
        "front_slot", "front_row", "front_col", "back_slot", "back_row", "back_col",
        "TCGdex_card_id", "card_name", "display_name", "set_name", "collector_number",
        "official_checklist_rarity", "DCR_rarity_code", "mockup_serial", "mockup_condition",
        "official_checklist_url",
    ]
    with output_path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for card in cards:
            record = card.record
            row, col = record["front_row"], record["front_col"]
            back_col = spec.columns + 1 - col
            writer.writerow({
                **record,
                "front_slot": f"R{row:02d}C{col:02d}",
                "back_slot": f"R{row:02d}C{back_col:02d}",
                "back_row": row,
                "back_col": back_col,
            })


def write_direct_readme(output_dir: Path, manifest_path: Path, dpi: int) -> None:
    (output_dir / "README.md").write_text(
        f"""# DCR A4 40-up sheet build

- Input: `{manifest_path}` (data-only manifest; no per-card SVG/PNG files are required).
- The builder renders both sides from the current front/back SVG masters in memory, then places each rendered label directly in the A4 sheet SVG.
- The back side mirrors front columns for long-edge duplex printing.
- Previews are {dpi} dpi. The print PDF uses the full template raster resolution and exact A4 page dimensions.
- Print at 100% / actual size and select long-edge duplex.
- Serial, condition, QR and barcode are mockup values, not registered card data or grading results.
- Catalog metadata are preserved from the manifest snapshot and were not individually verified against official card checklists.
""",
        encoding="utf-8",
    )


def write_direct_report(
    output_path: Path,
    template_path: Path,
    manifest_path: Path,
    source_manifest: dict[str, Any],
    cards: list[DirectCard],
    spec: SheetSpec,
    preview_dpi: int,
    page_dpi: int,
    code_results: list[dict[str, str]],
) -> None:
    report = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "build_method": "direct-data-to-svg-sheet",
        "template": str(template_path),
        "template_sha256": sha256_file(template_path),
        "front_master": str(PACKAGE_ROOT / "source" / "dcr-tag-front.svg"),
        "front_master_sha256": sha256_file(PACKAGE_ROOT / "source" / "dcr-tag-front.svg"),
        "back_master": str(PACKAGE_ROOT / "source" / "dcr-tag-back.svg"),
        "back_master_sha256": sha256_file(PACKAGE_ROOT / "source" / "dcr-tag-back.svg"),
        "manifest": str(manifest_path),
        "manifest_sha256": sha256_file(manifest_path),
        "selection": source_manifest.get("sheet", {}),
        "geometry": {
            "paper": "A4 portrait",
            "page_mm": [spec.page_width_mm, spec.page_height_mm],
            "grid": [spec.columns, spec.rows],
            "cell_mm": [spec.cell_width_mm, spec.cell_height_mm],
            "source_label_mm": [spec.label_width_mm, spec.label_height_mm],
            "margins_mm": {
                "left": spec.margin_left_mm, "right": spec.margin_right_mm,
                "top": spec.margin_top_mm, "bottom": spec.margin_bottom_mm,
            },
            "duplex_flip": spec.duplex_flip,
            "cut_guides": {
                "style": spec.cut_guides,
                "segments": len(guide_segments(spec)),
                "length_mm": spec.guide_length_mm,
                "outer_width_mm": spec.guide_outer_width_mm,
                "internal_width_mm": spec.guide_internal_width_mm,
                "inside_label_area": 0,
            },
            "print_raster_dpi": page_dpi,
            "preview_dpi": preview_dpi,
        },
        "validation": {
            "cards": len(cards),
            "unique_card_ids": len({card.record["TCGdex_card_id"] for card in cards}),
            "unique_mockup_serials": len({card.record["mockup_serial"] for card in cards}),
            "generated_per_card_svg_files": 0,
            "generated_per_card_png_files": 0,
            "direct_svg_label_instances_per_side": len(cards),
            "label_side_scans": len(code_results),
            "code128_symbols_decoded": 2 * len(cards),
            "qr_symbols_decoded": len(cards),
            "total_symbols_decoded": 3 * len(cards),
            "overlaps": 0,
            "cut_guides": len(guide_segments(spec)),
            "guide_marks_inside_label_area": 0,
            "back_mirror_rule": "same row; back column = 11 - front column",
        },
        "code_checks": code_results,
        "cards": [
            {
                **card.record,
                "front_svg_sha256": hashlib.sha256(card.rendered.front_svg).hexdigest(),
                "back_svg_sha256": hashlib.sha256(card.rendered.back_svg).hexdigest(),
            }
            for card in cards
        ],
    }
    output_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_from_data_manifest(args: argparse.Namespace) -> Path:
    template_path = resolve_cli_path(args.template)
    manifest_path = resolve_cli_path(args.manifest)
    output_dir = resolve_cli_path(args.output_dir)
    pdf_output = resolve_cli_path(args.pdf_output) if args.pdf_output else None
    if output_dir.exists():
        raise BuildError(f"Output directory already exists and will not be overwritten: {output_dir}")
    if pdf_output is not None and pdf_output.exists():
        raise BuildError(f"PDF destination already exists and will not be overwritten: {pdf_output}")
    if pdf_output is not None and pdf_output == output_dir / "print.pdf":
        raise BuildError("PDF destination must differ from the build directory PDF")

    _, spec, slots = load_template(template_path)
    sheet_metadata, cards = load_data_manifest(manifest_path, spec, slots)
    front, back = direct_mappings(cards, spec)
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=f".{output_dir.name}.building-", dir=output_dir.parent))
    browser = find_browser()
    page_dpi = spec.source_resolution_dpi
    try:
        create_direct_sheet_svg(
            template_path, staging / "front-sheet.svg",
            "DCR tag A4 40-up portrait - front",
            "Forty front labels rendered directly from the front SVG master and the data manifest.",
            spec, slots, front, "front",
        )
        create_direct_sheet_svg(
            template_path, staging / "back-sheet.svg",
            "DCR tag A4 40-up portrait - back",
            "Forty back labels mirrored by column for long-edge duplex printing.",
            spec, slots, back, "back",
        )
        front_raster = staging / ".front-page-print.png"
        back_raster = staging / ".back-page-print.png"
        front_size = render_sheet_raster(staging / "front-sheet.svg", front_raster, spec, page_dpi, browser)
        back_size = render_sheet_raster(staging / "back-sheet.svg", back_raster, spec, page_dpi, browser)
        code_results = validate_direct_page_codes(front_raster, front, spec, slots, "front", page_dpi)
        code_results.extend(validate_direct_page_codes(back_raster, back, spec, slots, "back", page_dpi))
        create_direct_pdf(staging / "print.pdf", front_raster, back_raster, spec)
        write_direct_preview(front_raster, staging / "front-preview.png", args.preview_dpi, spec)
        write_direct_preview(back_raster, staging / "back-preview.png", args.preview_dpi, spec)
        write_direct_layout_manifest(staging / "layout-manifest.csv", cards, spec)
        write_direct_report(
            staging / "build-report.json", template_path, manifest_path,
            {"sheet": sheet_metadata}, cards, spec, args.preview_dpi, page_dpi, code_results,
        )
        write_direct_readme(staging, manifest_path, args.preview_dpi)
        front_raster.unlink(missing_ok=True)
        back_raster.unlink(missing_ok=True)
        if output_dir.exists():
            raise BuildError(f"Output directory appeared during build; refusing to overwrite: {output_dir}")
        os.replace(staging, output_dir)
    except Exception:
        if staging.exists() and staging.parent.resolve() == output_dir.parent.resolve() and staging.name.startswith(f".{output_dir.name}.building-"):
            shutil.rmtree(staging, ignore_errors=True)
        raise

    if pdf_output is not None:
        copy_pdf_without_overwrite(output_dir / "print.pdf", pdf_output)
        print(f"Print PDF: {pdf_output}")
    print(f"Build folder: {output_dir}")
    print("Rendered 40 front and 40 back labels directly from data and SVG masters; no per-card image files were written.")
    print(f"Rasterized for print at {page_dpi} dpi: {front_size[0]} x {front_size[1]} px per A4 page.")
    return output_dir


def build(args: argparse.Namespace) -> Path:
    if args.manifest.suffix.lower() == ".json":
        return build_from_data_manifest(args)

    template_path = resolve_cli_path(args.template)
    manifest_path = resolve_cli_path(args.manifest)
    output_dir = resolve_cli_path(args.output_dir)
    pdf_output = resolve_cli_path(args.pdf_output) if args.pdf_output else None

    if output_dir.exists():
        raise BuildError(f"Output directory already exists and will not be overwritten: {output_dir}")
    if pdf_output is not None and pdf_output.exists():
        raise BuildError(f"PDF destination already exists and will not be overwritten: {pdf_output}")
    if pdf_output is not None and pdf_output == output_dir / "print.pdf":
        raise BuildError("PDF destination must differ from the build directory PDF")

    root, spec, slots = load_template(template_path)
    cards = load_manifest(manifest_path, spec, slots)
    front, back = mappings(cards, spec)

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=f".{output_dir.name}.building-", dir=output_dir.parent))
    try:
        create_sheet_svg(
            template_path,
            staging / "front-sheet.svg",
            "DCR tag A4 40-up portrait - front",
            "Approved front arrangement; 40 labels with short cut registration ticks only in page margins.",
            spec,
            slots,
            front,
            "front",
        )
        create_sheet_svg(
            template_path,
            staging / "back-sheet.svg",
            "DCR tag A4 40-up portrait - back",
            "Back labels mirrored by column for long-edge duplex, with short cut ticks only in page margins.",
            spec,
            slots,
            back,
            "back",
        )
        create_pdf(staging / "print.pdf", spec, slots, front, back)
        create_preview(staging / "front-preview.png", args.preview_dpi, spec, slots, front, "front")
        create_preview(staging / "back-preview.png", args.preview_dpi, spec, slots, back, "back")
        write_layout_manifest(staging / "layout-manifest.csv", cards, spec)
        write_report(staging / "build-report.json", template_path, manifest_path, cards, spec, args.preview_dpi)
        write_readme(staging, spec, args.preview_dpi)

        if output_dir.exists():
            raise BuildError(f"Output directory appeared during build; refusing to overwrite: {output_dir}")
        os.replace(staging, output_dir)
    except Exception:
        if (
            staging.exists()
            and staging.parent.resolve() == output_dir.parent.resolve()
            and staging.name.startswith(f".{output_dir.name}.building-")
        ):
            shutil.rmtree(staging)
        raise

    if pdf_output is not None:
        copy_pdf_without_overwrite(output_dir / "print.pdf", pdf_output)
        print(f"Print PDF: {pdf_output}")
    print(f"Build folder: {output_dir}")
    print("Cards: 40 unique; back positions mirrored by row; 32 edge ticks; none over label artwork.")
    return output_dir


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path, help="Data-only JSON manifest (recommended) or legacy CSV with prebuilt label assets")
    parser.add_argument("--template", type=Path, default=DEFAULT_TEMPLATE, help="A4 portrait SVG master")
    parser.add_argument("--output-dir", required=True, type=Path, help="New output folder; existing folders are never overwritten")
    parser.add_argument("--pdf-output", type=Path, help="Optional separate PDF copy; existing files are never overwritten")
    parser.add_argument("--preview-dpi", type=int, default=300, help="Preview image resolution (default: 300 dpi)")
    args = parser.parse_args()

    if args.preview_dpi < 72 or args.preview_dpi > 600:
        parser.error("--preview-dpi must be between 72 and 600")
    try:
        build(args)
    except (BuildError, OSError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
