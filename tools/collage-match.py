from PIL import Image
import numpy as np, json

ROOT = "/Users/srjhanwa/Library/CloudStorage/OneDrive-Microsoft/Desktop/Claude/Wedding website"
M = "/tmp/match"
W,H = 1512,982

design_f = Image.open(f"{ROOT}/Assets/Testpage.png").convert("RGB").crop((0,0,W,H))
ours_f   = Image.open(f"{M}/ours_all.png").convert("RGB")
info     = json.load(open(f"{M}/ours.json"))

def arr(im): return np.asarray(im).astype(np.float32)

def score_grid(design, tpl, mask, ox, oy, rng, step):
    """SSD over a grid of offsets. design HxWx3, tpl hxwx3, mask hxw."""
    h,w = mask.shape
    Hd,Wd = design.shape[:2]
    n = mask.sum()*3
    m3 = mask[...,None]
    tm = tpl*m3
    best=None
    for dy in range(-rng, rng+1, step):
        yy = int(round(oy+dy))
        if yy<0 or yy+h>Hd: continue
        for dx in range(-rng, rng+1, step):
            xx = int(round(ox+dx))
            if xx<0 or xx+w>Wd: continue
            d = design[yy:yy+h, xx:xx+w]
            err = np.abs(d*m3-tm).sum()/n
            if best is None or err<best[0]: best=(err,xx,yy)
    return best

def match(cls, search=96, scales=(1.0,)):
    hid = arr(Image.open(f"{M}/hide_{cls}.png").convert("RGB"))
    o   = arr(ours_f)
    diff = np.abs(o-hid).sum(axis=2)
    mask = diff > 24
    ys,xs = np.nonzero(mask)
    if len(xs) < 200: return None
    x0,x1,y0,y1 = int(xs.min()), int(xs.max())+1, int(ys.min()), int(ys.max())+1
    tw,th = x1-x0, y1-y0
    ocx,ocy = (x0+x1)/2, (y0+y1)/2
    tplI = ours_f.crop((x0,y0,x1,y1))
    mskI = Image.fromarray((mask[y0:y1,x0:x1]*255).astype(np.uint8))

    best=None
    # -------- coarse: work at 1/4 scale --------
    K=4
    dS = arr(design_f.resize((W//K,H//K), Image.LANCZOS))
    for s in scales:
        nw,nh = max(8,int(round(tw*s))), max(8,int(round(th*s)))
        cw,ch = max(4,nw//K), max(4,nh//K)
        t  = arr(tplI.resize((cw,ch), Image.LANCZOS))
        mk = (np.asarray(mskI.resize((cw,ch), Image.LANCZOS)).astype(np.float32)/255.0 > 0.6).astype(np.float32)
        if mk.sum()<12: continue
        r = score_grid(dS, t, mk, (ocx-nw/2)/K, (ocy-nh/2)/K, max(2,search//K), 1)
        if r and (best is None or r[0]<best[0]):
            best=(r[0], s, r[1]*K, r[2]*K, nw, nh)
    if best is None: return None
    # -------- fine: full res, +/-6px around the coarse hit --------
    dF = arr(design_f)
    err0,s,cx0,cy0,nw,nh = best
    fine=None
    for s2 in (s,):
        nw2,nh2 = max(8,int(round(tw*s2))), max(8,int(round(th*s2)))
        t  = arr(tplI.resize((nw2,nh2), Image.LANCZOS))
        mk = (np.asarray(mskI.resize((nw2,nh2), Image.LANCZOS)).astype(np.float32)/255.0 > 0.6).astype(np.float32)
        if mk.sum()<50: continue
        r = score_grid(dF, t, mk, cx0+(nw-nw2)/2, cy0+(nh-nh2)/2, 6, 2)
        if r and (fine is None or r[0]<fine[0]):
            fine=(r[0], s2, r[1], r[2], nw2, nh2)
    if fine is None: fine=best
    err,s,xx,yy,nw,nh = fine
    dcx,dcy = xx+nw/2, yy+nh/2
    return dict(cls=cls, err=round(float(err),2), scale=round(float(s),3),
                ours=[round(ocx,1),round(ocy,1),tw,th],
                design=[round(dcx,1),round(dcy,1),nw,nh],
                dx=round(float(dcx-ocx),1), dy=round(float(dcy-ocy),1))

res={}
for cls in info["pieces"]:
    r = match(cls)
    res[cls]=r
    print((f"{cls:16s} err={r['err']:6.1f} scale={r['scale']:.2f} "
           f"dx={r['dx']:+7.1f} dy={r['dy']:+7.1f}") if r else f"{cls:16s} NO MATCH", flush=True)
json.dump(res, open(f"{M}/deltas_t.json","w"), indent=1)
print("saved")
