"""Procedural paper textures for the inserts: cream (Vox-style collage) and dark grunge (vintage archive)."""
import sys, numpy as np, cv2
from PIL import Image
OUT = sys.argv[1]; rng = np.random.default_rng(12); W, H = 1920, 1080
def fbm(h, w, oct=6, base=4, g=0.55):
    o = np.zeros((h, w), np.float32); a = 1; s = 0
    for i in range(oct):
        n = rng.standard_normal((max(2, int(base * 2 ** i * h / w)), base * 2 ** i)).astype(np.float32)
        o += a * cv2.resize(n, (w, h), interpolation=cv2.INTER_CUBIC); s += a; a *= g
    return o / s
def fibers(h, w, n=900):
    m = np.zeros((h, w), np.float32)
    for _ in range(n):
        x, y = rng.integers(0, w), rng.integers(0, h); ang = rng.uniform(0, np.pi); L = rng.uniform(8, 40)
        cv2.line(m, (int(x), int(y)), (int(x + np.cos(ang) * L), int(y + np.sin(ang) * L)), float(rng.uniform(0.3, 1)), 1, cv2.LINE_AA)
    return cv2.GaussianBlur(m, (0, 0), 0.6)
# cream paper (Vox)
base = np.array([226, 214, 178], np.float32)
n = fbm(H, W, 7, 3) * 0.06 + fbm(H, W, 3, 40) * 0.025 - fibers(H, W) * 0.05
grain = rng.standard_normal((H, W)).astype(np.float32) * 0.018
img = base * (1 + n + grain)[..., None]
yy, xx = np.mgrid[0:H, 0:W]; v = 1 - 0.18 * (((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2) * 2
Image.fromarray(np.clip(img * v[..., None], 0, 255).astype(np.uint8)).save(f"{OUT}/paper_cream.jpg", quality=92)
# dark grunge paper (vintage)
base = np.array([44, 34, 26], np.float32)
stains = np.clip(fbm(H, W, 6, 2, 0.6) * 1.4, -1, 1)
n = stains * 0.35 + fbm(H, W, 4, 60) * 0.06 + rng.standard_normal((H, W)).astype(np.float32) * 0.05
img = base * (1 + n)[..., None]
# scratches
sc = np.zeros((H, W), np.float32)
for _ in range(70):
    x = rng.integers(0, W); y0 = rng.integers(0, H); L = rng.integers(40, 400)
    cv2.line(sc, (int(x), int(y0)), (int(x + rng.integers(-20, 20)), int(y0 + L)), float(rng.uniform(0.2, 0.7)), 1, cv2.LINE_AA)
img += sc[..., None] * 60
v = 1 - 0.55 * (((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2) * 2.2
Image.fromarray(np.clip(img * v[..., None], 0, 255).astype(np.uint8)).save(f"{OUT}/paper_dark.jpg", quality=92)
# tape strip (RGBA): translucent with torn ends
tw, th = 300, 70
a = np.full((th, tw), 0.62, np.float32) + fbm(th, tw, 4, 6) * 0.08
edge = (np.abs(fbm(th, 1, 4, 8)[:, 0]) * 14 + 6).astype(int)
for y in range(th): a[y, :edge[y]] = 0; a[y, tw - edge[(y + 17) % th]:] = 0
rgba = np.zeros((th, tw, 4), np.uint8); rgba[..., :3] = [236, 228, 205]; rgba[..., 3] = np.clip(a * 255, 0, 255).astype(np.uint8)
Image.fromarray(rgba).save(f"{OUT}/tape.png")
print("ok")
