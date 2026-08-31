#!/usr/bin/env python3
"""Normalize generated bright campaign art into usable project assets."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SRC_INTRO = ROOT / "assets" / "ai-v14" / "source" / "bright-stage-intros"
SRC_TERRAIN = ROOT / "assets" / "ai-v14" / "source" / "terrain-v2"
OUT_INTRO = ROOT / "assets" / "ai-v14" / "processed" / "bright-stage-intros"
OUT_TERRAIN = ROOT / "assets" / "ai-v14" / "processed" / "terrain-v2"
MANIFEST_OUT = ROOT / "assets" / "ai-v14" / "campaign-assets-manifest.json"

INTRO_SIZE = (1672, 941)
TERRAIN_SIZE = (768, 768)


@dataclass(frozen=True)
class CampaignImage:
    key: str
    stage: int | None
    theme: str
    source: str
    output: str


INTRO_IMAGES = [
    CampaignImage("title_bright", None, "Bright Campaign Title", "title-bright.png", "title-bright.png"),
    CampaignImage("stage_01_desert_bright", 1, "Warm Desert", "stage-01-desert-bright.png", "stage-01-desert-bright.png"),
    CampaignImage("stage_02_rain_bright", 2, "Cold Rain Battlefield", "stage-02-rain-bright.png", "stage-02-rain-bright.png"),
    CampaignImage("stage_03_forest_bright", 3, "Deep Green Forest", "stage-03-forest-bright.png", "stage-03-forest-bright.png"),
    CampaignImage("stage_04_industrial_bright", 4, "Industrial Ruins", "stage-04-industrial-bright.png", "stage-04-industrial-bright.png"),
    CampaignImage("stage_05_snow_bright", 5, "Snow Battlefield", "stage-05-snow-bright.png", "stage-05-snow-bright.png"),
    CampaignImage("stage_06_fortress_bright", 6, "Night Fortress", "stage-06-fortress-bright.png", "stage-06-fortress-bright.png"),
    CampaignImage("stage_07_final_bright", 7, "Dark Red Final Battlefield", "stage-07-final-bright.png", "stage-07-final-bright.png"),
]

TERRAIN_IMAGES = [
    CampaignImage("stage_02_rain_ground", 2, "Cold Rain Battlefield", "stage-02-rain-ground.png", "stage-02-rain-ground.png"),
    CampaignImage("stage_03_forest_ground", 3, "Deep Green Forest", "stage-03-forest-ground.png", "stage-03-forest-ground.png"),
    CampaignImage("stage_04_industrial_ground", 4, "Industrial Ruins", "stage-04-industrial-ground.png", "stage-04-industrial-ground.png"),
    CampaignImage("stage_05_snow_ground", 5, "Snow Battlefield", "stage-05-snow-ground.png", "stage-05-snow-ground.png"),
    CampaignImage("stage_06_fortress_ground", 6, "Night Fortress", "stage-06-fortress-ground.png", "stage-06-fortress-ground.png"),
    CampaignImage("stage_07_final_ground", 7, "Dark Red Final Battlefield", "stage-07-final-ground.png", "stage-07-final-ground.png"),
]


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def fit_image(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    im = im.convert("RGB")
    src_ratio = im.width / im.height
    dst_ratio = size[0] / size[1]
    if abs(src_ratio - dst_ratio) > 0.01:
        if src_ratio > dst_ratio:
            new_w = round(im.height * dst_ratio)
            x0 = (im.width - new_w) // 2
            im = im.crop((x0, 0, x0 + new_w, im.height))
        else:
            new_h = round(im.width / dst_ratio)
            y0 = (im.height - new_h) // 2
            im = im.crop((0, y0, im.width, y0 + new_h))
    if im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return im


def process_one(item: CampaignImage, src_dir: Path, out_dir: Path, size: tuple[int, int]) -> dict:
    src = src_dir / item.source
    if not src.exists():
        raise FileNotFoundError(src)
    out_dir.mkdir(parents=True, exist_ok=True)
    im = fit_image(Image.open(src), size)
    dst = out_dir / item.output
    im.save(dst, optimize=True)
    return {
        "key": item.key,
        "stage": item.stage,
        "theme": item.theme,
        "source": rel(src),
        "path": rel(dst),
        "width": im.width,
        "height": im.height,
        "mode": im.mode,
    }


def contact_sheet(items: list[dict], output: Path, thumb_size: tuple[int, int], cols: int) -> str:
    pad, label_h = 12, 26
    cell_w, cell_h = thumb_size[0] + pad * 2, thumb_size[1] + label_h + pad * 2
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cell_w * cols, cell_h * rows), (8, 12, 18))
    draw = ImageDraw.Draw(sheet)
    for i, item in enumerate(items):
        im = Image.open(ROOT / item["path"]).convert("RGB")
        im.thumbnail(thumb_size, Image.LANCZOS)
        ox, oy = (i % cols) * cell_w, (i // cols) * cell_h
        sheet.paste(im, (ox + pad + (thumb_size[0] - im.width) // 2, oy + label_h + pad))
        label = "TITLE" if item["stage"] is None else f"STAGE {item['stage']:02d}"
        draw.text((ox + pad, oy + 8), f"{label} / {item['theme']}", fill=(235, 241, 248))
        draw.rectangle((ox + pad, oy + label_h + pad, ox + pad + thumb_size[0], oy + label_h + pad + thumb_size[1]), outline=(47, 68, 88))
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output, optimize=True)
    return rel(output)


def main() -> None:
    intro = [process_one(item, SRC_INTRO, OUT_INTRO, INTRO_SIZE) for item in INTRO_IMAGES]
    terrain = [process_one(item, SRC_TERRAIN, OUT_TERRAIN, TERRAIN_SIZE) for item in TERRAIN_IMAGES]
    intro_contact = contact_sheet(intro, OUT_INTRO / "contact-sheet.png", (320, 180), 2)
    terrain_contact = contact_sheet(terrain, OUT_TERRAIN / "contact-sheet.png", (192, 192), 3)
    manifest = {
        "version": "v1.4-bright-campaign-assets",
        "style": "Japanese Tactical HD-2D bright campaign art",
        "generatedAt": "2026-08-30",
        "status": "assets-only-not-wired",
        "dimensions": {"stageIntro": INTRO_SIZE, "terrain": TERRAIN_SIZE},
        "title": intro[0],
        "stageIntros": intro[1:],
        "terrainOverlays": terrain,
        "contactSheets": {"stageIntros": intro_contact, "terrain": terrain_contact},
        "notes": [
            "Existing assets/stage-intros files are not overwritten.",
            "Stage 1 terrain already exists in the v1.4 AI art slice; this batch adds Stage 2-7 terrain candidates.",
            "Generated images contain no embedded title, menu, HUD, or UI text; game UI should render all copy.",
        ],
    }
    MANIFEST_OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"intro": len(intro), "terrain": len(terrain), "manifest": rel(MANIFEST_OUT), "contacts": manifest["contactSheets"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
