"""Mesh grid + overlay geometry (coastlines, lanes, measurement) for the renderer."""
import json, math, os
import numpy as np, cv2
from build_rasters import BASE, DETAIL, P

OUT = f"{P}/web/assets"
bh = np.load(f"{P}/data/base_h.npy"); dh = np.load(f"{P}/data/detail_h.npy"); dw = np.load(f"{P}/data/detail_w.npy")


def sample(arr, bbox, lons, lats):
    lo0, la0, lo1, la1 = bbox; h, w = arr.shape
    LON, LAT = np.meshgrid(lons, lats)
    return cv2.remap(arr, ((LON - lo0) / (lo1 - lo0) * w - 0.5).astype(np.float32),
                     ((la1 - LAT) / (la1 - la0) * h - 0.5).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


def axis(lo, hi, d_lo, d_hi, fine, coarse):
    a = list(np.arange(lo, d_lo, coarse)) + list(np.arange(d_lo, d_hi, fine)) + list(np.arange(d_hi, hi + 1e-9, coarse))
    return np.array(sorted(set(np.round(a, 5))), np.float32)


# --- mesh grid: dense inside the strait box, coarse elsewhere ---
lons = axis(BASE[0], BASE[2], 54.6, 58.4, 0.008, 0.035)
lats = axis(BASE[1], BASE[3], 24.6, 27.6, 0.008, 0.035)[::-1]
hb = sample(bh, BASE, lons, lats); hd = sample(dh, DETAIL, lons, lats)
LON, LAT = np.meshgrid(lons, lats)
m = 0.25
wd = np.clip(np.minimum.reduce([(LON - DETAIL[0]) / m, (DETAIL[2] - LON) / m, (LAT - DETAIL[1]) / m, (DETAIL[3] - LAT) / m]), 0, 1)
h = hb * (1 - wd) + hd * wd
# taper heights to zero at the patch border so it meets the globe
we = np.clip(np.minimum.reduce([(LON - BASE[0]), (BASE[2] - LON), (LAT - BASE[1]), (BASE[3] - LAT)]) / 1.0, 0, 1)
h = np.maximum(h, 0) * we
with open(f"{OUT}/grid.bin", "wb") as f:
    np.array([len(lons), len(lats)], np.int32).tofile(f)
    lons.tofile(f); lats.tofile(f); h.astype(np.float32).tofile(f)
print("grid", len(lons), len(lats), len(lons) * len(lats))

# --- coastlines from the detail water mask ---
H, W = dw.shape
def px2ll(p):
    return [round(DETAIL[3] - (p[1] + 0.5) / H * (DETAIL[3] - DETAIL[1]), 5), round(DETAIL[0] + (p[0] + 0.5) / W * (DETAIL[2] - DETAIL[0]), 5)]

land = (~dw).astype(np.uint8) * 255
land = cv2.morphologyEx(land, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
cs, _ = cv2.findContours(land, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
cs = sorted(cs, key=cv2.contourArea, reverse=True)


def seg(contour, box):
    pts = [px2ll(p[0]) for p in contour]
    inb = [box[0] <= la <= box[1] and box[2] <= lo <= box[3] for la, lo in pts]
    # longest run (with wrap-around)
    n = len(pts); best = (0, 0); i = 0
    ext = inb + inb
    run = 0
    for j in range(2 * n):
        run = run + 1 if ext[j] else 0
        if run > best[0] and run <= n: best = (run, j)
    L, end = best
    run_pts = [pts[(end - L + 1 + k) % n] for k in range(L)]
    arr = np.array([[lo * 1000, la * 1000] for la, lo in run_pts], np.float32).reshape(-1, 1, 2)
    arr = cv2.approxPolyDP(arr, 0.6, False).reshape(-1, 2) / 1000
    return [[round(float(b), 4), round(float(a), 4)] for a, b in arr]


def pick(lat, lon):
    for c in cs:
        x = (lon - DETAIL[0]) / (DETAIL[2] - DETAIL[0]) * W; y = (DETAIL[3] - lat) / (DETAIL[3] - DETAIL[1]) * H
        if cv2.pointPolygonTest(c, (x, y), False) >= 0: return c


iran = pick(27.5, 57.0); arabia = pick(25.0, 56.0)
coast = {
    "iran": seg(iran, (26.5, 28.0, 55.4, 57.9)),
    "oman": seg(arabia, (24.7, 26.45, 55.95, 56.62)),
}
print({k: len(v) for k, v in coast.items()})

# narrowest gap: Musandam vs any Iranian land (mainland + islands) north of it
def ll_of(c):
    return np.array([px2ll(p[0]) for p in c[::3]])
mus = np.concatenate([ll_of(c) for c in cs[:80] if c is arabia or (cv2.contourArea(c) > 4 and 26.3 < px2ll(c[0][0])[0] < 26.6 and 56.3 < px2ll(c[0][0])[1] < 56.7)])
mus = mus[(mus[:, 0] > 26.0) & (mus[:, 0] < 26.6) & (mus[:, 1] > 56.0)]
north = np.concatenate([ll_of(c) for c in cs[:60] if cv2.contourArea(c) > 30 and px2ll(c[0][0])[0] > 26.7 and c is not arabia])
north = north[(north[:, 1] > 55.9) & (north[:, 1] < 57.0)]
kx = 111.32 * math.cos(math.radians(26.5))
d = np.sqrt(((mus[:, None, 0] - north[None, :, 0]) * 110.57) ** 2 + ((mus[:, None, 1] - north[None, :, 1]) * kx) ** 2)
i, j = np.unravel_index(d.argmin(), d.shape)
gap = {"a": mus[i].round(4).tolist(), "b": north[j].round(4).tolist(), "km": round(float(d[i, j]), 1)}
print("gap", gap)

# --- shipping lanes (traffic separation scheme, stylised) ---
center = [(24.9, 57.75), (25.55, 57.2), (26.05, 56.85), (26.42, 56.66), (26.62, 56.45), (26.66, 56.2), (26.52, 55.9), (26.42, 55.6), (26.43, 55.0), (26.36, 54.3)]


def offset(path, km):
    out = []
    p = np.array(path)
    for k in range(len(p)):
        a = p[max(k - 1, 0)]; b = p[min(k + 1, len(p) - 1)]
        dy = (b[0] - a[0]) * 110.57; dx = (b[1] - a[1]) * kx
        nrm = np.array([-dx, dy]) / math.hypot(dx, dy)  # right-hand normal in (north, east) km
        out.append([round(p[k][0] + nrm[0] * km / 110.57, 4), round(p[k][1] + nrm[1] * km / kx, 4)])
    return out

# direction of travel along `center` is inbound (Gulf of Oman -> Persian Gulf); right-hand side = inbound lane
lanes = {
    "in": {"mid": offset(center, 6.0), "edges": [offset(center, 3.6), offset(center, 8.4)]},
    "out": {"mid": offset(center, -6.0)[::-1], "edges": [offset(center, -3.6)[::-1], offset(center, -8.4)[::-1]]},
}
# check lanes stay in water
def in_water(la, lo):
    x = int((lo - DETAIL[0]) / (DETAIL[2] - DETAIL[0]) * W); y = int((DETAIL[3] - la) / (DETAIL[3] - DETAIL[1]) * H)
    return bool(dw[min(max(y, 0), H - 1), min(max(x, 0), W - 1)])
for k, v in lanes.items():
    for e in v["edges"] + [v["mid"]]:
        bad = []
        for (a, b), (c, dd) in zip(e[:-1], e[1:]):
            for t in np.linspace(0, 1, 40):
                la, lo = a + (c - a) * t, b + (dd - b) * t
                if DETAIL[1] < la < DETAIL[3] and DETAIL[0] < lo < DETAIL[2] and not in_water(la, lo): bad.append((round(la, 3), round(lo, 3)))
        if bad: print("LAND", k, bad[:4], len(bad))

# long-haul routes for the wide shot (from the strait mouth outward / into the gulf)
routes = [
    [(25.3, 57.45), (24.3, 59.5), (23.4, 63.0), (22.6, 68.5)],
    [(25.3, 57.45), (23.6, 59.6), (20.5, 63.5), (17.0, 68.5)],
    [(25.3, 57.45), (23.2, 59.4), (19.5, 60.5), (14.0, 60.0)],
    [(25.3, 57.45), (23.0, 59.2), (18.5, 58.6), (15.0, 54.0), (13.0, 49.0)],
    [(26.36, 54.3), (27.3, 52.0), (28.4, 50.4), (29.2, 49.3), (29.6, 48.6)],
    [(26.36, 54.3), (26.9, 52.5), (26.75, 50.6)],
    [(26.36, 54.3), (26.2, 52.8), (25.95, 51.9)],
    [(26.43, 55.0), (25.6, 55.0), (25.1, 55.05)],
]
json.dump({"coast": coast, "gap": gap, "lanes": lanes, "center": center, "routes": routes}, open(f"{OUT}/overlay.json", "w"))

# debug plot
from PIL import Image, ImageDraw
im = Image.open(f"{OUT}/detail.jpg").resize((1250, 1000)); dr = ImageDraw.Draw(im)
def xy(la, lo): return ((lo - DETAIL[0]) / 5 * 1250, (DETAIL[3] - la) / 4 * 1000)
for k, col in [("iran", "red"), ("oman", "orange")]: dr.line([xy(*p) for p in coast[k]], fill=col, width=3)
for k, col in [("in", "lime"), ("out", "cyan")]:
    for e in lanes[k]["edges"]: dr.line([xy(*p) for p in e], fill=col, width=2)
dr.line([xy(*gap["a"]), xy(*gap["b"])], fill="white", width=3)
im.save(f"{P}/data/prev_geo.jpg")
