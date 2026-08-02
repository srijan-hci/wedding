# Working agreement for this repo

## Always build on the existing site

This repo is one real website: `index.html`, `rsvp/`, `styles.css`, `main.js`,
`light.js`, `Assets/`.

**Default behaviour for every session: edit the existing site files directly.**

Do NOT create standalone mockup, demo, prototype, sandbox or `-v2` files
(`index-new.html`, `test.html`, `intro-mockup.html`). New work layers onto the
live page so it can be judged in context, against the real background, real
assets and real type.

Only create a separate file when the user explicitly asks for a throwaway
comparison or an isolated experiment.

If a change is large or risky, say so clearly and offer a way to switch it off,
but still make it in the real page rather than a parallel copy.

**There used to be a `v2/` subpage.** It was a simpler alternative design,
built in isolation so the live site stayed untouched while it was worked on. It
won, and in August 2026 it was promoted to be the site: `v2/index.html` became
`index.html`, `v2/v2.css` became `styles.css`, `v2/v2.js` became `main.js`, and
`v2/rsvp/` became `rsvp/`. The original site was deleted in the same commit.

If you need it, it is in the history at `1c96c07..e85ec6c`. It was
`index.html` + `styles.css` + `sections.css` + `intro.css` + `intro.js` +
`nav.js`, and it used a 2.6 MB `shadow-wall-720.mp4` where this one generates
the same effect in WebGL. Do not resurrect any of it without a reason.

## Keeping additions removable

When adding a self-contained feature, prefer putting it in its own CSS/JS file
and wiring it in with as few lines as possible. That keeps the live page
authoritative while still making the feature easy to back out.

## Structure

| File | Purpose |
|---|---|
| `index.html` | The invitation. Collage, date, venue, three detail cards, and the three drawers those cards open. |
| `rsvp/index.html` | The RSVP page. One plain form that becomes one question at a time. |
| `rsvp/steps.js` | The stepping only. Submission still belongs to `rsvp.js`. |
| `styles.css` | Everything. Recoleta `@font-face`, tokens, the liquid glass, the collage stage, the stop-motion keyframes, the page below the collage, the drawers, the RSVP page. |
| `main.js` | Intro timing, mouse parallax, nav state, section reveals, the drawers. |
| `light.js` | The light and shadow on the wall. Self-contained WebGL, shaders included. |
| `rsvp.js` | Form submission. Holds the Google Apps Script URL. Shared by the RSVP page. |
| `google-apps-script.js` | Not used by the page. The script to paste into Google Apps Script so RSVPs land in a Google Sheet, with setup instructions. |
| `Assets/` | The wall photograph, avif/jpg at 1200/1600/3200. |
| `Assets/collage/` | The collage cut-outs, WebP with PNG fallback, plus `prepare.py` which made them. Originals in `Assets/collage/_source/`, gitignored. |
| `Font/` | Recoleta. Only the three weights actually loaded are tracked. |
| `tools/` | Measurement scripts. Nothing here ships. See `tools/README.md`. |

The page is four stacked fixed layers:

```
.background-layer   z 0    the wall photograph
.content-layer      z 10   collage, headline, everything you read
.light-layer        z 20   the drifting light, mix-blend-mode: multiply
.site-nav           z 30   the pill nav
.drawer-root        z 60   the detail sheets, over everything
```

Anything new needs a deliberate z-index relative to these.

**The nav has to sit outside `.content-layer`.** That layer creates a stacking
context at z-index 10, and a child can never paint above a sibling of its
parent. So `.site-nav` is a direct child of `<body>`. Same for `.drawer-root`,
which additionally has to cover the nav.

Brand colour is `#a94332`.

## Contrast under the light

`.light-layer` multiplies over the entire page, and multiply only ever darkens.
The shadow runs at the same strength the whole way down: the owner asked for
the wall and the shadow to be unbroken from the collage to the footer, so
nothing eases it and nothing should.

That means **every word on the site is cream on terracotta under a multiply
blend**, which is a much tighter contrast budget than dark text on a light
panel. An earlier version of this site solved the problem by putting body copy
on cream panels and easing the light back below the hero. Both are gone.

That is a much tighter contrast budget, and it was re-measured from scratch
rather than assumed. The method matters, because a `mix-blend-mode: multiply`
layer makes computed CSS colours meaningless:

