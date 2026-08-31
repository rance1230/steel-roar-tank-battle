#!/usr/bin/env python3
"""Convert v1.4 bright stage-intro PNGs to WebP and install into assets/stage-intros/.

Source: assets/ai-v14/processed/bright-stage-intros/ (1 title + 7 stages,
campaign-assets-manifest.json, was assets-only-not-wired).
Output: assets/stage-intros/*.webp (title-bg + THEMES[].intro names), replacing
the old ~19MB PNG set. Old PNGs are removed; sync targets:
.github/workflows/pages.yml (already copies this dir, glob updated separately)
and android/app/src/main/assets/assets/stage-intros/.

Regenerate with: python3 tools/convert_intros.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "ai-v14" / "processed" / "bright-stage-intros"
DST = ROOT / "assets" / "stage-intros"

# 与 src/data/data.js THEMES[].intro 一致 (关卡序)
MAP = {
    "title-bright.png": "title-bg.webp",
    "stage-01-desert-bright.png": "stage-01-desert.webp",
    "stage-02-rain-bright.png": "stage-02-rain.webp",
    "stage-03-forest-bright.png": "stage-03-forest.webp",
    "stage-04-industrial-bright.png": "stage-04-industrial.webp",
    "stage-05-snow-bright.png": "stage-05-snow.webp",
    "stage-06-fortress-bright.png": "stage-06-fortress.webp",
    "stage-07-final-bright.png": "stage-07-final.webp",
}


def main() -> None:
    DST.mkdir(parents=True, exist_ok=True)
    total = 0
    for src_name, dst_name in MAP.items():
        src = SRC / src_name
        if not src.exists():
            raise FileNotFoundError(src)
        im = Image.open(src).convert("RGB")
        out = DST / dst_name
        im.save(out, "WEBP", quality=85, method=6)
        n = out.stat().st_size
        total += n
        print(f"{dst_name:26s} {im.width}x{im.height}  {n // 1024}KB")
    # 清理旧 PNG (webp 已接管; README 保留)
    removed = 0
    for old in DST.glob("*.png"):
        old.unlink()
        removed += 1
    print(f"total {total // 1024}KB, removed {removed} old PNGs -> {DST}")


if __name__ == "__main__":
    main()
