#!/usr/bin/env python3
"""v1.8 W2: layered hull/turret art — canonical single-image + programmatic rotation.

R1 (4x4 grid enumeration) failed: gemini-3-pro-image cannot hold a 22.5-deg-per-frame
rotation across 16 cells (intermediate frames snap to cardinals/duplicates — axis
measurements 2026-09-02). R2 approach: per hull TYPE generate ONE image with hull
(left) + turret (right) side by side at identical scale, facing EAST; then cut alpha
by border flood-fill, center pivots (turret: erosion disc center; hull: bbox center),
and synthesize the 16 directions by exact LANCZOS rotation (512 -> 128 downscale).
Angles are exact by construction; validation only guards content/assembly sanity.

Run: python3 tools/gen_v18_layers.py [--only assault,balanced,heavy] [--assemble-only]
Output: src/data/v18.data.js — per kind/key: {img: 512x512 WebP atlas, angles[16] rad,
scales[16]} — 6 atlas Images total (asset contract: no 96 loose frames).
"""
import base64, io, json, math, os, ssl, sys, time, urllib.request
from pathlib import Path

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    SSL_CTX = ssl.create_default_context()
from PIL import Image
import numpy as np
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "ai-v18-layers" / "source"
PROC = ROOT / "assets" / "ai-v18-layers" / "processed"
OUT = ROOT / "src" / "data" / "v18.data.js"
ENV_FILE = Path(os.path.expanduser("~/.hermes/profiles/rance-main/.env"))
MODEL = "google/gemini-3-pro-image"

_env = {}
for _l in ENV_FILE.read_text().splitlines():
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        _k, _, _v = _l.partition("=")
        _env[_k.strip()] = _v.strip().strip('"').strip("'")
API_KEY = _env["OPENROUTER_API_KEY"]

COMMON = ("Single square 1024x1024 image on a solid uniform dark background #0a0f14. Exactly "
"TWO separate game assets placed side by side at IDENTICAL scale, both strictly flat "
"orthographic top-down view (camera directly overhead), Japanese tactical HD-2D game asset "
"style, hand-painted armor plate detail with bright clean accents, perfectly uniform ambient "
"lighting from directly above with no directional shadows and no drop shadows. LEFT HALF of "
"the image: a tank HULL facing EAST (its front points to the right), centered in the left "
"half, occupying about 78% of that half's width. RIGHT HALF: that hull's TURRET facing EAST "
"(its gun barrel points to the right), centered in the right half, occupying about 78% of "
"that half's width. Both parts fully inside their own half with clear margin, never touching "
"each other, identical level of detail and weathering. Absolutely NO text, NO letters, NO "
"numbers, NO labels, NO decals resembling writing, no watermark, no grid lines, no borders.")
HULL = (" The hull has NO turret and NO gun barrel: at the exact center of its deck leave a "
"flat empty recessed circular turret ring with bolts so a separate turret layer can rotate "
"above it; the rear engine deck (with glowing marker lights) clearly differs from the "
"pointed front glacis.")
TURRET = (" The turret is a compact armored disc floating alone without its hull; its gun "
"barrel points exactly east; the rotation pivot (turret center) is the disc center.")
SPECS = {
  "assault": COMMON + HULL + " Narrow agile attack tank hull: rust-orange #c9702a plating, gold #f6b94e trim, angular layered side skirts, pointed front glacis, two small glowing warm orange exhausts on the rear engine deck." + TURRET + " Matching compact angular turret: rust-orange #c9702a with gold #f6b94e ring trim, ONE long slim high-velocity cannon barrel with muzzle brake, small commander hatch.",
  "balanced": COMMON + HULL + " Square dependable command tank hull: steel-grey-blue plating, cyan #22c0ff glowing reactor strip across the rear deck, clean welded seams, slightly rounded corners, rear engine grille." + TURRET + " Matching round steel turret: cyan #22c0ff energy ring at its base, ONE medium-length cannon barrel, small sensor mast.",
  "heavy": COMMON + HULL + " Broad fortress-class heavy tank hull: dark iron #3d4652 plating with weathered teal #8fd8e8 vents, thick bolted side armor, wide tracks, large flat rear deck plate with two small glowing red-hot #ff7a5c marker lights." + TURRET + " Matching massive dark-iron #3d4652 fortress turret: red-hot #ff7a5c core glow, TWO parallel heavy cannon barrels, wide rectangular mantlet.",
}

