#!/usr/bin/env python3
"""Batch-generate 6 Steel Roar icon concept candidates via OpenRouter (openai/gpt-5.4-image-2).

One-pass creative draw: every candidate generated once; only API-level failures
(HTTP 5xx/429, no-image responses) are retried, never creative outcomes.
"""
import base64
import json
import os
import ssl
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    SSL_CTX = ssl.create_default_context()

ENV_FILE = Path(os.path.expanduser("~/.hermes/profiles/rance-main/.env"))
OUT_DIR = Path("/Volumes/vol1/像素小游戏/icon-concepts")
MODEL = "google/gemini-3-pro-image"  # Nano Banana Pro via OpenRouter
# openai/gpt-5.4-image-2 was tried first but the account's OpenRouter privacy
# settings ignore all of its providers (HTTP 404), so we stay on Nano Banana Pro.
FALLBACK_MODEL = "google/gemini-3.1-flash-image"

_env = {}
for _line in ENV_FILE.read_text().splitlines():
    _line = _line.strip()
    if _line and not _line.startswith("#") and "=" in _line:
        _k, _, _v = _line.partition("=")
        _env[_k.strip()] = _v.strip().strip('"').strip("'")
API_KEY = _env["OPENROUTER_API_KEY"]

# ---------------------------------------------------------------- prompts
# Constraint-delivery mode: main-prompt Constraints line (modern
# instruction-following model; no dedicated negative-prompt parameter).
SHARED_TAIL = """Complexity: use only 4–7 large basic shapes and at most two broad internal color regions. Use two simple eyes and add one tiny mouth only when it helps the expression. Remove every nonessential line, outline, anatomical detail, texture, and decoration. Keep the character readable at 32 × 32.
Composition: keep the character upright and centered inside the central safe area (a centered circle covering the middle two thirds of the square), occupying about 65–75% of the canvas, so the whole silhouette survives circular, rounded-square, and squircle cropping. The main silhouette must never touch the outer edges of the square.
Style: make simplification, cuteness, and lovable baby-like appeal the strongest qualities. Use large soft forms, compact proportions, thick rounded contours, and an ultra-clean graphic treatment. Prefer one clear shape over several explanatory details. Add an extremely, extremely subtle, almost imperceptible sense of depth through a barely-there neo-skeuomorphic treatment.
Finish: show only the character on the full-canvas background, with clean surfaces and normal square outer corners.
Constraints: Use no text or watermark. Add no borders, frames, cards, or presentation masks. Include one character only, with no extra subjects or scenery. Use no fragile lines, sharp tips, unnecessary outlines, tiny details, or decorative marks; every tip must be visibly blunt and rounded. Add no photorealistic material, dramatic bevel, glossy hotspot, deep occlusion, extrusion, strong three-dimensional rendering, or external cast shadow. Keep the background solid and uniform, with no texture, vignette, or lighting variation."""

SHARED_HEAD = """Create one complete full-bleed 1:1 square image.
Background: fill the entire square with solid deep blue-black (#11151f). Keep the background color visible in every open area and in all four corners; the character sits fully inside the central safe area."""

