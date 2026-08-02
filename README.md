# akriti-srijan.com

A wedding invitation for Akriti and Srijan, 20 and 21 February 2027 at
Tharavadu Mane, Bangalore.

Plain HTML, CSS and JavaScript. No build step, no framework, no dependencies.
Open `index.html`, or serve the folder:

```sh
python3 -m http.server 8899
```

| Path | What it is |
|---|---|
| `index.html` | The invitation. Collage, date, venue, three detail cards. |
| `rsvp/` | The RSVP form, one question at a time. |
| `styles.css` | Everything. Tokens, the collage stage, the glass, the drawers. |
| `main.js` | Intro timing, mouse parallax, nav state, the drawers. |
| `light.js` | The light and shadow on the wall. WebGL, shaders included. |
| `rsvp.js` | Form submission. **Needs an endpoint before it works.** |
| `Assets/` | The wall, and the collage artwork. |
| `Font/` | Recoleta, the three weights actually used. |
| `tools/` | Measurement scripts. Nothing here ships. |

Read `AGENTS.md` before changing anything. It records the traps, and there are
several that cost real time to find.
