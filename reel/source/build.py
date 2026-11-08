import subprocess, sys, os
S = os.path.dirname(os.path.abspath(__file__))
U = '/root/.claude/uploads/e32a9664-605b-5d26-9201-4c4d5f0b6f82'
SEG = os.path.join(S, 'seg'); os.makedirs(SEG, exist_ok=True)
F = {n: os.path.join(U, f) for n, f in [
    ('5353', '1a1b316c-IMG_5353.mov'), ('5354', 'fdb58180-IMG_5354.mov'), ('5355', '5ca7ca57-IMG_5355.mov'),
    ('5356', '05cde857-IMG_5356.mov'), ('5357', '4fb05f7d-IMG_5357.mov'), ('5358', '78ff22bb-IMG_5358.mov'),
    ('5359', 'f4034a62-IMG_5359.mov'), ('5400', 'aaddd8c3-IMG_5400.mov')]}

# (clip, src_start, src_dur, speed, out_dur, transition_into_next)
SHOTS = [
    ('5359', 0.0, 5.2, 1.0, 5.2, 'fade'),        # establishing: the crowd waits
    ('5355', 0.0, 2.0, 0.5, 4.0, 'fade'),       # slow-mo milk pour
    ('5356', 0.0, 3.0, 0.75, 4.0, 'fade'),       # golden light, row of bowls
    ('5354', 1.8, 5.6, 1.0, 5.6, 'smoothleft'),  # first dog arrives at bowl
    ('5353', 1.0, 5.6, 1.0, 5.6, 'fade'),        # close: golden dog eating
    ('5357', 0.5, 5.6, 1.0, 5.6, 'fade'),       # two dogs, one hurt
    ('5358', 0.8, 5.6, 1.0, 5.6, 'fade'),        # three share one bowl
    ('5400', 0.0, 3.4, 0.85, 4.0, 'fade'),       # next day: patched dog
    ('5400', 4.43, 1.6, 0.5, 3.2, 'fade'),       # collar = someone's
    ('5359', 2.2, 5.0, 1.0, 5.0, None),          # bookend + end card
]
T = 0.8

TM = ("zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=203,format=gbrpf32le,"
      "zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p")
GRADE = ("eq=gamma=1.06:contrast=1.04:saturation=1.07,"
         "colorbalance=rs=-0.02:bs=0.025:rh=0.035:gh=0.01:bh=-0.03,"
         "curves=all='0/0.025 0.5/0.51 1/0.975'")

def run(cmd):
    print(' '.join(cmd[:8]), '...', flush=True)
    subprocess.run(cmd, check=True)

