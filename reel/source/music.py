"""Original soothing BGM: felt piano + warm pad + soft bass, 75 BPM, key of D.
Bar = 3.2 s, beat = 0.8 s. Composed to the edit: cuts land on beats,
section lift at bar 9 (25.6 s), final resolve at bar 13 (38.4 s)."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
import wave, sys

SR = 48000
BEAT = 0.8
BAR = 4 * BEAT
TOTAL = 42.6
N = int(TOTAL * SR)
rng = np.random.default_rng(7)

def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)

L = np.zeros(N); R = np.zeros(N)

def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N: return
    sig = sig[: N - i]
    gl = np.cos((pan + 1) * np.pi / 4); gr = np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * gain * gl
    R[i:i + len(sig)] += sig * gain * gr

def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), x)

def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x)

def piano(m, dur=4.0, vel=0.7, bright=1.0):
    f = mtof(m)
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    B = 0.00035
    pitch_decay = 1.0 + max(0, (m - 60)) / 30.0
    for k in range(1, 11):
        fk = f * k * np.sqrt(1 + B * k * k)
        if fk > 9000: break
        amp = (1.0 / k ** 1.6) * (vel ** (0.5 + 0.25 * k)) * (bright if k > 3 else 1)
        tau = 3.2 / (pitch_decay * (1 + 0.55 * (k - 1)))
        ph = rng.uniform(0, 2 * np.pi)
        # two slightly detuned strings -> gentle beating, like a real unison
        out += amp * np.exp(-t / tau) * (np.sin(2 * np.pi * fk * t + ph) + 0.6 * np.sin(2 * np.pi * fk * 1.0007 * t + ph))
    att = np.minimum(1, t / 0.006)
    rel = np.ones(n); r0 = int((dur - 0.35) * SR); rel[r0:] = np.linspace(1, 0, n - r0)
    hammer = lp(rng.standard_normal(n) * np.exp(-t / 0.012), 1800) * 0.04 * vel
    out = (out * att + hammer) * rel
    return lp(out, 3400 + 2600 * vel)  # felt-damped tone

def pad_chord(ms, dur, gain=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    l = np.zeros(n); r = np.zeros(n)
    for m in ms:
        f = mtof(m)
        for det, side in ((-0.004, 0), (0.0, 2), (0.004, 1)):
            ff = f * (1 + det)
            s = np.zeros(n)
            for k in range(1, 9):
                s += np.sin(2 * np.pi * ff * k * t + rng.uniform(0, 6.28)) / k
            if side in (0, 2): l += s
            if side in (1, 2): r += s
    env = np.minimum(1, t / 1.4) * np.minimum(1, (dur - t) / 1.6).clip(0, 1)
    lfo = 1 + 0.08 * np.sin(2 * np.pi * 0.15 * t)
    l = lp(l * env * lfo, 900, 4); r = lp(r * env * lfo, 900, 4)
    return l * gain, r * gain

def bass(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    f = mtof(m)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    env = np.minimum(1, t / 0.08) * np.exp(-t / 4.0) * np.minimum(1, (dur - t) / 0.4).clip(0, 1)
    return s * env

# Chords (MIDI). D = 62
CHORDS = {
    'D':  dict(root=38, arp=[50, 57, 64, 66, 69, 64, 66, 61 + 12], pad=[62, 66, 69, 73]),
    'Bm': dict(root=35, arp=[47, 54, 61, 62, 66, 61, 62, 69],      pad=[59, 62, 66, 69]),
    'G':  dict(root=31, arp=[43, 50, 57, 59, 62, 57, 59, 66],      pad=[59, 62, 66, 69 - 12 + 12]),
    'A':  dict(root=33, arp=[45, 52, 59, 62, 64, 59, 61, 64],      pad=[57, 61, 64, 66]),
}
PROG = ['D', 'Bm', 'G', 'A'] * 3 + ['D']

for b, name in enumerate(PROG):
    t0 = b * BAR
    c = CHORDS[name]
    final = b == len(PROG) - 1
    # piano arpeggio in eighths
    pattern = c['arp'] if not final else c['arp'][:5]
    for i, m in enumerate(pattern):
        tt = t0 + i * (BEAT / 2)
        vel = 0.55 + 0.12 * (i == 0) + rng.uniform(-0.05, 0.05)
        if b < 2: vel *= 0.85
        add(piano(m, 3.0 if not final else 6.0, vel), tt + rng.uniform(0, 0.012), (0.10 if m < 55 else 0.17), pan=-0.25 + 0.5 * (i % 2))
    # left hand low octave
    add(piano(c['root'] + 12, 3.6, 0.45), t0, 0.08, pan=-0.1)
    # pad from bar 3
    if b >= 2:
        pl, pr = pad_chord(c['pad'], BAR + 1.6 if not final else 4.2, 0.010 if b < 8 else 0.014)
        i0 = int(t0 * SR); n = min(len(pl), N - i0)
        L[i0:i0 + n] += pl[:n]; R[i0:i0 + n] += pr[:n]
    # bass from bar 5
    if b >= 4:
        add(bass(c['root'] + 12, BAR + 0.3 if not final else 4.0), t0, 0.045)

# Melody (bars 5-13), beats -> (midi, length_in_beats)
MEL = {
    4: [(78, 2), (76, 1), (74, 1)],
    5: [(74, 2), (73, 1), (71, 1)],
    6: [(74, 2), (71, 1), (69, 1)],
    7: [(76, 3)],
    8: [(81, 2), (78, 1), (76, 1)],
    9: [(78, 2), (74, 1), (73, 1)],
    10: [(74, 2), (76, 1), (78, 1)],
    11: [(76, 4)],
    12: [(74, 4)],
}
for b, notes in MEL.items():
    beat = 0
    for m, ln in notes:
        tt = b * BAR + beat * BEAT + rng.uniform(0, 0.015)
        vel = 0.62 if b < 8 else 0.7
        add(piano(m, max(2.5, ln * BEAT + 1.5) if b < 12 else 6.0, vel, bright=0.8), tt, 0.30, pan=0.1)
        beat += ln

# Reverb: synthetic stereo hall IR
irn = int(3.2 * SR); t = np.arange(irn) / SR
irL = lp(rng.standard_normal(irn), 5000) * np.exp(-t / 0.75)
irR = lp(rng.standard_normal(irn), 5000) * np.exp(-t / 0.75)
pre = int(0.02 * SR)
irL = np.concatenate([np.zeros(pre), irL]); irR = np.concatenate([np.zeros(pre), irR])
irL /= np.sqrt(np.sum(irL ** 2)); irR /= np.sqrt(np.sum(irR ** 2))
wetL = fftconvolve(hp(L, 180), irL)[:N]; wetR = fftconvolve(hp(R, 180), irR)[:N]
outL = 0.72 * L + 0.42 * wetL
outR = 0.72 * R + 0.42 * wetR

# master EQ: clean sub, scoop mud
outL = hp(outL, 55, 4); outR = hp(outR, 55, 4)
def scoop(x):
    band = sosfilt(butter(2, [160, 420], 'band', fs=SR, output='sos'), x)
    return x - 0.45 * band
outL = scoop(outL); outR = scoop(outR)
# gentle tape-ish warmth + master fade
outL = np.tanh(outL * 1.3) / 1.3; outR = np.tanh(outR * 1.3) / 1.3
tt = np.arange(N) / SR
fade = np.minimum(1, tt / 0.3) * np.clip((TOTAL - tt) / 3.0, 0, 1)
outL *= fade; outR *= fade
peak = max(np.abs(outL).max(), np.abs(outR).max())
outL = outL / peak * 0.89; outR = outR / peak * 0.89

pcm = (np.stack([outL, outR], 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('ok', TOTAL)
