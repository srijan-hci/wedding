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
| `styles.css` | Base styling and the three-layer page shell. |
| `intro.css` / `intro.js` | The opening collage animation. Self-contained. |
| `sections.css` | Design tokens, navigation, and every section below the hero. |
| `nav.js` | Nav state, active-link highlighting, click-to-load map, scroll reveals. |
| `rsvp.js` | The RSVP form. Holds the Google Apps Script URL. |
| `google-apps-script.js` | Not used by the page. The script to paste into Google Apps Script so RSVPs land in a Google Sheet, with setup instructions. |
| `Assets/` | Background photo (avif/jpg at 1200/1600/3200) and the shadow-wall video. |

The page is built from three stacked fixed layers:
`.background-layer` (z 0) → `.content-layer` (z 10) → `.shadow-layer` (z 20,
`mix-blend-mode: multiply`). Anything new needs a deliberate z-index
relative to these.

Two consequences of that stack worth knowing before editing:

1. **The hero must stay bounded.** `.intro` and `.hero-copy` are positioned
   with `inset: 0`, so they fill their nearest positioned ancestor. That
   ancestor is `.hero-section`, which is fixed at `100vh`. Remove that height
   and the collage is flung to the middle of the whole document.

2. **Nothing inside `.content-layer` can paint above the shadow video.**
   `.content-layer` creates a stacking context at z-index 10, and a child can
   never escape above a sibling of its parent. That is why `.site-nav` is a
   direct child of `<body>` at z-index 30 rather than living inside the
   content.

Brand colour is `#a94332`.

## Contrast under the shadow video

The shadow video multiplies over the entire page, and multiply only ever
darkens. Measured against the actual video file, the middle of the frame sits
at about 69% brightness and more than half the area is below 70%.

That has two hard consequences:

- **All body copy must be dark text on the light cream panels.** Light text on
  the terracotta wall is reserved for large display type only (the hero and the
  footer), never paragraphs.
- **The ink colours in `sections.css` are deliberately darker than they look
  like they need to be**, so body copy still clears roughly 5:1 in average
  shadow. Do not lighten them back for aesthetic reasons without re-measuring.

In the darkest ~1% of the frame, body copy still drops to about 3.6:1, which is
under the WCAG AA threshold of 4.5:1. This is unavoidable while the shadow runs
at full strength over the content: at that darkness even pure black text on the
cream panel only reaches 4.5:1. Softening the shadow below the hero is the only
real fix, and that is a deliberate design choice the owner has made against.

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
