import json, sys, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly
C = sys.argv[1]; SR = 48000; DUR = 89.6; L = int(DUR * SR); t = np.arange(L) / SR; rng = np.random.default_rng(4)
vo = json.load(open(f"{C}/web/assets/vo.json"))
Wd = {}
for w in vo["words"]: Wd.setdefault(w["w"].split("(")[0], []).append(w["s"])
def add(buf, x, at, g):
    i = int(at * SR); n = min(len(x), L - i)
    if n > 0 and i >= 0: buf[i:i + n] += x[:n] * g
lp = lambda x, f: sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
hp = lambda x, f: sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
bp = lambda x, a, b: sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), x)
def env(a, b, fi, fo):
    e = np.clip((t - a) / fi, 0, 1) * np.clip((b - t) / fo, 0, 1); return e * e * (3 - 2 * e)
mid = lambda m: 440 * 2 ** ((m - 69) / 12)
# --- voiceover
v = np.zeros(L)
for i, ln in enumerate(vo["lines"]):
    a, sr = sf.read(f"{C}/audio/vo_{i:02d}.wav"); add(v, resample_poly(a, SR, sr), ln["start"], 1.0)
# --- score: sections with their own chords; slow attack pads, soft pulse in the chapters
sections = [  # start, end, chords (midi), pulse level
    (0.0, 15.0, [[50, 57, 62, 65], [46, 53, 58, 62]], 0.0),
    (15.0, 35.4, [[50, 57, 62, 65], [43, 50, 55, 58], [46, 53, 58, 62], [45, 52, 57, 61]], 0.6),
    (35.4, 58.4, [[48, 55, 60, 63], [44, 51, 56, 60], [46, 53, 58, 62], [43, 50, 55, 58]], 0.75),
    (58.4, 77.8, [[50, 57, 62, 65], [46, 53, 58, 62], [48, 55, 60, 64], [45, 52, 57, 61]], 0.7),
    (77.8, 89.6, [[46, 53, 58, 62], [48, 55, 60, 64], [50, 57, 62, 66], [50, 57, 62, 69]], 0.4),
]
pad = np.zeros(L); sub = np.zeros(L); pulse = np.zeros(L)
tri = lambda f: 2 * np.abs(2 * ((t * f) % 1) - 1) - 1
for s0, s1, chords, pl in sections:
    seg = (s1 - s0) / len(chords)
    for i, ch in enumerate(chords):
        a0, a1 = s0 + i * seg, s0 + (i + 1) * seg
        e = env(a0 - 0.4, a1 + 0.4, 1.4, 1.4)
        for m in ch: pad += (tri(mid(m + 12) * 0.998) + tri(mid(m + 12) * 1.002) + 0.5 * tri(mid(m + 24))) * e * 0.04
        sub += np.sin(2 * np.pi * mid(ch[0] - 12) * t) * env(a0, a1, 0.3, 0.3) * 0.16
    if pl > 0:
        for k in np.arange(s0 + 0.2, s1 - 0.2, 60 / 72):
            n = int(0.45 * SR); tt = np.arange(n) / SR
            add(pulse, np.sin(2 * np.pi * (52 + 60 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 8), k, pl)
pad = lp(pad, 1500)
def riser(at, d=2.2):
    n = int(d * SR); x = hp(rng.standard_normal(n), 1200) * np.linspace(0, 1, n) ** 3; out = np.zeros(L); add(out, x, at - d, 0.12); return out
def boom(at, amp):
    n = int(2.5 * SR); tt = np.arange(n) / SR
    x = (np.sin(2 * np.pi * (60 * np.exp(-tt * 3) + 30) * tt) * np.exp(-tt * 2.0) + lp(rng.standard_normal(n), 300) * np.exp(-tt * 6) * 0.5) * amp
    out = np.zeros(L); add(out, x, at, 1); return out
music = pad + sub + lp(pulse, 200)
for c in (15.0, 35.4, 58.4, 77.8): music += riser(c) + boom(c, 0.5)
music += boom(Wd["closes"][0] - 0.05, 0.7) + boom(Wd["block"][0], 0.45)
music *= env(0, DUR, 1.5, 2.5); music /= np.abs(music).max() / 0.85
# --- sfx
sfx = np.zeros(L)
def whoosh(d=0.7):
    n = int(d * SR); return bp(rng.standard_normal(n), 400, 5000) * np.sin(np.linspace(0, np.pi, n)) ** 2
def pop(f0=950, f1=320, d=0.09):
    tt = np.arange(int(d * SR)) / SR; f = f1 + (f0 - f1) * np.exp(-tt * 45); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 38)
def tick(f=2400):
    tt = np.arange(int(0.05 * SR)) / SR; return np.sin(2 * np.pi * f * tt) * np.exp(-tt * 90)
def alert():
    tt = np.arange(int(0.5 * SR)) / SR; return (np.sign(np.sin(2 * np.pi * 660 * tt)) * 0.3 + np.sin(2 * np.pi * 990 * tt)) * np.exp(-tt * 6)
for c in (5.6, 15.0, 35.4, 52.8, 58.4, 66.8, 70.9, 77.8): add(sfx, whoosh(), c - 0.4, 0.4)
for i in range(3): add(sfx, pop(900 + i * 90), Wd["three"][0] + i * 0.35, 0.45)
for at in (Wd["thirty"][0], Wd["twenty"][3]): add(sfx, tick(1800), at - 0.1, 0.4)
for at in (Wd["twenty"][2], Wd["fifth"][0], Wd["oil"][3], Wd["fifteen"][0], Wd["carrying"][0] + 0.2, Wd["eighty"][0]): add(sfx, tick(2600), at - 0.15, 0.3)
add(sfx, alert(), Wd["attack"][0] - 0.05, 0.22)
add(sfx, pop(700, 200, 0.12), Wd["singapore"][0], 0.4)
for i in range(3): add(sfx, pop(500, 160, 0.14), Wd["block"][0] + 0.35 + i * 0.22, 0.5)
for name, x in [("vo_track", v), ("music", music), ("sfx", sfx)]:
    sf.write(f"{C}/audio/{name}.wav", np.stack([x, x], 1).astype(np.float32), SR)
print("ok")
