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
| `index.html` | The invitation. Collage, date, venue, three detail cards, and the three Polaroid modals those cards open. |
| `rsvp/index.html` | The RSVP page. One plain form that becomes one question at a time. |
| `rsvp/steps.js` | The stepping only. Submission still belongs to `rsvp.js`. |
| `styles.css` | Everything. Recoleta `@font-face`, tokens, the liquid glass, the collage stage, the stop-motion keyframes, the page below the collage, the detail modals, the RSVP page. |
| `main.js` | Intro timing, mouse parallax, nav state, section reveals, the detail modals. |
| `light.js` | The light and shadow on the wall. Self-contained WebGL, shaders included. |
| `rsvp.js` | Form submission. Holds the Google Apps Script URL. Shared by the RSVP page. |
| `google-apps-script.js` | Not used by the page. The script to paste into Google Apps Script so RSVPs land in a Google Sheet, with setup instructions. |
| `Assets/` | The wall photograph, avif/jpg at 1200/1600/3200. |
| `Assets/collage/` | The collage cut-outs, WebP with PNG fallback except the three cards which are WebP only, plus `prepare.py` which made them. Originals in `Assets/collage/_source/`, gitignored. |
| `Font/` | Recoleta. Only the three weights actually loaded are tracked. |
| `tools/` | Measurement scripts. Nothing here ships. See `tools/README.md`. |

The page is four stacked fixed layers:

