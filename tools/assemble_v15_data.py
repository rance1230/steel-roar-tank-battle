#!/usr/bin/env python3
"""Assemble v1.5 top-down unit sheets into src/data/v15.data.js (runtime manifest).

Downscales each processed 4x4 direction sheet (256px cells) to a per-unit
runtime cell size, encodes as WebP (falls back to PNG when WebP is not
smaller), and inlines everything as data URIs so `node build.js` can produce
the single-file index.html. Regenerate with:
    python3 tools/assemble_v15_data.py
"""

import base64
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "assets" / "ai-v15-topdown" / "processed" / "units"
SRC_TERRAIN = ROOT / "assets" / "ai-v15-topdown" / "processed" / "terrain-atlases"
OUT = ROOT / "src" / "data" / "v15.data.js"

# Actual sheet order (verified 2026-08-31 against rendered frames): idx0=E then
# counter-clockwise 22.5°/frame on screen (idx4=N, idx8=W, idx12=S). The
# generated manifest's original clockwise labels were wrong.
DIRECTIONS = [
    "E", "ENE", "NE", "NNE", "N", "NNW", "NW", "WNW",
    "W", "WSW", "SW", "SSW", "S", "SSE", "SE", "ESE",
]

# key, family, variant, runtime cell px, logical draw width, glow
UNIT_SPECS = [
    ("player_assault_raijin",     "player",  "assault",   128, 54,  "#f6b94e"),
    ("player_balanced_ironclad",  "player",  "balanced",  128, 52,  "#22c0ff"),
    ("player_heavy_genbu",        "player",  "heavy",     128, 62,  "#8fd8e8"),
    ("wingman_assault",           "wingman", "assault",   96,  36,  "#f6b94e"),
    ("wingman_guard",             "wingman", "guard",     96,  38,  "#22c0ff"),
    ("wingman_flex",              "wingman", "flex",      96,  35,  "#67f0c0"),
    ("enemy_crimson_tank",        "enemy",   "tank",      128, 48,  "#ff4c3f"),
    ("enemy_crimson_carrier",     "enemy",   "truck",     128, 46,  "#ff7144"),
    ("boss_crimson_landship",     "boss",    "landship",  192, 132, "#ff543f"),
    ("support_airstrike_plane",   "support", "airstrike", 128, 56,  "#9bdcff"),
]

# 实测每帧朝向角 (屏幕系, 0=E, 顺时针为正, 单位°)。
# 生成 sheet 的帧序既不统一顺/逆时针、步进也不均匀 (2026-08-31 逐帧测量),
# 运行时按"最近角度"选帧, 缺失方向自动落到最接近的可用帧。
# flex 机身近对称、飞机测量被翼尖干扰: 两者的实测无单调性, 用理想均匀 CCW 表兜底。
UNIFORM_CCW = [0, -22.5, -45, -67.5, -90, -112.5, -135, -157.5,
               -180, -202.5, -225, -247.5, -270, -292.5, -315, -337.5]
FRAME_ANGLES = {
    "player_assault_raijin":    [-0.8, -28.0, -46.4, -57.1, -90.0, -125.0, -133.7, -142.4,
                                 179.5, 150.4, 136.1, 121.2, 90.0, 56.5, 42.5, 29.3],
    "player_balanced_ironclad": [-4.7, -16.1, -31.9, -46.1, -57.3, -82.0, -88.5, -116.8,
                                 -145.3, -168.5, -171.3, -173.3, 90.0, 54.6, 41.1, 29.9],
    "player_heavy_genbu":       [-1.0, -39.7, -46.3, -47.8, -89.1, -111.3, -123.7, -136.0,
                                 -174.9, 157.6, 141.6, 135.9, 89.8, 55.8, 41.5, 23.3],
    "wingman_assault":          [-1.1, 15.4, 43.1, 64.7, 89.4, 128.3, 138.9, 155.2,
                                 180.4, 217.6, 228.0, 238.9, 270.2, 304.7, 314.8, 328.7],
    "wingman_guard":            [-2.9, 21.6, 33.8, 45.8, 62.4, 79.3, 107.4, 120.3,
                                 181.9, 195.3, 197.2, 214.5, 226.5, 270.1, 272.2, 305.8],
    "wingman_flex":             UNIFORM_CCW,
    "enemy_crimson_tank":       [-6.0, -32.7, -46.5, -60.2, -66.5, -68.0, -78.5, -116.7,
                                 -171.6, 154.9, 140.6, 126.1, 117.0, 91.7, 23.2, 5.3],
    "enemy_crimson_carrier":    [-7.1, -37.0, -44.5, -65.5, -68.1, -67.2, -85.6, -90.1,
                                 -125.8, -134.0, -143.2, -134.1, -120.4, -128.1, -127.8, -159.4],
    "boss_crimson_landship":    [-4.1, -7.8, -16.5, -22.9, -32.4, -42.2, -43.9, -47.8,
                                 -89.2, -138.9, -143.3, -135.4, -139.7, -166.9, -171.7, -176.1],
    "support_airstrike_plane":  UNIFORM_CCW,
}