def gen(name, prompt):
    body = json.dumps({"model": MODEL, "modalities": ["image", "text"],
                       "messages": [{"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=body,
        headers={"Authorization": "Bearer " + API_KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, context=SSL_CTX, timeout=180) as r:
        d = json.load(r)
    msg = d["choices"][0]["message"]
    imgs = msg.get("images") or []
    if not imgs:
        raise RuntimeError("no image in response: " + str(msg.get("content"))[:120])
    img = imgs[0]["image_url"]["url"]
    assert img.startswith("data:image"), "unexpected payload"
    raw = base64.b64decode(img.split(",", 1)[1])
    p = SRC / (name + "_pair.png")
    p.write_bytes(raw)
    print("gen", name, len(raw) // 1024, "KB", flush=True)
    return p

def _cut_bg(a):
    """连通性 alpha: 从边界洪泛'背景样'像素(近底色或暗晕); 模型柔光晕 40-60 亮度, 硬阈值切不掉.
    保留 ≥120px 的实体连通域 (光斑孤岛剔除)."""
    dist = np.abs(a[:, :, 0] - 10) + np.abs(a[:, :, 1] - 15) + np.abs(a[:, :, 2] - 20)
    bg_like = (dist < 42) | (a.max(axis=2) < 62)
    lab, _ = ndimage.label(bg_like)
    border = set(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]).tolist()) - {0}
    keep = ~np.isin(lab, list(border))
    lab2, _ = ndimage.label(keep)
    if lab2.max() > 1:
        sizes = ndimage.sum(keep, lab2, range(1, lab2.max() + 1))
        big = [i + 1 for i, s in enumerate(sizes) if s >= max(120, sizes.max() * 0.02)]
        keep = np.isin(lab2, big)
    return np.where(keep, 255, 0).astype(np.uint8)

def _disc_center(mask):
    """炮塔圆盘中心: 二值腐蚀 12 轮剥离炮管等细长部, 幸存像素质心"""
    m = mask.copy()
    for _ in range(12):
        if m.sum() < 60: break
        e = m.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                e &= np.roll(np.roll(m, dy, 0), dx, 1)
        m = e
    ys, xs = np.nonzero(m)
    if len(xs) < 8: return None
    return float(xs.mean()), float(ys.mean())

def _canonical(im_half, is_turret):
    """半图 → pivot 居中正方画布(源分辨率, 含边距) + 画布边长(源px) + 内容朝向(y-down atan2, E=0).
    朝向: hull=二阶矩轴+暖/青色尾部投票(头=反向); turret=亮装甲最远30px圆均值(炮口)."""
    a = np.asarray(im_half.convert("RGB")).astype(int)
    alpha = _cut_bg(a)
    img = Image.fromarray(np.dstack([a.astype(np.uint8), alpha]), "RGBA")
    bbox = img.getbbox()
    assert bbox, "empty after alpha cut"
    img = img.crop(bbox)
    bw, bh = img.size
    mask = np.asarray(img)[:, :, 3] > 40
    pivot = _disc_center(mask) if is_turret else None
    if pivot is None or not (bw * 0.15 < pivot[0] < bw * 0.85) or not (bh * 0.15 < pivot[1] < bh * 0.85):
        pivot = (bw / 2, bh / 2)
    # 内容朝向 (画布 y 向下, atan2 语义: E=0, N=-π/2, S=+π/2)
    ys, xs = np.nonzero(mask)
    if is_turret:
        bright = mask & (a[bbox[1]:bbox[3], bbox[0]:bbox[2]].max(axis=2) > 95)
        bys, bxs = np.nonzero(bright)
        r = np.hypot(bxs - pivot[0], bys - pivot[1])
        k = min(30, len(bxs))
        far = np.argpartition(-r, k - 1)[:k]
        angs = np.arctan2(bys[far] - pivot[1], bxs[far] - pivot[0])
        facing = math.atan2(np.sin(angs).mean(), np.cos(angs).mean())
    else:
        x, y = xs - xs.mean(), ys - ys.mean()
        evals, evecs = np.linalg.eigh(np.cov(np.vstack([x, y])))
        assert evals[1] > 0 and evals[1] / max(evals[0], 1e-6) > 1.35, "hull not elongated"
        ax, ay = evecs[:, 1]
        rgb = np.asarray(img)[:, :, :3].astype(int)
        warm = mask & (rgb[:, :, 0] > 150) & (rgb[:, :, 0] - rgb[:, :, 2] > 60)
        cyan = mask & (rgb[:, :, 2] > 150) & (rgb[:, :, 2] - rgb[:, :, 0] > 60)
        sel = warm | cyan
        assert sel.sum() >= 30, "no rear color markers for facing vote"
        sy, sx = np.nonzero(sel)
        proj = (sx - pivot[0]) * ax + (sy - pivot[1]) * ay
        # R3 审校修复: 金色前部描边会盖过尾部排气 → 只统计长轴两端极区(排除侧裙边),
        # 并按饱和度²加权 (排气/红标远比金边饱和)
        imb = np.abs(rgb[sy, sx, 0].astype(int) - rgb[sy, sx, 2].astype(int)) ** 2
        extreme = np.abs(proj) > 0.65 * np.abs(proj).max()
        assert extreme.sum() >= 8, "no color markers at hull axis ends"
        wsum = float((imb[extreme] * proj[extreme]).sum())   # >0: 彩色(=尾)偏 +轴端 → 头在 -轴
        assert abs(wsum) > 0, "facing vote is a tie"
        facing = math.atan2(-ay if wsum > 0 else ay, -ax if wsum > 0 else ax)
    # 画布: 半径=离 pivot 最远像素 + 4px 边距 → 任意旋转不裁切
    r_max = float(np.hypot(xs - pivot[0], ys - pivot[1]).max())
    s = int(math.ceil(2 * r_max)) + 8
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    canvas.paste(img, (int(round(s / 2 - pivot[0])), int(round(s / 2 - pivot[1]))))
    return canvas, s, float(facing % (2 * math.pi))

def _despeckle(frame):
    """终帧 <12px 孤立连通域剔除 (尘埃/fringe 点)"""
    a = np.asarray(frame).copy()
    m = a[:, :, 3] > 24
    lab, n = ndimage.label(m)
    if n > 1:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        keep = [i + 1 for i, sz in enumerate(sizes) if sz >= 12]
        drop = ~np.isin(lab, keep)
        a[drop, 3] = 0
    return Image.fromarray(a)

def synth(name):
    """正典对图 → {hull:{frames16}, turret:{frames16, ratio}}; 朝向归一 EAST + 单次插值合成.
    R2 审校修复: 车体朝向偏 90°(balanced N/heavy S) → 预旋归一; 炮尖裁切 → 半径+边距画布;
    薄天线丢失 → 源分辨率旋转后单次降采样; 尘埃 → 终帧 despeckle; 炮塔比例 → 显式表.
    R3 审校: hull 朝向投票法互斥失效(质量投票错 assault, 饱和度加权错 balanced) → 采用
    两轮人工审校确证的源图朝向覆盖表; 表缺项才回退自动投票."""
    im = Image.open(SRC / (name + "_pair.png"))
    W, H = im.size
    assert abs(W - H) <= 8, f"non-square canvas {W}x{H}"
    RATIO = {"assault": 1.05, "balanced": 1.00, "heavy": 1.02}   # R2 审校: 炮尖越出车头 10-25%
    FACING = {"assault": {"hull": 0, "turret": 0},                # 源图实测: 东
              "balanced": {"hull": -90, "turret": 0},             # 北 (y-down atan2: N=-90°)
              "heavy": {"hull": 90, "turret": 0}}                 # 南
    parts = {}
    for key, half, is_turret in (("hull", (0, 0, W // 2, H), False), ("turret", (W // 2, 0, W, H), True)):
        canvas, s, facing = _canonical(im.crop(half), is_turret)
        fdeg = math.degrees(facing)
        if name in FACING and key in FACING[name]:
            fdeg = FACING[name][key]
        frames = []
        for i in range(16):
            f = canvas.rotate(fdeg + 22.5 * i, Image.BICUBIC)   # 朝向归一 + 22.5°/帧, 源分辨率单次插值
            frames.append(_despeckle(f.resize((128, 128), Image.LANCZOS)))
        assert (np.asarray(frames[0])[:, :, 3] > 40).sum() > 400, f"{name}/{key}: near-empty frame"
        parts[key] = {"frames": frames, "src_side": s, "facing": fdeg,
                      "auto_facing": math.degrees(facing)}
    parts["turret"]["scale_to_hull"] = RATIO[name]   # 同图实测比例被模型构图差异污染, 审校标定值
    return parts

def save_sheets(name, parts):
    for key in ("hull", "turret"):
        d = PROC / f"{key}_{name}"; d.mkdir(parents=True, exist_ok=True)
        for i, f in enumerate(parts[key]["frames"]): f.save(d / (str(i) + ".png"))
        parts[key]["frames"][0].save(d / "canonical.png")
        sheet = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        for i, f in enumerate(parts[key]["frames"]): sheet.paste(f, ((i % 4) * 128, (i // 4) * 128))
        sheet.save(d / "sheet.png")

def wrap(a):
    return (a + math.pi) % (2 * math.pi) - math.pi

def validate(name, parts):
    """角度表由构造精确: 只查内容量级与画布一致性"""
    for key in ("hull", "turret"):
        counts = [int((np.asarray(f)[:, :, 3] > 40).sum()) for f in parts[key]["frames"]]
        assert min(counts) > 300, f"{name}/{key}: near-empty frame ({min(counts)}px)"
        assert max(counts) / min(counts) < 1.35, f"{name}/{key}: size spread {min(counts)}..{max(counts)}"
    k = parts["turret"]["scale_to_hull"]
    assert 0.6 < k < 1.8, f"{name}: turret/hull scale ratio implausible ({k:.2f})"
    print(f"  validate {name}: OK (turret/hull={k:.2f})", flush=True)

def assemble():
    """3 对正典 → 6 张 512 atlas (WebP) + 精确角表 + scale → src/data/v18.data.js.
    角度: frame i = -22.5°*i (屏幕系, 视觉逆时针 E→N→W→S)."""
    out = {"hulls": {}, "turrets": {}}
    for name in SPECS:
        parts = synth(name)
        validate(name, parts)
        save_sheets(name, parts)
        for key, kind in (("hull", "hulls"), ("turret", "turrets")):
            sheet = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
            for i, f in enumerate(parts[key]["frames"]): sheet.paste(f, ((i % 4) * 128, (i // 4) * 128))
            buf = io.BytesIO()
            sheet.save(buf, "WEBP", quality=82, lossless=False)
            b64 = base64.b64encode(buf.getvalue()).decode()
            scale = 1.0 if key == "hull" else parts["turret"]["scale_to_hull"]
            out[kind][name] = {"img": "data:image/webp;base64," + b64,
                               "angles": [round((-i * math.pi / 8) % (2 * math.pi), 4) for i in range(16)],
                               "scales": [round(scale, 4)] * 16}
    js = ("/* v1.8 W2: 分层机体素材 (gen_v18_layers.py: 正典单图+程序旋转合成; hull@bodyA+turret@ta; pivot=帧中心) */\n"
          "const V18L=" + json.dumps(out, separators=(",", ":")) + ";\n"
          "if(typeof window!=='undefined')window.V18L=V18L;\n")
    OUT.write_text(js)
    print("wrote", OUT, len(js) // 1024, "KB (source text)", flush=True)

if __name__ == "__main__":
    SRC.mkdir(parents=True, exist_ok=True); PROC.mkdir(parents=True, exist_ok=True)
    args = sys.argv[1:]
    only = set(args[args.index("--only") + 1].split(",")) if "--only" in args else None
    failures = []
    if "--assemble-only" not in args:
        targets = {n: p for n, p in SPECS.items() if only is None or n in only}
        for n, p in targets.items():
            ok = False
            for attempt in range(3):
                try:
                    gen(n, p)
                    parts = synth(n)
                    validate(n, parts)
                    save_sheets(n, parts)
                    ok = True; break
                except Exception as e:
                    print("attempt", attempt, "fail", n, ":", e, flush=True); time.sleep(6)
            if not ok: failures.append(n)
    if "--gen-only" not in args:
        if failures:
            print("FAILED:", failures); sys.exit(1)
        assemble()
