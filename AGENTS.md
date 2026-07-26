# Working agreement for this repo

## Always build on the existing site

This repo is one real website: `index.html` + `styles.css` + `Assets/`.

**Default behaviour for every session: edit the existing site files directly.**

Do NOT create standalone mockup, demo, prototype, sandbox, or `-v2` files
(e.g. `intro-mockup.html`, `test.html`, `index-new.html`). New work layers
onto the live page so it can be judged in context, against the real
background, real assets, and real type.

Only create a separate file when the user explicitly asks for a throwaway
comparison or an isolated experiment.

If a change is large or risky, say so clearly and offer a way to switch it
off, but still make it in the real page rather than a parallel copy.

## Keeping additions removable

When adding a self-contained feature (an intro animation, a new section),
prefer putting it in its own CSS/JS file and wiring it into `index.html`
with as few lines as possible. That keeps the live page authoritative while
still making the feature easy to back out.

## Structure

| File | Purpose |
|---|---|
| `index.html` | The whole page. Layers: background photo, content, shadow video overlay. |
| `styles.css` | All base styling. |
| `Assets/` | Background photo (avif/jpg at 1200/1600/3200) and the shadow-wall video. |

The page is built from three stacked fixed layers:
`.background-layer` (z 0) → `.content-layer` (z 10) → `.shadow-layer` (z 20,
`mix-blend-mode: multiply`). Anything new needs a deliberate z-index
relative to these.

Brand colour is `#a94332`.

## Previewing: one server, always port 4173

There is exactly ONE preview server, and it always runs on port 4173.

Copilot sessions run in a git worktree, which is a *different folder* from
the user's main checkout. A server started against the main checkout cannot
see files added during a session. So at the start of a session, take over
port 4173 and point it at the session folder:

```
kill $(lsof -ti :4173 -sTCP:LISTEN)          # free the port first
cd <session folder>
python3 -m http.server 4173 --bind 127.0.0.1
```

Then preview at `http://127.0.0.1:4173/index.html`.

Do not start a second server on another port and ask the user to switch.
Do not leave stray servers running. One port, one URL, every time.

The site uses `<video>` and responsive `<picture>` sources, so opening
`index.html` via `file://` will not behave correctly. Always use the server.

## Audience

The user is a product designer, not a developer. Explain changes in plain
language, work in small increments, and flag anything risky before doing it.
