# Measurement tools

None of this ships. These are the scripts that produced the numbers quoted in
`AGENTS.md`, kept so they can be re-run rather than re-invented.

They need Python with Pillow, numpy and Playwright, and a local server:

```sh
python3 -m http.server 8899
```

| Script | What it does |
|---|---|
| `collage-shoot.py` | Screenshots the home page once whole, then once per collage piece with that piece hidden. The pixel difference is an exact mask for the piece. |
| `collage-match.py` | Template-matches each of those masked pieces into `Assets/Testpage.png` and prints how far the design puts it from where we put it. Run `collage-shoot.py` first. |
| `contrast-audit.py` | Measures real rendered contrast for every text run on both pages. |
| `springs.py` | Simulates the spring curves used by the collage intro and prints them as CSS `linear()`. Needs nothing but the standard library, and no server. |
| `../Assets/collage/prepare.py` | Trims raw artwork to its alpha bounding box, resizes, and writes the WebP plus PNG fallback. |

## Two things to know about the contrast audit

The light layer is `mix-blend-mode: multiply`, so computed CSS colours tell you
nothing about what is actually on screen. The script therefore reads the
foreground off the rendered glyph cores and the background off a thin ring
around them, and never trusts a declared colour.

It also hides `.site-nav` before measuring. The nav is `position: fixed`, so it
sits inside other elements' bounding boxes, and its own cream-on-dark glyphs
were being attributed to whatever it happened to be covering. That produced
three convincing sub-2:1 failures whose real ratios were 11.7, 10.4 and 9.2.
The nav is measured on its own instead.

Playwright caches aggressively. Every script routes `**/*.{js,css}` with
`Cache-Control: no-cache`, or edits do not show up.

## About springs.py

It is the odd one out: the others measure the site, this one generates a
value the site uses. The output is pasted into `motion.css`, which is why
that file says do not hand-edit the numbers.

A spring is a simulation rather than a shape, so it cannot be drawn with the
four control points of a cubic-bezier. What a bezier cannot express is the
TAIL, and the tail is most of what the eye reads as weight: whether a thing
stops dead, or carries past its mark and rings.

Two traps are worth repeating, both commented in the script:

The integration step has to stay small. Euler integration is only stable
while the step is short relative to the spring's period, and a stiff spring
at a coarse step diverges rather than settling, so the curve explodes
instead of arriving.

The simulated curve then has to be rescaled onto the animation's own
duration. A spring settles in its own time, and if that were longer than the
CSS duration the animation would be cut off mid-flight and the piece would
visibly jump at the end. The script measures the settle time, resamples
across it, and forces the last sample to exactly 1.
