import math, os, sys, concurrent.futures as cf, urllib.request
OUT=sys.argv[1]
def tile(lon,lat,z):
    n=2**z; return int((lon+180)/360*n), int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
jobs=[]
for z,(lo0,la0,lo1,la1) in [(7,(86,-12,127,35)),(10,(97.8,-0.7,105.2,6.7))]:
    x0,y0=tile(lo0,la1,z); x1,y1=tile(lo1,la0,z)
    jobs+=[(z,x,y) for x in range(x0,x1+1) for y in range(y0,y1+1)]
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