CANDIDATES = {
    "A1": {
        "direction": "A 徽章·正面炮塔（钢灰主导 + 六边形装甲板）",
        "colors": {"ip1": "steel blue-gray #8a93a6 family", "ip2": "golden amber #f0b23c family", "bg": "deep blue-black #11151f"},
        "prompt": f"""{SHARED_HEAD}
Subject: place one extremely simplified, cute, endearing tank-turret IP character on the background, reduced to one soft rounded continuous silhouette and one defining feature. It is a front-facing rounded dome-shaped tank turret looking straight at the viewer, with one short, very thick, blunt cannon barrel pointing forward at the viewer. The defining feature is a large glowing golden ring at the barrel mouth, like a bold golden circle. Behind the turret sits one wide solid hexagonal armor plate as a single large supporting shape in a darker steel tone. Two tiny simple eyes sit on the turret dome.
Color behavior: use exactly three semantic colors in the complete image: steel blue-gray (#8a93a6 family) as the turret color, golden amber (#f0b23c family) for the muzzle ring and the facial marks, plus the deep blue-black background (#11151f). Organize both IP colors into broad purposeful masses. Keep the character, facial marks, and background clearly separated.
{SHARED_TAIL}""",
    },
    "A2": {
        "direction": "A 徽章·正面炮塔（金色主导，无六边形，更近景）",
        "colors": {"ip1": "warm golden amber #f0b23c family (turret body + muzzle circle)", "ip2": "steel blue-gray #8a93a6 family (barrel + facial marks)", "bg": "deep blue-black #11151f"},
        "prompt": f"""{SHARED_HEAD}
Subject: place one extremely simplified, cute, endearing tank-turret IP character on the background, reduced to one soft rounded continuous silhouette and one defining feature. It is a front-facing rounded dome-shaped tank turret looking straight at the viewer, with one short, very thick, blunt cannon barrel pointing forward at the viewer. The defining feature is a large glowing circle at the barrel mouth in a brighter golden tone. Two tiny simple eyes sit on the turret dome. Nothing else appears in the image.
Color behavior: use exactly three semantic colors in the complete image: warm golden amber (#f0b23c family) as the main turret color and the glowing muzzle circle, steel blue-gray (#8a93a6 family) for the cannon barrel and the facial marks, plus the deep blue-black background (#11151f). Organize both IP colors into broad purposeful masses. Keep the character, facial marks, and background clearly separated.
{SHARED_TAIL}""",
    },
    "B1": {
        "direction": "B 冲锋·45°俯视开炮（钢灰坦克 + 金色炮焰）",
        "colors": {"ip1": "steel blue-gray #8a93a6 family (hull + tracks)", "ip2": "golden amber #f0b23c family (muzzle flash + facial marks)", "bg": "deep blue-black #11151f"},
        "prompt": f"""{SHARED_HEAD}
Subject: place one extremely simplified, cute, endearing little tank IP character on the background, reduced to one soft rounded continuous silhouette and one defining feature. It is seen from a high three-quarter top-down angle: a compact rounded hull with two thick rounded track strips, angled toward the upper right as if charging forward. One short, very thick, blunt cannon barrel points to the upper right. The defining feature is one large soft burst of golden muzzle flash blooming at the barrel tip. Two tiny simple eyes sit on the hull front.
Color behavior: use exactly three semantic colors in the complete image: steel blue-gray (#8a93a6 family) for the hull and tracks, golden amber (#f0b23c family) for the muzzle flash and the facial marks, plus the deep blue-black background (#11151f). Organize both IP colors into broad purposeful masses. Keep the character, facial marks, and background clearly separated.
{SHARED_TAIL}""",
    },
    "B2": {
        "direction": "B 冲锋·45°俯视开炮（金色坦克 + 红色炮焰）",
        "colors": {"ip1": "warm golden amber #f0b23c family (hull + tracks)", "ip2": "vivid signal red #d64533 family (muzzle burst + facial marks)", "bg": "deep blue-black #11151f"},
        "prompt": f"""{SHARED_HEAD}
Subject: place one extremely simplified, cute, endearing little tank IP character on the background, reduced to one soft rounded continuous silhouette and one defining feature. It is seen from a high three-quarter top-down angle: a compact rounded hull with two thick rounded track strips, angled toward the upper right as if charging forward. One short, very thick, blunt cannon barrel points to the upper right. The defining feature is one large soft burst of signal-red muzzle flash blooming at the barrel tip. Two tiny simple eyes sit on the hull front.
Color behavior: use exactly three semantic colors in the complete image: warm golden amber (#f0b23c family) for the hull and tracks, vivid signal red (#d64533 family) for the muzzle burst and the facial marks, plus the deep blue-black background (#11151f). Organize both IP colors into broad purposeful masses. Keep the character, facial marks, and background clearly separated.
{SHARED_TAIL}""",
    },
    "C1": {
        "direction": "C Overdrive·速度尾焰（钢灰坦克 + 三道金色拖尾）",
        "colors": {"ip1": "steel blue-gray #8a93a6 family (hull + tracks)", "ip2": "golden amber #f0b23c family (speed trails + facial marks)", "bg": "deep blue-black #11151f"},
        "prompt": f"""{SHARED_HEAD}
Subject: place one extremely simplified, cute, endearing little tank IP character on the background, reduced to one soft rounded continuous silhouette and one defining feature. It is seen from a high three-quarter top-down angle: a compact rounded hull with two thick rounded track strips, angled toward the upper right as if dashing forward, one short very thick blunt cannon barrel pointing to the upper right. The defining feature is a set of exactly three thick, soft, rounded golden speed-trail bands streaming behind the tank toward the lower left, like bold motion streaks; both ends of every band are fully blunt and rounded. Two tiny simple eyes sit on the hull front.
Color behavior: use exactly three semantic colors in the complete image: steel blue-gray (#8a93a6 family) for the hull and tracks, golden amber (#f0b23c family) for the three speed-trail bands and the facial marks, plus the deep blue-black background (#11151f). Organize both IP colors into broad purposeful masses. Keep the character, facial marks, and background clearly separated.
{SHARED_TAIL}""",
    },
    "C2": {
        "direction": "C Overdrive·速度尾焰（金色坦克 + 金色拖尾，能量全开）",
        "colors": {"ip1": "warm golden amber #f0b23c family (hull + trails)", "ip2": "steel blue-gray #8a93a6 family (barrel + facial marks)", "bg": "deep blue-black #11151f"},
        "prompt": f"""{SHARED_HEAD}
Subject: place one extremely simplified, cute, endearing little tank IP character on the background, reduced to one soft rounded continuous silhouette and one defining feature. It is seen from a high three-quarter top-down angle: a compact rounded hull with two thick rounded track strips, angled toward the upper right as if dashing forward, one short very thick blunt cannon barrel pointing to the upper right. The defining feature is a set of exactly three thick, soft, rounded speed-trail bands streaming behind the tank toward the lower left, like bold motion streaks; both ends of every band are fully blunt and rounded. Two tiny simple eyes sit on the hull front.
Color behavior: use exactly three semantic colors in the complete image: warm golden amber (#f0b23c family) for the hull, tracks, and the three speed-trail bands, steel blue-gray (#8a93a6 family) for the cannon barrel and the facial marks, plus the deep blue-black background (#11151f). Organize both IP colors into broad purposeful masses. Keep the character, facial marks, and background clearly separated.
{SHARED_TAIL}""",
    },
}


