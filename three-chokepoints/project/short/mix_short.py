"""Shorts mix: CC0 score (Ondrosik, "Sanctum Resonance"), CC0 USC/Sunset Editorial sound effects, Kokoro voiceover."""
import sys, json, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly, fftconvolve
D = sys.argv[1]; SR = 48000; DUR = 41.5; L = int(DUR * SR); rng = np.random.default_rng(3)
vo = json.load(open(f"{D}/vo.json")); Wd = {}
for w in vo["words"]: Wd.setdefault(w["w"].split("(")[0], []).append(w["s"])
def load(name): x, sr = sf.read(f"{D}/sfx/{name}.wav"); return x if sr == SR else resample_poly(x, SR, sr)
def seg(x, a, b=None): return x[int(a * SR): int(b * SR) if b else None]
def norm(x, db): p = np.abs(x).max() + 1e-9; return x / p * 10 ** (db / 20)
def fade(x, fi=0.01, fo=0.2):
    n = len(x); e = np.ones(n); a, b = int(fi * SR), int(fo * SR)
    if a: e[:a] = np.linspace(0, 1, a)
    if b: e[-b:] = np.minimum(e[-b:], np.linspace(1, 0, b))
    return x * e
lp = lambda x, f: sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
hp = lambda x, f: sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def pitch(x, k): return resample_poly(x, int(1000 * k), 1000)          # k > 1 = slower / lower
bus = {k: np.zeros(L) for k in ("amb", "fx", "hit")}
def add(b, x, at, g=1.0):
    i = int(round(at * SR)); n = min(len(x), L - i)
    if n > 0: bus[b][i:i + n] += x[:n] * g

S = {k: load(k) for k in ["horn_ship", "horn_fog", "horn_destroyer", "siren_navy", "bow_wash", "surf", "expl_heavy", "expl_single", "expl_dull",
                          "expl_underwater", "radio_interf", "radio_static", "rumble", "teletype"]}
thud = lambda g=-6, k=1.6: norm(fade(lp(pitch(seg(S["expl_dull"], 0, 1.6), k), 900), 0.002, 0.5), g)
boom = lambda g=-3, k=1.3: norm(fade(lp(pitch(seg(S["expl_heavy"], 0.2, 5.5), k), 2500), 0.003, 1.5), g)
# --- A: space, comms chatter, three pillars erupt
add("amb", norm(fade(hp(seg(S["radio_interf"], 2, 8), 300), 0.6, 1.2), -24), 0.0)
for i in range(3): add("hit", boom(-4 - i, 1.25 + 0.1 * i), Wd["three"][0] + i * 0.3)
# --- B: the dive, then water
add("amb", norm(fade(pitch(seg(S["rumble"], 0, 7), 1.4), 1.0, 1.0), -14), 5.6)
add("amb", norm(fade(seg(S["bow_wash"], 1.0, 6.0), 0.8, 0.6), -16), 7.9)
add("fx", thud(-8, 1.9), Wd["thirty"][0] + 0.1)
# --- C/D: the tanker's horn carries over the cut into the oil pillar
add("fx", norm(fade(seg(S["horn_ship"], 0.0, 3.4), 0.01, 1.0), -4), 9.25)
add("hit", boom(-2, 1.45), 10.42)
add("amb", norm(fade(lp(seg(S["rumble"], 0, 7), 400), 0.5, 1.5), -16), 10.5)
add("fx", thud(-9, 1.7), Wd["fifth"][0] - 0.2)
add("amb", norm(fade(seg(S["surf"], 4, 11), 1.0, 1.5), -26), 10.4)
# --- E: Bab el-Mandeb — radio, alarm, explosions, collapse
add("fx", norm(fade(seg(S["radio_static"], 0.0, 1.1), 0.01, 0.3), -14), 17.05)
add("fx", norm(fade(seg(S["siren_navy"], 13.2, 17.4), 0.5, 1.0), -15), 18.2)
tA = Wd["attack"][0]
add("hit", norm(fade(seg(S["expl_single"], 0.25, 5.5), 0.003, 1.5), -2), tA - 0.05)
add("hit", norm(fade(seg(S["expl_underwater"], 0.6, 5.0), 0.003, 1.5), -5), tA + 0.3)
add("hit", norm(fade(lp(seg(S["expl_heavy"], 0.25, 5.0), 3000), 0.003, 1.5), -6), tA + 0.6)
add("hit", boom(-3, 1.55), Wd["half"][0] - 0.2)
# --- F: the long way round
add("fx", norm(fade(seg(S["horn_fog"], 0.0, 3.2), 0.05, 1.2), -12), 23.3)
add("fx", thud(-8, 1.6), Wd["fifteen"][0] - 0.2)
# --- G/H: Malacca traffic, real bow wash on the boat footage
add("amb", norm(fade(seg(S["bow_wash"], 8.0, 13.0), 0.6, 0.8), -16), 26.95)
add("fx", norm(fade(seg(S["horn_destroyer"], 7.2, 9.6), 0.02, 0.8), -16), 27.7)
add("fx", thud(-9, 1.8), Wd["three"][1] - 0.1)
add("amb", norm(fade(seg(S["bow_wash"], 1.5, 3.2), 0.05, 0.4), -9), 30.5)
# --- I: two pillars
add("fx", thud(-6, 1.5), Wd["oil"][3] - 0.25); add("fx", thud(-7, 1.4), Wd["hormuz"][1] - 0.2)
# --- K: block — everything turns red
add("hit", boom(-1, 1.35), Wd["block"][0])
add("fx", norm(fade(seg(S["siren_navy"], 13.2, 17.6), 0.05, 1.2), -12), Wd["block"][0] + 0.05)
for i, w in enumerate(("block", "any", "one")): add("fx", thud(-7, 1.5 + 0.15 * i), Wd[w][0] + [0.12, 0.05, 0.08][i])
add("hit", norm(fade(lp(seg(S["expl_underwater"], 0.6, 5.0), 1800), 0.01, 2.0), -4), Wd["feels"][0])
add("amb", norm(fade(hp(seg(S["radio_interf"], 10, 14), 400), 0.4, 1.0), -24), 35.4)
# --- L: one last horn under the title
add("fx", norm(fade(lp(seg(S["horn_ship"], 0.0, 3.0), 1800), 0.05, 1.6), -14), 38.75)

