import sys, soundfile as sf
from kokoro_onnx import Kokoro
P=sys.argv[1]
k=Kokoro(f"{P}/tts/kokoro-v1.0.onnx", f"{P}/tts/voices-v1.0.bin")
lines=[
 "This is the Strait of Hormuz.",
 "Just thirty-nine kilometres wide at its narrowest point.",
 "Yet about one fifth of all the world's oil flows through it.",
 "That's twenty million barrels, every single day.",
]
for i,t in enumerate(lines):
    a,sr=k.create(t,voice="am_michael",speed=1.1,lang="en-us")
    sf.write(f"{P}/audio/s_vo_{i}.wav",a,sr); print(i, round(len(a)/sr,2))