1. Screenshot normally, then again with all text transparent, then again with
   the light layer hidden.
2. The difference between the first two is the exact glyph mask.
3. Read the *rendered* foreground off the eroded glyph cores, so nothing is
   assumed about how the light composites.
4. Read the background from a 1 to 3px ring around the glyphs, not the whole
   bounding box.
5. Take the worst case only in the direction that actually costs contrast.

Two traps, both of which produced alarming and completely false failures:

- Sampling the whole bounding box, or taking the worst of both the darkest and
  the lightest nearby pixel, compares cream text against the bright rim of the
  glass pill it sits on and reports 1.2:1 for something plainly readable.
- **The fixed nav overlays other elements' boxes.** Three "failures" under 2:1
  were the nav's own cream-on-dark glyphs landing inside the box being
  measured. Their real ratios were 11.7, 10.4 and 9.2. Hide `.site-nav` while
  measuring and check it separately.

Current state: 71 text runs across both pages at 390 and 1512, **zero below
threshold**, and zero axe-core violations at 390, 820 and 1440 on the home
page, the RSVP page and an open drawer. The colours are already near the top of
their range, so if you add small text on the wall, measure it. Do not eyeball
it.

## The collage and the intro

The design came from Figma (`Assets/Testpage.png`, gitignored). Things worth
knowing before editing it:

1. **The collage is a fixed-ratio stage, not viewport units.** `.hero-stage`
   has an `aspect-ratio` and `container-type: inline-size`; every piece is
   placed with `--x` / `--y` / `--w` as a percentage of that box, and type uses
   `cqw`. The whole composition therefore scales as one locked unit instead of
   drifting apart as the window changes shape.

   `cqw` rather than `vw` matters: the stage caps at `max-width: 1600px`, so
   with `vw` the type would keep growing after the artwork had stopped.

   There are **two** deliberate arrangements, wide and tall, neither random and
   neither a scaled copy of the other. The user explicitly does not want the
   same collage everywhere.

2. **The positions are measured, not eyeballed.** Every `--x` / `--y` / `--w`
   in the wide arrangement was solved against `Assets/Testpage.png` by isolating
   each piece (screenshot the page twice, once with the piece hidden, and use
   the pixel difference as a mask) and template-matching it into the design.
   All seventeen land within 10px. The headline is exact: its ink spans
   x 153..1383 in both.

   If you change the headline wording, `font-size: 8.578cqw` has to be
   re-solved. Measure the rendered INK, not the layout box: the box includes
   side bearing the eye does not see, which is what made the first attempt 12%
   too narrow.

3. **DOM order is stacking order, and it drives the animation.** The Polaroid
   sits in the middle of `.collage`. Everything before it is behind and steps
   outward from underneath; everything after is in front and steps inward from
   off screen.

4. **⚠️ The `:not()` specificity trap, which has now bitten twice.**
   `.intro-play .piece:not(.p-polaroid)` scores (0,3,0) because `:not()` counts.
   A per-piece rule like `.p-stamp` scores (0,1,0) and loses.

   * First time: the shorthand's implicit `animation-delay: 0` beat every
     per-piece delay and all seventeen pieces animated at once. Fixed by moving
     delays onto `--fan-delay`.
   * Second time: a `.piece:not(.p-polaroid)` block holding "default" travel
     values beat all seventeen `--from-x` / `--from-y` / `--from-scale` /
     `--from-rot` rules, so no piece ever travelled and the assembly was
     silently just a zoom. Fixed by deleting that block and putting the
     defaults in `var()` fallbacks inside the keyframe.

   **Do not reintroduce a defaults rule for anything a per-piece rule sets.**
   Put the default in the `var()` fallback.

5. **Media queries add no specificity, so source order decides.** The phone
   travel vectors originally sat with the rest of the phone layout, above the
   wide values, and were silently overwritten by them: pieces on a phone flew
   towards where the Polaroid sits on a desktop. The phone overrides now sit
   *after* the wide block, with a comment saying why.

