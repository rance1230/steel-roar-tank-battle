#!/usr/bin/env python3
"""Process v1.5 top-down generated art into game-ready sprite sheets and tiles.

This batch is intentionally assets-only. It preserves the generated source
images, slices 4x4 unit direction sheets into normalized transparent frames,
slices 4x4 terrain atlases into modular tiles, and writes a manifest for the
future renderer integration.
"""

from __future__ import annotations

import json
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "assets" / "ai-v15-topdown"
SRC_UNITS = BASE / "source" / "units"
SRC_TERRAIN = BASE / "source" / "terrain-atlases"
OUT = BASE / "processed"
OUT_UNITS = OUT / "units"
OUT_TERRAIN = OUT / "terrain-atlases"
MANIFEST_OUT = BASE / "topdown-assets-manifest.json"
UNIT_CONTACT_OUT = OUT / "unit-contact-sheet.png"
TERRAIN_CONTACT_OUT = OUT / "terrain-contact-sheet.png"

GRID = 4
UNIT_CELL = 256
TERRAIN_CELL = 256
DIRECTIONS = [
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
    "N",
    "NNE",
    "NE",
    "ENE",
]


@dataclass(frozen=True)
class UnitSpec:
    key: str
    source: str
    family: str
    variant: str
    display_name: str
    role: str
    accent: str
    fill: float = 0.80
    quality_note: str = ""


@dataclass(frozen=True)
class TerrainSpec:
    key: str
    source: str
    display_name: str
    theme: str
    palette: list[str]
    tile_roles: list[str]


UNIT_SPECS = [
    UnitSpec(
        "player_assault_raijin",
        "player-assault-raijin-16dir.png",
        "player",
        "assault",
        "Raijin assault tank",
        "fast striker",
        "#f6b94e",
        0.78,
    ),
    UnitSpec(
        "player_balanced_ironclad",
        "player-balanced-ironclad-16dir.png",
        "player",
        "balanced",
        "Ironclad command tank",
        "all-round command",
        "#22c0ff",
        0.80,
    ),
    UnitSpec(
        "player_heavy_genbu",
        "player-heavy-genbu-16dir.png",
        "player",
        "heavy",
        "Genbu fortress tank",
        "heavy armor",
        "#8fd8e8",
        0.84,
    ),
    UnitSpec(
        "wingman_assault",
        "wingman-assault-16dir.png",
        "wingman",
        "assault",
        "Assault wingman",
        "fire support",
        "#f6b94e",
        0.70,
    ),
    UnitSpec(
        "wingman_guard",
        "wingman-guard-16dir.png",
        "wingman",
        "guard",
        "Guard wingman",
        "shield support",
        "#22c0ff",
        0.72,
    ),
    UnitSpec(
        "wingman_flex",
        "wingman-flex-16dir.png",
        "wingman",
        "flex",
        "Flex wingman",
        "adaptive tactical",
        "#67f0c0",
        0.70,
        "Source is landscape format; sliced on native 4x4 cells to avoid losing frames.",
    ),
    UnitSpec(
        "enemy_crimson_tank",
        "enemy-crimson-tank-16dir.png",
        "enemy",
        "tank",
        "Crimson assault tank",
        "standard enemy armor",
        "#ff4c3f",
        0.78,
    ),
    UnitSpec(
        "enemy_crimson_carrier",
        "enemy-crimson-carrier-16dir.png",
        "enemy",
        "carrier",
        "Crimson carrier",
        "enemy support carrier",
        "#ff7144",
        0.78,
    ),
    UnitSpec(
        "boss_crimson_landship",
        "boss-crimson-landship-16dir.png",
        "boss",
        "landship",
        "Crimson landship boss",
        "boss armor",
        "#ff543f",
        0.88,
        "Source is landscape format; sliced on native 4x4 cells to preserve the wide hull.",
    ),
    UnitSpec(
        "support_airstrike_plane",
        "support-airstrike-plane-16dir.png",
        "support",
        "airstrike",
        "Airstrike support aircraft",
        "support strike aircraft",
        "#9bdcff",
        0.78,
    ),
]


