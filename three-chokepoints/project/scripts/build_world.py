"""World texture: blend the desert palette (Bab el-Mandeb build) and the tropical palette (Malacca build) by climate."""
import importlib.util, os, sys, math, json
import numpy as np, cv2
from PIL import Image
C = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); S = os.path.dirname(C)
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m
desert = load("desert", f"{S}/bab/scripts/build_rasters.py"); tropic = load("tropic", f"{S}/mal/scripts/build_rasters.py")
for m in (desert, tropic): m.D = f"{C}/data"; m.P = C
def build(name, bbox, res, z, q=90):
    lo0, la0, lo1, la1 = bbox
    w = int(round((lo1 - lo0) / res)); h = int(round((la1 - la0) / res))
    lons = lo0 + (np.arange(w) + 0.5) * res; lats = la1 - (np.arange(h) + 0.5) * res
    hgt = desert.sample(z, lons, lats)
    water = desert.water_mask(hgt, bbox, w, h, lats)
    hgt = np.where(water, np.minimum(hgt, -1), np.maximum(hgt, 1))
    mpp = (res * 111320 * math.cos(math.radians(max(min((la0 + la1) / 2, 60), -60))), res * 110574)
    a = desert.colorize(hgt, water, lats, lons, mpp).astype(np.float32)   # used for its water palette + relief
    # vegetation index from Natural Earth I (public domain): where it is green vs dry, used to blend our two palettes
    b = tropic.colorize(hgt, water, lats, lons, mpp).astype(np.float32)
    LON, LAT = np.meshgrid(lons, lats)
    nx = ((LON + 180) / 360 * NE1.shape[1] - 0.5).astype(np.float32); ny = ((90 - LAT) / 180 * NE1.shape[0] - 0.5).astype(np.float32)
    ne = cv2.remap(NE1, nx, ny, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)
    g = np.clip(((ne[..., 1] - ne[..., 0]) + 14) / 30, 0, 1); g = g * g * (3 - 2 * g)
    g = cv2.GaussianBlur(g.astype(np.float32), (0, 0), 2)[..., None]
    land = a * (1 - g) + b * g
    rgb = np.where(water[..., None], a, land)
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(f"{C}/web/assets/world/{name}.jpg", quality=q)
    np.save(f"{C}/data/{name}_h.npy", hgt.astype(np.float32)); print(name, w, h)
    return hgt, lons, lats
os.makedirs(f"{C}/web/assets/world", exist_ok=True)
Image.MAX_IMAGE_PIXELS = None
NE1 = np.asarray(Image.open(f"{C}/data/ne/NE1_50M_SR_W/NE1_50M_SR_W.tif").convert("RGB"))
print("NE1", NE1.shape)
build("globe", (-180, -85, 180, 85), 360 / 2048, 3, 88)
hgt, lons, lats = build("base", (-20.0, -42.0, 125.0, 58.0), 0.03, 5)
# coarse mesh grid for the world patch
glons = np.arange(-20.0, 125.0001, 0.1, dtype=np.float32); glats = np.arange(58.0, -42.0001, -0.1, dtype=np.float32)
gh = desert.sample(5, glons, glats); gh = np.where(gh > 0, gh, 0)
LON, LAT = np.meshgrid(glons, glats)
we = np.clip(np.minimum.reduce([LON + 20, 125 - LON, LAT + 42, 58 - LAT]) / 2.0, 0, 1); gh = gh * we
with open(f"{C}/web/assets/world/grid.bin", "wb") as f:
    np.array([len(glons), len(glats)], np.int32).tofile(f); glons.tofile(f); glats.tofile(f); gh.astype(np.float32).tofile(f)
print("grid", len(glons), len(glats))
