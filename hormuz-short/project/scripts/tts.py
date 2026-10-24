import sys, json, soundfile as sf
from kokoro_onnx import Kokoro
P=sys.argv[1]; voice=sys.argv[2] if len(sys.argv)>2 else "am_michael"
k=Kokoro(f"{P}/tts/kokoro-v1.0.onnx", f"{P}/tts/voices-v1.0.bin")
lines=[
 "This narrow channel may be the most important stretch of water on Earth.",
 "The Strait of Hormuz. Only about thirty-nine kilometres wide at its narrowest point.",
 "Every tanker leaving the Persian Gulf has to squeeze through here, with Iran on one side, and Oman on the other.",
 "Ships follow two lanes, each only about two miles wide. One way in. One way out.",
 "And through them flows roughly one fifth of all the oil the world uses. About twenty million barrels, every single day.",
 "The Strait of Hormuz. A narrow gateway, with global impact.",
]
meta=[]
for i,t in enumerate(lines):
    a,sr=k.create(t,voice=voice,speed=1.05,lang="en-us")
    sf.write(f"{P}/audio/vo_{i}.wav",a,sr); meta.append(len(a)/sr); print(i, round(len(a)/sr,2))
print("total",round(sum(meta),2))
