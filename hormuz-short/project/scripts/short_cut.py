"""Re-edit the 41.5 s render into an under-20 s cut: retimed frame sequences + new audio."""
import os, sys, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly
P = sys.argv[1]; FPS = 24; SR = 48000
# (src start, src end, speed)
SEGS = [(0.0, 8.2, 2.5), (8.2, 12.0, 1.0), (21.0, 25.5, 3.0), (26.5, 35.0, 1.25), (35.3, 38.8, 1.0)]
starts = []; acc = 0.0
for a, b, sp in SEGS: starts.append(acc); acc += (b - a) / sp
DUR = acc
def to_src(t):
    for (a, b, sp), s0 in zip(SEGS, starts):
        if t < s0 + (b - a) / sp: return a + (t - s0) * sp
    return SEGS[-1][1]
def to_out(ts):  # source time -> output time (first segment containing it)
    for (a, b, sp), s0 in zip(SEGS, starts):
        if a <= ts <= b: return s0 + (ts - a) / sp
    return None
N = int(round(DUR * FPS))
for src, dst in [("frames", "short_frames"), ("reel_frames", "short_reel"), ("frames_land", "short_frames_land"), ("reel_land", "short_reel_land")]:
    os.makedirs(f"{P}/{dst}", exist_ok=True)
    for f in os.listdir(f"{P}/{dst}"): os.remove(f"{P}/{dst}/{f}")
    for n in range(N):
        k = min(995, int(round(to_src(n / FPS) * FPS)))
        os.symlink(f"{P}/{src}/f_{k:05d}.png", f"{P}/{dst}/f_{n:05d}.png")
print("duration", round(DUR, 2), "frames", N, "seg starts", [round(s, 2) for s in starts])

L = int(DUR * SR); t = np.arange(L) / SR; rng = np.random.default_rng(1)
def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def env(a, b, fi, fo):
    e = np.clip((t - a) / fi, 0, 1) * np.clip((b - t) / fo, 0, 1); return e * e * (3 - 2 * e)
def add(buf, x, at, g):
    i = int(at * SR); n = min(len(x), L - i)
    if n > 0: buf[i:i + n] += x[:n] * g
# --- voiceover
vo = np.zeros(L)
for i, at in enumerate([0.35, 3.5, 8.9, 12.4]):
    a, sr = sf.read(f"{P}/audio/s_vo_{i}.wav"); add(vo, resample_poly(a, SR, sr), at, 1.0)
# --- music: same palette as the long cut, compressed structure
mid = lambda m: 440 * 2 ** ((m - 69) / 12); saw = lambda f: 2 * ((t * f) % 1) - 1
pad = np.zeros(L); chords = [[50, 57, 62, 65], [46, 53, 58, 65], [48, 55, 60, 67], [50, 57, 62, 69]]
seg = DUR / len(chords)
for i, ch in enumerate(chords):
    e = env(i * seg - 0.4, (i + 1) * seg + 0.4, 1.2, 1.2)
    for m in ch: pad += (saw(mid(m) * 0.999) + saw(mid(m) * 1.001)) * e * 0.05
pad = lp(pad, 900)
sub = np.sin(2 * np.pi * mid(38) * t) * 0.18 * env(0, DUR, 1.5, 1.2)
pulse = np.zeros(L); beat = 60 / 84
for k in np.arange(3.3, 8.6, beat):
    n = int(0.5 * SR); tt = np.arange(n) / SR
    add(pulse, np.sin(2 * np.pi * (55 - 25 * tt) * tt) * np.exp(-tt * 9), k, 0.8)
pulse = lp(pulse, 180) * 0.55
ticks = np.zeros(L)
for k in np.arange(3.3, 8.6, beat / 2):
    n = int(0.04 * SR); add(ticks, rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 120), k, 1)
ticks = hp(ticks, 6000) * 0.06
rise = hp(rng.standard_normal(L), 1500) * env(6.6, 8.58, 1.9, 0.05) ** 2 * 0.12
def boom(at, amp):
    n = int(3 * SR); tt = np.arange(n) / SR; x = np.sin(2 * np.pi * (70 * np.exp(-tt * 2) + 30) * tt) * np.exp(-tt * 1.6) * amp
    x += lp(rng.standard_normal(n), 400) * np.exp(-tt * 5) * amp * 0.6; out = np.zeros(L); add(out, x, at, 1); return out
whoosh = lp(hp(rng.standard_normal(L), 300), 3000) * env(2.4, 4.0, 0.8, 0.9) * 0.12
music = pad + sub + pulse + ticks + rise + whoosh + boom(0, 0.35) + boom(starts[3], 0.6) + boom(starts[4], 0.7)
music = music / np.abs(music).max() * 0.9
# --- sfx tied to the graphics (source times mapped into the cut)
def pop(f0=950, f1=320, d=0.09):
    tt = np.arange(int(d * SR)) / SR; f = f1 + (f0 - f1) * np.exp(-tt * 45)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 38)
def ding():
    tt = np.arange(int(0.6 * SR)) / SR; return (np.sin(2 * np.pi * 1320 * tt) + 0.4 * np.sin(2 * np.pi * 2653 * tt)) * np.exp(-tt * 7)
def thud():
    tt = np.arange(int(0.12 * SR)) / SR; return np.sin(2 * np.pi * (140 * np.exp(-tt * 25) + 60) * tt) * np.exp(-tt * 30)
sfx = np.zeros(L)
add(sfx, pop(), to_out(0.3), 0.5)
for i in range(5): add(sfx, pop(800 + i * 60), to_out(28.3 + i * 0.07), 0.32)
add(sfx, ding(), to_out(28.75), 0.22)
for n in range(10): add(sfx, thud(), to_out(31.28 + n * 0.09 + 0.12), 0.55)
for name, x in [("short_vo", vo), ("short_music", music), ("short_sfx", sfx)]:
    sf.write(f"{P}/audio/{name}.wav", np.stack([x, x], 1).astype(np.float32), SR)
