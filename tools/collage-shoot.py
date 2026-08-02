from playwright.sync_api import sync_playwright
import json, pathlib

OUT = pathlib.Path("/tmp/match")
OUT.mkdir(exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path="/Users/srjhanwa/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell")
    ctx = b.new_context(viewport={"width":1512,"height":982},
                        device_scale_factor=1,
                        reduced_motion="reduce")
    pg = ctx.new_page()
    # defeat caching
    def noc(route):
        route.continue_()
    pg.route("**/*.{js,css}", lambda r: r.continue_(headers={**r.request.headers, "Cache-Control":"no-cache"}))
    pg.goto("http://localhost:8899/v2/", wait_until="domcontentloaded")
    pg.wait_for_timeout(2500)

    # kill the WebGL light + wall so the collage sits on a flat known bg,
    # making masks trivial to derive
    pg.evaluate("""() => {
      
      const s = document.createElement('style');
      s.textContent = `
        .light-layer { display:none !important; }
  
        .site-nav, header, nav { display:none !important; }
      `;
      document.head.appendChild(s);
    }""")
    pg.wait_for_timeout(300)

    stage = pg.evaluate("""() => {
      const st = document.querySelector('.hero-stage').getBoundingClientRect();
      const h  = document.querySelector('.headline');
      const hr = h.getBoundingClientRect();
      // measure the ink box of the text, not the block
      const r = document.createRange();
      r.selectNodeContents(h);
      const tr = r.getBoundingClientRect();
      const out = {stage:{x:st.x,y:st.y,w:st.width,h:st.height},
                   headlineBlock:{x:hr.x,y:hr.y,w:hr.width,h:hr.height},
                   headlineText:{x:tr.x,y:tr.y,w:tr.width,h:tr.height},
                   fontSize: getComputedStyle(h).fontSize,
                   pieces:{}};
      document.querySelectorAll('.piece').forEach(el => {
        const cls = [...el.classList].find(c => c.startsWith('p-'));
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        out.pieces[cls] = {x:b.x,y:b.y,w:b.width,h:b.height,
                           cx:b.x+b.width/2, cy:b.y+b.height/2,
                           varX: cs.getPropertyValue('--x').trim(),
                           varY: cs.getPropertyValue('--y').trim(),
                           varW: cs.getPropertyValue('--w').trim(),
                           varR: cs.getPropertyValue('--rot').trim()};
      });
      return out;
    }""")
    (OUT/"ours.json").write_text(json.dumps(stage, indent=1))

    pg.screenshot(path=str(OUT/"ours_all.png"), clip={"x":0,"y":0,"width":1512,"height":982})

    # per-piece: hide it, shoot, diff gives the mask
    for cls in stage["pieces"]:
        pg.evaluate(f"""() => {{
          document.querySelector('.{cls}').style.visibility='hidden';
        }}""")
        pg.wait_for_timeout(40)
        pg.screenshot(path=str(OUT/f"hide_{cls}.png"), clip={"x":0,"y":0,"width":1512,"height":982})
        pg.evaluate(f"""() => {{
          document.querySelector('.{cls}').style.visibility='';
        }}""")
    b.close()
print("done")
