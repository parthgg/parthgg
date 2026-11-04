"""15 s teaser score, 120 BPM in D minor; every hit lands on a picture cut. No whooshes: risers are tonal sweeps."""
import sys, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly, fftconvolve
C = sys.argv[1]; SR = 48000; DUR = 15.0; L = int(DUR * SR); rng = np.random.default_rng(11)
B = 0.5  # one beat
def buf(): return np.zeros(L)
def add(b, x, at, g=1.0):
    i = int(round(at * SR)); n = min(len(x), L - i)
    if n > 0 and i >= 0: b[i:i + n] += x[:n] * g
lp = lambda x, f, o=2: sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
hp = lambda x, f, o=2: sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
bp = lambda x, a, b: sosfilt(butter(2, [a, b], 'band', fs=SR, output='sos'), x)
mid = lambda m: 440 * 2 ** ((m - 69) / 12)
T = lambda d: np.arange(int(d * SR)) / SR
def saw(f, d): t = T(d); return 2 * ((t * f) % 1) - 1
def kick(a=1.0):
    t = T(0.45); f = 45 + 110 * np.exp(-t * 28); x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    x[:int(0.004 * SR)] += hp(rng.standard_normal(int(0.004 * SR)), 2000) * 0.4; return np.tanh(x * 1.6) * a
def clap():
    t = T(0.25); n = bp(rng.standard_normal(len(t)), 900, 5000); e = np.zeros(len(t))
    for o in (0, 0.011, 0.022): e += np.exp(-np.clip(t - o, 0, None) * 60) * (t >= o)
    return n * (e + 0.4 * np.exp(-t * 14)) * 0.6
def hat(d=0.03): t = T(d); return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * 140)
def boom(a=1.0, d=2.2):
    t = T(d); x = np.sin(2 * np.pi * (32 + 50 * np.exp(-t * 6)) * t) * np.exp(-t * 1.8)
    return np.tanh(x * 2.0) * a
def metal(a=1.0, d=1.6):
    t = T(d); fs = [312, 471, 733, 1097, 1588, 2241]; x = sum(np.sin(2 * np.pi * f * t + i) * np.exp(-t * (2.5 + i)) for i, f in enumerate(fs))
    return x / len(fs) * a
def tick(f=2600, a=1.0): t = T(0.04); return np.sin(2 * np.pi * f * t) * np.exp(-t * 110) * a
def blip(a=1.0):
    t = T(0.12); f = 1800 * np.exp(-t * 18) + 200; x = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)); x = np.round(x * 4) / 4
    return x * np.exp(-t * 25) * a
def sweep(f0, f1, d, a=1.0):
    t = T(d); f = f0 * (f1 / f0) ** (t / d); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.2 * np.sin(3.01 * ph)) * (t / d) ** 2.2 * a
def pluck(m, d=0.35, a=1.0):
    t = T(d); f = mid(m); x = (saw(f, d) * 0.6 + np.sin(2 * np.pi * f * t)) * np.exp(-t * 9)
    return lp(x, 3500) * a

drums, bass, pad, arp, fx, hits = buf(), buf(), buf(), buf(), buf(), buf()
CH = [[50, 53, 57, 62], [46, 50, 53, 58], [53, 57, 60, 65], [48, 52, 55, 60]]   # Dm  Bb  F  C (2 s each)
ROOT = [38, 34, 41, 36]
# --- pad across the whole piece
for bi in range(8):
    t0 = bi * 2.0; d = 2.3; ch = CH[bi % 4]; t = T(d); env = np.clip(t / 0.25, 0, 1) * np.clip((d - t) / 0.4, 0, 1)
    for m in ch: pad_ = (saw(mid(m) * 0.997, d) + saw(mid(m) * 1.003, d)) * env * 0.05; add(pad, lp(pad_, 1800), t0 - 0.1)
# --- intro 0-3: impact, hairline ticks, tonal riser into the zoom-through, pulsing sub through the dive
add(hits, boom(0.8), 0.0); add(hits, metal(0.35), 0.0)
for k, at in enumerate((0.05, 0.12, 0.19, 0.26, 0.33)): add(fx, tick(3000 + 200 * k, 0.25), at)
add(fx, sweep(180, 1400, 1.05, 0.22), 0.37)
add(hits, kick(0.9), 1.0); add(hits, boom(0.5, 1.2), 1.0)
for i in range(16):
    at = 1.0 + i * 0.125; add(bass, lp(saw(mid(ROOT[0] - 12), 0.11), 300) * np.exp(-T(0.11) * 12) * (0.5 + 0.5 * i / 16), at, 0.5)
    if i % 2: add(drums, hat(), at, 0.15 + 0.25 * i / 16)
add(fx, sweep(220, 2400, 1.0, 0.25), 2.0)
# --- main groove 3.0-11.0
for i in range(16):
    at = 3.0 + i * B
    if 7.5 <= at < 8.5: continue                     # the crash at 7.5: drums drop out for a bar
    add(drums, kick(), at)
    if i % 2: add(drums, clap(), at, 0.8)
    for s in (0.25,): add(drums, hat(), at + s, 0.35)
    if at >= 5.0: add(drums, hat(0.015), at + 0.125, 0.15); add(drums, hat(0.015), at + 0.375, 0.15)
