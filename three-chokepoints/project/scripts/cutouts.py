"""Prepare photos in the two reference styles.
Vox: halftone dots, torn paper edge with a white border (cut-out collage).
Vintage: sepia print with a cream border, scratches and soft vignette."""
import sys, math, numpy as np, cv2
from PIL import Image
SRC, OUT = sys.argv[1], sys.argv[2]
rng = np.random.default_rng(3)
def load(name, crop=None, size=1100):
    im = Image.open(f"{SRC}/{name}").convert("RGB")
    if crop: w, h = im.size; im = im.crop((int(crop[0] * w), int(crop[1] * h), int(crop[2] * w), int(crop[3] * h)))
    im.thumbnail((size, size)); return np.asarray(im).astype(np.float32)
def torn_mask(h, w, amp=10, inset=14):
    m = np.zeros((h, w), np.uint8)
    def edge(n): return np.cumsum(rng.normal(0, 1.4, n)).clip(-amp, amp) + rng.normal(0, 1.0, n)
    top, bot, lef, rig = edge(w), edge(w), edge(h), edge(h)
    pts = [(x, inset + top[x]) for x in range(0, w, 3)] + [(w - inset + rig[y], y) for y in range(0, h, 3)] + \
          [(x, h - inset + bot[x]) for x in range(w - 1, -1, -3)] + [(inset + lef[y], y) for y in range(h - 1, -1, -3)]
    cv2.fillPoly(m, [np.array(pts, np.int32)], 255); return m
def halftone(rgb, cell=7, ink=(28, 26, 24), paper=(240, 234, 214)):
    g = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    g = np.clip((g - 0.12) / 0.8, 0, 1) ** 1.1
    h, w = g.shape; out = np.full((h, w), 1.0, np.float32)
    ang = math.radians(45); ca, sa = math.cos(ang), math.sin(ang)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u = (xx * ca + yy * sa) / cell; v = (-xx * sa + yy * ca) / cell
    du = u - np.floor(u) - 0.5; dv = v - np.floor(v) - 0.5; d = np.sqrt(du ** 2 + dv ** 2)
    gb = cv2.GaussianBlur(g, (0, 0), cell * 0.5)
    r = np.sqrt(np.clip(1 - gb, 0, 1)) * 0.62
    dot = np.clip((r - d) * cell * 1.5, 0, 1)
    ink = np.array(ink, np.float32); paper = np.array(paper, np.float32)
    return paper * (1 - dot[..., None]) + ink * dot[..., None]
def clahe(rgb, clip=3.0):
    g = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    g = cv2.createCLAHE(clipLimit=clip, tileGridSize=(6, 6)).apply(g)
    g = cv2.normalize(g, None, 0, 255, cv2.NORM_MINMAX)
    return np.repeat(g[..., None], 3, -1).astype(np.float32)
def vox(name, out, crop=None, size=1000, cell=6, sat=False):
    rgb = load(name, crop, size); h, w = rgb.shape[:2]
    if sat:   # satellite views: contrast + duotone, light halftone texture
        g = clahe(rgb, 3.5)[..., 0] / 255
        ink = np.array((24, 30, 38), np.float32); pap = np.array((238, 232, 212), np.float32)
        duo = pap * g[..., None] + ink * (1 - g[..., None])
        ht = duo * 0.7 + halftone(clahe(rgb, 3.5), cell) * 0.3
    else:
        ht = halftone(rgb, cell)
    border = 22; H, Wd = h + 2 * border, w + 2 * border
    canvas = np.full((H, Wd, 3), (246, 242, 230), np.float32); canvas[border:border + h, border:border + w] = ht
    a = torn_mask(H, Wd, amp=9, inset=6)
    rgba = np.dstack([canvas, a]).clip(0, 255).astype(np.uint8)
    Image.fromarray(rgba).save(f"{OUT}/{out}.png"); print(out, rgba.shape)
def vintage(name, out, crop=None, size=1000):
    rgb = load(name, crop, size); h, w = rgb.shape[:2]
    g = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    g = np.clip((g - 0.06) * 1.15, 0, 1)
    g = clahe(rgb, 2.0)[..., 0] / 255 if 'suez' in name else g
    sep = np.stack([g * 236 + 14, g * 214 + 12, g * 170 + 10], -1)
    yy, xx = np.mgrid[0:h, 0:w]; vig = 1 - 0.45 * ((((xx - w / 2) / w) ** 2 + ((yy - h / 2) / h) ** 2) * 2)
    sep = sep * vig[..., None] * (1 + rng.normal(0, 0.035, (h, w, 1)))
    for _ in range(7):
        x = rng.integers(0, w); y0 = rng.integers(0, h); L = rng.integers(20, 140)
        ov = sep.copy(); cv2.line(ov, (int(x), int(y0)), (int(x + rng.integers(-6, 6)), int(y0 + L)), (235, 225, 200), 1, cv2.LINE_AA); sep = sep * 0.75 + ov * 0.25
    b = 26; bb = 70
    canvas = np.full((h + b + bb, w + 2 * b, 3), (233, 226, 208), np.float32); canvas[b:b + h, b:b + w] = sep
    a = np.full(canvas.shape[:2], 255, np.uint8)
    Image.fromarray(np.dstack([canvas.clip(0, 255), a]).astype(np.uint8)).save(f"{OUT}/{out}.png"); print(out, canvas.shape)
# Vox cut-outs for the chapter openers
vox("hormuz82.jpg", "cut_hormuz", crop=(0.05, 0.05, 0.95, 0.95), size=900, sat=True)
vox("hormuz14.jpg", "cut_hormuz2", crop=(0.0, 0.0, 1.0, 1.0), size=700, cell=5, sat=True)
vox("suez06.jpg", "cut_suez", crop=(0.0, 0.0, 1.0, 0.97), size=900, sat=True)
vox("maersk79.jpg", "cut_ship", size=760, cell=5)
vox("sing91.jpg", "cut_sing", crop=(0.06, 0.04, 0.94, 0.96), size=900, sat=True)
vox("mal1226.jpg", "cut_mal", crop=(0.0, 0.15, 1.0, 0.75), size=800, cell=5, sat=True)
# vintage prints for the Red Sea dispatch collage
vintage("suez06.jpg", "vin_suez", crop=(0.0, 0.0, 1.0, 0.97), size=760)
vintage("maersk79.jpg", "vin_ship", size=620)
