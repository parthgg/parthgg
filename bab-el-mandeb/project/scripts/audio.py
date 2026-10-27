import json, sys, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly
B = sys.argv[1]; SR = 48000; DUR = 15.6; L = int(DUR * SR); t = np.arange(L) / SR; rng = np.random.default_rng(3)
vo_meta = json.load(open(f"{B}/web/assets/vo.json"))
W = {}
for w in vo_meta["words"]: W.setdefault(w["w"].split("(")[0], []).append(w["s"])
def add(buf, x, at, g):
    i = int(at * SR); n = min(len(x), L - i)
    if n > 0: buf[i:i + n] += x[:n] * g
lp = lambda x, f: sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
hp = lambda x, f: sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
bp = lambda x, a, b: sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), x)
def env(a, b, fi, fo):
    e = np.clip((t - a) / fi, 0, 1) * np.clip((b - t) / fo, 0, 1); return e * e * (3 - 2 * e)
# voiceover
vo = np.zeros(L)
for i, ln in enumerate(vo_meta["lines"]):
    a, sr = sf.read(f"{B}/audio/vo_{i}.wav"); add(vo, resample_poly(a, SR, sr), ln["start"], 1.0)
# music: pulsing minor pad + soft kick, lifts after the zoom
mid = lambda m: 440 * 2 ** ((m - 69) / 12); saw = lambda f: 2 * ((t * f) % 1) - 1
pad = np.zeros(L)
for i, ch in enumerate([[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [45, 52, 57, 64]]):
    e = env(i * 3.9 - 0.3, (i + 1) * 3.9 + 0.3, 0.8, 0.8)
    for m in ch: pad += (saw(mid(m) * 0.998) + saw(mid(m) * 1.002)) * e * 0.045
pad = lp(pad, 1100) * (0.75 + 0.25 * np.sin(2 * np.pi * t * 2.2))
kick = np.zeros(L); beat = 60 / 100
for k in np.arange(0.3, DUR - 0.3, beat):
    n = int(0.35 * SR); tt = np.arange(n) / SR
    add(kick, np.sin(2 * np.pi * (48 + 70 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 10), k, 0.55 if k < 7.0 else 0.75)
hats = np.zeros(L)
for k in np.arange(8.0, DUR - 0.3, beat / 2):
    n = int(0.03 * SR); add(hats, rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 150), k, 1)
hats = hp(hats, 7000) * 0.05
music = pad + lp(kick, 200) + hats + np.sin(2 * np.pi * mid(33) * t) * 0.12 * env(0, DUR, 1, 1)
music = music / np.abs(music).max() * 0.85
# sfx
sfx = np.zeros(L)
whoosh = bp(rng.standard_normal(int(1.3 * SR)), 300, 3500) * np.sin(np.linspace(0, np.pi, int(1.3 * SR))) ** 2
add(sfx, whoosh, 6.75, 0.55)
def click():
    n = int(0.025 * SR); return hp(rng.standard_normal(n), 2500) * np.exp(-np.arange(n) / SR * 260)
ts = W["sixteen"][0] - 0.05
for i in range(13): add(sfx, click(), ts + i * 0.6 / 13, 0.35)
def pop(f0=950, f1=320, d=0.09):
    tt = np.arange(int(d * SR)) / SR; f = f1 + (f0 - f1) * np.exp(-tt * 45)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 38)
for i in range(3): add(sfx, pop(900 + i * 80), W["ships"][0] + 0.05 + i * 0.22, 0.4)
def chime(f=1480):
    tt = np.arange(int(0.7 * SR)) / SR; return (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt * 6)
add(sfx, chime(1320), W["aden"][0] - 0.1, 0.16); add(sfx, chime(1480), W["red"][0], 0.14); add(sfx, chime(1760), W["suez"][0] - 0.05, 0.16)
add(sfx, pop(1200, 500), W["mandeb"][0] - 0.25, 0.3)
for name, x in [("vo_track", vo), ("music", music), ("sfx", sfx)]:
    sf.write(f"{B}/audio/{name}.wav", np.stack([x, x], 1).astype(np.float32), SR)
print("ok")
