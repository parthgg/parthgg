"""Re-cut the documentary with the reference-style inserts spliced in."""
import os, subprocess, sys
C = sys.argv[1]; D = "/home/user/parthgg/three-chokepoints"; FPS = 25
def run(cmd): print(" ".join(cmd[:6]), "..."); subprocess.run(cmd, check=True)
def first_frame(clip, s):
    n = round(s * FPS)
    while not os.path.exists(f"{C}/clips/{clip}/f_{n:05d}.png"): n += 1
    return n
# 1) footage segments with their transparent overlays
run(["ffmpeg", "-v", "error", "-y", "-i", f"{C}/F0.mp4", "-framerate", "25", "-start_number", str(first_frame("KIN", 0)), "-i", f"{C}/clips/KIN/f_%05d.png",
     "-filter_complex", "[0:v][1:v]overlay=format=auto:eof_action=pass,format=yuv420p[v]", "-map", "[v]", "-c:v", "libx264", "-crf", "14", f"{C}/F0k.mp4"])
run(["ffmpeg", "-v", "error", "-y", "-i", f"{C}/F1base.mp4", "-framerate", "25", "-start_number", str(first_frame("F1", 66.68)), "-i", f"{C}/clips/F1/f_%05d.png",
     "-framerate", "25", "-start_number", str(first_frame("TAG", 66.68)), "-i", f"{C}/clips/TAG/f_%05d.png",
     "-filter_complex", "[0:v][1:v]overlay=format=auto[a];[a][2:v]overlay=format=auto,format=yuv420p[v]", "-map", "[v]", "-c:v", "libx264", "-crf", "14", f"{C}/F1k.mp4"])
# 2) segments: (source, global start of segment, global end); source is a clip folder or (video file, its global start)
cuts = [5.6, 15.0, 17.3, 35.4, 38.8, 47.05, 50.3, 52.8, 58.4, 62.8, 66.8, 70.9, 77.8]
srcs = [("F0k.mp4", 0.0), "W1", "CH1", "H", "CH2", "B", "ATT", "B", "W2", "CH3", "M1", ("F1k.mp4", 66.68), "M2", "W3"]
END = 89.6
inputs, chains = [], []
for i, src in enumerate(srcs):
    s = 0.0 if i == 0 else cuts[i - 1] - 0.1
    e = END if i == len(srcs) - 1 else cuts[i] + 0.1
    if isinstance(src, tuple):
        inputs += ["-i", f"{C}/{src[0]}"]; off = s - src[1]
    else:
        n0 = first_frame(src, s); inputs += ["-framerate", "25", "-start_number", str(n0), "-i", f"{C}/clips/{src}/f_%05d.png"]; off = s - n0 / FPS
    off = max(0.0, off)
    chains.append(f"[{i}:v]settb=AVTB,fps=25,format=yuv420p,trim=start={off:.3f}:duration={e - s:.3f},setpts=PTS-STARTPTS[s{i}]")
x = "s0"
for i in range(1, len(srcs)):
    chains.append(f"[{x}][s{i}]xfade=transition=fade:duration=0.2:offset={cuts[i - 1] - 0.1:.3f}[x{i}]"); x = f"x{i}"
chains.append(f"[{x}]noise=alls=2:allf=t+u,format=yuv420p[v]")
inputs += ["-i", f"{C}/audio/mix.wav"]
run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";\n".join(chains), "-map", "[v]", "-map", f"{len(srcs)}:a",
     "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-maxrate", "14M", "-bufsize", "28M", "-profile:v", "high", "-movflags", "+faststart",
     "-c:a", "aac", "-b:a", "192k", "-shortest", f"{D}/three_chokepoints_16x9.mp4"])
print(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size", "-of", "compact", f"{D}/three_chokepoints_16x9.mp4"], capture_output=True, text=True).stdout)
