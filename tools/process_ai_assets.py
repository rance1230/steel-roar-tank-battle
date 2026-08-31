#!/usr/bin/env python3
"""Process generated v1.4 AI art into game-ready PNG assets.

The generator often returns isolated assets on a dark studio backdrop rather
than true alpha. This script keeps the original source files, builds a soft
cutout alpha from edge-connected background pixels, normalizes image sizes,
and writes a small browser manifest consumed by src/game/aiart.js.
"""

from __future__ import annotations

import json
import base64
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "ai-v14" / "source"
OUT = ROOT / "assets" / "ai-v14" / "processed"
DATA_OUT = ROOT / "src" / "data" / "ai_assets.data.js"
JSON_OUT = ROOT / "assets" / "ai-v14" / "asset-manifest.json"
CONTACT_OUT = OUT / "contact-sheet.png"


@dataclass(frozen=True)
class AssetSpec:
    key: str
    source: str
    output: str
    kind: str
    max_size: int
    bg_dist: float = 82.0
    dark_luma: float = 26.0
    dark_sat: float = 22.0
    pad: int = 24


ASSETS = [
    AssetSpec("player_raijin", "player-raijin.png", "player-raijin-cutout.png", "cutout", 720, 86, 24, 20, 34),
    AssetSpec("player_balanced", "player-balanced.png", "player-balanced-cutout.png", "cutout", 720, 88, 24, 20, 34),
    AssetSpec("player_genbu", "player-genbu.png", "player-genbu-cutout.png", "cutout", 760, 90, 24, 20, 36),
    AssetSpec("enemy_crimson_assault", "enemy-crimson-assault.png", "enemy-crimson-assault-cutout.png", "cutout", 640, 92, 24, 24, 30),
    AssetSpec("enemy_crimson_carrier", "enemy-crimson-carrier.png", "enemy-crimson-carrier-cutout.png", "cutout", 640, 92, 24, 24, 30),
    AssetSpec("wingman_assault", "wingman-assault.png", "wingman-assault-cutout.png", "cutout", 560, 88, 24, 20, 30),
    AssetSpec("wingman_guard", "wingman-guardian.png", "wingman-guardian-cutout.png", "cutout", 580, 90, 24, 20, 30),
    AssetSpec("wingman_tactical", "wingman-tactical.png", "wingman-tactical-cutout.png", "cutout", 560, 88, 24, 20, 30),
    AssetSpec("boss_landship", "boss-landship.png", "boss-landship-cutout.png", "cutout", 920, 94, 25, 24, 36),
    AssetSpec("fx_explosion_core", "fx-explosion-core.png", "fx-explosion-core-cutout.png", "cutout", 640, 80, 22, 28, 18),
    AssetSpec("ui_hud_ornaments", "ui-hud-ornaments.png", "ui-hud-ornaments.png", "reference", 960),
    AssetSpec("stage1_ground_texture", "stage1-ground-texture.png", "stage1-ground-texture.png", "texture", 768),
]