def render_segments(only=None):
    for i, (c, ss, sd, sp, od, _) in enumerate(SHOTS):
        if only is not None and i not in only: continue
        vf = [TM, 'scale=1080:1920:flags=lanczos']
        if sp < 1.0:
            vf += [f'minterpolate=fps={30/sp:.4f}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1',
                   f'setpts=PTS/{sp}']
        vf += ['fps=30', GRADE]
        if c == '5400':
            vf += ['colorbalance=rm=0.04:gm=0.01:bm=-0.04:rh=0.02:bh=-0.02,eq=saturation=1.08']
        if i == len(SHOTS) - 1:
            # end card plate: soft defocus + dim ramps in under the title
            vf_s = ','.join(vf)
            fc = (f"[0:v]{vf_s},split[a][b];[b]gblur=sigma=18,eq=brightness=-0.07:saturation=0.85,format=yuva420p,"
                  f"fade=t=in:st=0.9:d=1.4:alpha=1[bl];[a][bl]overlay=format=auto,trim=duration={od},setpts=PTS-STARTPTS,format=yuv420p[v]")
            run(['ffmpeg', '-v', 'error', '-y', '-ss', str(ss), '-t', str(sd + 0.2), '-i', F[c], '-filter_complex', fc,
                 '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '12', f'{SEG}/s{i:02d}.mp4'])
            continue
        vf += [f'trim=duration={od}', 'setpts=PTS-STARTPTS', 'format=yuv420p']
        run(['ffmpeg', '-v', 'error', '-y', '-ss', str(ss), '-t', str(sd + 0.2), '-i', F[c], '-vf', ','.join(vf),
             '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '12', f'{SEG}/s{i:02d}.mp4'])

def alpha(t0, t1, fi=0.7, fo=0.7):
    return (f"if(lt(t,{t0}),0,if(lt(t,{t0+fi:.2f}),(t-{t0})/{fi},if(lt(t,{t1-fo:.2f}),1,if(lt(t,{t1}),({t1}-t)/{fo},0))))")

def text(txt, t0, t1, y, size=86, font='cg.ttf', rise=14):
    fontfile = os.path.join(S, 'fonts', font)
    # ease-out rise as it fades in
    yexpr = f"{y}+{rise}*(1-min(1,max(0,(t-{t0})/1.1)))*(1-min(1,max(0,(t-{t0})/1.1)))"
    return (f"drawtext=fontfile={fontfile}:text='{txt}':fontsize={size}:fontcolor=white:"
            f"borderw=1:bordercolor=white@0.85:shadowcolor=black@0.55:shadowx=0:shadowy=3:x=(w-text_w)/2:y='{yexpr}':alpha='{alpha(t0, t1)}'")

def final(out):
    n = len(SHOTS)
    inputs = []
    for i in range(n): inputs += ['-i', f'{SEG}/s{i:02d}.mp4']
    inputs += ['-i', os.path.join(S, 'bgm.wav')]
    BANDS = [('band_mid.png', 0.4, 4.5), ('band_mid.png', 21.1, 25.3), ('band_mid.png', 25.9, 30.1)]
    for b, _, _ in BANDS: inputs += ['-loop', '1', '-framerate', '30', '-t', '41', '-i', os.path.join(S, b)]
    fc = []; prev = '[0:v]'; acc = SHOTS[0][4]
    for k in range(1, n):
        off = acc - T
        lbl = f'[x{k}]'
        fc.append(f"{prev}[{k}:v]xfade=transition={SHOTS[k-1][5]}:duration={T}:offset={off:.3f}{lbl}")
        prev = lbl; acc = acc + SHOTS[k][4] - T
    total = acc
    texts = [
        text('every morning,', 0.6, 4.3, 560),
        text('they wait.', 1.3, 4.3, 650, font='cgi.ttf'),
        text('some came hurt.', 21.3, 25.1, 560),
        text('none leave hungry.', 22.0, 25.1, 650, font='cgi.ttf'),
        text('here, no one', 26.1, 29.9, 560),
        text('eats alone.', 26.8, 29.9, 650, font='cgi.ttf'),
        text('a full bowl,', 37.0, total + 1, 840, size=96),
        text('a full heart.', 37.8, total + 1, 955, size=96, font='cgi.ttf'),
    ]
    cur = prev
    for j, (_, a, b) in enumerate(BANDS):
        fc.append(f"[{n+1+j}:v]format=yuva420p,fade=t=in:st={a}:d=0.8:alpha=1,fade=t=out:st={b-0.8:.2f}:d=0.8:alpha=1[bd{j}]")
        fc.append(f"{cur}[bd{j}]overlay=format=auto:shortest=1[ov{j}]"); cur = f'[ov{j}]'
    post = (f"{cur}vignette=angle=PI/5:mode=forward,noise=alls=3:allf=t,"
            + ','.join(texts) +
            f",fade=t=in:st=0:d=0.5,fade=t=out:st={total-1.3:.2f}:d=1.3,format=yuv420p[v]")
    fc.append(post)
    fc.append(f"[{n}:a]atrim=0:{total:.3f},afade=t=out:st={total-2.6:.2f}:d=2.6,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]")
    run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(fc), '-map', '[v]', '-map', '[a]',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
         '-r', '30', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
         '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out])
    print('total', total)

if __name__ == '__main__':
    if sys.argv[1] == 'seg':
        render_segments(None if len(sys.argv) < 3 else [int(x) for x in sys.argv[2].split(',')])
    else:
        final(sys.argv[2])
