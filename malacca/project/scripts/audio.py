import json, sys, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly
M = sys.argv[1]; SR = 48000; DUR = 16.2; L = int(DUR * SR); t = np.arange(L) / SR; rng = np.random.default_rng(9)
vo_meta = json.load(open(f"{M}/web/assets/vo.json"))
Wd = {}
for w in vo_meta["words"]: Wd.setdefault(w["w"].split("(")[0], []).append(w["s"])
def add(buf, x, at, g):
    i = int(at * SR); n = min(len(x), L - i)
    if n > 0 and i >= 0: buf[i:i + n] += x[:n] * g
lp = lambda x, f: sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
hp = lambda x, f: sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
bp = lambda x, a, b: sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), x)
def env(a, b, fi, fo):
    e = np.clip((t - a) / fi, 0, 1) * np.clip((b - t) / fo, 0, 1); return e * e * (3 - 2 * e)
mid = lambda m: 440 * 2 ** ((m - 69) / 12)
# voiceover
vo = np.zeros(L)
for i, ln in enumerate(vo_meta["lines"]):
    a, sr = sf.read(f"{M}/audio/vo_{i}.wav"); add(vo, resample_poly(a, SR, sr), ln["start"], 1.0)
# music: dark pad + 16th arpeggio + sub + kick (kick enters after the title)
saw = lambda f: 2 * ((t * f) % 1) - 1
pad = np.zeros(L); prog = [[38, 45, 50, 53], [34, 41, 46, 50], [36, 43, 48, 52], [33, 40, 45, 49]]
seg = DUR / 4
for i, ch in enumerate(prog):
    e = env(i * seg - 0.3, (i + 1) * seg + 0.3, 0.6, 0.6)
    for m in ch: pad += (saw(mid(m + 12) * 0.997) + saw(mid(m + 12) * 1.003)) * e * 0.035
pad = lp(pad, 1400)
arp = np.zeros(L); step = 60 / 112 / 4
for k, at in enumerate(np.arange(0.0, DUR, step)):
    ch = prog[min(3, int(at / seg))]; f = mid(ch[k % 4] + 24); n = int(0.11 * SR); tt = np.arange(n) / SR
    add(arp, np.sign(np.sin(2 * np.pi * f * tt)) * np.exp(-tt * 28) * 0.5 + np.sin(2 * np.pi * f * 2 * tt) * np.exp(-tt * 30) * 0.3, at, 0.18 * (0.5 if at < 0.85 else 1.0))
arp = lp(arp, 3200)
sub = np.zeros(L)
for i, ch in enumerate(prog): sub += np.sin(2 * np.pi * mid(ch[0] - 12) * t) * env(i * seg, (i + 1) * seg, 0.05, 0.05) * 0.22
kick = np.zeros(L)
for at in np.arange(0.85, DUR - 0.4, 60 / 112):
    n = int(0.3 * SR); tt = np.arange(n) / SR; add(kick, np.sin(2 * np.pi * (45 + 90 * np.exp(-tt * 35)) * tt) * np.exp(-tt * 11), at, 0.7)
music = pad + arp + sub + lp(kick, 220)
music *= env(0, DUR, 0.4, 0.6); music /= np.abs(music).max() / 0.85
# sfx
sfx = np.zeros(L)
def whoosh(d):
    n = int(d * SR); return bp(rng.standard_normal(n), 400, 5000) * np.sin(np.linspace(0, np.pi, n)) ** 2
def boom(amp=1.0):
    n = int(2.2 * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * (55 * np.exp(-tt * 3) + 32) * tt) * np.exp(-tt * 2.2) + lp(rng.standard_normal(n), 300) * np.exp(-tt * 6) * 0.5) * amp
def blip(f=1800, d=0.07):
    tt = np.arange(int(d * SR)) / SR; return np.sin(2 * np.pi * f * tt) * np.exp(-tt * 55)
def ping(f=1250):
    tt = np.arange(int(0.9 * SR)) / SR; return (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * f * 2.76 * tt)) * np.exp(-tt * 5)
add(sfx, whoosh(1.0), 0.0, 0.35)
add(sfx, boom(0.8), Wd["strait"][0] - 0.1, 1.0)                 # title hit
add(sfx, boom(0.45), Wd["narrowest"][0] - 0.05, 1.0)            # pin drop
for k in range(3): add(sfx, ping(), Wd["narrowest"][0] + 0.2 + k * 1.05, 0.13)   # radar sweeps
add(sfx, blip(2200), Wd["three"][0] - 0.1, 0.35)               # callout
for c in (5.85, 9.25, 12.25): add(sfx, whoosh(0.6), c - 0.35, 0.5)
for i in range(5): add(sfx, blip(1500 + i * 180), 5.85 + 0.35 + i * 0.18, 0.28)   # HUD tags
tc = Wd["hundred"][0] - 0.2
for k in np.arange(tc, tc + 1.3, 0.045): add(sfx, blip(2600, 0.02), k, 0.12)        # counter ticks
shimmer = hp(rng.standard_normal(int(1.6 * SR)), 6000) * np.exp(-np.linspace(0, 4, int(1.6 * SR)))
add(sfx, shimmer, 9.35, 0.18)
add(sfx, boom(0.9), Wd["eighty"][0] - 0.1, 1.0)                 # 80% hit
for name, x in [("vo_track", vo), ("music", music), ("sfx", sfx)]:
    sf.write(f"{M}/audio/{name}.wav", np.stack([x, x], 1).astype(np.float32), SR)
print("ok")