# fill into the triptych
for k in range(8): add(drums, clap(), 4.5 + k * 0.0625, 0.25 + 0.5 * k / 8)
# bass: 8ths, ducked by the kick
for i in range(16):
    for h in range(2):
        at = 3.0 + i * B + h * 0.25
        if 7.5 <= at < 8.5: continue
        r = ROOT[int(at // 2) % 4]; x = lp(saw(mid(r - 12), 0.24) + 0.5 * saw(mid(r), 0.24), 380) * np.exp(-T(0.24) * 6)
        add(bass, x, at, 0.45)
# arp: 16ths on chord tones from the triptych onwards
pat = [0, 2, 1, 3, 2, 1, 3, 2]
for i in range(int((11.0 - 5.0) / 0.125)):
    at = 5.0 + i * 0.125
    if 7.5 <= at < 8.5: continue
    ch = CH[int(at // 2) % 4]; add(arp, pluck(ch[pat[i % 8]] + 12, 0.3, 0.16), at)
# hits on the cuts
for at, a in [(3.0, 1.0), (5.0, 0.7), (8.5, 0.7), (10.0, 0.6)]: add(hits, boom(0.55 * a, 1.4), at); add(hits, metal(0.3 * a), at)
for at in (3.0, 5.0, 8.5, 10.0, 11.0, 12.5): add(fx, blip(0.12), at)
# odometers
for k in range(14): add(fx, tick(2000 + 90 * k, 0.18), 3.02 + 0.9 * (1 - (1 - k / 13) ** 2))
for k in range(10): add(fx, tick(2200 + 90 * k, 0.15), 9.15 + 0.7 * (1 - (1 - k / 9) ** 2))
for at in (5.25, 5.5, 5.75): add(fx, pluck(74, 0.4, 0.25), at)
# the collapse: a falling tone into a heavy distorted hit at 7.5
t = T(0.5); f = 900 * (110 / 900) ** (t / 0.5); add(fx, np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.18 * (t / 0.5), 7.0)
add(hits, np.tanh(boom(1.4, 2.0) * 2.5) * 0.7, 7.5); add(hits, metal(0.5, 2.0), 7.5)
for k in range(4): add(fx, blip(0.18), 7.5 + k * 0.06)
# 11.0: everything stops but the drone; the line "block any one of them" plays over it
add(hits, boom(0.9, 2.5), 11.0); add(hits, metal(0.45, 2.2), 11.0)
t = T(1.5); add(bass, np.sin(2 * np.pi * mid(26) * t) * np.clip(t / 0.1, 0, 1) * np.clip((1.5 - t) / 0.3, 0, 1) * 0.35, 11.0)
# 12.0-12.5 strobe: accelerating kick roll + riser
for k in range(6): add(drums, kick(0.5 + 0.08 * k), 12.0 + k * 0.08)
add(fx, sweep(300, 3000, 0.5, 0.25), 12.0)
# 12.5 end card: final hit, three notes for the three straits, sustained chord
add(hits, boom(1.0, 2.5), 12.5); add(hits, metal(0.4, 2.5), 12.5)
for k, m in enumerate((74, 77, 81)): add(arp, pluck(m, 1.2, 0.35), 12.6 + k * 0.25)
d = 2.5; t = T(d); env = np.clip(t / 0.05, 0, 1) * np.exp(-t * 0.9)
for m in (50, 57, 62, 64, 65, 69): add(pad, lp(saw(mid(m) * 0.998, d) + saw(mid(m) * 1.002, d), 2200) * env * 0.06, 12.5)
pad[int(11.0 * SR):int(12.5 * SR)] *= 0.6
# --- simple room for pad/arp/hits
ir = rng.standard_normal(int(1.4 * SR)) * np.exp(-np.arange(int(1.4 * SR)) / SR * 4.5); ir = lp(ir, 5000); ir /= np.abs(ir).sum() / 8
wet = fftconvolve(pad + arp * 0.8 + hits * 0.3 + fx * 0.4, ir)[:L] * 0.25
# sidechain envelope from the kicks
sc = np.ones(L)
for i in range(16):
    at = 3.0 + i * B
    if 7.5 <= at < 8.5: continue
    j = int(at * SR); n = int(0.3 * SR); sc[j:j + n] = np.minimum(sc[j:j + n], 1 - 0.6 * np.exp(-np.arange(n) / SR * 12))
music = drums * 0.8 + (bass + pad + arp) * sc + hits * 0.9 + fx + wet
fade = np.clip((DUR - np.arange(L) / SR) / 0.6, 0, 1); music *= fade
music = np.tanh(music * 1.1) / 1.1
# --- voice: the doc's closing line, starting on the 11.0 cut
v = np.zeros(L); a, sr = sf.read(f"{C}/audio/vo_16.wav"); a = resample_poly(a, SR, sr); add(v, a, 11.0, 1.0)
sf.write(f"{C}/audio/teaser_music.wav", np.stack([music, music], 1).astype(np.float32), SR)
sf.write(f"{C}/audio/teaser_vo.wav", np.stack([v, v], 1).astype(np.float32), SR)
print("ok")
