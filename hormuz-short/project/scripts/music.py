import numpy as np, soundfile as sf, sys
from scipy.signal import butter, sosfilt
SR=48000; DUR=41.5; N=int(SR*DUR); t=np.arange(N)/SR
rng=np.random.default_rng(1)
def lp(x,f,o=2): return sosfilt(butter(o,f,'low',fs=SR,output='sos'),x)
def hp(x,f,o=2): return sosfilt(butter(o,f,'high',fs=SR,output='sos'),x)
def env(a,b,fi,fo):
    e=np.clip((t-a)/fi,0,1)*np.clip((b-t)/fo,0,1); return e*e*(3-2*e)
def saw(f,ph=0): return 2*((t*f+ph)%1)-1
mid=lambda m:440*2**((m-69)/12)
L=np.zeros(N); Rr=np.zeros(N)
# chord progression (D minor-ish), each 41.5/5 seconds
chords=[[50,57,62,65],[46,53,58,65],[48,55,60,67],[45,52,57,64],[50,57,62,69]]
seg=DUR/len(chords)
for i,ch in enumerate(chords):
    a=i*seg-0.6; b=(i+1)*seg+0.6
    e=env(a,b,2.5,2.5)
    for m in ch:
        for d,pan in [(-0.08,0.3),(0.07,0.7)]:
            v=saw(mid(m)*(1+d/100*12/12*0.01*100/100))*e*0.05
            L+=v*(1-pan); Rr+=v*pan
L=lp(L,900); Rr=lp(Rr,900)
# sub drone
sub=np.sin(2*np.pi*mid(38)*t)*0.18*env(0,DUR,3,2)
# pulse from 6s to 26s, stronger 20-26, stops for pullback
bpm=84; beat=60/bpm; pulse=np.zeros(N)
for k in np.arange(6.0,26.4,beat):
    i=int(k*SR); n=int(0.5*SR); tt=np.arange(n)/SR
    if i+n<N: pulse[i:i+n]+=np.sin(2*np.pi*(55-25*tt)*tt*2*np.pi/np.pi/2*1)*np.exp(-tt*9)*(0.5+0.5*(k>20))
pulse=lp(pulse,180)*0.55
# ticks 12-26s
ticks=np.zeros(N)
for k in np.arange(12.0,26.4,beat/2):
    i=int(k*SR); n=int(0.04*SR)
    ticks[i:i+n]+=rng.standard_normal(n)*np.exp(-np.arange(n)/SR*120)
ticks=hp(ticks,6000)*0.06
# riser into the pull back (26.6) and impact
rise=hp(rng.standard_normal(N),1500)*env(23.6,26.6,3.0,0.05)**2*0.12
def boom(at,amp):
    x=np.zeros(N); i=int(at*SR); n=int(3*SR); tt=np.arange(n)/SR
    x[i:i+n]=np.sin(2*np.pi*(70*np.exp(-tt*2)+30)*tt)*np.exp(-tt*1.6)*amp
    x[i:i+n]+=lp(rng.standard_normal(n),400)*np.exp(-tt*5)*amp*0.6
    return x
whoosh=lp(hp(rng.standard_normal(N),300),3000)*env(5.6,8.6,1.4,1.6)*0.12
imp=boom(26.6,0.6)+boom(35.3,0.7)+boom(0.0,0.35)
mono=sub+pulse+ticks+rise+imp+whoosh
L=L+mono; Rr=Rr+mono
out=np.stack([L,Rr],1); out*=env(0,DUR,0.05,1.2)[:,None]
out/=np.abs(out).max()/0.9
sf.write(sys.argv[1],out.astype(np.float32),SR)
print("ok")
