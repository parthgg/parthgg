import json, re, sys, numpy as np, soundfile as sf
from scipy.signal import resample_poly
from pocketsphinx import Decoder
P=sys.argv[1]
starts=[0.5,6.0,12.2,20.0,26.6,35.4]
lines=[
 "This narrow channel may be the most important stretch of water on Earth.",
 "The Strait of Hormuz. Only about thirty-nine kilometres wide at its narrowest point.",
 "Every tanker leaving the Persian Gulf has to squeeze through here, with Iran on one side, and Oman on the other.",
 "Ships follow two lanes, each only about two miles wide. One way in. One way out.",
 "And through them flows roughly one fifth of all the oil the world uses. About twenty million barrels, every single day.",
 "The Strait of Hormuz. A narrow gateway, with global impact.",
]
words_out=[]
for i,line in enumerate(lines):
    a,sr=sf.read(f"{P}/audio/vo_{i}.wav"); a=resample_poly(a,16000,sr)
    pcm=(np.clip(a,-1,1)*32767).astype(np.int16).tobytes()
    disp=line.split()
    norm=[re.sub(r"[^a-z\-']","",w.lower()).replace("kilometres","kilometers") for w in disp]
    d=Decoder(samprate=16000,bestpath=False)
    toks=[]
    for w in norm:
        toks+= w.split("-") if "-" in w else [w]
    d.set_align_text(" ".join(toks))
    d.start_utt(); d.process_raw(pcm,full_utt=True); d.end_utt()
    d.set_alignment()
    d.start_utt(); d.process_raw(pcm,full_utt=True); d.end_utt()
    seg=[(s.name,s.start/100,(s.start+s.duration)/100) for s in d.get_alignment()]
    seg=[s for s in seg if s[0] not in ("<s>","</s>","<sil>")]
    # map tokens back to display words (hyphenated words take 2 tokens)
    k=0
    for dw,nw in zip(disp,norm):
        n=len(nw.split("-")) if "-" in nw else 1
        s0,e0=seg[k][1],seg[k+n-1][2]; k+=n
        words_out.append({"w":dw,"s":round(starts[i]+s0,3),"e":round(starts[i]+e0,3),"line":i})
json.dump(words_out,open(f"{P}/web/assets/words.json","w"),indent=0)
for w in words_out: print(f'{w["s"]:6.2f} {w["e"]:6.2f} {w["w"]}')