6. **The stop-motion is `steps()`, on two different counts.** `--frames: 14`
   for position and `--frames-rot: 9` for rotation, deliberately not a factor of
   14, so angle and position never land on the same beat. That mismatch is what
   stops it reading as machinery. `assemble` owns `transform`, so the resting
   tilt has to ride on the separate `rotate` property or the two overwrite each
   other.

   A third animation, `reveal`, flips opacity in one step at each piece's own
   delay. Without it `animation-fill-mode: both` fills backwards and every piece
   is painted at its start position from frame zero.

   Travel distances are computed, not guessed: the exact vector back to the
   Polaroid's centre for the pieces behind it, and a `cqw + vw` sum for the ones
   in front so they clear the window at any width. Percentages do **not** work
   inside `translate()`: they resolve against the element's own box, so the same
   number means a different distance for every piece.

7. **The collage images are pre-trimmed.** Each PNG was cropped to its alpha
   bounding box before resizing, so the image box equals the artwork and CSS
   sizing is predictable. The `width`/`height` attributes in the HTML match the
   trimmed files. If you re-export from Figma, re-trim, or the sizes will lie.

8. **There is no shadow video.** The old site used one, 2.6 MB of its 3.5 MB
   total. `light.js` generates the same effect instead.

### The liquid glass

Used by the nav pill and the RSVP button. Frost, refraction, dispersion and
rim, as four layers, because an element with its own `filter` becomes a
backdrop root and would block its own `backdrop-filter`.

**⚠️ Two approaches were built and rejected. Do not retry them without reading
this.**

* **SVG `feDisplacementMap` over a duplicated wall.** The usual web recipe for
  geometric refraction. The duplicated wall layer is *opaque*, so it painted
  over the collage and the Polaroid, and showed bare terracotta everywhere the
  real backdrop was not bare terracotta, which is most of where a fixed nav
  travels.
* **`backdrop-filter: url(#filter)`.** Unimplemented in Chromium, unreliable
  elsewhere. Genuinely bending a moving backdrop is not available
  cross-browser at all.

What ships instead reads as refraction without being it: a much heavier
`backdrop-filter` masked away from the middle, so the centre stays sharp and
the rim smears. It works over *any* backdrop, which is the point, because the
nav crosses the wall, a photograph and cream card stock as you scroll.

The dark tint is not decoration. Without it the cream label loses contrast the
moment the nav passes over the venue photograph.

Cost, measured with the pills over the animating light and interleaved against
the same page with the glass switched off: +0.1ms median at 1x CPU, +4.7ms at
6x throttling. Absolute frame times in headless Chrome are meaningless; only
the delta within one session is.

### The drawers

Bottom sheets, one per detail card. The motion is measured off the reference
the user chose rather than invented: `translateY(100%)` to 0 over 500ms on
`cubic-bezier(0.32, 0.72, 0, 1)`, scrim black 40% with an 8px blur over the
same 500ms, 32px rounded top on a phone and 48px on a desktop, and it stays a
bottom sheet at every width.

**One deliberate improvement on that reference:** it sets `aria-modal="true"`
but does not trap focus, so a keyboard user tabs straight out into the inert
page behind. Ours traps focus in both directions and hands it back to the exact
card that opened it. Verified: 45 tabs each way, zero escapes.

`hidden` on a drawer means "closed". Two frames are needed between painting the
sheet at `translateY(100%)` and adding `.is-open`, or the transition is skipped
and it jumps.

### The RSVP page

`rsvp/` ships **one ordinary form** with every question visible and a
working submit button. `steps.js` is pure enhancement: if it never loads, the
form still works and only the pacing is lost. Verified with JavaScript off.

**⚠️ Which step you are on is a class, `.is-current`. `hidden` means one thing
only: this question does not apply to you.** They were the same attribute at
first, and hiding the five steps you are not on made the step counter read
"1 of 1" from the second question onward. Keeping them separate is also what
lets `rsvp.js` hide the two attending-only questions for a "no" without either
file knowing about the other: the flow simply becomes four steps instead of six.

Submission is still the root `rsvp.js`. `steps.js` only decides which question
you are looking at.

## The light on the wall (`light.js`)

The wall used to be darkened by a 2.6 MB looping video of moving shadows. This
does the same job in about 30 KB of code, and the result moves on its own and pools
toward the cursor.