WEBP_QUALITY = 88

# v1.5 地形: 每 stage 从 4x4 图集取 8 个槽位拼成横条 (游戏 tile id 的语义映射:
# ground A/B=槽0/1, 小径=槽2, 水面/油污/能量/熔岩=槽6, 水岸过渡=槽7,
# 岩石障碍=槽8, 残骸变体=槽14/15)。运行时烘焙到 16px。
TERRAIN_STAGES = [
    "stage_01_desert",
    "stage_02_rain",
    "stage_03_forest",
    "stage_04_industrial",
    "stage_05_snow",
    "stage_06_night_fortress",
    "stage_07_final_battlefield",
]
TERRAIN_SLOTS = [0, 1, 2, 6, 7, 8, 14, 15]
TERRAIN_SRC_CELL = 256
TERRAIN_OUT_CELL = 32


def encode_uri(im: Image.Image) -> tuple[str, str, int]:
    """Encode as WebP when smaller, else PNG. Returns (data_uri, fmt, bytes)."""
    png = io.BytesIO()
    im.save(png, "PNG", optimize=True)
    webp = io.BytesIO()
    im.save(webp, "WEBP", quality=WEBP_QUALITY, method=6)
    if len(webp.getvalue()) < len(png.getvalue()):
        return "data:image/webp;base64," + base64.b64encode(webp.getvalue()).decode(), "webp", len(webp.getvalue())
    return "data:image/png;base64," + base64.b64encode(png.getvalue()).decode(), "png", len(png.getvalue())


def encode_terrain_strips(images: dict, terrain: dict) -> int:
    """每 stage 8 槽位 → 32px 横条 WebP; 记录 slots 供运行时烘焙。"""
    total = 0
    cell = TERRAIN_OUT_CELL
    for idx, stage in enumerate(TERRAIN_STAGES):
        atlas = Image.open(SRC_TERRAIN / f"{stage}-atlas.png").convert("RGB")
        strip = Image.new("RGB", (cell * len(TERRAIN_SLOTS), cell))
        for j, slot in enumerate(TERRAIN_SLOTS):
            r, c = divmod(slot, 4)
            tile = atlas.crop(
                (c * TERRAIN_SRC_CELL, r * TERRAIN_SRC_CELL,
                 (c + 1) * TERRAIN_SRC_CELL, (r + 1) * TERRAIN_SRC_CELL)
            ).resize((cell, cell), Image.LANCZOS)
            strip.paste(tile, (j * cell, 0))
        key = f"terrain_{stage}"
        uri, fmt, nbytes = encode_uri(strip)
        images[key] = uri
        total += nbytes
        terrain["stages"].append({"key": stage, "img": key, "cell": cell})
        print(f"{key:34s} {fmt}  {nbytes // 1024}KB")
    terrain["slots"] = TERRAIN_SLOTS
    terrain["cell"] = cell
    return total


def main() -> None:
    images: dict[str, str] = {}
    units: dict[str, dict] = {}
    terrain: dict = {"stages": []}
    total = 0
    for key, family, variant, cell, draw_w, glow in UNIT_SPECS:
        sheet = Image.open(SRC_DIR / f"{key}-sheet.png").convert("RGBA")
        small = sheet.resize((cell * 4, cell * 4), Image.LANCZOS)
        uri, fmt, nbytes = encode_uri(small)
        images[key] = uri
        total += nbytes
        units.setdefault(family, {})[variant] = {
            "img": key, "cell": cell, "w": draw_w, "glow": glow,
            "angles": FRAME_ANGLES[key],
        }
        print(f"{key:28s} {fmt}  cell={cell:3d}  {nbytes // 1024:4d}KB")

    total += encode_terrain_strips(images, terrain)

    manifest = {
        "version": "v1.5-topdown-units",
        "generatedAt": "2026-08-31",
        "directions": DIRECTIONS,
        "images": images,
        "units": units,
        "terrain": terrain,
        "notes": [
            "Runtime slice of assets/ai-v15-topdown processed sheets; see tools/assemble_v15_data.py.",
            "Per-unit cell sizes: boss 192, player/enemy/plane 128, wingman 96.",
            "Terrain strips: 8 slots per stage, baked to 16px tiles at runtime by src/game/v15terrain.js.",
        ],
    }
    js = (
        "/* v15 top-down 16向单位资产 — 由 tools/assemble_v15_data.py 生成, 勿手改 */\n"
        + "window.V15_MANIFEST="
        + json.dumps(manifest, separators=(",", ":"), ensure_ascii=False)
        + ";\n"
    )
    OUT.write_text(js, encoding="utf-8")
    print(f"total encoded: {total // 1024}KB  ->  {OUT}  ({OUT.stat().st_size // 1024}KB)")


if __name__ == "__main__":
    main()
