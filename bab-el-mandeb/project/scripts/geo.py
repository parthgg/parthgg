import json, math, sys
import numpy as np, cv2
from PIL import Image
B = sys.argv[1]
WIDE = (18.0, 2.0, 64.0, 38.0); CLOSE = (42.65, 11.95, 44.15, 13.35)
ww = np.load(f"{B}/data/wide_w.npy"); cw = np.load(f"{B}/data/close_w.npy")
def ll2px(bb, shape, la, lo):
    H, W = shape; return (lo - bb[0]) / (bb[2] - bb[0]) * W, (bb[3] - la) / (bb[3] - bb[1]) * H
def px2ll(bb, shape, x, y):
    H, W = shape; return bb[3] - (y + 0.5) / H * (bb[3] - bb[1]), bb[0] + (x + 0.5) / W * (bb[2] - bb[0])
kx = lambda la: 111.32 * math.cos(math.radians(la))

# --- strait width from the close-up mask
land = (~cw).astype(np.uint8)
n, lab, stats, _ = cv2.connectedComponentsWithStats(land, 8)
big = sorted(range(1, n), key=lambda i: -stats[i, cv2.CC_STAT_AREA])
def comp_at(la, lo):
    x, y = ll2px(CLOSE, cw.shape, la, lo); return lab[int(y), int(x)]
arabia, africa = comp_at(13.2, 44.0), comp_at(12.2, 43.0)
perim = comp_at(12.655, 43.42)
def pts(c, lat_lo, lat_hi):
    ys, xs = np.nonzero(lab == c)
    edge = cv2.morphologyEx((lab == c).astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
    ys, xs = np.nonzero(edge)
    ll = np.array([px2ll(CLOSE, cw.shape, x, y) for x, y in zip(xs[::4], ys[::4])])
    return ll[(ll[:, 0] > lat_lo) & (ll[:, 0] < lat_hi)]
A = pts(arabia, 12.4, 13.0); F = pts(africa, 12.2, 12.9)
def mind(P, Q):
    d = np.sqrt(((P[:, None, 0] - Q[None, :, 0]) * 110.57) ** 2 + ((P[:, None, 1] - Q[None, :, 1]) * kx(12.6)) ** 2)
    i, j = np.unravel_index(d.argmin(), d.shape); return P[i], Q[j], d[i, j]
a, b, km = mind(A, F)
print(f"mainland-to-mainland narrowest: {km:.1f} km = {km/1.609:.1f} mi  {a.round(3)} -> {b.round(3)}  (perim comp {perim}, arabia {arabia}, africa {africa})")
gap = {"a": a.round(4).tolist(), "b": b.round(4).tolist(), "km": round(float(km), 1)}

# --- sea fills on the wide grid: split at the strait and at Guardafui-Fartak
H, W = ww.shape
wm = ww.astype(np.uint8) * 255
def barrier(p, q, th=5):
    x0, y0 = ll2px(WIDE, ww.shape, *p); x1, y1 = ll2px(WIDE, ww.shape, *q)
    cv2.line(wm, (int(x0), int(y0)), (int(x1), int(y1)), 0, th)
ext = lambda p, q, f: (p[0] + (p[0] - q[0]) * f, p[1] + (p[1] - q[1]) * f)
barrier(ext(a, b, 0.4), ext(b, a, 0.4))
barrier((11.83, 51.28), (15.62, 52.23), 7)
barrier((29.9, 32.3), (29.9, 32.9), 7)  # stop at Suez
fills = {}
for name, seed in [("redsea", (20.0, 38.5)), ("aden", (12.5, 47.0))]:
    m = wm.copy(); x, y = ll2px(WIDE, ww.shape, *seed)
    mask = np.zeros((H + 2, W + 2), np.uint8)
    cv2.floodFill(m, mask, (int(x), int(y)), 128)
    f = (m == 128).astype(np.float32)
    f = cv2.GaussianBlur(f, (0, 0), 1.2)
    rgba = np.zeros((H, W, 4), np.uint8); rgba[..., :3] = 255; rgba[..., 3] = (np.clip(f, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(rgba).resize((W // 2, H // 2), Image.LANCZOS).save(f"{B}/web/assets/fill_{name}.png")
    fills[name] = float(f.sum())
print("fill px", {k: int(v) for k, v in fills.items()})

# --- route Gulf of Aden -> strait (west channel) -> Red Sea -> Suez
route = [(12.25, 48.3), (12.15, 46.6), (12.35, 45.2), (12.55, 44.0), (12.56, 43.55), (12.6, 43.33), (12.85, 43.15), (13.4, 42.8),
         (14.6, 41.95), (16.2, 40.9), (18.0, 39.85), (20.0, 38.6), (22.0, 37.5), (24.0, 36.2), (26.0, 35.0), (27.1, 34.3), (27.55, 34.15), (27.8, 33.85),
         (28.2, 33.42), (28.7, 33.05), (29.3, 32.75), (29.93, 32.55)]
bad = []
for (p0, l0), (p1, l1) in zip(route[:-1], route[1:]):
    for tt in np.linspace(0, 1, 60):
        la, lo = p0 + (p1 - p0) * tt, l0 + (l1 - l0) * tt
        if CLOSE[1] < la < CLOSE[3] and CLOSE[0] < lo < CLOSE[2]:
            x, y = ll2px(CLOSE, cw.shape, la, lo); ok = cw[int(y), int(x)]
        else:
            x, y = ll2px(WIDE, ww.shape, la, lo); ok = ww[int(y), int(x)]
        if not ok and la < 29.5: bad.append((round(la, 3), round(lo, 3)))
print("route on land:", bad[:8], len(bad))
json.dump({"gap": gap, "route": route}, open(f"{B}/web/assets/geo.json", "w"))