def call_openrouter(prompt: str, model: str, timeout: int = 240):
    """Return (image_bytes, None) or (None, error_string)."""
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "modalities": ["image", "text"],
    }).encode()
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=payload,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        resp = urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX)
        data = json.load(resp)
    except urllib.error.HTTPError as e:
        return None, f"HTTP {e.code}: {e.read()[:300].decode(errors='replace')}"
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"

    msg = (data.get("choices") or [{}])[0].get("message", {})
    images = msg.get("images") or []
    if images:
        url = images[0].get("image_url", {}).get("url", "")
        if url.startswith("data:"):
            b64 = url.split(",", 1)[1]
            return base64.b64decode(b64), None
    # some models return b64 in message.content or annotations
    err_text = str(msg.get("content"))[:200] if msg.get("content") else json.dumps(data)[:300]
    return None, f"no_image: {err_text}"


def gen_one(label, spec):
    model = MODEL
    last_err = None
    for attempt in range(3):  # operational retries only
        img, err = call_openrouter(spec["prompt"], model)
        if img:
            dst = OUT_DIR / f"{label}.png"
            dst.write_bytes(img)
            return {"label": label, "ok": True, "path": str(dst), "model": model,
                    "bytes": len(img), "attempts": attempt + 1}
        last_err = err
        operational = ("HTTP 5" in err or "HTTP 429" in err or "timeout" in err.lower()
                       or "URLError" in err or "no_image" in err)
        if not operational:
            break
        time.sleep(8 * (attempt + 1))
    return {"label": label, "ok": False, "model": model, "error": (last_err or "")[:300]}


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "prompts.json").write_text(
        json.dumps({"model": MODEL, "fallback_model": FALLBACK_MODEL,
                    "candidates": {k: {"direction": v["direction"], "colors": v["colors"],
                                       "prompt": v["prompt"]} for k, v in CANDIDATES.items()}},
                   ensure_ascii=False, indent=2)
    )
    results = []
    with ThreadPoolExecutor(max_workers=3) as pool:
        futs = {pool.submit(gen_one, k, v): k for k, v in CANDIDATES.items()}
        for fut in as_completed(futs):
            r = fut.result()
            results.append(r)
            print(f"[{r['label']}] {'OK ' + str(r.get('bytes', 0)) + 'B' if r['ok'] else 'FAIL: ' + r.get('error', '')[:120]}", flush=True)
    order = {k: i for i, k in enumerate(CANDIDATES)}
    results.sort(key=lambda r: order[r["label"]])
    print("FINAL_JSON=" + json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    main()
