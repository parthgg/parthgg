"""Diwali cut v2: same edit/music as build_diwali.py; new serif typography.
Lower thirds (Cormorant Garamond SemiBold + Italic, gold keywords) revealed word by
word, sitting low in the frame (~310px above the bottom edge). End card centred:
'Happy / Diwali' in Playfair Display Black, letter-by-letter with a soft gold
glow, a growing gold rule, and 'from Kabila' tracking in."""
import subprocess, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build as B
import build_diwali as BD
import typo as T
S, SEG = B.S, B.SEG
CUT, BEAT, DROP, MUSIC = BD.CUT, BD.BEAT, BD.DROP, BD.MUSIC
W_, G_ = T.WHITE, T.GOLD
L1 = ('cg_semi.ttf', 70)   # upright lead-in line
L2 = ('cgi_med.ttf', 90)   # larger italic line
X0, B1, B2, MAXW = 72, 1478, 1584, 790

CAPTIONS = [  # (line1 runs, line2 runs) as (text, colour)
    ([('this Diwali,', W_)], [('we celebrated at ', W_), ('Kabila', G_)]),
    ([('with warm ', W_), ('milk & rusk', G_)], [('for every dog & cat', W_)]),
    ([('and every single one', W_)], [('cherished', G_), (' it.', W_)]),
    ([('some came hurt,', W_)], [('none left hungry.', W_)]),
    ([('they shared it,', W_)], [('like ', W_), ('family.', G_)]),
]

def lower_third(c, t0, t1):
    r1 = T.fit([(t, *L1, col) for t, col in c[0]], MAXW)
    r2 = T.fit([(t, *L2, col) for t, col in c[1]], MAXW)
    f1, n1 = T.words(r1, X0, B1, t0, t1)
    f2, _ = T.words(r2, X0, B2, t0 + 0.12 + n1 * 0.075, t1, stagger=0.09, dur=0.5)
    return f1 + f2

def end_card(t0):
    cx = 540
    f = []
    a, _ = T.letters_center('Happy', 'pf_black.ttf', 170, W_, cx, 880, t0, stagger=0.055, dur=0.55, rise=46)
    b, _ = T.letters_center('Diwali', 'pf_black.ttf', 170, W_, cx, 1046, t0 + 0.28, stagger=0.055, dur=0.55, rise=46)
    f += a + b
    tr = t0 + 0.75  # gold rule grows from centre
    g = T.clamp01(f"(t-{tr:.2f})/0.5")
    f.append(f"drawbox=enable='gte(t,{tr+0.04:.2f})':x='(iw-max(2,190*(1-pow(1-{g},3))))/2':y=1092:"
             f"w='max(2,190*(1-pow(1-{g},3)))':h=3:color={G_}@0.95:t=fill")
    tk = t0 + 0.95  # 'from Kabila' tracks in as one phrase, letter by letter
    txt = 'from Kabila'
    cols = [W_] * 5 + [G_] * 6
    fts = ['cgi_med.ttf'] * 5 + ['cgi_semi.ttf'] * 6
    fk, _ = T.letters_center(txt, 'cgi_med.ttf', 82, W_, cx, 1188, tk, stagger=0.04, dur=0.45, rise=14,
                             track_from=0.8, track_dur=1.3, colors=cols, fonts=fts)
    return f + fk

def glow_filters(t0):
    """Whole-word gold glow layer (blurred), screen-blended under the end card."""
    p1 = T.clamp01(f"(t-{t0+0.3:.2f})/1.0")
    p2 = T.clamp01(f"(t-{t0+0.55:.2f})/1.0")
    gw = []
    for txt, base, p in (('Happy', 880, p1), ('Diwali', 1046, p2)):
        gw.append(f"drawtext=fontfile={os.path.join(T.FONTS, 'pf_black.ttf')}:text='{txt}':fontsize=170:"
                  f"fontcolor={G_}:y_align=baseline:x=(w-text_w)/2:y={base}:alpha='0.85*{p}'")
    return ','.join(gw)

