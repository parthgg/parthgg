"""21.6s fast cut at 100 BPM (beat 0.6s). Reuses graded segments from build.py.
Cut points (dissolve midpoints): 2.4 4.2 6.0 7.8 9.6 12.0 14.4 16.2 18.0, end 21.6."""
import subprocess, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build as B
S, SEG = B.S, B.SEG
T = 0.3  # quick, soft dissolves

# (segment, start_in_segment, visible_beats, transition_into_next)
CUT = [
    ('s00', 0.0, 4, 'fade'),        # hook: the crowd waits
    ('s01', 0.0, 3, 'fade'),        # slow-mo pour
    ('s02', 0.0, 3, 'smoothleft'),  # golden light row
    ('s03', 0.4, 3, 'fade'),        # dog arrives at bowl
    ('s04', 0.6, 3, 'fade'),        # golden dog close
    ('s05', 0.3, 4, 'fade'),        # some came hurt
    ('s06', 2.0, 4, 'smoothup'),    # no one eats alone (lift)
    ('s07', 0.0, 3, 'fade'),        # patched dog
    ('s08', 0.4, 3, 'fade'),        # collar
    ('s09', 0.6, 6, None),          # end card
]
BEAT = 0.6

def text(txt, t0, t1, y, size=86, font='cg.ttf', f=0.35):
    ff = os.path.join(S, 'fonts', font)
    a = (f"if(lt(t,{t0}),0,if(lt(t,{t0+f:.2f}),(t-{t0})/{f},if(lt(t,{t1-f:.2f}),1,if(lt(t,{t1}),({t1}-t)/{f},0))))")
    k = f"(1-min(1,max(0,(t-{t0})/0.6)))"
    return (f"drawtext=fontfile={ff}:text='{txt}':fontsize={size}:fontcolor=white:borderw=1:bordercolor=white@0.85:"
            f"shadowcolor=black@0.55:shadowx=0:shadowy=3:x=(w-text_w)/2:y='{y}+10*{k}*{k}':alpha='{a}'")

def main(out):
    n = len(CUT)
    D = []
    for i, (_, _, beats, _) in enumerate(CUT):
        vis = beats * BEAT
        D.append(vis + (T if 0 < i < n - 1 else T / 2))
    inputs = []
    for seg, *_ in CUT: inputs += ['-i', f'{SEG}/{seg}.mp4']
    inputs += ['-i', os.path.join(S, 'bgm_fast.wav')]
    BANDS = [(0.15, 2.45), (9.55, 12.0), (11.95, 14.45)]
    for _ in BANDS: inputs += ['-loop', '1', '-framerate', '30', '-t', '23', '-i', os.path.join(S, 'band_mid.png')]
    fc = []
    for i, (seg, st, _, _) in enumerate(CUT):
        fc.append(f"[{i}:v]trim=start={st}:duration={D[i]:.3f},setpts=PTS-STARTPTS[c{i}]")
    prev = '[c0]'; acc = D[0]
    for k in range(1, n):
        fc.append(f"{prev}[c{k}]xfade=transition={CUT[k-1][3]}:duration={T}:offset={acc - T:.3f}[x{k}]")
        prev = f'[x{k}]'; acc += D[k] - T
    total = acc
    for j, (a, b) in enumerate(BANDS):
        fc.append(f"[{n+1+j}:v]format=yuva420p,fade=t=in:st={a}:d=0.35:alpha=1,fade=t=out:st={b-0.35:.2f}:d=0.35:alpha=1[bd{j}]")
        fc.append(f"{prev}[bd{j}]overlay=format=auto:shortest=1[ov{j}]"); prev = f'[ov{j}]'
    texts = [
        text('every morning,', 0.2, 2.45, 560),
        text('they wait.', 0.55, 2.45, 650, font='cgi.ttf'),
        text('some came hurt.', 9.7, 11.95, 560),
        text('none leave hungry.', 10.05, 11.95, 650, font='cgi.ttf'),
        text('here, no one', 12.1, 14.4, 560),
        text('eats alone.', 12.45, 14.4, 650, font='cgi.ttf'),
        text('a full bowl,', 18.4, total + 1, 840, size=96),
        text('a full heart.', 18.85, total + 1, 955, size=96, font='cgi.ttf'),
    ]
    fc.append(f"{prev}vignette=angle=PI/5:mode=forward,noise=alls=3:allf=t," + ','.join(texts) +
              f",fade=t=in:st=0:d=0.25,fade=t=out:st={total-0.9:.2f}:d=0.9,format=yuv420p[v]")
    fc.append(f"[{n}:a]atrim=0:{total:.3f},afade=t=out:st={total-1.4:.2f}:d=1.4,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]")
    master = os.path.join(S, 'master_fast.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(fc), '-map', '[v]', '-map', '[a]',
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', '30',
                    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
                    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', master], check=True)
    for p in (1, 2):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', master, '-c:v', 'libx264', '-preset', 'slow', '-b:v', '10M',
                        '-maxrate', '15M', '-bufsize', '20M', '-pass', str(p), '-passlogfile', os.path.join(S, 'x264f'),
                        '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                        '-colorspace', 'bt709', *(['-an', '-f', 'null', '/dev/null'] if p == 1 else
                        ['-c:a', 'copy', '-movflags', '+faststart', out])], check=True)
    print('total', round(total, 3))

if __name__ == '__main__':
    main(sys.argv[1])
