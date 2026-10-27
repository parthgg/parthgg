import json, sys, numpy as np, cv2
S, C = sys.argv[1], sys.argv[2]
BASE = (18.0, 2.0, 64.0, 38.0); DETAIL = (42.65, 11.95, 44.15, 13.35)
wh = np.load(f"{S}/bab/data/wide_h.npy"); ch = np.load(f"{S}/bab/data/close_h.npy")
def sample(arr, bbox, lons, lats):
    lo0, la0, lo1, la1 = bbox; h, w = arr.shape; LON, LAT = np.meshgrid(lons, lats)
    return cv2.remap(arr, ((LON - lo0) / (lo1 - lo0) * w - 0.5).astype(np.float32), ((la1 - LAT) / (la1 - la0) * h - 0.5).astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
def axis(lo, hi, d_lo, d_hi, fine, coarse):
    a = list(np.arange(lo, d_lo, coarse)) + list(np.arange(d_lo, d_hi, fine)) + list(np.arange(d_hi, hi + 1e-9, coarse))
    return np.array(sorted(set(np.round(a, 5))), np.float32)
lons = axis(BASE[0], BASE[2], 41.5, 45.5, 0.01, 0.05); lats = axis(BASE[1], BASE[3], 11.3, 14.2, 0.01, 0.05)[::-1]
h1 = sample(wh, BASE, lons, lats); h2 = sample(ch, DETAIL, lons, lats)
LON, LAT = np.meshgrid(lons, lats); m = 0.15
wd = np.clip(np.minimum.reduce([(LON - DETAIL[0]) / m, (DETAIL[2] - LON) / m, (LAT - DETAIL[1]) / m, (DETAIL[3] - LAT) / m]), 0, 1)
h = h1 * (1 - wd) + h2 * wd
we = np.clip(np.minimum.reduce([LON - BASE[0], BASE[2] - LON, LAT - BASE[1], BASE[3] - LAT]) / 1.0, 0, 1)
h = np.maximum(h, 0) * we
with open(f"{C}/web/assets/bab/grid.bin", "wb") as f:
    np.array([len(lons), len(lats)], np.int32).tofile(f); lons.tofile(f); lats.tofile(f); h.astype(np.float32).tofile(f)
g = json.load(open(f"{S}/bab/web/assets/geo.json"))
json.dump({"gap": g["gap"], "main": g["route"]}, open(f"{C}/web/assets/bab/overlay.json", "w"))
print("bab grid", len(lons), len(lats), len(lons) * len(lats))