```
.background-layer   z 0    the wall photograph
.content-layer      z 10   collage, headline, everything you read
.light-layer        z 20   the drifting light, mix-blend-mode: multiply
.site-nav           z 30   the pill nav
.drawer-root        z 60   the detail Polaroids, over everything
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
page, the RSVP page and an open detail modal. The colours are already near the
top of their range, so if you add small text on the wall, measure it. Do not
eyeball it.

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

### The detail modals

A Polaroid, not a bottom sheet. Each card opens a centred card wearing the same
warm white frame as the artwork printed on the cards themselves: a thin margin
on three sides, a slightly deeper band along the bottom, and every word sitting
in the photo window, which is the only part that scrolls. It fades and scales
in over 500ms on `cubic-bezier(0.32, 0.72, 0, 1)`, scrim black 40% with an 8px
blur. It stays the same shape at every width; on a phone it simply gets
narrower.

The frame is `padding` on `.drawer` driven by two custom properties,
`--pol-edge` (the three-sided margin) and `--pol-foot` (the band below the
window), not a `border`. A border would add to the element's width and the
window's own edge would drift out of square with it. A real Polaroid's foot is
about four times its edge; here it is about double, because four times is a lot
of empty white to ask for on a card carrying this much reading.

**⚠️ `.drawer-body` needs `min-height: 0`.** A flex child defaults to
`min-height: auto`, meaning "never shrink below your content". Without it the
window grows to fit every word, the card outgrows the screen, and nothing
scrolls at all.

**The close button sits on the top-right corner, half on and half off the
frame.** Anywhere inside the window and it would sit over text scrolling
underneath it, which reads as a bug rather than a button. It also has to
restate `border-radius: 999px` in its `:focus-visible` rule, because the global
`button:focus-visible` sets `border-radius: 2px` so a rectangular ring hugs the
element, which boxes in a circle.

`.drawer-root` is a one-cell grid with `place-items: center`, not just a fixed
box. The single explicit row and column is what gives `.drawer`'s
`max-height: 100%` a definite track to measure against; against an auto track
the percentage has nothing to resolve to.

**One deliberate improvement on the reference this was modelled on:** it sets
`aria-modal="true"` but does not trap focus, so a keyboard user tabs straight
out into the inert page behind. Ours traps focus in both directions and hands
it back to the exact card that opened it. Verified: 45 tabs each way, zero
escapes.

`hidden` on a modal means "closed". Two frames are needed between painting the
card at its starting opacity and adding `.is-open`, or the transition is
skipped and it jumps.

**The class is still `drawer`.** These were bottom sheets before the card
became a Polaroid, and the name is load-bearing in `index.html`, `styles.css`
and `main.js`, so renaming it is a job of its own rather than a detail of a
visual change.

**The card artwork is cropped differently from every other collage piece.**
`card-travel`, `card-events` and `card-bangalore` come out of Figma with a soft
drop shadow already painted in, and `.card-shot img` adds its own
`drop-shadow()`. `prepare.py` therefore crops them with `trim_solid()`, which
keeps only the opaque rectangle, rather than `trim()`, which keeps anything not
fully transparent. Using the wrong one gives every card two shadows. All three
are forced to one shared output size because their solid rectangles differ by a
pixel, which would otherwise make the three cards fractionally different heights
in the grid.

**⚠️ The captions are painted into the artwork, and the `alt` text is the only
thing naming these buttons.** There used to be a `.card-label` span under each
card holding "Travel / Stay" and so on. The designer moved that lettering into
the Polaroid's white band, so the spans are gone and the CSS with them. That
span was also the button's accessible name, so each `<img>` now carries a real
alt instead. **Do not set `alt=""` on these three.** They look decorative, and
the reflex is to blank them, but doing so makes a screen reader announce three
consecutive buttons as nothing but "button".

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

**The page is centred**, set once as `text-align: center` on `.rsvp-page`.
Everything either inherits that or is a flex row, and flex rows ignore
`text-align`, which is why `.rsvp-choice` and `.rsvp-actions` centre themselves
explicitly and `.rsvp-input--short` needs `margin-inline: auto`. Form controls
do not inherit it either, hence `text-align: center` on `.rsvp-input`.

**⚠️ The radio dots on the yes/no step are clipped, not removed.** Centring a
dot and its label as a pair left the two dots 11px apart, because the labels are
different lengths, and that reads as a mistake on a page where everything else
lines up. The pill carries the state instead. It must stay a clip, never
`display: none` or `visibility: hidden`: those drop the input out of the tab
order and the accessibility tree, so it would stop being reachable by keyboard
or announceable. Verified still a real radio group: arrow keys move between
options, the wrapping label makes the whole pill clickable, and axe reports
zero violations.

Because the dot is gone, the checked pill changes *weight* as well as colour, via
an `inset` box-shadow that doubles the border without moving anything. Colour
alone would fail WCAG 1.4.1. There is also an `@supports not selector(:has(*))`
block that puts the dot back, because without `:has()` nothing can show the
checked state and the dot would be the only signal left.

### Where replies go

GitHub Pages only serves files, so the form posts to a Google Apps Script that
Srijan owns, which appends one row to the wedding planning spreadsheet:

`docs.google.com/spreadsheets/d/1xV8bFDqyMMbiC_yCEdOb3N2A32cIWFlQJVh0JY8Ejl0`

It writes to the **`💌 RSVPs`** tab and nothing else. **The `🧑‍🧑‍🧒‍🧒 Guest List`
tab is hand-curated and must never be written to by anything automated.** Names
there read like "Uma didi + family", so matching them against whatever a guest
types would eventually clobber real data. Reconcile by eye instead.

The columns are `Submitted, Name, Email, Attending, Party size, Dietary needs,
Note`. **The left-hand keys in `COLUMNS` must match the `name` attributes in
`rsvp/index.html` exactly.** Anything a guest sends that is not in `COLUMNS` is
silently dropped, which is deliberate: it is what discards the honeypot. Add a
question in both places or it will not be recorded.

Two things about that script are load-bearing:

- It looks the tab up by exact name, then falls back to **any** tab containing
  "RSVP". Without the fallback, renaming the tab (even just dropping the emoji)
  would quietly start a second, empty tab beside the real one, and replies would
  look like they had vanished.
- Bolding and freezing the header is a **separate, idempotent check**, not part
  of the "first run" branch. The heading row was created by hand during setup, so
  a first-run-only check would never have fired.

**⚠️ Never use `appendRow()` here, and never use `getLastRow()` to decide where
to write.** Both count the last row the grid has ever been *touched* in, which is
not the last row with anything in it. Clearing cells (as opposed to deleting the
rows) leaves them empty but still counted. This was found the hard way: after
clearing eleven test rows, the next reply landed in **row 13** with a wall of
blank rows above it, and every later reply would have marched further down.
`nextRow_()` reads the values back and finds the last row with real content, so
blank rows get reused instead of accumulating. It also means a guest's row can be
cleared by hand without breaking anything afterwards.

A submission takes roughly **five seconds** end to end, and longer on a slow
connection. `rsvp.js` therefore swaps "Sending..." for a "still sending" line
after six seconds. **There is deliberately no timeout**: cutting the request off
would report a failure for a reply that was actually delivered, and the guest
would send it twice.

`RSVP_ENDPOINT` in `rsvp.js` holds the live `/exec` URL and is committed. It is
not a secret: anyone can read it in the page source, and the script only ever
appends a row. If it is ever emptied the form does not fail silently, it tells
people to email instead.

**⚠️ `mode: "no-cors"` means a success here is "delivered", not "confirmed".**
The browser refuses to let us read the reply, so we cannot tell a written row
from a script that threw. That is why the thank-you screen also gives an email
address. It is also why **the sheet is the only ground truth when testing.**
`curl` reports 405 on that endpoint even when the post works, because the real
response is a 302 to `script.googleusercontent.com` and curl mishandles the
redirect. Do not chase that 405.

**If you change the Apps Script you must redeploy it**, via Deploy > Manage
deployments > pencil > New version. A brand new deployment would hand you a
different URL.

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
nothing at all when the tab is hidden, and pauses the clock while scrolling. No
WebGL hides the layer and leaves a plain terracotta wall.

**⚠️ The light must animate the whole way down the page. Do not add a
scroll-based gate.** There used to be one, `scrollY < innerHeight * 1.6`, from
when main.js eased the light down to 35 percent below the hero: freezing
something already faded out cost nothing. That fade was removed when the wall
and shadow became continuous, but the gate stayed, and quietly froze the drift
from the venue section onward. `stop()` leaves the last frame painted, so it
never looked broken, just inexplicably still, which is why it survived so long.
Measured: 105 draw calls per 1.5s above the threshold, **0** below it, resuming
the moment you scrolled back up. The layer is `position: fixed` at constant
opacity, so it is *always* on screen and there is no honest offscreen state.
Hiding the tab is the one real reason to stop.

🔴 **If you change the composite, re-measure contrast from scratch.** This blend
*darkens*, where the first attempt brightened, so every reading moves the
opposite way. All 40 text elements were re-measured in the two worst cases
(cursor over the content, and cursor jammed in a far corner). The lowest is
5.15:1 against a 4.5 threshold. The one apparent failure is the RSVP honeypot at
`left: -9756px` with `aria-hidden="true"`, which is a spam trap and correctly
excluded.


## Regenerating the collage assets

`prepare.py` is the only thing that should ever write to `Assets/collage/`.
Never hand-edit an exported file.

**It must be run from the repo root, not from its own folder.** Its source
paths are relative (`Assets/...`), so running it in place fails on the first
missing file.

```
python3 Assets/collage/prepare.py
```

It writes everything to `/tmp/collage-out/` and prints a table of sizes. Copy
across only the pieces that actually changed, then fix permissions (see the
OneDrive note below):

```
cp /tmp/collage-out/card-travel.webp Assets/collage/card-travel.webp
chmod 644 Assets/collage/card-travel.webp
```

The designer re-saves artwork **over the same filenames** (`Assets/Frame 6.png`
and friends), so a re-export is usually just those two commands per piece with
no code change at all. Check `git status`: if a source was not actually
re-saved, its output is byte-identical and will not appear.

It needs Pillow and numpy. `Assets/image 8.png`, `image 23.png` and
`image 31.png` are a superseded first attempt at the cards, still on disk and
gitignored. `Assets/collage/polaroid-blank.webp` is no longer referenced by
anything but is deliberately still tracked, in case a fourth card is ever added.

## Working on this machine

Three environment traps, all of which cost real time to find:

**⚠️ The repo lives inside OneDrive.** Writing many files in a tight loop
throws `TimeoutError: [Errno 60]` partway through, so scripts should build
their output in `/tmp` and copy it in afterwards. OneDrive also sets copied
files to mode `700`, which is wrong for tracked files, so `chmod 644` after
copying anything in.

**Playwright needs an explicit browser path and WebGL flags.** The bundled
launcher does not find Chromium here, and headless has no GPU, so the light
renders nothing without SwiftShader:

```python
p.chromium.launch(headless=True,
    executable_path="/Users/srjhanwa/Library/Caches/ms-playwright/"
        "chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/"
        "chrome-headless-shell",
    args=["--use-gl=angle", "--use-angle=swiftshader",
          "--enable-unsafe-swiftshader"])
