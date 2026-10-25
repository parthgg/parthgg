import numpy as np, soundfile as sf, sys
from scipy.signal import butter, sosfilt
SR=48000; N=int(41.5*SR); out=np.zeros(N); rng=np.random.default_rng(5)
def add(x,at,g):
    i=int(at*SR); n=min(len(x),N-i); out[i:i+n]+=x[:n]*g
def pop(f0=950,f1=320,d=0.09):
    t=np.arange(int(d*SR))/SR; f=f1+(f0-f1)*np.exp(-t*45)
    return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*38)
def ding(f=1320,d=0.6):
    t=np.arange(int(d*SR))/SR
    return (np.sin(2*np.pi*f*t)+0.4*np.sin(2*np.pi*f*2.01*t))*np.exp(-t*7)
def whoosh(d=0.55):
    n=int(d*SR); t=np.arange(n)/SR; x=rng.standard_normal(n)
    x=sosfilt(butter(2,[500,4000],'band',fs=SR,output='sos'),x)
    e=np.sin(np.pi*t/d)**2; return x*e
def thud():
    t=np.arange(int(0.12*SR))/SR
    return np.sin(2*np.pi*(140*np.exp(-t*25)+60)*t)*np.exp(-t*30)
add(whoosh(0.5),0.05,0.35); add(pop(),0.3,0.5)
add(whoosh(0.6),12.0,0.4)
for i in range(5): add(pop(800+i*60),28.3+i*0.07,0.32)
add(ding(),28.75,0.22)
for n in range(10): add(thud(),31.45+n*0.09+0.12,0.55)
add(pop(1100,400),38.9,0.5)
sf.write(sys.argv[1],np.stack([out,out],1).astype(np.float32),SR); print('ok')
