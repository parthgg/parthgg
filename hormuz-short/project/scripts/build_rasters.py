"""Build color textures + height grids from Terrarium DEM tiles and Natural Earth vectors.

Outputs (in proj/web/assets):
  base.jpg     lon 44..68, lat 14..48, equirectangular
  detail.jpg   lon 54..59, lat 24..28 (strait close-up)
  globe.jpg    whole world, low res
  grid.bin     float32 heights (m) on a non-uniform lat/lon grid + lon/lat axes
"""
import json, math, os, sys
import numpy as np, cv2
from PIL import Image, ImageDraw

P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = f"{P}/data"; OUT = f"{P}/web/assets"; os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

BASE = (44.0, 14.0, 68.0, 48.0)
DETAIL = (54.0, 24.0, 59.0, 28.0)


def mosaic(z):
    files = os.listdir(f"{D}/t/{z}")
    xs = sorted({int(f.split("_")[0]) for f in files}); ys = sorted({int(f.split("_")[1][:-4]) for f in files})
    x0, y0 = xs[0], ys[0]
    arr = np.zeros(((ys[-1] - y0 + 1) * 256, (xs[-1] - x0 + 1) * 256), np.float32)
    for f in files:
        x, y = int(f.split("_")[0]), int(f.split("_")[1][:-4])
        im = np.asarray(Image.open(f"{D}/t/{z}/{f}").convert("RGB")).astype(np.float32)
        arr[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768
    return arr, x0, y0


def sample(z, lons, lats):
    arr, x0, y0 = mosaic(z); n = 2 ** z
    LON, LAT = np.meshgrid(lons, lats)
    px = (LON + 180) / 360 * n * 256 - x0 * 256
    py = (1 - np.arcsinh(np.tan(np.radians(LAT))) / np.pi) / 2 * n * 256 - y0 * 256
    return cv2.remap(arr, px.astype(np.float32), py.astype(np.float32), cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def raster_mask(path, bbox, w, h, keep=None):
    lo0, la0, lo1, la1 = bbox
    im = Image.new("L", (w, h), 0); dr = ImageDraw.Draw(im)
    for f in json.load(open(path))["features"]:
        if keep and not keep(f["properties"]): continue
        g = f["geometry"]; polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for poly in polys:
            for k, ring in enumerate(poly):
                pts = [((x - lo0) / (lo1 - lo0) * w, (la1 - y) / (la1 - la0) * h) for x, y in ring]
                if len(pts) > 2: dr.polygon(pts, fill=255 if k == 0 else 0)
    return np.asarray(im) > 127


def fbm(h, w, octaves=6, base=8):
    out = np.zeros((h, w), np.float32); amp = 1.0; tot = 0
    for o in range(octaves):
        s = base * 2 ** o
        n = rng.standard_normal((max(2, int(h / w * s)), s)).astype(np.float32)
        out += amp * cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC); tot += amp; amp *= 0.55
    return out / tot


def colorize(hgt, water, lats, lons, mpp):
    """hgt meters, water bool, mpp meters per pixel (x,y). Returns uint8 RGB."""
    H, W = hgt.shape
    land = ~water
    hl = np.where(land, np.maximum(hgt, 0), 0).astype(np.float32)
    # --- relief shading (baked) ---
    ex = 3.0
    gy, gx = np.gradient(hl * ex)
    gx /= mpp[0]; gy /= mpp[1]
    az, alt = math.radians(315), math.radians(32)
    lx, ly, lz = math.sin(az) * math.cos(alt), math.cos(az) * math.cos(alt), math.sin(alt)
    nz = 1 / np.sqrt(1 + gx ** 2 + gy ** 2)
    shade = (-gx * lx + gy * ly + lz) * nz  # gy positive = southward in image rows
    shade = np.clip(shade, 0, 1)
    slope = np.sqrt(gx ** 2 + gy ** 2)
    # cavity / local relief
    k = max(3, int(4000 / mpp[0]) | 1)
    blur = cv2.GaussianBlur(hl, (k, k), 0)
    cav = np.clip((hl - blur) / 400, -1, 1)
    # --- land palette ---
    noise = fbm(H, W, 7, 6)
    sand_lo = np.array([214, 184, 140], np.float32)   # bright desert sand
    sand_hi = np.array([196, 160, 116], np.float32)
    rock = np.array([118, 98, 78], np.float32)        # brown mountains
    rock2 = np.array([92, 84, 76], np.float32)        # grey ophiolite (Musandam / Hajar)
    t_el = np.clip(hl / 1800, 0, 1)[..., None]
    t_sl = np.clip(slope / 0.9, 0, 1)[..., None]
    base = sand_lo * (1 - t_el) + sand_hi * t_el
    base = base * (1 + 0.10 * noise[..., None])
    rocky = rock * (1 + 0.15 * fbm(H, W, 5, 20)[..., None])
    hajar = ((lats[:, None] < 26.6) & (lons[None, :] > 55.6) & (lons[None, :] < 60))[..., None]
    rocky = np.where(hajar, rock2, rocky)
    col = base * (1 - t_sl * 0.85) + rocky * (t_sl * 0.85)
    # green tint on the Caspian lowlands (Gilan / Mazandaran)
    LAT, LON = np.meshgrid(lats, lons, indexing="ij")
    green = ((LAT > 36.4) & (LAT < 38.5) & (LON > 48.8) & (LON < 54.0) & (hl < 900)).astype(np.float32)
    green = cv2.GaussianBlur(green, (0, 0), 6 * 1000 / mpp[0] + 1)[..., None]
    col = col * (1 - 0.55 * green) + np.array([86, 104, 64], np.float32) * 0.55 * green
    light = (0.30 + 1.05 * shade)[..., None] * (1 + 0.35 * cav[..., None])
    col = col * light
    # --- water ---
    depth = np.clip(-np.where(LAT > 34, hgt + 28, hgt), 0, 6000).astype(np.float32)
    depth = np.where(water, depth, 0).astype(np.float32)
    dist0 = cv2.distanceTransform(water.astype(np.uint8), cv2.DIST_L2, 5) * mpp[0]
    depth = np.where(LAT > 34, np.minimum(dist0 / 300, 400), depth).astype(np.float32)
    sig = 2500 / mpp[0]
    depth = cv2.GaussianBlur(depth, (0, 0), sig) / np.maximum(cv2.GaussianBlur(water.astype(np.float32), (0, 0), sig), 1e-3)
    dist = cv2.distanceTransform(water.astype(np.uint8), cv2.DIST_L2, 5) * mpp[0]
    deep = np.array([14, 30, 50], np.float32); mid = np.array([20, 50, 76], np.float32)
    shallow = np.array([34, 96, 104], np.float32); surf = np.array([70, 140, 135], np.float32)
    td = np.clip(depth / 22, 0, 1)[..., None]
    wcol = shallow * (1 - td) + mid * td
    wcol = wcol * (1 - np.clip((depth - 30) / 300, 0, 1)[..., None]) + deep * np.clip((depth - 30) / 300, 0, 1)[..., None]
    tc = np.clip(1 - dist / 2500, 0, 1)[..., None] ** 2
    wcol = wcol * (1 - 0.55 * tc) + surf * 0.55 * tc
    wcol = wcol * (1 + 0.04 * noise[..., None])
    out = np.where(water[..., None], wcol, col)
    # soften the coastline a touch
    return np.clip(out, 0, 255).astype(np.uint8)


def water_mask(hgt, bbox, w, h, lats):
    ne_land = raster_mask(f"{D}/land.geojson", bbox, w, h)
    lakes = raster_mask(f"{D}/lakes.geojson", bbox, w, h, keep=lambda p: (p.get("scalerank") or 9) <= 2)
    dem_water = hgt <= 0.5
    # trust DEM near sea level below 34N, Natural Earth for inland seas (Caspian is below sea level)
    LAT = np.repeat(lats[:, None], w, 1)
    water = np.where(LAT < 34, dem_water & ~(ne_land & (hgt > -5) & False), ~ne_land) | lakes
    water = water & ~((hgt > 3) & (LAT < 34))
    # remove specks
    water = cv2.morphologyEx(water.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    return water


def build(name, bbox, res, z, q=92):
    lo0, la0, lo1, la1 = bbox
    w = int(round((lo1 - lo0) / res)); h = int(round((la1 - la0) / res))
    lons = lo0 + (np.arange(w) + 0.5) * res; lats = la1 - (np.arange(h) + 0.5) * res
    hgt = sample(z, lons, lats)
    water = water_mask(hgt, bbox, w, h, lats)
    hgt = np.where(water, np.minimum(hgt, -1), np.maximum(hgt, 1))
    mpp = (res * 111320 * math.cos(math.radians((la0 + la1) / 2)), res * 110574)
    rgb = colorize(hgt, water, lats, lons, mpp)
    Image.fromarray(rgb).save(f"{OUT}/{name}.jpg", quality=q)
    np.save(f"{P}/data/{name}_h.npy", hgt.astype(np.float32)); np.save(f"{P}/data/{name}_w.npy", water)
    print(name, w, h)
    return hgt, water, lons, lats


if __name__ == "__main__":
    which = sys.argv[1:] or ["globe", "base", "detail"]
    if "globe" in which: build("globe", (-180, -85, 180, 85), 360 / 2048, 3, 88)
    if "base" in which: build("base", BASE, 0.0045, 7)
    if "detail" in which: build("detail", DETAIL, 0.00125, 10)
