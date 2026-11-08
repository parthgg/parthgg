"""Diwali cut on Mixkit 'India' by Arulo (Mixkit Stock Music Free License).
Track drop at 30.00s, re-drop at 44.99s (8 bars). Beat = 0.4684s.
Music starts 8 beats before the drop so the drop lands on the first cut (3.75s)
and the re-drop on the cut into the next-day shots (18.74s)."""
import subprocess, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build as B
S, SEG = B.S, B.SEG
BEAT = 14.99 / 32
DROP = 30.00
MUSIC = os.path.join(S, 'mixkit', '205.mp3')

# (segment, start_in_segment, beats, transition_into_next, transition_dur)
CUT = [
    ('s00', 0.0, 8, 'fadewhite', 0.30),  # hook: crowd waits; white flash on the DROP
    ('s01', 0.0, 4, 'fade', 0.22),       # milk pour (slow-mo)
    ('s02', 0.0, 4, 'smoothleft', 0.25), # golden light row
    ('s03', 0.4, 4, 'fade', 0.22),       # dog reaches bowl
    ('s04', 0.6, 4, 'fade', 0.22),       # golden dog close
    ('s05', 0.3, 6, 'fade', 0.22),       # some came hurt
    ('s06', 1.6, 6, 'fadewhite', 0.30),  # sharing; flash on RE-DROP
    ('s07', 0.0, 4, 'fade', 0.22),       # patched dog
    ('s08', 0.4, 4, 'fade', 0.25),       # collar
    ('s09', 0.6, 8, None, 0),            # end card
]

def text(txt, t0, t1, y, size=84, font='cg.ttf', f=0.3):
    ff = os.path.join(S, 'fonts', font)
    a = f"if(lt(t,{t0:.2f}),0,if(lt(t,{t0+f:.2f}),(t-{t0:.2f})/{f},if(lt(t,{t1-f:.2f}),1,if(lt(t,{t1:.2f}),({t1:.2f}-t)/{f},0))))"
    k = f"(1-min(1,max(0,(t-{t0:.2f})/0.5)))"
    return (f"drawtext=fontfile={ff}:text='{txt}':fontsize={size}:fontcolor=white:borderw=1:bordercolor=white@0.85:"
            f"shadowcolor=black@0.55:shadowx=0:shadowy=3:x=(w-text_w)/2:y='{y}+10*{k}*{k}':alpha='{a}'")

def main(out):
    n = len(CUT)
    # cut points (transition midpoints) on the beat grid
    cuts, acc = [], 0.0
    for _, _, beats, _, _ in CUT[:-1]:
        acc += beats * BEAT; cuts.append(acc)
    total = acc + CUT[-1][2] * BEAT
    # clip lengths so each transition is centred on its cut
    D = []
    for i, (_, _, beats, _, _) in enumerate(CUT):
        pre = CUT[i - 1][4] / 2 if i > 0 else 0
        post = CUT[i][4] / 2 if i < n - 1 else 0
        D.append(beats * BEAT + pre + post)
    c = [0.0] + cuts
    W = [  # text windows: (line1, line2, t0, t1)
        ('this Diwali,', 'we celebrated at Kabila', 0.25, c[1] - 0.15),
        ('with warm milk & rusk', 'for every dog & cat', c[1] + 0.12, c[3] - 0.12),
        ('and every single one', 'cherished it.', c[3] + 0.12, c[5] - 0.12),
        ('some came hurt,', 'none left hungry.', c[5] + 0.12, c[6] - 0.12),
        ('they shared it,', 'like family.', c[6] + 0.12, c[7] - 0.15),
    ]
    end_t0 = c[9] + 0.35
    inputs = []
    for seg, *_ in CUT: inputs += ['-i', f'{SEG}/{seg}.mp4']
    inputs += ['-ss', f'{DROP - 8 * BEAT:.4f}', '-i', MUSIC]
    for _ in W: inputs += ['-loop', '1', '-framerate', '30', '-t', '26', '-i', os.path.join(S, 'band_mid.png')]
    fc = []
    for i, (seg, st, *_r) in enumerate(CUT):
        fc.append(f"[{i}:v]trim=start={st}:duration={D[i]:.4f},setpts=PTS-STARTPTS[c{i}]")
    prev = '[c0]'; pos = D[0]
    for k in range(1, n):
        td = CUT[k - 1][4]
        off = cuts[k - 1] - td / 2
        fc.append(f"{prev}[c{k}]xfade=transition={CUT[k-1][3]}:duration={td}:offset={off:.4f}[x{k}]")
        prev = f'[x{k}]'
    for j, (_, _, a, b) in enumerate(W):
        fc.append(f"[{n+1+j}:v]format=yuva420p,fade=t=in:st={a-0.1:.2f}:d=0.3:alpha=1,fade=t=out:st={b-0.2:.2f}:d=0.3:alpha=1[bd{j}]")
        fc.append(f"{prev}[bd{j}]overlay=format=auto:shortest=1[ov{j}]"); prev = f'[ov{j}]'
    texts = []
    for l1, l2, a, b in W:
        texts += [text(l1, a, b, 560), text(l2, a + 0.3, b, 650, font='cgi.ttf')]
    texts += [text('Happy Diwali', end_t0, total + 1, 820, size=120),
              text('with love, from Kabila', end_t0 + 0.45, total + 1, 955, size=80, font='cgi.ttf')]
    fc.append(f"{prev}vignette=angle=PI/5:mode=forward,noise=alls=3:allf=t," + ','.join(texts) +
              f",fade=t=in:st=0:d=0.2,fade=t=out:st={total-0.8:.2f}:d=0.8,format=yuv420p[v]")
    fc.append(f"[{n}:a]atrim=0:{total:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.05,afade=t=out:st={total-1.6:.2f}:d=1.6,"
              f"loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]")
    master = os.path.join(S, 'master_diwali.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(fc), '-map', '[v]', '-map', '[a]',
                    '-t', f'{total:.3f}', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', '30',
                    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
                    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', master], check=True)
    for p in (1, 2):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', master, '-c:v', 'libx264', '-preset', 'slow', '-b:v', '10M',
                        '-maxrate', '15M', '-bufsize', '20M', '-pass', str(p), '-passlogfile', os.path.join(S, 'x264d'),
                        '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                        '-colorspace', 'bt709', *(['-an', '-f', 'null', '/dev/null'] if p == 1 else
                        ['-c:a', 'copy', '-movflags', '+faststart', out])], check=True)
    print('total', round(total, 3), 'cuts', [round(x, 2) for x in cuts])

if __name__ == '__main__':
    main(sys.argv[1])
