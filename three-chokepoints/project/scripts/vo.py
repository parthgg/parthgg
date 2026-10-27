import sys, json, re, numpy as np, soundfile as sf
from scipy.signal import resample_poly
from kokoro_onnx import Kokoro
from pocketsphinx import Decoder
C, P = sys.argv[1], sys.argv[2]
k = Kokoro(f"{P}/tts/kokoro-v1.0.onnx", f"{P}/tts/voices-v1.0.bin")
# (text, alignment text, pause after)
LINES = [
 ("Almost everything you buy, and most of the oil that powers it, travels by sea.", 0.45),
 ("But the world's busiest shipping routes all squeeze through a handful of narrow gaps.", 0.35),
 ("Here are three of them, and why the whole world watches them.", 0.9),
 ("First, the Strait of Hormuz.", 0.3),
 ("Just thirty-nine kilometres wide, it's the only way out of the Persian Gulf.", 0.35),
 ("In twenty twenty-four, about twenty million barrels of oil passed through it every day, roughly a fifth of everything the world consumes.", 0.35),
 ("There is no other sea route. If Hormuz closes, that oil is stuck.", 0.9),
 ("Sail west, and the next bottleneck is Bab el Mandeb.", 0.3),
 ("Twenty-six kilometres wide, it guards the Red Sea and the Suez Canal, the shortest route between Asia and Europe.", 0.35),
 ("When ships came under attack here in late twenty twenty-three, oil flows fell by more than half.", 0.3),
 ("Many tankers sailed around Africa instead, a detour of about fifteen days.", 0.9),
 ("Sail east, and you reach the busiest of them all: the Strait of Malacca.", 0.3),
 ("Near Singapore, it's less than three kilometres wide.", 0.35),
 ("More than a hundred thousand ships passed through it in twenty twenty-five, carrying even more oil than Hormuz,", 0.2),
 ("including around eighty percent of China's oil imports.", 0.9),
 ("Three narrow straits, linking the oil of the Gulf to the factories of Asia and the markets of Europe.", 0.4),
 ("Block any one of them, and the whole world feels it.", 1.2),
]
def norm(txt):
    w = re.sub(r"[^a-z' ]", " ", txt.lower().replace("-", " ").replace("kilometres", "kilometers")).split()
    return [x.strip("'") for x in w if x.strip("'")]
out, segs, t0 = [], [], 0.4
for i, (txt, gap) in enumerate(LINES):
    a, sr = k.create(txt, voice="am_michael", speed=1.08, lang="en-us")
    sf.write(f"{C}/audio/vo_{i:02d}.wav", a, sr)
    pcm = (np.clip(resample_poly(a, 16000, sr), -1, 1) * 32767).astype(np.int16).tobytes()
    d = Decoder(samprate=16000, bestpath=False)
    ws = [w for w in norm(txt)]
    for w in ws:
        if d.lookup_word(w) is None:
            d.add_word(w, {"mandeb": "M AE N D EH B", "hormuz": "HH AO R M UW Z", "malacca": "M AH L AE K AH"}.get(w, "AH"), True); print("added", w)
    d.set_align_text(" ".join(ws)); d.start_utt(); d.process_raw(pcm, full_utt=True); d.end_utt()
    d.set_alignment(); d.start_utt(); d.process_raw(pcm, full_utt=True); d.end_utt()
    out += [{"w": s.name, "s": round(t0 + s.start / 100, 3), "e": round(t0 + (s.start + s.duration) / 100, 3), "line": i}
            for s in d.get_alignment() if s.name not in ("<s>", "</s>", "<sil>")]
    segs.append({"start": round(t0, 3), "dur": round(len(a) / sr, 3), "text": txt}); t0 += len(a) / sr + gap
json.dump({"words": out, "lines": segs, "end": round(t0, 3)}, open(f"{C}/web/assets/vo.json", "w"), indent=0)
for s in segs: print(f'{s["start"]:6.2f} +{s["dur"]:5.2f}  {s["text"]}')
print("total", round(t0, 2))
