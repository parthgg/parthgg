import sys, json, re, numpy as np, soundfile as sf
from scipy.signal import resample_poly
from kokoro_onnx import Kokoro
from pocketsphinx import Decoder
OUT, P = sys.argv[1], sys.argv[2]
k = Kokoro(f"{P}/tts/kokoro-v1.0.onnx", f"{P}/tts/voices-v1.0.bin")
LINES = [  # (start, text) — starts sit on the music's section hits
 (0.25, "Every day, the world's economy squeezes through three narrow gaps in the sea."),
 (5.85, "The Strait of Hormuz. Just thirty-nine kilometres wide."),
 (9.25, "Twenty million barrels of oil pass through it every day. A fifth of all the oil the world uses."),
 (17.2, "Bab el Mandeb. When ships came under attack here, oil flows fell by more than half."),
 (22.85, "Tankers took the long way, around Africa. Fifteen extra days."),
 (27.05, "And the Strait of Malacca. Less than three kilometres wide. It carries even more oil than Hormuz."),
 (34.75, "Block any one of them,"),
 (36.6, "and the whole world feels it."),
]
def norm(txt):
    w = re.sub(r"[^a-z' ]", " ", txt.lower().replace("-", " ").replace("kilometres", "kilometers")).split()
    return [x.strip("'") for x in w if x.strip("'")]
SR = 24000; track = np.zeros(int(44 * SR)); words, lines = [], []
for i, (t0, txt) in enumerate(LINES):
    a, sr = k.create(txt, voice="am_michael", speed=1.12, lang="en-us"); assert sr == SR
    # trim leading/trailing silence so the line lands exactly on its start time
    nz = np.where(np.abs(a) > 0.01)[0]; a = a[max(0, nz[0] - 240): nz[-1] + 2400]
    j = int(t0 * SR); track[j:j + len(a)] += a
    pcm = (np.clip(resample_poly(a, 16000, sr), -1, 1) * 32767).astype(np.int16).tobytes()
    d = Decoder(samprate=16000, bestpath=False); ws = norm(txt)
    for w in ws:
        if d.lookup_word(w) is None: d.add_word(w, {"mandeb": "M AE N D EH B", "hormuz": "HH AO R M UW Z", "malacca": "M AH L AE K AH"}.get(w, "AH"), True)
    d.set_align_text(" ".join(ws)); d.start_utt(); d.process_raw(pcm, full_utt=True); d.end_utt()
    d.set_alignment(); d.start_utt(); d.process_raw(pcm, full_utt=True); d.end_utt()
    words += [{"w": s.name, "s": round(t0 + s.start / 100, 3), "e": round(t0 + (s.start + s.duration) / 100, 3), "line": i} for s in d.get_alignment() if s.name not in ("<s>", "</s>", "<sil>")]
    lines.append({"start": t0, "end": round(t0 + len(a) / SR, 3), "text": txt})
    print(f"{t0:6.2f} -> {t0 + len(a) / SR:6.2f}  {txt}")
sf.write(f"{OUT}/audio/vo_track.wav", track, SR)
json.dump({"words": words, "lines": lines}, open(f"{OUT}/vo.json", "w"), indent=0)
