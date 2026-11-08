"""Upbeat warm BGM for the 21.6s cut. 100 BPM (beat 0.6s, bar 2.4s), key of D.
I-V-vi-IV. Bar 1 intro, drums drop at bar 2 (first cut), breakdown at bar 5
(9.6s, 'some came hurt'), full lift bars 6-8, final chord at bar 9 (19.2s)."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
import wave, sys

SR = 48000
BEAT = 0.6
BAR = 4 * BEAT
TOTAL = 21.6
N = int((TOTAL + 0.5) * SR)
rng = np.random.default_rng(11)
mtof = lambda m: 440.0 * 2 ** ((m - 69) / 12)
L = np.zeros(N); R = np.zeros(N)
KICKS = []  # for sidechain

def lp(x, fc, o=2): return sosfilt(butter(o, fc, 'low', fs=SR, output='sos'), x)
def hp(x, fc, o=2): return sosfilt(butter(o, fc, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)

def add(sig, t0, g=1.0, pan=0.0, bus=None):
    i = int(t0 * SR)
    if i >= N: return
    sig = sig[:N - i]
    gl = np.cos((pan + 1) * np.pi / 4); gr = np.sin((pan + 1) * np.pi / 4)
    (bus or (L, R))[0][i:i + len(sig)] += sig * g * gl
    (bus or (L, R))[1][i:i + len(sig)] += sig * g * gr

def piano(m, dur=1.5, vel=0.7, bright=1.0):
    f = mtof(m); n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros(n); pd = 1.0 + max(0, m - 60) / 30.0
    for k in range(1, 11):
        fk = f * k * np.sqrt(1 + 0.00035 * k * k)
        if fk > 10000: break
        amp = (1 / k ** 1.5) * (vel ** (0.5 + 0.22 * k)) * (bright if k > 3 else 1)
        tau = 2.6 / (pd * (1 + 0.5 * (k - 1)))
        ph = rng.uniform(0, 6.28)
        out += amp * np.exp(-t / tau) * (np.sin(2 * np.pi * fk * t + ph) + 0.6 * np.sin(2 * np.pi * fk * 1.0007 * t + ph))
    att = np.minimum(1, t / 0.004)
    rel = np.ones(n); r0 = int(max(0, dur - 0.25) * SR); rel[r0:] = np.linspace(1, 0, n - r0)
    ham = lp(rng.standard_normal(n) * np.exp(-t / 0.01), 2500) * 0.05 * vel
    return lp((out * att + ham) * rel, 4000 + 3000 * vel)

def pad(ms, dur):
    n = int(dur * SR); t = np.arange(n) / SR; l = np.zeros(n); r = np.zeros(n)
    for m in ms:
        for det, side in ((-0.005, 0), (0, 2), (0.005, 1)):
            s = sum(np.sin(2 * np.pi * mtof(m) * (1 + det) * k * t + rng.uniform(0, 6.28)) / k for k in range(1, 8))
            if side != 1: l += s
            if side != 0: r += s
    env = np.minimum(1, t / 0.5) * np.clip((dur - t) / 0.6, 0, 1)
    return lp(l * env, 1400, 4), lp(r * env, 1400, 4)

def kick(v=1.0):
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 45 + 75 * np.exp(-t / 0.035)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    click = lp(rng.standard_normal(n) * np.exp(-t / 0.002), 3000) * 0.15
    return (s + click) * v

def clap(v=1.0):
    n = int(0.25 * SR); t = np.arange(n) / SR
    env = np.exp(-t / 0.06) * (1 + 0.6 * np.exp(-((t - 0.012) / 0.003) ** 2) + 0.5 * np.exp(-((t - 0.024) / 0.003) ** 2))
    return bp(rng.standard_normal(n), 900, 4500) * env * v

def shaker(v=1.0):
    n = int(0.09 * SR); t = np.arange(n) / SR
    env = np.minimum(1, t / 0.012) * np.exp(-t / 0.025)
    return hp(rng.standard_normal(n), 6000, 4) * env * v

def bassnote(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR; f = mtof(m)
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    return lp(s * np.minimum(1, t / 0.01) * np.exp(-t / 0.5) * np.clip((dur - t) / 0.05, 0, 1), 700)

CH = {  # root, comp voicing (oct 4), arp (oct 4-5), pad
    'D':  (38, [62, 66, 69, 73], [74, 69, 66, 69, 76, 69, 66, 69], [62, 66, 69]),
    'A':  (33, [61, 64, 69, 71], [73, 69, 64, 69, 76, 69, 64, 69], [61, 64, 69]),
    'Bm': (35, [62, 66, 69, 71], [74, 71, 66, 71, 78, 71, 66, 71], [59, 62, 66]),
    'G':  (31, [62, 67, 71, 74], [74, 71, 67, 71, 79, 71, 67, 71], [59, 62, 67]),
}
PROG = ['D', 'A', 'Bm', 'G', 'D', 'A', 'Bm', 'G', 'D']
BREAK = 4      # bar index (0-based) of the breakdown
pads = (np.zeros(N), np.zeros(N))

for b, name in enumerate(PROG):
    t0 = b * BAR; root, comp, arp, pd_ = CH[name]
    final = b == len(PROG) - 1
    full = 1 <= b and b != BREAK and not final
    # piano comp: 3-3-2 syncopated stabs
    hits = [0, 1.5, 3.0] if not final else [0]
    for h in hits:
        for m in comp:
            add(piano(m, 1.1 if not final else 3.2, 0.62 + 0.1 * (h == 0)), t0 + h * BEAT + rng.uniform(0, 0.008), 0.05, pan=-0.2)
    # light 8th-note arp sparkle
    if not final:
        for i, m in enumerate(arp):
            add(piano(m + 12 * (b >= 5), 0.9, 0.45 + 0.08 * (i % 2 == 0)), t0 + i * BEAT / 2, 0.06 if b != BREAK else 0.09, pan=0.35)
    # pad
    pl, pr = pad(pd_, BAR + 0.6 if not final else 2.8)
    i0 = int(t0 * SR); n = min(len(pl), N - i0)
    g = 0.012 if b != BREAK else 0.02
    pads[0][i0:i0 + n] += pl[:n] * g; pads[1][i0:i0 + n] += pr[:n] * g
    # bass
    if b >= 1 and b != BREAK:
        for h, d in ((0, 1.0), (1.5, 0.5), (2.0, 1.0), (3.5, 0.5)) if not final else ((0, 2.5),):
            add(bassnote(root + 12, d * BEAT + 0.05 if not final else 2.5), t0 + h * BEAT, 0.16)
    # drums
    if full:
        for bt in (0, 2): add(kick(1.0), t0 + bt * BEAT, 0.42 if b < 5 else 0.48); KICKS.append(t0 + bt * BEAT)
        add(kick(0.55), t0 + 2.5 * BEAT, 0.42); KICKS.append(t0 + 2.5 * BEAT)
        for bt in (1, 3): add(clap(1.0), t0 + bt * BEAT, 0.24 if b < 5 else 0.28, pan=0.05)
    if b >= 1 and not final:
        for e in range(8):
            add(shaker(1.0 if e % 2 else 0.55), t0 + e * BEAT / 2 + rng.uniform(0, 0.006), (0.13 if b < 5 else 0.16) if b != BREAK else 0.07, pan=0.4)
    if b == BREAK - 1 or b == len(PROG) - 2:  # little riser into breakdown / ending
        n = int(BAR * SR); tt = np.arange(n) / SR
        rs = hp(rng.standard_normal(n), 3000) * (tt / (BAR)) ** 3 * 0.02
        add(rs, t0, 1.0, pan=0)

# melody: (midi, beats)
MEL = {
    1: [(76, 1), (73, .5), (76, .5), (81, 1), (76, 1)],
    2: [(78, 1.5), (76, .5), (74, 1), (71, 1)],
    3: [(74, 1), (76, .5), (78, .5), (79, 1), (78, 1)],
    4: [(76, 2), (73, 2)],
    5: [(78, 1), (81, 1), (83, 1), (81, 1)],
    6: [(79, 1), (78, .5), (76, .5), (74, 1), (76, 1)],
    7: [(78, 1.5), (76, .5), (74, 1), (76, 1)],
    8: [(78, 4)],
}
for b, notes in MEL.items():
    bt = 0
    for m, ln in notes:
        add(piano(m, max(1.0, ln * BEAT + 0.6) if b < 8 else 3.0, 0.72 if b != BREAK else 0.6, 0.9),
            b * BAR + bt * BEAT + rng.uniform(0, 0.01), 0.17 if b < 5 else 0.21, pan=0.05)
        if 5 <= b <= 7: add(piano(m - 12, max(1.0, ln * BEAT + 0.6), 0.6), b * BAR + bt * BEAT, 0.08, pan=-0.1)
        if b == 8: add(piano(74, 3.0, 0.6), b * BAR, 0.12)
        bt += ln

# sidechain pump on pads
sc = np.ones(N); tt = np.arange(int(0.3 * SR)) / SR
duck = 1 - 0.55 * np.exp(-tt / 0.09)
for k in KICKS:
    i = int(k * SR); n = min(len(duck), N - i); sc[i:i + n] = np.minimum(sc[i:i + n], duck[:n])
L += pads[0] * sc; R += pads[1] * sc

# reverb (shorter room)
irn = int(1.8 * SR); t = np.arange(irn) / SR
def ir():
    x = lp(rng.standard_normal(irn), 6000) * np.exp(-t / 0.42); return x / np.sqrt(np.sum(x ** 2))
wl = fftconvolve(hp(L, 250), ir())[:N]; wr = fftconvolve(hp(R, 250), ir())[:N]
oL = 0.8 * L + 0.3 * wl; oR = 0.8 * R + 0.3 * wr
oL = hp(oL, 35, 4); oR = hp(oR, 35, 4)
oL -= 0.35 * bp(oL, 180, 400); oR -= 0.35 * bp(oR, 180, 400)
oL = np.tanh(oL * 1.4) / 1.4; oR = np.tanh(oR * 1.4) / 1.4
T_ = np.arange(N) / SR
fade = np.minimum(1, T_ / 0.05) * np.clip((TOTAL - T_) / 1.6, 0, 1)
oL *= fade; oR *= fade
pk = max(abs(oL).max(), abs(oR).max()); oL *= 0.89 / pk; oR *= 0.89 / pk
pcm = (np.stack([oL, oR], 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok')
