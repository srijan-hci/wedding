/* Intro animation trigger, plus the mouse parallax that follows it.
   All the sequencing lives in intro.css; this file only decides when
   things start and how far each piece drifts with the cursor. */
(function () {
  const body = document.body;
  const intro = document.querySelector(".intro");
  const collage = document.querySelector(".collage");
  const layers = Array.from(document.querySelectorAll(".layer"));

  if (!intro || !collage) return;

  /* ---------- The intro ---------- */

  function play() {
    body.classList.remove("intro-play");
    // Forcing a layout read here is what lets the same animation
    // restart from the beginning instead of being ignored.
    void intro.offsetWidth;
    body.classList.add("intro-play");
  }

  // Type replayIntro() in the browser console to watch it again
  // without reloading the page.
  window.replayIntro = play;

  /* ---------- Mouse parallax ----------
     The point of this is that no two pieces move alike. Each one has
     its own --px / --py / --pr / --pl values in intro.css:

       --px / --py  how far it drifts, and in which direction. A
                    negative value drifts against the cursor, which is
                    what visually separates neighbouring pieces.
       --pr         how far it tilts.
       --pl         how quickly it chases the cursor.

     That last one does most of the work. Every piece keeps its OWN
     lagged copy of the cursor position rather than sharing one, so
     the laggy pieces visibly trail the quick ones instead of the
     whole group sliding as a single slab. */

  const DRIFT_X = 20; // px of sideways drift at --px: 1, cursor at the edge
  const DRIFT_Y = 12; // px of vertical drift at --py: 1

  const canHover = window.matchMedia("(hover: hover)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const items = layers.map(function (layer) {
    const piece = layer.firstElementChild;
    const face = piece ? piece.querySelector(".face") : null;
    const style = piece ? getComputedStyle(piece) : null;
    const read = function (name, fallback) {
      if (!style) return fallback;
      const value = parseFloat(style.getPropertyValue(name));
      return isNaN(value) ? fallback : value;
    };
    return {
      layer: layer,
      face: face,
      px: read("--px", 1),
      py: read("--py", 1),
      pr: read("--pr", 0),
      lag: read("--pl", 0.08),
      x: 0, // this piece's own lagged copy of the cursor
      y: 0
    };
  });

  let targetX = 0;
  let targetY = 0;
  let started = false;

  function onPointerMove(event) {
    // Convert the cursor to a -1 to 1 range measured from the centre
    // of the window, so the effect is identical at any screen size.
    targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    targetY = (event.clientY / window.innerHeight - 0.5) * 2;
  }

  function frame() {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      item.x += (targetX - item.x) * item.lag;
      item.y += (targetY - item.y) * item.lag;

      const x = (item.x * DRIFT_X * item.px).toFixed(2);
      const y = (item.y * DRIFT_Y * item.py).toFixed(2);
      item.layer.style.transform = "translate3d(" + x + "px," + y + "px,0)";

      if (item.face && item.pr) {
        item.face.style.transform = "rotate(" + (item.x * item.pr).toFixed(3) + "deg)";
      }
    }

    requestAnimationFrame(frame);
  }

  function startParallax() {
    if (started || !canHover || reduced) return;
    started = true;
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    requestAnimationFrame(frame);
  }

  // Wait until the collage has finished settling, so the drift never
  // competes with the intro for the viewer's attention.
  collage.addEventListener("animationend", function (event) {
    if (event.target === collage) startParallax();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", play, { once: true });
  } else {
    play();
  }
})();
