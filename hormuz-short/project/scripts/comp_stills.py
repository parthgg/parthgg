import sys,glob
from PIL import Image
P=sys.argv[1]; ims=[]
for f in sorted(glob.glob(f"{P}/reel_stills/t_*.png"),key=lambda f:float(f.split('t_')[1][:-4])):
    t=float(f.split('t_')[1][:-4]); fr=round(t*24)
    base=Image.open(f"{P}/frames/f_{fr:05d}.png").convert('RGBA'); ov=Image.open(f).convert('RGBA')
    ims.append(Image.alpha_composite(base,ov).convert('RGB').resize((360,640)))
s=Image.new('RGB',(360*len(ims[:5]),640*((len(ims)+4)//5)))
for i,im in enumerate(ims): s.paste(im,((i%5)*360,(i//5)*640))
s.save(f"{P}/reel_sheet.jpg",quality=88)