def _smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / max(1e-6, edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


def cutout_dark_backdrop(im: Image.Image, spec: AssetSpec) -> Image.Image:
    rgba = im.convert("RGBA")
    arr = np.asarray(rgba).astype(np.float32)
    rgb = arr[:, :, :3]
    h, w = rgb.shape[:2]
    edge = max(10, min(h, w) // 32)
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

    bg_like = (dist < spec.bg_dist) | ((luma < spec.dark_luma) & (sat < spec.dark_sat))
    seed = np.zeros((h, w), dtype=bool)
    seed[:edge, :] = bg_like[:edge, :]
    seed[-edge:, :] = bg_like[-edge:, :]
    seed[:, :edge] = bg_like[:, :edge]
    seed[:, -edge:] = bg_like[:, -edge:]
    reached = ndimage.binary_propagation(seed, mask=bg_like)

    object_mask = ~reached
    object_mask = ndimage.binary_fill_holes(object_mask)
    object_mask = ndimage.binary_opening(object_mask, structure=np.ones((2, 2), dtype=bool))
    object_mask = ndimage.binary_closing(object_mask, structure=np.ones((3, 3), dtype=bool))

    # Preserve bright emissive parts and high-saturation sparks even when they
    # touch the source edge; suppress low-detail studio backdrop halos.
    vivid = (dist > spec.bg_dist * 1.08) & ((luma > 48) | (sat > 34))
    object_mask |= vivid
    alpha = Image.fromarray((object_mask.astype(np.uint8) * 255), "L").filter(ImageFilter.GaussianBlur(1.2))
    a = np.asarray(alpha).astype(np.float32)
    a *= np.clip(_smoothstep(18, 78, dist) + _smoothstep(30, 95, luma) * 0.42 + _smoothstep(24, 72, sat) * 0.45, 0, 1)
    a[reached] = np.minimum(a[reached], 18)
    out = np.dstack([arr[:, :, :3], np.clip(a, 0, 255)]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def crop_and_resize(im: Image.Image, spec: AssetSpec) -> Image.Image:
    rgba = im.convert("RGBA")
    alpha = np.asarray(rgba)[:, :, 3]
    ys, xs = np.where(alpha > 14)
    if len(xs) and len(ys):
        x0, x1 = max(0, xs.min() - spec.pad), min(rgba.width, xs.max() + spec.pad + 1)
        y0, y1 = max(0, ys.min() - spec.pad), min(rgba.height, ys.max() + spec.pad + 1)
        rgba = rgba.crop((x0, y0, x1, y1))
    scale = min(1.0, spec.max_size / max(rgba.width, rgba.height))
    if scale < 1:
        rgba = rgba.resize((round(rgba.width * scale), round(rgba.height * scale)), Image.LANCZOS)
    return rgba


def process_asset(spec: AssetSpec) -> dict:
    src = SRC / spec.source
    if not src.exists():
        raise FileNotFoundError(src)
    im = Image.open(src)
    if spec.kind == "cutout":
        im = cutout_dark_backdrop(im, spec)
        im = crop_and_resize(im, spec)
    elif spec.kind == "texture":
        im = im.convert("RGB")
        scale = spec.max_size / max(im.width, im.height)
        if scale < 1:
            im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    else:
        im = im.convert("RGBA")
        scale = spec.max_size / max(im.width, im.height)
        if scale < 1:
            im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)

    OUT.mkdir(parents=True, exist_ok=True)
    dst = OUT / spec.output
    im.save(dst, optimize=True)
    return {
        "key": spec.key,
        "kind": spec.kind,
        "path": str(dst.relative_to(ROOT)),
        "source": str(src.relative_to(ROOT)),
        "width": im.width,
        "height": im.height,
        "mode": im.mode,
    }


def write_contact_sheet(items: list[dict]) -> str:
    picked = [
        ("PLAYER / ASSAULT", "player_raijin"),
        ("PLAYER / BALANCED", "player_balanced"),
        ("PLAYER / FORTRESS", "player_genbu"),
        ("WING / ASSAULT", "wingman_assault"),
        ("WING / GUARD", "wingman_guard"),
        ("WING / FLEX", "wingman_tactical"),
        ("ENEMY / TANK", "enemy_crimson_assault"),
        ("ENEMY / CARRIER", "enemy_crimson_carrier"),
        ("BOSS", "boss_landship"),
        ("FX / EXPLOSION", "fx_explosion_core"),
    ]
    by_key = {item["key"]: item for item in items}
    cell_w, cell_h, cols = 260, 210, 5
    rows = (len(picked) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), (7, 10, 16))
    for i, (label, key) in enumerate(picked):
        item = by_key.get(key)
        if not item:
            continue
        src = ROOT / item["path"]
        im = Image.open(src).convert("RGBA")
        tile = Image.new("RGBA", (cell_w, cell_h), (11, 16, 24, 255))
        bg = Image.new("RGBA", (cell_w - 24, cell_h - 48), (19, 27, 39, 255))
        tile.alpha_composite(bg, (12, 32))
        scale = min((cell_w - 48) / im.width, (cell_h - 76) / im.height, 1.0)
        if scale < 1:
            im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        tile.alpha_composite(im, ((cell_w - im.width) // 2, 36 + (cell_h - 76 - im.height) // 2))
        draw = ImageDraw.Draw(tile)
        draw.text((14, 12), label, fill=(230, 238, 248))
        draw.text((14, cell_h - 24), f"{item['width']}x{item['height']}", fill=(105, 185, 220))
        sheet.paste(tile.convert("RGB"), ((i % cols) * cell_w, (i // cols) * cell_h))
    CONTACT_OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT_OUT, optimize=True)
    return str(CONTACT_OUT.relative_to(ROOT))


def data_url(rel_path: str) -> str:
    data = (ROOT / rel_path).read_bytes()
    return "data:image/png;base64," + base64.b64encode(data).decode("ascii")


def main() -> None:
    processed = [process_asset(spec) for spec in ASSETS]
    contact = write_contact_sheet(processed)
    images = {item["key"]: item["path"] for item in processed}
    manifest = {
        "version": "v1.4-ai-art-slice",
        "style": "Japanese Tactical HD-2D",
        "generatedAt": "2026-08-30",
        "images": images,
        "units": {
            "player": {
                "assault": {"image": "player_raijin", "w": 52, "anchor": [0.53, 0.56], "glow": "#f6b94e", "role": "fast striker"},
                "balanced": {"image": "player_balanced", "w": 50, "anchor": [0.53, 0.56], "glow": "#22c0ff", "role": "all-round command"},
                "heavy": {"image": "player_genbu", "w": 62, "anchor": [0.54, 0.58], "glow": "#8fd8e8", "role": "fortress armor"},
            },
            "wingman": {
                "assault": {"image": "wingman_assault", "w": 36, "anchor": [0.53, 0.56], "glow": "#f6b94e", "role": "fire support"},
                "guard": {"image": "wingman_guard", "w": 39, "anchor": [0.54, 0.58], "glow": "#22c0ff", "role": "shield support"},
                "flex": {"image": "wingman_tactical", "w": 34, "anchor": [0.53, 0.57], "glow": "#67f0c0", "role": "adaptive tactical"},
            },
            "enemy": {
                "tank": {"image": "enemy_crimson_assault", "w": 48, "bossW": 120, "anchor": [0.53, 0.57]},
                "truck": {"image": "enemy_crimson_carrier", "w": 46, "bossW": 116, "anchor": [0.54, 0.58]},
                "boss": {"image": "boss_landship", "w": 132, "anchor": [0.55, 0.58]},
            },
        },
        "environment": {"stage1Ground": "stage1_ground_texture"},
        "fx": {"explosion": "fx_explosion_core"},
        "ui": {"ornaments": "ui_hud_ornaments"},
        "contactSheet": contact,
        "processed": processed,
    }
    JSON_OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    browser_manifest = json.loads(json.dumps(manifest, ensure_ascii=False))
    browser_manifest["delivery"] = "embedded-data-url"
    browser_manifest["imagePaths"] = images
    browser_manifest["images"] = {key: data_url(path) for key, path in images.items()}
    DATA_OUT.write_text(
        "/* generated by tools/process_ai_assets.py */\n"
        "window.AI_ART_MANIFEST="
        + json.dumps(browser_manifest, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "processed": len(processed),
        "manifest": str(JSON_OUT),
        "data": str(DATA_OUT),
        "delivery": "embedded-data-url",
        "contact": str(ROOT / contact),
        "dataBytes": DATA_OUT.stat().st_size,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