TERRAIN_SPECS = [
    TerrainSpec(
        "stage_01_desert",
        "stage-01-desert-atlas.png",
        "Stage 01 desert outpost",
        "sandstone desert battlefield",
        ["sand", "ochre", "warm stone", "turquoise water"],
        [
            "sand ground A",
            "sand ground B",
            "sand road straight",
            "sand road corner",
            "road T junction",
            "road crossing",
            "oasis water",
            "water edge transition",
            "rock obstacle",
            "brush cover",
            "burned tank wreck",
            "crater",
            "sandbag cover",
            "wooden fence barrier",
            "crate debris",
            "ruined wall debris",
        ],
    ),
    TerrainSpec(
        "stage_02_rain",
        "stage-02-rain-atlas.png",
        "Stage 02 rain city",
        "wet asphalt and canal battlefield",
        ["blue gray", "wet asphalt", "green canal", "amber streetlight"],
        [
            "wet asphalt A",
            "wet asphalt B",
            "road straight",
            "road corner",
            "road T junction",
            "road crossing",
            "shallow water",
            "water edge transition",
            "concrete block obstacle",
            "tire barricade cover",
            "burned armored wreck",
            "rain crater",
            "sandbag cover",
            "metal fence barrier",
            "crate debris",
            "broken wall debris",
        ],
    ),
    TerrainSpec(
        "stage_03_forest",
        "stage-03-forest-atlas.png",
        "Stage 03 forest shrine",
        "moss forest battlefield",
        ["moss green", "soil", "stone", "warm shrine red"],
        [
            "forest ground A",
            "forest ground B",
            "dirt road straight",
            "dirt road corner",
            "dirt road T junction",
            "dirt road crossing",
            "pond water",
            "pond edge transition",
            "boulder obstacle",
            "fallen log cover",
            "burned tank wreck",
            "mud crater",
            "sandbag forest cover",
            "wood fence barrier",
            "crate debris",
            "broken shrine wall debris",
        ],
    ),
    TerrainSpec(
        "stage_04_industrial",
        "stage-04-industrial-atlas.png",
        "Stage 04 industrial ruins",
        "concrete and steel battlefield",
        ["light concrete", "rust orange", "graphite steel", "cyan utility light"],
        [
            "cracked concrete A",
            "cracked concrete B with dust",
            "metal road straight",
            "metal road corner",
            "road T junction",
            "road crossing",
            "oil-stained floor",
            "grated drain transition",
            "steel barricade obstacle",
            "pipe cover",
            "burned armored wreck",
            "concrete crater",
            "sandbag industrial cover",
            "chain-link fence barrier",
            "barrel crate debris",
            "collapsed factory wall debris",
        ],
    ),
    TerrainSpec(
        "stage_05_snow",
        "stage-05-snow-atlas.png",
        "Stage 05 snow battlefield",
        "winter snow and ice battlefield",
        ["blue white", "pale cyan", "silver gray", "amber glint"],
        [
            "snow ground A",
            "snow ground B with stones",
            "compacted snow road straight",
            "compacted snow road corner",
            "compacted snow road T junction",
            "compacted snow road crossing",
            "ice patch",
            "ice edge transition",
            "frozen boulder obstacle",
            "snowdrift cover",
            "frozen armored wreck",
            "snow crater",
            "snow-covered sandbag cover",
            "frosted fence barrier",
            "supply crate debris",
            "bunker rubble under snow",
        ],
    ),
    TerrainSpec(
        "stage_06_night_fortress",
        "stage-06-night-fortress-atlas.png",
        "Stage 06 night fortress",
        "moonlit fortress battlefield",
        ["deep blue", "graphite", "cyan electric", "moon white", "amber hazard"],
        [
            "dark stone slab A",
            "wet stone slab B",
            "fortress road straight",
            "fortress road corner",
            "fortress road T junction",
            "fortress road crossing",
            "blue-lit energy floor",
            "energy edge transition",
            "armored wall block obstacle",
            "pipe and grate cover",
            "burned fortress wreck",
            "blast crater",
            "steel barricade cover",
            "electric fence barrier",
            "barrel crate debris",
            "broken fortress masonry",
        ],
    ),
    TerrainSpec(
        "stage_07_final_battlefield",
        "stage-07-final-battlefield-atlas.png",
        "Stage 07 final battlefield",
        "scorched final fortress battlefield",
        ["charcoal", "crimson", "hot orange", "ember gold", "cyan warning"],
        [
            "scorched ground A",
            "scorched ground B with ash",
            "cracked asphalt road straight",
            "cracked asphalt road corner",
            "cracked asphalt road T junction",
            "cracked asphalt road crossing",
            "lava crack tile",
            "lava edge transition",
            "black rock obstacle",
            "ember smoke cover",
            "destroyed boss wreck",
            "magma crater",
            "scorched sandbag cover",
            "spiked metal fence barrier",
            "burning barrel debris",
            "broken final fortress debris",
        ],
    ),
]


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def crop_grid_cell(im: Image.Image, index: int) -> Image.Image:
    row, col = divmod(index, GRID)
    x0 = round(col * im.width / GRID)
    y0 = round(row * im.height / GRID)
    x1 = round((col + 1) * im.width / GRID)
    y1 = round((row + 1) * im.height / GRID)
    return im.crop((x0, y0, x1, y1))


def smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / max(1e-6, edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


def edge_cutout(rgba: Image.Image) -> Image.Image:
    arr = np.asarray(rgba.convert("RGBA")).astype(np.float32)
    rgb = arr[:, :, :3]
    h, w = rgb.shape[:2]
    edge = max(6, min(h, w) // 18)
    edge_pixels = np.concatenate(
        [
            rgb[:edge, :, :].reshape(-1, 3),
            rgb[-edge:, :, :].reshape(-1, 3),
            rgb[:, :edge, :].reshape(-1, 3),
            rgb[:, -edge:, :].reshape(-1, 3),
        ],
        axis=0,
    )
    bg = np.median(edge_pixels, axis=0)
    dist = np.linalg.norm(rgb - bg, axis=2)
    luma = rgb[:, :, 0] * 0.2126 + rgb[:, :, 1] * 0.7152 + rgb[:, :, 2] * 0.0722
    sat = rgb.max(axis=2) - rgb.min(axis=2)

    bg_dist = 68.0
    bg_like = (dist < bg_dist) | ((dist < bg_dist * 1.3) & (luma < 24) & (sat < 24))
    seed = np.zeros((h, w), dtype=bool)
    seed[:edge, :] = bg_like[:edge, :]
    seed[-edge:, :] = bg_like[-edge:, :]
    seed[:, :edge] = bg_like[:, :edge]
    seed[:, -edge:] = bg_like[:, -edge:]
    reached = ndimage.binary_propagation(seed, mask=bg_like)

    object_mask = ~reached
    object_mask = ndimage.binary_fill_holes(object_mask)
    object_mask = ndimage.binary_closing(object_mask, structure=np.ones((3, 3), dtype=bool))
    vivid = (dist > bg_dist * 0.9) & ((luma > 44) | (sat > 34))
    object_mask |= vivid

    alpha = Image.fromarray((object_mask.astype(np.uint8) * 255), "L").filter(ImageFilter.GaussianBlur(1.0))
    alpha_arr = np.asarray(alpha).astype(np.float32)
    alpha_arr *= np.clip(
        smoothstep(16, 72, dist) + smoothstep(28, 92, luma) * 0.35 + smoothstep(22, 72, sat) * 0.45,
        0,
        1,
    )
    alpha_arr[reached] = np.minimum(alpha_arr[reached], 8)
    return Image.fromarray(np.dstack([arr[:, :, :3], np.clip(alpha_arr, 0, 255)]).astype(np.uint8), "RGBA")


def normalize_alpha(cell: Image.Image) -> Image.Image:
    rgba = cell.convert("RGBA")
    alpha = np.asarray(rgba)[:, :, 3]
    if (alpha < 245).sum() > alpha.size * 0.05:
        cleaned = rgba.copy()
        a = cleaned.getchannel("A")
        a = a.point(lambda v: 0 if v < 4 else v)
        cleaned.putalpha(a)
        return prune_alpha_components(cleaned)
    return prune_alpha_components(edge_cutout(rgba))


def prune_alpha_components(rgba: Image.Image) -> Image.Image:
    """Drop tiny detached alpha flecks while keeping the unit body and close glow."""
    arr = np.asarray(rgba.convert("RGBA")).copy()
    mask = arr[:, :, 3] > 8
    labels, count = ndimage.label(mask)
    if count <= 1:
        return Image.fromarray(arr, "RGBA")

    areas = ndimage.sum(mask, labels, range(1, count + 1))
    largest_label = int(np.argmax(areas)) + 1
    largest_area = float(areas[largest_label - 1])
    slices = ndimage.find_objects(labels)
    main_slice = slices[largest_label - 1]
    if main_slice is None:
        return Image.fromarray(arr, "RGBA")

    main_y, main_x = main_slice
    h, w = mask.shape
    expand = round(max(h, w) * 0.13)
    main_box = (
        max(0, main_x.start - expand),
        max(0, main_y.start - expand),
        min(w, main_x.stop + expand),
        min(h, main_y.stop + expand),
    )
    cx = (main_x.start + main_x.stop) / 2
    cy = (main_y.start + main_y.stop) / 2
    keep = labels == largest_label

    for label_id, area in enumerate(areas, start=1):
        if label_id == largest_label:
            continue
        comp_slice = slices[label_id - 1]
        if comp_slice is None:
            continue
        ys, xs = comp_slice
        comp_box = (xs.start, ys.start, xs.stop, ys.stop)
        overlaps_main = not (
            comp_box[2] < main_box[0]
            or comp_box[0] > main_box[2]
            or comp_box[3] < main_box[1]
            or comp_box[1] > main_box[3]
        )
        comp_cx = (xs.start + xs.stop) / 2
        comp_cy = (ys.start + ys.stop) / 2
        near_center = ((comp_cx - cx) ** 2 + (comp_cy - cy) ** 2) ** 0.5 < max(h, w) * 0.38
        if area >= max(28, largest_area * 0.025) or (area >= 12 and (overlaps_main or near_center)):
            keep |= labels == label_id

    arr[:, :, 3] = np.where(keep, arr[:, :, 3], 0).astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def alpha_bbox(im: Image.Image, threshold: int = 8) -> tuple[int, int, int, int] | None:
    alpha = np.asarray(im.convert("RGBA"))[:, :, 3]
    ys, xs = np.where(alpha > threshold)
    if not len(xs) or not len(ys):
        return None
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def make_unit_frame(cell: Image.Image, bbox: tuple[int, int, int, int] | None, scale: float) -> Image.Image:
    canvas = Image.new("RGBA", (UNIT_CELL, UNIT_CELL), (0, 0, 0, 0))
    if bbox is None:
        return canvas
    pad = 6
    x0, y0, x1, y1 = bbox
    crop = cell.crop((max(0, x0 - pad), max(0, y0 - pad), min(cell.width, x1 + pad), min(cell.height, y1 + pad)))
    new_w = max(1, round(crop.width * scale))
    new_h = max(1, round(crop.height * scale))
    fit = min((UNIT_CELL - 10) / new_w, (UNIT_CELL - 10) / new_h, 1.0)
    if fit < 1:
        new_w = max(1, round(new_w * fit))
        new_h = max(1, round(new_h * fit))
    crop = crop.resize((new_w, new_h), Image.LANCZOS)
    canvas.alpha_composite(crop, ((UNIT_CELL - new_w) // 2, (UNIT_CELL - new_h) // 2))
    return canvas


def process_unit(spec: UnitSpec) -> dict:
    src = SRC_UNITS / spec.source
    if not src.exists():
        raise FileNotFoundError(src)

    im = Image.open(src).convert("RGBA")
    cells = [normalize_alpha(crop_grid_cell(im, i)) for i in range(GRID * GRID)]
    boxes = [alpha_bbox(cell) for cell in cells]
    sides = [max(box[2] - box[0], box[3] - box[1]) for box in boxes if box]
    max_side = max(sides) if sides else UNIT_CELL
    scale = min((UNIT_CELL * spec.fill) / max_side, 2.4)

    unit_dir = OUT_UNITS / spec.key
    if unit_dir.exists():
        shutil.rmtree(unit_dir)
    unit_dir.mkdir(parents=True, exist_ok=True)

    sheet = Image.new("RGBA", (UNIT_CELL * GRID, UNIT_CELL * GRID), (0, 0, 0, 0))
    frame_items = []
    for i, (cell, box) in enumerate(zip(cells, boxes)):
        frame = make_unit_frame(cell, box, scale)
        frame_path = unit_dir / f"frame-{i:02d}.png"
        frame.save(frame_path, optimize=True)
        sheet.alpha_composite(frame, ((i % GRID) * UNIT_CELL, (i // GRID) * UNIT_CELL))
        frame_items.append(
            {
                "index": i,
                "direction": DIRECTIONS[i],
                "path": rel(frame_path),
                "width": UNIT_CELL,
                "height": UNIT_CELL,
            }
        )

    sheet_path = OUT_UNITS / f"{spec.key}-sheet.png"
    sheet.save(sheet_path, optimize=True)
    return {
        **asdict(spec),
        "sourcePath": rel(src),
        "sheetPath": rel(sheet_path),
        "frameDir": rel(unit_dir),
        "frames": frame_items,
        "cellSize": UNIT_CELL,
        "sourceSize": [im.width, im.height],
        "outputSize": [sheet.width, sheet.height],
        "directions": DIRECTIONS,
    }


def process_terrain(spec: TerrainSpec) -> dict:
    src = SRC_TERRAIN / spec.source
    if not src.exists():
        raise FileNotFoundError(src)

    im = Image.open(src).convert("RGB")
    stage_dir = OUT_TERRAIN / spec.key
    if stage_dir.exists():
        shutil.rmtree(stage_dir)
    stage_dir.mkdir(parents=True, exist_ok=True)

    atlas = Image.new("RGB", (TERRAIN_CELL * GRID, TERRAIN_CELL * GRID), (0, 0, 0))
    tile_items = []
    for i, role in enumerate(spec.tile_roles):
        cell = crop_grid_cell(im, i)
        inset = max(1, round(min(cell.width, cell.height) * 0.006))
        if cell.width > inset * 2 and cell.height > inset * 2:
            cell = cell.crop((inset, inset, cell.width - inset, cell.height - inset))
        tile = cell.resize((TERRAIN_CELL, TERRAIN_CELL), Image.LANCZOS)
        tile_path = stage_dir / f"tile-{i:02d}.png"
        tile.save(tile_path, optimize=True)
        atlas.paste(tile, ((i % GRID) * TERRAIN_CELL, (i // GRID) * TERRAIN_CELL))
        tile_items.append(
            {
                "index": i,
                "role": role,
                "path": rel(tile_path),
                "width": TERRAIN_CELL,
                "height": TERRAIN_CELL,
            }
        )

    atlas_path = OUT_TERRAIN / f"{spec.key}-atlas.png"
    atlas.save(atlas_path, optimize=True)
    return {
        **asdict(spec),
        "sourcePath": rel(src),
        "atlasPath": rel(atlas_path),
        "tileDir": rel(stage_dir),
        "tiles": tile_items,
        "cellSize": TERRAIN_CELL,
        "sourceSize": [im.width, im.height],
        "outputSize": [atlas.width, atlas.height],
    }


def label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fill: tuple[int, int, int]) -> None:
    draw.text(xy, text, fill=fill)


def write_unit_contact_sheet(units: list[dict]) -> str:
    thumb = 64
    label_w = 230
    row_h = thumb + 34
    width = label_w + GRID * GRID * thumb
    height = 38 + len(units) * row_h
    sheet = Image.new("RGB", (width, height), (8, 11, 16))
    draw = ImageDraw.Draw(sheet)
    label(draw, (14, 12), "v15 top-down unit direction sheets: 16 frames per unit", (231, 239, 247))
    for row, unit in enumerate(units):
        y = 38 + row * row_h
        label(draw, (14, y + 10), unit["display_name"], (235, 240, 248))
        label(draw, (14, y + 28), f"{unit['family']} / {unit['variant']} / {unit['role']}", (120, 191, 215))
        for i, frame in enumerate(unit["frames"]):
            im = Image.open(ROOT / frame["path"]).convert("RGBA").resize((thumb, thumb), Image.LANCZOS)
            bg = Image.new("RGBA", (thumb, thumb), (18, 24, 34, 255))
            bg.alpha_composite(im)
            x = label_w + i * thumb
            sheet.paste(bg.convert("RGB"), (x, y))
            if row == 0:
                label(draw, (x + 6, 22), frame["direction"], (132, 153, 172))
    UNIT_CONTACT_OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(UNIT_CONTACT_OUT, optimize=True)
    return rel(UNIT_CONTACT_OUT)


def write_terrain_contact_sheet(stages: list[dict]) -> str:
    scale = 70
    atlas_thumb = scale * GRID
    label_h = 40
    gap = 18
    cols = 2
    rows = (len(stages) + cols - 1) // cols
    width = cols * atlas_thumb + (cols + 1) * gap
    height = rows * (atlas_thumb + label_h) + (rows + 1) * gap
    sheet = Image.new("RGB", (width, height), (9, 12, 15))
    draw = ImageDraw.Draw(sheet)
    for i, stage in enumerate(stages):
        col = i % cols
        row = i // cols
        x = gap + col * (atlas_thumb + gap)
        y = gap + row * (atlas_thumb + label_h + gap)
        label(draw, (x, y), stage["display_name"], (235, 240, 248))
        label(draw, (x, y + 18), stage["theme"], (130, 193, 216))
        atlas = Image.open(ROOT / stage["atlasPath"]).convert("RGB").resize((atlas_thumb, atlas_thumb), Image.LANCZOS)
        sheet.paste(atlas, (x, y + label_h))
        for n in range(1, GRID):
            gx = x + n * scale
            gy = y + label_h + n * scale
            draw.line((gx, y + label_h, gx, y + label_h + atlas_thumb), fill=(36, 43, 52))
            draw.line((x, gy, x + atlas_thumb, gy), fill=(36, 43, 52))
    TERRAIN_CONTACT_OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(TERRAIN_CONTACT_OUT, optimize=True)
    return rel(TERRAIN_CONTACT_OUT)


def main() -> None:
    OUT_UNITS.mkdir(parents=True, exist_ok=True)
    OUT_TERRAIN.mkdir(parents=True, exist_ok=True)

    units = [process_unit(spec) for spec in UNIT_SPECS]
    terrain = [process_terrain(spec) for spec in TERRAIN_SPECS]
    unit_contact = write_unit_contact_sheet(units)
    terrain_contact = write_terrain_contact_sheet(terrain)

    manifest = {
        "version": "v1.5-topdown-directional-modular-assets",
        "status": "assets-only-not-wired",
        "generatedAt": "2026-08-31",
        "style": "Japanese Tactical HD-2D, bright top-down battlefield art",
        "grid": {"unitDirections": GRID * GRID, "terrainTilesPerStage": GRID * GRID},
        "directions": DIRECTIONS,
        "unitCellSize": UNIT_CELL,
        "terrainCellSize": TERRAIN_CELL,
        "units": units,
        "terrain": terrain,
        "contactSheets": {
            "units": unit_contact,
            "terrain": terrain_contact,
        },
        "notes": [
            "This batch corrects the prior single-angle oblique combat-unit mismatch for a flat top-down map.",
            "Terrain atlases are intended as modular 4x4 tile kits; mixed-terrain levels can assemble multiple tiles from one or more stage sets.",
            "Existing v1.4 oblique assets and game renderer files are not overwritten by this script.",
        ],
    }
    MANIFEST_OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "units": len(units),
                "unitFrames": sum(len(item["frames"]) for item in units),
                "terrainStages": len(terrain),
                "terrainTiles": sum(len(item["tiles"]) for item in terrain),
                "manifest": str(MANIFEST_OUT),
                "unitContact": str(ROOT / unit_contact),
                "terrainContact": str(ROOT / terrain_contact),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
