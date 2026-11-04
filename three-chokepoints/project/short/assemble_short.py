"""Assemble the 9:16 Short: 3D hero frames + two real-footage inserts + mix."""
import math, os, subprocess, sys
C = sys.argv[1]; SH = sys.argv[2]; OUT = sys.argv[3]; FPS = 25; END = 41.5
segs = [(0.0, 'A'), (5.7, 'B'), (9.25, 'foot:C'), (10.4, 'D'), (17.05, 'E'), (22.7, 'F'), (26.95, 'G'), (30.5, 'foot:H'), (31.8, 'I'), (34.2, 'black'), (34.75, 'K'), (38.6, 'L')]
fr = lambda x: math.floor(x * FPS + 0.5)
os.makedirs(f"{SH}/seg", exist_ok=True); lst = []
for i, (s, src) in enumerate(segs):
    e = segs[i + 1][0] if i + 1 < len(segs) else END; n0, n1 = fr(s), fr(e); n = n1 - n0; out = f"{SH}/seg/{i:02d}.mp4"
    if src == 'black': ins, vf = ["-f", "lavfi", "-i", "color=black:s=1080x1920:r=25"], "format=yuv420p"
    elif src.startswith('foot:'): ins, vf = ["-i", f"{SH}/foot/{src[5:]}.mp4"], "setpts=N/25/TB,format=yuv420p"
    else:
        miss = [k for k in range(n0, n1) if not os.path.exists(f"{C}/hero/{src}/f_{k:05d}.png")]
        if miss: sys.exit(f"{src}: missing {len(miss)} frames, first {miss[0]}")
        ins, vf = ["-framerate", "25", "-start_number", str(n0), "-i", f"{C}/hero/{src}/f_%05d.png"], "format=yuv420p"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-vf", vf, "-frames:v", str(n), "-r", "25", "-c:v", "libx264", "-crf", "12", "-preset", "fast", out], check=True)
    lst.append(f"file '{out}'"); print(i, src, s, e, n)
open(f"{SH}/seg/list.txt", "w").write("\n".join(lst) + "\n")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", f"{SH}/seg/list.txt", "-i", f"{SH}/audio/short_mix.wav",
                "-vf", "noise=alls=2:allf=t,format=yuv420p", "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-maxrate", "16M", "-bufsize", "32M",
                "-profile:v", "high", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "256k", "-t", str(END), OUT], check=True)
print(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=width,height", "-of", "compact", OUT], capture_output=True, text=True).stdout)