```

Route `**/*.{js,css,webp}` with `Cache-Control: no-cache` or Playwright will
happily screenshot the previous version of a file you just changed. Also note
`page.accessibility` does not exist in this build: inject axe and `evaluate`
instead.

**`pkill` and `killall` are refused; `kill` needs a numeric PID.** Finding the
PID and killing it have to be two separate calls, because each shell command
runs in a fresh process:

```
pgrep -f "http.server 4173" | head -1
kill <pid>
```

A Python virtualenv with Pillow, numpy and Playwright is the easiest way to run
any of this. Building it under `/tmp` works but does not survive a reboot.

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

After pushing, poll the Pages build rather than guessing. It takes about
45 seconds:

```
env -u GH_TOKEN gh api repos/srijan-hci/wedding/pages/builds/latest --jq '.status'
```

Wait for `built`, then load the live site with a cache-busting query string and
confirm the change is really there. Do not treat a successful push as a
successful deploy.

## Audience

The user is a product designer, not a developer. Explain changes in plain
language, work in small increments, and flag anything risky before doing it.

Sentence case for headings. No em-dashes anywhere, in the site copy or in
conversation: use a colon, a comma, or a shorter sentence.

## Open, and not to be guessed at

Everything below is either waiting on the owner or is copy nobody has approved.
**Do not quietly resolve any of it.** Ask.

**Waiting on the owner:**

Nothing right now. The Apps Script was redeployed on 3 August 2026 and the
`nextRow_()` fix is confirmed live: two replies a minute apart landed in rows 2
and 3, and after row 3 was cleared the next reply **reused** row 3 rather than
skipping to row 4. That reuse is the exact behaviour `appendRow()` got wrong,
so it is the test worth repeating if the script is ever changed again.

**Unconfirmed copy currently on the live site:**

- **The date.** The Figma says "February 21, 2027"; the site says
  "20 & 21 February 2027". One of them is wrong.
- **The venue spelling.** Figma "Tharvadu Mane", site "Tharavadu Mane".
- **"Please RSVP by 28 August 2026"** was lifted from the Figma and never
  confirmed.
- **The venue street address in the Travel modal is still a placeholder.**
- **The closing paragraph** ("Come for the food, stay for the dancing...") was
  written by an assistant, not by the couple.
- **All three detail modals** were condensed from an earlier version of the site
  and have never been fact-checked. Treat every logistic in them as a draft.

**Offered and not yet answered:** on the RSVP page the two long answers
(dietary needs, note) now centre their text as it is typed, which reads oddly
for a sentence. Left-aligning just those two is a small change if wanted.
