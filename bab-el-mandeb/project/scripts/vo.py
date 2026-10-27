import sys, json, re, numpy as np, soundfile as sf
from scipy.signal import resample_poly
from kokoro_onnx import Kokoro
from pocketsphinx import Decoder
B, P = sys.argv[1], sys.argv[2]
k = Kokoro(f"{P}/tts/kokoro-v1.0.onnx", f"{P}/tts/voices-v1.0.bin")
LINES = [
    ("This is Bab el Mandeb. At its narrowest, just sixteen miles wide.", "this is bob el mandeb at its narrowest just sixteen miles wide"),
    ("Yet thousands of ships squeeze through it every year.", "yet thousands of ships squeeze through it every year"),
    ("It links the Gulf of Aden to the Red Sea, and on to the Suez Canal.", "it links the gulf of aden to the red sea and on to the suez canal"),
    ("The shortest sea route between Asia and Europe.", "the shortest sea route between asia and europe"),
]
GAP = [0.25, 0.35, 0.45, 0.25]
out = []; t0 = 0.3; segs = []
for i, (txt, align) in enumerate(LINES):
    a, sr = k.create(txt, voice="am_michael", speed=1.12, lang="en-us")
    sf.write(f"{B}/audio/vo_{i}.wav", a, sr)
    pcm = (np.clip(resample_poly(a, 16000, sr), -1, 1) * 32767).astype(np.int16).tobytes()
    d = Decoder(samprate=16000, bestpath=False)
    for w in align.split():
        if d.lookup_word(w) is None: print("not in dict:", w)
    d.add_word("mandeb", "M AE N D EH B", True) if d.lookup_word("mandeb") is None else None
    d.add_word("aden", "AA D AH N", True) if d.lookup_word("aden") is None else None
    d.set_align_text(align); d.start_utt(); d.process_raw(pcm, full_utt=True); d.end_utt()
    d.set_alignment(); d.start_utt(); d.process_raw(pcm, full_utt=True); d.end_utt()
    ws = [(s.name, t0 + s.start / 100, t0 + (s.start + s.duration) / 100) for s in d.get_alignment() if s.name not in ("<s>", "</s>", "<sil>")]
    segs.append({"start": round(t0, 3), "dur": round(len(a) / sr, 3)})
    out += [{"w": w, "s": round(s, 3), "e": round(e, 3), "line": i} for w, s, e in ws]
    t0 += len(a) / sr + GAP[i]
json.dump({"words": out, "lines": segs, "end": round(t0, 3)}, open(f"{B}/web/assets/vo.json", "w"))
for w in out: print(f'{w["s"]:5.2f} {w["w"]}', end=" | ")
print("\nlines", segs, "end", round(t0, 2))
