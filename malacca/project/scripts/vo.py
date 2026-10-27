import sys, json, numpy as np, soundfile as sf
from scipy.signal import resample_poly
from kokoro_onnx import Kokoro
from pocketsphinx import Decoder
M, P = sys.argv[1], sys.argv[2]
k = Kokoro(f"{P}/tts/kokoro-v1.0.onnx", f"{P}/tts/voices-v1.0.bin")
LINES = [
    ("This is the Strait of Malacca.", "this is the strait of malacca"),
    ("At its narrowest, it's less than three kilometres wide.", "at its narrowest it's less than three kilometers wide"),
    ("Yet more than a hundred thousand ships pass through it every year,", "yet more than a hundred thousand ships pass through it every year"),
    ("carrying almost a third of the world's seaborne oil,", "carrying almost a third of the world's seaborne oil"),
    ("and around eighty percent of China's oil imports.", "and around eighty percent of china's oil imports"),
]
GAP = [0.2, 0.35, 0.15, 0.15, 0.3]
out, segs, t0 = [], [], 0.3
for i, (txt, al) in enumerate(LINES):
    a, sr = k.create(txt, voice="am_michael", speed=1.12, lang="en-us")
    sf.write(f"{M}/audio/vo_{i}.wav", a, sr)
    pcm = (np.clip(resample_poly(a, 16000, sr), -1, 1) * 32767).astype(np.int16).tobytes()
    d = Decoder(samprate=16000, bestpath=False)
    for w in al.split():
        if d.lookup_word(w) is None: print("missing", w)
    d.set_align_text(al); d.start_utt(); d.process_raw(pcm, full_utt=True); d.end_utt()
    d.set_alignment(); d.start_utt(); d.process_raw(pcm, full_utt=True); d.end_utt()
    out += [{"w": s.name, "s": round(t0 + s.start / 100, 3), "e": round(t0 + (s.start + s.duration) / 100, 3), "line": i}
            for s in d.get_alignment() if s.name not in ("<s>", "</s>", "<sil>")]
    segs.append({"start": round(t0, 3), "dur": round(len(a) / sr, 3)}); t0 += len(a) / sr + GAP[i]
json.dump({"words": out, "lines": segs, "end": round(t0, 3)}, open(f"{M}/web/assets/vo.json", "w"))
for w in out: print(f'{w["s"]:5.2f} {w["w"]}', end=" | ")
print("\n", segs, "end", round(t0, 2))
