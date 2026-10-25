"""Pick a position for each reel insert that avoids the map's own graphics and the subject.

Reads keep-out masks (every 3rd frame, 1080x1920 RGBA), unions them over each insert's
on-screen window, adds the YouTube Shorts UI zones, and scans candidate rectangles.
Writes web/assets/placements.json and a debug sheet.
"""
import json, os, sys, glob
import numpy as np
from PIL import Image, ImageDraw

P = sys.argv[1]
FW, FH = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1080, 1920)
MASKS = sys.argv[4] if len(sys.argv) > 4 else "masks"
FRAMES = sys.argv[5] if len(sys.argv) > 5 else "frames"
LAND = FW > FH
F = 4                      # analysis downscale
W, H = FW // F, FH // F
INSERTS = {                # name: (t0, t1, width, height, default cx, default cy)
    "hook":   (0.25, 5.7, 900, 150, FW / 2, FH * 0.105 + 37),
    "tanker": (12.25, 15.9, 640, 330, FW / 2, FH * 0.5),
    "fifth":  (28.25, 31.25, 820, 270, FW / 2, FH * 0.5),
    "stack":  (31.25, 34.75, 680, 430, FW / 2, FH * 0.49),
    "cta":    (38.9, 41.5, 660, 104, FW / 2, FH * 0.655),
}
PAD = 24  # breathing room around the card, px

def ui_mask():
    m = np.zeros((H, W), bool)
    if LAND:                                         # player controls / progress bar
        m[int(0.88 * H):] = True; m[: int(0.03 * H)] = True
        return m
    m[: int(0.06 * H)] = True                      # top bar
    m[int(0.80 * H):] = True                        # title / channel / music row
    m[int(0.45 * H): int(0.86 * H), int(0.86 * W):] = True  # like / comment / share column
    return m

def window_mask(t0, t1):
    acc = np.zeros((H, W), bool)
    for f in range(int(t0 * 24) // 3 * 3, int(t1 * 24) + 1, 3):
        p = f"{P}/{MASKS}/m_{f:05d}.png"
        if not os.path.exists(p): continue
        a = np.asarray(Image.open(p).convert("RGBA").resize((W, H), Image.BILINEAR))[..., 3]
        acc |= a > 40
    return acc

def best_spot(keep, w, h, dcx, dcy):
    ii = np.pad(keep.astype(np.int32), ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    best = None
    for sc in (1.0, 0.92, 0.85, 0.78, 0.7):
        rw, rh = int((w * sc + 2 * PAD) / F), int((h * sc + 2 * PAD) / F)
        for y in range(0, H - rh, 4):
            for x in range(0, W - rw, 4):
                ov = ii[y + rh, x + rw] - ii[y, x + rw] - ii[y + rh, x] + ii[y, x]
                frac = ov / (rw * rh)
                cx, cy = (x + rw / 2) * F, (y + rh / 2) * F
                # cost: overlap dominates, then shrinking, then distance from the designed spot / centre column
                cost = frac * 100 + (1 - sc) * 6 + abs(cx - FW / 2) / FW * 1.5 + abs(cy - dcy) / FH * 1.0
                if best is None or cost < best[0]:
                    best = (cost, frac, sc, cx, cy)
        if best and best[1] == 0 and best[2] == sc:
            break
    return best

if __name__ == "__main__":
    ui = ui_mask(); out = {}; sheet = []
    for name, (t0, t1, w, h, dcx, dcy) in INSERTS.items():
        keep = window_mask(t0, t1) | ui
        before = keep[int((dcy - h / 2) / F): int((dcy + h / 2) / F), int((dcx - w / 2) / F): int((dcx + w / 2) / F)].mean()
        cost, frac, sc, cx, cy = best_spot(keep, w, h, dcx, dcy)
        out[name] = {"cx": round(cx), "cy": round(cy), "scale": sc}
        print(f"{name:7s} old overlap {before*100:5.1f}%  ->  new overlap {frac*100:4.1f}%  at ({cx:.0f},{cy:.0f}) scale {sc}")
        # debug tile: mid-window frame + keep-out tint + old (grey) and new (green) boxes
        fr = int((t0 + t1) / 2 * 24)
        base = Image.open(f"{P}/{FRAMES}/f_{fr:05d}.png").convert("RGB").resize((W, H))
        tint = Image.new("RGB", (W, H), (255, 0, 0))
        base = Image.composite(Image.blend(base, tint, 0.45), base, Image.fromarray((keep * 255).astype(np.uint8)))
        d = ImageDraw.Draw(base)
        d.rectangle([(dcx - w / 2) / F, (dcy - h / 2) / F, (dcx + w / 2) / F, (dcy + h / 2) / F], outline=(200, 200, 200), width=2)
        d.rectangle([(cx - w * sc / 2) / F, (cy - h * sc / 2) / F, (cx + w * sc / 2) / F, (cy + h * sc / 2) / F], outline=(0, 255, 90), width=3)
        d.text((6, 6), name, fill=(255, 255, 255))
        sheet.append(base)
    json.dump(out, open(f"{P}/web/assets/placements_{FW}x{FH}.json", "w"), indent=1)
    s = Image.new("RGB", (W * len(sheet), H))
    for i, im in enumerate(sheet): s.paste(im, (i * W, 0))
    s.save(f"{P}/placement_sheet_{FW}x{FH}.jpg", quality=90)
