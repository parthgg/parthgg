"""v2 cut: ~29 shots, hard cuts, overlays composited on footage, grain + audio."""
import os, subprocess, sys, math
C = sys.argv[1]; D = "/home/user/parthgg/three-chokepoints"; FPS = 25; END = 89.6
OUT = sys.argv[2] if len(sys.argv) > 2 else f"{D}/three_chokepoints_16x9.mp4"
segs = [(0.0, 'F'), (1.9, 'F'), (3.7, 'F'), (5.6, 'W1'), (9.45, 'OV'), (11.0, 'W1'), (15.0, 'CH1'), (17.3, 'H'), (22.2, 'F'), (24.0, 'F'),
        (27.3, 'H'), (30.6, 'OV'), (32.7, 'H'), (35.4, 'CH2'), (38.8, 'B'), (44.2, 'OV'), (47.05, 'ATT'), (50.3, 'F'), (52.8, 'W2'), (58.4, 'CH3'),
        (62.8, 'M1'), (66.8, 'F'), (69.6, 'F'), (71.1, 'F'), (73.7, 'M2'), (77.8, 'W3'), (82.1, 'F'), (83.3, 'F'), (84.5, 'W3')]
def run(cmd): subprocess.run(cmd, check=True)
os.makedirs(f"{C}/seg", exist_ok=True)
lst = []
for i, (s, src) in enumerate(segs):
    e = segs[i + 1][0] if i + 1 < len(segs) else END
    n0, n1 = math.floor(s * FPS + 0.5), math.floor(e * FPS + 0.5); n = n1 - n0
    out = f"{C}/seg/{i:02d}.mp4"
    def pngs(clip):
        missing = [k for k in range(n0, n1) if not os.path.exists(f"{C}/clips/{clip}/f_{k:05d}.png")]
        if missing: sys.exit(f"missing {clip} frames {missing[:3]}... ({len(missing)})")
        return ["-framerate", "25", "-start_number", str(n0), "-i", f"{C}/clips/{clip}/f_%05d.png"]
    if src == 'F':
        ins = ["-i", f"{C}/foot/{s}.mp4"] + pngs('OV')
        fc = "[0:v]settb=1/25,setpts=N/25/TB[b];[b][1:v]overlay=format=auto:eof_action=pass[o]"
    elif src == 'OV':
        ins = pngs('OV'); fc = "color=black:s=1920x1080:r=25[k];[k][0:v]overlay=format=auto:shortest=1[o]"
    else:
        ins = pngs(src); fc = "color=black:s=1920x1080:r=25[k];[k][0:v]overlay=format=auto:shortest=1[o]"
    run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", fc + ";[o]format=yuv420p[v]", "-map", "[v]", "-frames:v", str(n), "-r", "25",
         "-c:v", "libx264", "-crf", "12", "-preset", "fast", out])
    lst.append(f"file '{out}'")
    print(i, src, s, e, n)
open(f"{C}/seg/list.txt", "w").write("\n".join(lst) + "\n")
run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", f"{C}/seg/list.txt", "-i", f"{C}/audio/mix.wav",
     "-vf", "noise=alls=3:allf=t,format=yuv420p", "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-maxrate", "14M", "-bufsize", "28M",
     "-profile:v", "high", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "192k", "-t", str(END), OUT])
print(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,size", "-of", "compact", OUT], capture_output=True, text=True).stdout)
