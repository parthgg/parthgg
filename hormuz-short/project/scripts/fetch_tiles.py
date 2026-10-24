import math, os, sys, concurrent.futures as cf, urllib.request
OUT=sys.argv[1]
def tile(lon,lat,z):
    n=2**z; x=int((lon+180)/360*n); y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n); return x,y
jobs=[]
for z,(lo0,la0,lo1,la1) in [(3,(-180,-85,180,85)),(7,(42,12,70,48)),(10,(54,24,59.2,28))]:
    x0,y0=tile(lo0,la1,z); x1,y1=tile(lo1,la0,z)
    for x in range(x0,min(x1,2**z-1)+1):
        for y in range(y0,min(y1,2**z-1)+1): jobs.append((z,x,y))
print(len(jobs))
def get(j):
    z,x,y=j; p=f"{OUT}/t/{z}/{x}_{y}.png"
    if os.path.exists(p): return
    os.makedirs(os.path.dirname(p),exist_ok=True)
    for a in range(4):
        try: urllib.request.urlretrieve(f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",p); return
        except Exception as e: err=e
    print("fail",j,err)
with cf.ThreadPoolExecutor(16) as ex: list(ex.map(get,jobs))
