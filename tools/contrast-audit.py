from playwright.sync_api import sync_playwright
from PIL import Image
import numpy as np, io, json
EXE="/Users/srjhanwa/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell"

def lum(rgb):
    c=np.asarray(rgb,dtype=float)/255.0
    c=np.where(c<=0.04045, c/12.92, ((c+0.055)/1.055)**2.4)
    return 0.2126*c[...,0]+0.7152*c[...,1]+0.0722*c[...,2]
def ratio(a,b):
    l1,l2=max(a,b),min(a,b); return (l1+0.05)/(l2+0.05)
def erode(m,r=1):
    out=m.copy()
    for dy in range(-r,r+1):
        for dx in range(-r,r+1):
            out &= np.roll(np.roll(m,dy,0),dx,1)
    return out
def dilate(m,r=2):
    out=m.copy()
    for dy in range(-r,r+1):
        for dx in range(-r,r+1):
            out |= np.roll(np.roll(m,dy,0),dx,1)
    return out

SEL=("h1, h2, h3, p, a, li, dt, dd, legend, label, button, "
     ".card-label, .kicker, .micro, .rsvp-help, .rsvp-kicker, .rsvp-progress")
HIDE_TEXT="""() => {const s=document.createElement('style');s.id='__ht';
 s.textContent='*,*::before,*::after{color:transparent !important;text-shadow:none !important;-webkit-text-fill-color:transparent !important}';
 document.head.appendChild(s);}"""
HIDE_LIGHT="""() => {const s=document.createElement('style');s.id='__hl';
 s.textContent='.light-layer{display:none !important}';document.head.appendChild(s);}"""
RM=lambda i:f"() => {{const s=document.getElementById('{i}'); if(s) s.remove();}}"
def shot(pg): return np.asarray(Image.open(io.BytesIO(pg.screenshot())).convert("RGB")).astype(float)

def audit(pg,url,label,scrolls):
    pg.goto(url,wait_until="domcontentloaded"); pg.wait_for_timeout(2400)
    out=[]
    for y in scrolls:
        pg.evaluate(f"() => window.scrollTo(0,{y})"); pg.wait_for_timeout(500)
        pg.evaluate("() => { const s=document.createElement('style'); s.id='__nn'; s.textContent='.site-nav{visibility:hidden !important}'; document.head.appendChild(s); }")
        pg.wait_for_timeout(120)
        boxes=pg.evaluate("""(sel)=>[...document.querySelectorAll(sel)].map(e=>{
            const b=e.getBoundingClientRect(); const cs=getComputedStyle(e);
            const txt=(e.textContent||'').replace(/\\s+/g,' ').trim();
            const own=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
            if(!own||!txt||b.width<8||b.height<6) return null;
            if(b.bottom<2||b.top>innerHeight-2||b.right<0||b.left>innerWidth) return null;
            if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity<0.1) return null;
            return {x:Math.max(0,b.x),y:Math.max(0,b.y),w:b.width,h:b.height,
                    t:txt.slice(0,44),fs:parseFloat(cs.fontSize),fw:cs.fontWeight,color:cs.color,
                    sel:e.tagName.toLowerCase()+'.'+(typeof e.className==='string'?e.className.split(' ')[0]:'')};
        }).filter(Boolean)""",SEL)
        if not boxes: continue
        A=shot(pg)
        pg.evaluate(HIDE_TEXT); pg.wait_for_timeout(180); B=shot(pg)
        pg.evaluate(HIDE_LIGHT); pg.wait_for_timeout(260); C=shot(pg)
        pg.evaluate(RM('__hl')); pg.evaluate(RM('__ht')); pg.evaluate(RM('__nn')); pg.wait_for_timeout(260)
        for bx in boxes:
            x0,y0=int(bx["x"]),int(bx["y"])
            x1,y1=min(A.shape[1],int(bx["x"]+bx["w"])+1),min(A.shape[0],int(bx["y"]+bx["h"])+1)
            if x1-x0<8 or y1-y0<6: continue
            a,b_,c=A[y0:y1,x0:x1],B[y0:y1,x0:x1],C[y0:y1,x0:x1]
            glyph=np.abs(a-b_).sum(axis=2)>36
            if glyph.sum()<12: continue
            near=dilate(glyph,3)&~dilate(glyph,1)
            if near.sum()<12: near=dilate(glyph,4)&~glyph
            if near.sum()<12: continue
            bgN=b_[near]
            # The rendered foreground, read straight off the glyph cores.
            # No assumption about how the light composites: whatever the
            # browser actually painted is what gets measured.
            core=erode(glyph,1)
            if core.sum()>=6:
                fgR=np.median(a[core],axis=0)
            else:
                # Too thin to erode. Take the glyph pixel furthest from the
                # local background, which is the closest thing to pure fg.
                gp=a[glyph]; bgm=np.median(bgN,axis=0)
                fgR=gp[np.argmax(np.abs(gp-bgm).sum(axis=1))]
            # WCAG compares the text against what is directly behind it.
            # Taking the worst of BOTH the darkest and the lightest nearby
            # pixel is not that: for cream text on a dark pill it compares
            # the cream against the pill's own bright rim highlight and
            # reports ~1:1 for something plainly readable. So the worst
            # case is taken only in the direction that actually costs
            # contrast, and from a percentile rather than a single pixel.
            Lb=lum(bgN); Lf=float(lum(fgR))
            typ=float(np.median(Lb))
            worstL = float(np.percentile(Lb,85)) if Lf>typ else float(np.percentile(Lb,15))
            worst=ratio(Lf,worstL)
            typical=ratio(Lf,typ)
            big=bx["fs"]>=24 or (bx["fs"]>=18.66 and int(bx["fw"] or 400)>=700)
            need=3.0 if big else 4.5
            out.append(dict(page=label,text=bx["t"],fs=round(bx["fs"],1),sel=bx["sel"],
                            ratio=round(float(worst),2),typical=round(float(typical),2),
                            need=need,pass_=bool(worst>=need)))
    return out

with sync_playwright() as p:
    br=p.chromium.launch(headless=True,executable_path=EXE); rows=[]
    for W,H,tag in [(1512,982,"desktop"),(390,844,"mobile")]:
        ctx=br.new_context(viewport={"width":W,"height":H},reduced_motion="reduce")
        pg=ctx.new_page()
        pg.route("**/*.{js,css}", lambda r: r.continue_(headers={**r.request.headers,"Cache-Control":"no-cache"}))
        sc=[0,1100,2200,3300,4100] if tag=="desktop" else [0,900,1800,2700,3600,4400]
        rows+=audit(pg,"http://localhost:8899/v2/",f"home-{tag}",sc)
        rows+=audit(pg,"http://localhost:8899/v2/rsvp/",f"rsvp-{tag}",[0])
        ctx.close()
    br.close()
fails=[r for r in rows if not r["pass_"]]
print(f"checked {len(rows)} runs, {len(fails)} FAIL\n")
seen=set()
for r in sorted(fails,key=lambda r:r["ratio"]):
    k=(r["text"],r["page"])
    if k in seen: continue
    seen.add(k)
    print(f"  {r['ratio']:5.2f} (typ {r['typical']:5.2f}, need {r['need']})  {r['fs']:>6}px  {r['sel']:22s} {r['page']:13s} {r['text']!r}")
json.dump(rows,open("/tmp/match/contrast6.json","w"))