This is a deliberate, close port of the hero effect on
[microsoft.ai](https://microsoft.ai/), read out of their minified bundle
`BlockGL-Dh1-xzDN.js`. Their shader comments credit **Unicorn Studio** as the
origin of the bokeh and voronoi maths, and that credit is kept in our source.
An earlier attempt approximated the *look* with procedural noise and was wrong
in every structural respect. If you are tempted to "simplify" this back into
noise, read the four passes below first: there is no noise anywhere in the real
effect.

### The four passes, in order

Each pass writes to a buffer the next one reads. Two buffers ping-pong.

1. **Vignette.** A soft ellipse centred on the cursor. Transparent inside,
   solid deep shadow outside. This is the only pass the cursor touches, and it
   is the whole of the light.
2. **Sine.** Bends the picture with two sine waves, so the edge of that ellipse
   stops being a circle and starts undulating.
3. **Shatter.** A voronoi cell pattern, each cell shifting its slice of the
   image by its own offset. This is what tears the soft ellipse into separate
   finger-shaped streaks. The cells are rotated 44 degrees and squashed, which
   is exactly why the streaks run diagonally.
4. **Bokeh.** 50 taps on a golden-angle spiral, weighting bright pixels by
   `5 + colour^9 * 150`. Highlights smear into soft discs, everything else
   barely moves. This is what makes it read as out of focus.

### Every number, and where it came from

All of these are theirs, read from their source, unless the note says otherwise.

| | |
|---|---|
| Render scale | 0.5 desktop, 0.4 under 760px (ours, for phone battery) |
| Vignette | radius 0.354, falloff 1, skew 0.54, angle 0 |
| Sine | frequency 0.35, amplitude 1.18, rotation 0 |
| Shatter | scale 0.534, spread 1, angle 44 degrees, skew 0.84 |
| Bokeh | 50 samples, fixed radius 0.003, highlight power 9 |
| Composite | 26 percent multiply |
| Cursor ease | 0.1 per frame, over the full 0..1 canvas range |
| Clock | 2x real seconds; sine reads it at 0.25x, voronoi at 0.2x |
| Warm colour | `#FFD198` |
| Shadow colour | `#4a1c0c` (**ours**, see below) |

Their bokeh shader computes a `blurRadius` from the tilt setting and then never
passes it to the function that would use it, so the real sample radius is the
hardcoded `0.003`. We replicate the behaviour, not the dead code.

### The three places we deliberately differ

1. **No 1.4 MB gradient photograph.** They build their background by overlaying
   a large image onto flat pink. Our background is the terracotta wall already
   on the page. So our canvas outputs only the `mix(vec3(1.0), blend, 0.26)`
   half of their equation, and the CSS layer applies `mix-blend-mode: multiply`.
   Mathematically identical, and it saves the download entirely.

2. **Blue noise is generated at load, not downloaded.** They ship a 130 KB PNG
   used only to rotate each pixel's sample spiral by a fraction of a turn, and
   it is scaled by 0.01 so it barely matters. We generate a 256x256 texture at
   startup: white noise with the local 3x3 average subtracted three times, which
   suppresses low frequencies. Costs nothing and avoids re-hosting their asset.

3. **The shadow colour is `#4a1c0c`, not their `#4a0035`.** Their plum suits a
   pink background. On our terracotta it pulled the wall 4 degrees toward
   magenta and left it looking dusty. Six candidates were measured against the
   light-off baseline (`hsl(10, 33%, 45%)`); `#4a1c0c` was the only one that
   moved hue by 0 degrees while still reading as a shadow.

We also honour `prefers-reduced-motion`, which **microsoft.ai does not**. Tested:
their animation runs identically with the OS setting on, and they offer a manual
toggle instead. Ours centres the light and draws exactly one frame.

### Traps

⚠️ **Never write `pow(rgb, vec3(uSomething))` with a uniform exponent.** A
uniform forces a real exp2/log2 pair, and the bokeh pass runs it 150 times per
pixel. Microsoft use the literal `vec3(9.0)`, which the compiler folds into a
few multiplies. Ours is a `#define HIGHLIGHTS` baked in when the shader is
built. `bokehSamples` is baked the same way, so changing it needs a reload,
where everything else in `CONFIG` takes effect on the next frame.

⚠️ **Reduced motion needs `preserveDrawingBuffer: true`.** It draws once and
never again, so the buffer has to survive compositing. The flag is set from the
media query *before* the context is created, and only in that case: keeping the
buffer costs memory bandwidth for nothing when you redraw every frame anyway.

⚠️ **Do not trust frame-rate numbers from a Playwright session.** A completely
blank `about:blank` page reports the same ~30fps as our page in this harness.
Measure GPU cost with a `readPixels` sync loop instead: the real figure is
**0.059 ms per frame** for the whole four-pass chain. Only ever compare fps
figures taken within a single session run.

### Tuning it

Everything adjustable lives in one `CONFIG` block at the top of `light.js`, in
plain English, and is exposed on `window.LIGHT` so it can be tried live in the
browser console:

```js
LIGHT.strength = 0.4          // takes effect next frame
LIGHT.vignetteRadius = 0.5    // takes effect next frame
LIGHT.warm = '#FFE0B0'; LIGHT.refresh()   // colours are parsed once
```

How much of the light reaches the page is not in here. It is one CSS variable,
`--light-strength`, and it is the same the whole way down. It used to ease back
below the hero; it deliberately does not any more.

### What is verified, and what to re-check if you change it

Structural fingerprint matches theirs exactly: downsampling both canvases to
128x80 and measuring directional gradient energy at 15 degree steps gives
`streak along 135 degrees, across 60 degrees` for both. Zero axe violations at
390, 820 and 1440 with all FAQs expanded. Zero console errors. The loop draws
nothing at all when the tab is hidden or once you scroll 1.6 screens past the
hero, and pauses while scrolling. No WebGL hides the layer and leaves a plain
terracotta wall.

🔴 **If you change the composite, re-measure contrast from scratch.** This blend
*darkens*, where the first attempt brightened, so every reading moves the
opposite way. All 40 text elements were re-measured in the two worst cases
(cursor over the content, and cursor jammed in a far corner). The lowest is
5.15:1 against a 4.5 threshold. The one apparent failure is the RSVP honeypot at
`left: -9756px` with `aria-hidden="true"`, which is a spam trap and correctly
excluded.


## Previewing: one server, always port 4173

There is exactly ONE preview server, and it always runs on port 4173.

Copilot sessions sometimes run in a git worktree, which is a *different
folder* from the user's main checkout, and sometimes run in place in the
main checkout itself. A server started against the wrong folder cannot see
files added during a session. So at the start of every session, take over
port 4173 and point it at whichever folder the session is actually working
in:

```
lsof -ti :4173 -sTCP:LISTEN | while read p; do kill $p; done   # free the port
cd <session folder>
python3 -m http.server 4173 --bind 127.0.0.1
```

Then preview at `http://127.0.0.1:4173/index.html`.

Do not start a second server on another port and ask the user to switch.
Do not leave stray servers running. One port, one URL, every time.

The site uses `<video>` and responsive `<picture>` sources, so opening
`index.html` via `file://` will not behave correctly. Always use the server.

## Publishing

GitHub Pages deploys every push to `origin/main`, so pushing to main puts
the change on `akriti-srijan.com` within a minute or two. Never push to
main without explicit approval ("publish", "push it", or similar).

The site is served from the `main` branch root. The `CNAME` file in the
repo root holds the custom domain and must not be deleted or renamed:
removing it unsets the domain in GitHub Pages and takes the site offline.
(Despite the name, that file is not a DNS record.)

DNS lives at Namecheap: the apex `akriti-srijan.com` uses four A records
pointing at `185.199.108-111.153`, and `www` is a CNAME to
`srijan-hci.github.io`.

Two account traps on this machine:

1. The personal GitHub account is `srijan-hci`. A LinkedIn account,
   `srjhanwa_LinkedIn`, is also configured and has no access to this repo.
   `GH_TOKEN` is injected for the LinkedIn account, so unset it and switch
   accounts first:

   ```
   env -u GH_TOKEN gh auth switch --hostname github.com --user srijan-hci
   ```

2. The Copilot app injects a LinkedIn credential helper after normal git
   config, so a plain `git push` still fails with a 403 even once
   `srijan-hci` is active. Use this exact form:

   ```
   env -u GH_TOKEN git \
     -c credential.helper= \
     -c credential.https://github.com.helper= \
     -c 'credential.https://github.com.helper=!/Users/srjhanwa/Library/Caches/copilot-desktop-gh-2.96.0/gh auth git-credential' \
     push origin HEAD:main
   ```

Every commit should include:
`Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`

After pushing, confirm the deploy by polling the live site for a file or
marker that only exists in the new build.

## Audience

The user is a product designer, not a developer. Explain changes in plain
language, work in small increments, and flag anything risky before doing it.