def main(out):
    n = len(CUT)
    cuts, acc = [], 0.0
    for _, _, beats, _, _ in CUT[:-1]:
        acc += beats * BEAT; cuts.append(acc)
    total = acc + CUT[-1][2] * BEAT
    D = []
    for i, (_, _, beats, _, _) in enumerate(CUT):
        D.append(beats * BEAT + (CUT[i - 1][4] / 2 if i else 0) + (CUT[i][4] / 2 if i < n - 1 else 0))
    c = [0.0] + cuts
    win = [(0.25, c[1] - 0.15), (c[1] + 0.12, c[3] - 0.12), (c[3] + 0.12, c[5] - 0.12),
           (c[5] + 0.12, c[6] - 0.12), (c[6] + 0.12, c[7] - 0.15)]
    end_t0 = c[9] + 0.3

    inputs = []
    for seg, *_ in CUT: inputs += ['-i', f'{SEG}/{seg}.mp4']
    inputs += ['-ss', f'{DROP - 8 * BEAT:.4f}', '-i', MUSIC]
    scrims = [('band_low.png', a, b) for a, b in win] + [('band_center.png', end_t0 - 0.2, total + 1)]
    for sp, _, _ in scrims: inputs += ['-loop', '1', '-framerate', '30', '-t', '26', '-i', os.path.join(S, sp)]
    fc = []
    for i, (seg, st, *_r) in enumerate(CUT):
        fc.append(f"[{i}:v]trim=start={st}:duration={D[i]:.4f},setpts=PTS-STARTPTS[c{i}]")
    prev = '[c0]'
    for k in range(1, n):
        td = CUT[k - 1][4]
        fc.append(f"{prev}[c{k}]xfade=transition={CUT[k-1][3]}:duration={td}:offset={cuts[k-1] - td/2:.4f}[x{k}]")
        prev = f'[x{k}]'
    for j, (_, a, b) in enumerate(scrims):
        fc.append(f"[{n+1+j}:v]format=yuva420p,fade=t=in:st={a-0.1:.2f}:d=0.35:alpha=1,fade=t=out:st={b-0.2:.2f}:d=0.3:alpha=1[bd{j}]")
        fc.append(f"{prev}[bd{j}]overlay=format=auto:shortest=1[ov{j}]"); prev = f'[ov{j}]'
    # gold glow behind the end-card title (screen blend in RGB)
    fc.append(f"color=c=black:s=1080x1920:r=30:d={total:.3f},{glow_filters(end_t0)},gblur=sigma=26,"
              f"eq=brightness=0:saturation=1.3,format=gbrp[glow]")
    fc.append(f"{prev}vignette=angle=PI/5:mode=forward,noise=alls=3:allf=t,format=gbrp[base]")
    fc.append("[base][glow]blend=all_mode=screen:all_opacity=0.75,format=yuv420p[g]")
    texts = []
    for cap, (a, b) in zip(CAPTIONS, win):
        texts += lower_third(cap, a, b)
    texts += end_card(end_t0)
    fc.append("[g]" + ','.join(texts) + f",fade=t=in:st=0:d=0.2,fade=t=out:st={total-0.8:.2f}:d=0.8,format=yuv420p[v]")
    fc.append(f"[{n}:a]atrim=0:{total:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.05,afade=t=out:st={total-1.6:.2f}:d=1.6,"
              f"loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]")
    graph = ';'.join(fc)
    open(os.path.join(S, 'graph_diwali2.txt'), 'w').write(graph)
    master = os.path.join(S, 'master_diwali2.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex_script', os.path.join(S, 'graph_diwali2.txt'),
                    '-map', '[v]', '-map', '[a]', '-t', f'{total:.3f}', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
                    '-pix_fmt', 'yuv420p', '-r', '30', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                    '-colorspace', 'bt709', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', master], check=True)
    if out == '--master-only':
        return print('master', master)
    for p in (1, 2):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', master, '-c:v', 'libx264', '-preset', 'slow', '-b:v', '10M',
                        '-maxrate', '15M', '-bufsize', '20M', '-pass', str(p), '-passlogfile', os.path.join(S, 'x264d2'),
                        '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709',
                        '-colorspace', 'bt709', *(['-an', '-f', 'null', '/dev/null'] if p == 1 else
                        ['-c:a', 'copy', '-movflags', '+faststart', out])], check=True)
    print('total', round(total, 3), 'filters', len(texts))

if __name__ == '__main__':
    main(sys.argv[1])
