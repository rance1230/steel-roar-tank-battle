#!/usr/bin/env python3
"""Assemble assets/ai-v18-ui/runtime into src/data/v18_ui.data.js (runtime manifest).

Verifies each runtime file against the package manifest SHA-256, then inlines
the bytes verbatim as data URIs (no re-encode: WebP backgrounds stay WebP,
transparent UI PNGs stay PNG) so `node build.js` carries them into the
single-file index.html. Regenerate with:
    python3 tools/assemble_v18_ui.py
"""

import base64
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT / "assets" / "ai-v18-ui"
RUNTIME = PKG / "runtime"
OUT = ROOT / "src" / "data" / "v18_ui.data.js"

# V18UI.images key -> manifest asset id (runtime file + mime)
ASSETS = {
    "title": ("UI-TITLE", "image/webp"),
    "dep":   ("UI-BG-DEP", "image/webp"),
    "frame": ("UI-FRM-BASE", "image/png"),
    "ico":   ("UI-ICO-MASTER", "image/png"),
    "badge": ("UI-BADGE", "image/png"),
}

MIME = {
    ".webp": "image/webp",
    ".png": "image/png",
}


def main() -> None:
    manifest = json.loads((PKG / "manifest.json").read_text(encoding="utf-8"))
    images: dict[str, str] = {}
    total = 0
    for key, (asset_id, _) in ASSETS.items():
        spec = manifest["assets"][asset_id]
        path = PKG / spec["runtime"]
        data = path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        expect = spec["sha256"]["runtime"]
        if digest != expect:
            raise SystemExit(
                f"SHA-256 mismatch for {path.name}: got {digest}, manifest says {expect}"
            )
        mime = MIME[path.suffix]
        images[key] = f"data:{mime};base64," + base64.b64encode(data).decode()
        total += len(data)

    js_meta = {
        "version": manifest["schema"],
        "frame": {"size": 512, "border": manifest["assets"]["UI-FRM-BASE"]["nineSlice"]["runtimeBorder"]},
        "ico": {
            "size": 512,
            "cell": manifest["assets"]["UI-ICO-MASTER"]["grid"]["runtimeCell"],
            "cols": manifest["assets"]["UI-ICO-MASTER"]["grid"]["columns"],
            "rows": manifest["assets"]["UI-ICO-MASTER"]["grid"]["rows"],
            "idx": {n: i for i, n in enumerate(manifest["assets"]["UI-ICO-MASTER"]["icons"])},
        },
        "badge": {"size": 512},
        "title": {"w": 1536, "h": 864},
        "dep": {
            "w": 1536,
            "h": 864,
            "anchor": manifest["assets"]["UI-BG-DEP"]["tankAnchor"],
            "statsSafe": manifest["assets"]["UI-BG-DEP"]["statsSafeArea"],
        },
        "tokens": manifest["tokens"],
    }

    OUT.write_text(
        '"use strict";\n'
        "/* data/v18_ui — V1.8 UI 资产运行时清单 (生成物, 勿手改; tools/assemble_v18_ui.py) */\n"
        "window.V18UI={meta:" + json.dumps(js_meta, ensure_ascii=False, separators=(",", ":"))
        + ",images:{"
        + ",".join(f"{k}:\"{v}\"" for k, v in images.items())
        + "}};\n",
        encoding="utf-8",
    )
    print(f"v18_ui.data.js: {len(images)} images, {total/1024:.0f} KB raw, "
          f"{OUT.stat().st_size/1024:.0f} KB js")


if __name__ == "__main__":
    main()