# --- score: Sanctum Resonance from 0 s; its own stop at 34.2-34.7 is the dramatic pause
m, sr = sf.read(f"{D}/music.wav"); m = m if sr == SR else resample_poly(m, SR, sr)
if m.ndim == 1: m = np.stack([m, m], 1)
music = np.zeros((L, 2)); n = min(len(m), L); music[:n] = m[:n]
t = np.arange(L) / SR; music *= (np.clip((DUR - t) / 1.0, 0, 1) ** 1.5)[:, None]
music = norm(music, -6)
# --- voice
v, sr = sf.read(f"{D}/audio/vo_track.wav"); v = resample_poly(v, SR, sr)[:L]; v = np.pad(v, (0, L - len(v)))
v = norm(v, -3)
# duck music + ambience under the voice
env = np.convolve(np.abs(v), np.ones(int(0.05 * SR)) / int(0.05 * SR), "same"); duck = 1 - 0.55 * np.clip(env / 0.05, 0, 1)
duck = np.convolve(duck, np.ones(int(0.15 * SR)) / int(0.15 * SR), "same")
# small room on the effects so they sit in one space
ir = rng.standard_normal(int(0.9 * SR)) * np.exp(-np.arange(int(0.9 * SR)) / SR * 6); ir = lp(ir, 6000); ir /= np.abs(ir).sum() / 6
fx = bus["fx"] + bus["hit"]; fxw = fx + fftconvolve(fx, ir)[:L] * 0.18
mono = bus["amb"] * 0.8 * (0.6 + 0.4 * duck) + fxw * 0.85 + v * 1.0
mix = music * (0.62 * duck)[:, None] + mono[:, None]
# hard silence for the pause before "block"
a, b = int(34.2 * SR), int(Wd["block"][0] * SR - 0.03 * SR); g = np.ones(L); g[a:b] = 0.0
g[a - 480:a] = np.linspace(1, 0, 480); mix *= g[:, None]
mix = np.tanh(mix * 1.2) / 1.2
sf.write(f"{D}/audio/short_mix_raw.wav", mix.astype(np.float32), SR)
print("ok")
