"""v4: dogs'-eye story, sans-serif (Inter / Inter Display) typography, gentler
music: Mixkit 'I Believe in Us' by Michael Ramir C. (86 BPM, warm piano pop),
Mixkit Stock Music Free License. Cuts sit on its beat grid; soft dissolves only."""
import subprocess, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build as B
import typo as T
S, SEG = B.S, B.SEG
MUSIC = os.path.join(S, 'mixkit', '1030.mp3')
M_START = 88.282          # a beat in the track's fuller middle section
BEAT = 0.6966             # 86.1 BPM
W_, G_ = T.WHITE, T.GOLD

CUT = [  # (segment, start_in_segment, beats, transition, dur)
    ('s00', 0.0, 4, 'fade', 0.40),
    ('s01', 0.0, 3, 'fade', 0.35),
    ('s02', 0.0, 3, 'smoothleft', 0.40),
    ('s03', 0.3, 3, 'fade', 0.35),
    ('s04', 0.5, 3, 'fade', 0.35),
    ('s05', 0.2, 4, 'fade', 0.35),
    ('s06', 1.4, 4, 'fade', 0.40),
    ('s07', 0.0, 3, 'fade', 0.35),
    ('s08', 0.3, 3, 'fade', 0.45),
    ('s09', 0.5, 5, None, 0),
]
L1 = ('Inter-Medium.otf', 56)
L2 = ('InterDisplay-Bold.otf', 80)
X0, B1, B2, MAXW = 72, 1478, 1578, 790

CAPTIONS = [
    ([('this is ', W_), ('Kabila,', G_)], [('home to all of us', W_)]),
    ([('and today, someone', W_)], [('brought ', W_), ('milk & rusk', G_)]),
    ([('we didn’t wait', W_)], [('to be asked twice', W_)]),
    ([('a few of us are healing,', W_)], [('but we ', W_), ('all', G_), (' ate well', W_)]),
    ([('no fighting,', W_)], [('just ', W_), ('sharing', G_)]),
]

def lower_third(c, t0, t1):
    r1 = T.fit([(t, *L1, col) for t, col in c[0]], MAXW)
    r2 = T.fit([(t, *L2, col) for t, col in c[1]], MAXW)
    f1, n1 = T.words(r1, X0, B1, t0, t1, stagger=0.08, dur=0.5, rise=18)
    f2, _ = T.words(r2, X0, B2, t0 + 0.15 + n1 * 0.08, t1, stagger=0.1, dur=0.55, rise=24)
    return f1 + f2

def end_card(t0):
    cx, f = 540, []
    a, _ = T.letters_center('Thank You', 'InterDisplay-Black.otf', 168, W_, cx, 960, t0, stagger=0.06, dur=0.6, rise=50)
    f += a
    b, _ = T.letters_center('for showing up', 'InterDisplay-Medium.otf', 64, W_, cx, 1060, t0 + 0.65,
                            stagger=0.03, dur=0.45, rise=16)
    f += b
    tr = t0 + 1.1
    g = T.clamp01(f"(t-{tr:.2f})/0.5")
    f.append(f"drawbox=enable='gte(t,{tr+0.04:.2f})':x='(iw-max(2,150*(1-pow(1-{g},3))))/2':y=1112:"
             f"w='max(2,150*(1-pow(1-{g},3)))':h=3:color={G_}@0.95:t=fill")
    k, _ = T.letters_center('THE DOGS OF KABILA', 'Inter-SemiBold.otf', 38, G_, cx, 1180, t0 + 1.3,
                            stagger=0.025, dur=0.4, rise=8, extra_track=7, track_from=0.6, track_dur=1.4)
    return f + k

def main(out):
    n = len(CUT)
    cuts, acc = [], 0.0
    for _, _, beats, _, _ in CUT[:-1]:
        acc += beats * BEAT; cuts.append(acc)
    total = acc + CUT[-1][2] * BEAT
    D = [b * BEAT + (CUT[i-1][4] / 2 if i else 0) + (CUT[i][4] / 2 if i < n - 1 else 0)
         for i, (_, _, b, _, _) in enumerate(CUT)]
    c = [0.0] + cuts
    win = [(0.3, c[1] - 0.15), (c[1] + 0.15, c[3] - 0.15), (c[3] + 0.15, c[5] - 0.15),
           (c[5] + 0.15, c[6] - 0.15), (c[6] + 0.15, c[7] - 0.2)]
    end_t0 = c[9] + 0.35
    inputs = []
    for seg, *_ in CUT: inputs += ['-i', f'{SEG}/{seg}.mp4']
    inputs += ['-ss', f'{M_START}', '-i', MUSIC]
    scrims = [('band_low.png', a, b) for a, b in win] + [('band_center.png', end_t0 - 0.2, total + 1)]
    for sp, _, _ in scrims: inputs += ['-loop', '1', '-framerate', '30', '-t', '27', '-i', os.path.join(S, sp)]
    fc = []
    for i, (seg, st, *_r) in enumerate(CUT):
        fc.append(f"[{i}:v]trim=start={st}:duration={D[i]:.4f},setpts=PTS-STARTPTS[c{i}]")
    prev = '[c0]'
    for k in range(1, n):
        td = CUT[k-1][4]
        fc.append(f"{prev}[c{k}]xfade=transition={CUT[k-1][3]}:duration={td}:offset={cuts[k-1]-td/2:.4f}[x{k}]")
        prev = f'[x{k}]'
    for j, (_, a, b) in enumerate(scrims):
        fc.append(f"[{n+1+j}:v]format=yuva420p,fade=t=in:st={a-0.1:.2f}:d=0.4:alpha=1,fade=t=out:st={b-0.25:.2f}:d=0.35:alpha=1[bd{j}]")
        fc.append(f"{prev}[bd{j}]overlay=format=auto:shortest=1[ov{j}]"); prev = f'[ov{j}]'
    texts = []
    for cap, (a, b) in zip(CAPTIONS, win): texts += lower_third(cap, a, b)
    texts += end_card(end_t0)
    fc.append(f"{prev}vignette=angle=PI/5:mode=forward,noise=alls=3:allf=t," + ','.join(texts) +
              f",fade=t=in:st=0:d=0.3,fade=t=out:st={total-1.0:.2f}:d=1.0,format=yuv420p[v]")
    fc.append(f"[{n}:a]atrim=0:{total:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.6,afade=t=out:st={total-2.2:.2f}:d=2.2,"
              f"loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]")
    gpath = os.path.join(S, 'graph_v4.txt'); open(gpath, 'w').write(';'.join(fc))
    master = os.path.join(S, 'master_v4.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex_script', gpath, '-map', '[v]', '-map', '[a]',
                    '-t', f'{total:.3f}', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', '30',
                    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
                    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', master], check=True)
    for p in (1, 2):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', master, '-c:v', 'libx264', '-preset', 'slow', '-b:v', '10M',
                        '-maxrate', '15M', '-bufsize', '20M', '-pass', str(p), '-passlogfile', os.path.join(S, 'x264v4'),
                        '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                        '-colorspace', 'bt709', *(['-an', '-f', 'null', '/dev/null'] if p == 1 else
                        ['-c:a', 'copy', '-movflags', '+faststart', out])], check=True)
    print('total', round(total, 3), 'cuts', [round(x, 2) for x in cuts])

if __name__ == '__main__':
    main(sys.argv[1])
