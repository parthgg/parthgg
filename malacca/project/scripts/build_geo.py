"""Mesh grid + overlay geometry for the Malacca map shots."""
import json, math, os, sys
import numpy as np, cv2
M = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = f"{M}/web/assets"
BASE = (88.0, -10.0, 125.0, 33.0); DETAIL = (98.0, -0.5, 105.0, 6.5)
bh = np.load(f"{M}/data/base_h.npy"); dh = np.load(f"{M}/data/detail_h.npy"); dw = np.load(f"{M}/data/detail_w.npy"); bw = np.load(f"{M}/data/base_w.npy")

def sample(arr, bbox, lons, lats):
    lo0, la0, lo1, la1 = bbox; h, w = arr.shape; LON, LAT = np.meshgrid(lons, lats)
    return cv2.remap(arr, ((LON - lo0) / (lo1 - lo0) * w - 0.5).astype(np.float32), ((la1 - LAT) / (la1 - la0) * h - 0.5).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
def axis(lo, hi, d_lo, d_hi, fine, coarse):
    a = list(np.arange(lo, d_lo, coarse)) + list(np.arange(d_lo, d_hi, fine)) + list(np.arange(d_hi, hi + 1e-9, coarse))
    return np.array(sorted(set(np.round(a, 5))), np.float32)

lons = axis(BASE[0], BASE[2], 98.3, 104.7, 0.009, 0.04)
lats = axis(BASE[1], BASE[3], -0.2, 6.2, 0.009, 0.04)[::-1]
hb = sample(bh, BASE, lons, lats); hd = sample(dh, DETAIL, lons, lats)
LON, LAT = np.meshgrid(lons, lats); m = 0.3
wd = np.clip(np.minimum.reduce([(LON - DETAIL[0]) / m, (DETAIL[2] - LON) / m, (LAT - DETAIL[1]) / m, (DETAIL[3] - LAT) / m]), 0, 1)
h = hb * (1 - wd) + hd * wd
we = np.clip(np.minimum.reduce([LON - BASE[0], BASE[2] - LON, LAT - BASE[1], BASE[3] - LAT]) / 1.0, 0, 1)
h = np.maximum(h, 0) * we
with open(f"{OUT}/grid.bin", "wb") as f:
    np.array([len(lons), len(lats)], np.int32).tofile(f); lons.tofile(f); lats.tofile(f); h.astype(np.float32).tofile(f)
print("grid", len(lons), len(lats))

# narrowest point near Singapore: Singapore island (+ its southern islets) vs the Riau islands
H, W = dw.shape
def px2ll(x, y): return DETAIL[3] - (y + 0.5) / H * (DETAIL[3] - DETAIL[1]), DETAIL[0] + (x + 0.5) / W * (DETAIL[2] - DETAIL[0])
def ll2px(la, lo): return int((lo - DETAIL[0]) / (DETAIL[2] - DETAIL[0]) * W), int((DETAIL[3] - la) / (DETAIL[3] - DETAIL[1]) * H)
land = (~dw).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(land, 8)
x, y = ll2px(1.36, 103.82); sg = lab[y, x]
edge = cv2.morphologyEx((lab > 0).astype(np.uint8), cv2.MORPH_GRADIENT, np.ones((3, 3), np.uint8))
ys, xs = np.nonzero(edge)
pts = np.array([(*px2ll(a, b), lab[b, a]) for a, b in zip(xs, ys)])
box = (pts[:, 0] > 1.0) & (pts[:, 0] < 1.32) & (pts[:, 1] > 103.55) & (pts[:, 1] < 104.1)
P_ = pts[box]
cent = {c: st[int(c), :2] for c in np.unique(P_[:, 2]).astype(int)}
clat = {c: px2ll(st[c, 0] + st[c, 2] / 2, st[c, 1] + st[c, 3] / 2)[0] for c in cent}
north = P_[np.array([clat[int(c)] >= 1.19 for c in P_[:, 2]])]
south = P_[np.array([clat[int(c)] < 1.15 for c in P_[:, 2]])]
kx = 111.32 * math.cos(math.radians(1.2))
d = np.sqrt(((north[:, None, 0] - south[None, :, 0]) * 110.57) ** 2 + ((north[:, None, 1] - south[None, :, 1]) * kx) ** 2)
i, j = np.unravel_index(d.argmin(), d.shape)
gap = {"a": north[i, :2].round(4).tolist(), "b": south[j, :2].round(4).tolist(), "km": round(float(d[i, j]), 2)}
print("Singapore mainland vs Riau islands, narrowest:", gap)

# routes: Indian Ocean -> Malacca -> Singapore -> South China Sea -> Chinese ports
main = [(6.4, 89.0), (6.0, 93.5), (5.95, 95.6), (5.3, 97.6), (4.1, 99.3), (3.0, 100.6), (2.4, 101.45), (1.75, 102.5), (1.3, 103.3), (1.14, 103.6), (1.17, 103.78), (1.22, 104.2), (1.5, 104.6), (3.2, 105.6), (6.5, 107.6), (10.5, 110.0), (14.5, 111.6), (18.5, 112.6), (21.6, 113.7)]
branches = [
    [(18.5, 112.6), (21.0, 115.6), (23.4, 117.6), (24.8, 119.4), (27.5, 121.6), (29.3, 123.0), (30.7, 122.95)],   # to Shanghai / Ningbo
    [(18.5, 112.6), (19.8, 111.6), (20.6, 110.9)],                                                # to Zhanjiang
    [(10.5, 110.0), (13.0, 116.5), (18.5, 121.2), (22.2, 120.8), (26.0, 121.9)],                  # east of the Philippines? no: via Luzon strait
]
branches = branches[:2]
def check(path):
    bad = []
    for (a0, b0), (a1, b1) in zip(path[:-1], path[1:]):
        for tt in np.linspace(0, 1, 80):
            la, lo = a0 + (a1 - a0) * tt, b0 + (b1 - b0) * tt
            if DETAIL[1] < la < DETAIL[3] and DETAIL[0] < lo < DETAIL[2]:
                x, y = ll2px(la, lo); ok = dw[min(y, H - 1), min(x, W - 1)]
            else:
                hh, ww = bw.shape; x = int((lo - BASE[0]) / (BASE[2] - BASE[0]) * ww); y = int((BASE[3] - la) / (BASE[3] - BASE[1]) * hh); ok = bw[y, x]
            if not ok: bad.append((round(la, 3), round(lo, 3)))
    return bad
for k, p in [("main", main)] + [(f"b{i}", b) for i, b in enumerate(branches)]:
    b = check(p); print(k, "on land:", b[:6], len(b))
json.dump({"gap": gap, "main": main, "branches": branches}, open(f"{OUT}/overlay.json", "w"))
