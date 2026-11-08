"""Tiny typesetter for ffmpeg drawtext: measures runs with PIL (same FreeType
metrics), lays out words/letters, and emits staggered animated drawtext filters.
All text uses baseline alignment so mixed fonts sit on one line."""
import os
from PIL import ImageFont

FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fonts')
WHITE = 'white'
GOLD = '0xF5C66A'
_cache = {}

def font(name, size):
    k = (name, size)
    if k not in _cache:
        _cache[k] = ImageFont.truetype(os.path.join(FONTS, name), size)
    return _cache[k]

def adv(txt, name, size):
    return font(name, size).getlength(txt)

def clamp01(expr):
    return f"min(1,max(0,{expr}))"

def esc(s):
    return s.replace('\\', '\\\\').replace("'", "’").replace(':', '\\:').replace('%', '\\%')

def _dt(txt, name, size, color, x, y, alpha, shadow=True, extra=''):
    sh = ':shadowcolor=black@0.55:shadowx=0:shadowy=2' if shadow else ''
    return (f"drawtext=fontfile={os.path.join(FONTS, name)}:text='{esc(txt)}':fontsize={size}:fontcolor={color}"
            f"{sh}:y_align=baseline:x='{x}':y='{y}':alpha='{alpha}'{extra}")

def line_width(runs):
    return sum(adv(t, f, s) for t, f, s, _ in runs)

def fit(runs, maxw):
    """Scale all run sizes down uniformly if the line is wider than maxw."""
    w = line_width(runs)
    if w <= maxw: return runs
    k = maxw / w
    return [(t, f, max(10, int(s * k)), c) for t, f, s, c in runs]

def words(runs, x0, base, t0, t1, stagger=0.075, dur=0.42, rise=22, out=0.25):
    """Word-by-word reveal: each word fades in and rises with an ease-out cubic,
    the whole line fades out together at t1."""
    filters, x, i = [], x0, 0
    for txt, fnt, size, col in runs:
        parts = txt.split(' ')
        for j, wd in enumerate(parts):
            if wd:
                ts = t0 + i * stagger
                p = clamp01(f"(t-{ts:.3f})/{dur}")
                ease_y = f"{base}+{rise}*pow(1-{p},3)"
                a = f"{p}*{clamp01(f'({t1:.3f}-t)/{out}')}"
                filters.append(_dt(wd, fnt, size, col, f"{x:.1f}", ease_y, a))
                x += adv(wd, fnt, size); i += 1
            if j < len(parts) - 1:
                x += adv(' ', fnt, size)
    return filters, i

def letters_center(txt, fnt, size, col, cx, base, t0, stagger=0.05, dur=0.5, rise=40,
                   track_from=0.0, track_dur=1.2, extra_track=0, shadow=True, colors=None, fonts=None):
    """Per-letter reveal centred on cx. Optional tracking-in: letters start spread
    by `track_from` (fraction of their offset from centre) and settle."""
    f = font(fnt, size)
    # per-letter x using kerning-aware cumulative advances
    xs = []
    for k in range(len(txt)):
        xs.append(f.getlength(txt[:k]) + k * extra_track)
    total = f.getlength(txt) + (len(txt) - 1) * extra_track
    left = cx - total / 2
    out = []
    n = 0
    for k, ch in enumerate(txt):
        if ch == ' ': continue
        ts = t0 + n * stagger; n += 1
        p = clamp01(f"(t-{ts:.3f})/{dur}")
        off = xs[k] + f.getlength(ch) / 2 - total / 2  # letter centre offset from cx
        if track_from:
            q = clamp01(f"(t-{t0:.3f})/{track_dur}")
            x = f"{cx}+{off:.1f}*(1+{track_from}*pow(1-{q},3))-{f.getlength(ch)/2:.1f}"
        else:
            x = f"{left + xs[k]:.1f}"
        y = f"{base}+{rise}*pow(1-{p},3)"
        out.append(_dt(ch, fonts[k] if fonts else fnt, size, colors[k] if colors else col, x, y, p, shadow=shadow))
    return out, total
