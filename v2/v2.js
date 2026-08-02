/* ============================================================
   v2 behaviour

   Four small jobs:
     1. Play the intro once the images are actually ready.
     2. Drift the collage with the mouse afterwards.
     3. Ease the light back as you scroll off the hero.
     4. Nav state, section reveals, and the click-to-load map.

   All of it degrades safely. Everything this file hides is hidden by
   a `.js`-scoped CSS rule, so if this never runs, nothing disappears.
   ============================================================ */
(function () {
  var root = document.documentElement;
  var body = document.body;
  var hero = document.querySelector(".hero");
  var collage = document.querySelector(".collage");
  var nav = document.querySelector(".site-nav");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Browser chrome inset ----------
     On phones the toolbars overlay the page, so the layout viewport is
     shorter than the physical screen and every CSS viewport unit
     reports that short height. A full-bleed layer sized to 100vh
     therefore stops at the toolbar's top edge instead of filling
     behind it. Measuring the difference gives the CSS the missing
     height. Only on touch devices: on a desktop screen.height is the
     whole monitor, which would wildly oversize the background. */
  function setChromeInset() {
    var coarse = window.matchMedia("(pointer: coarse)").matches;
    var gap = window.screen.height - window.innerHeight;
    var inset = coarse && gap > 0 && gap < window.innerHeight ? gap : 0;
    root.style.setProperty("--chrome-inset", inset + "px");
  }

  setChromeInset();
  window.addEventListener("resize", setChromeInset, { passive: true });
  window.addEventListener("orientationchange", setChromeInset, { passive: true });

  /* ============================================================
     1. THE INTRO

     The pieces fan out from behind the Polaroid. That illusion only
     works if the images have actually decoded: a piece that is still
     loading slides out as an empty gap. So rather than firing on
     DOMContentLoaded, wait for the images, with a ceiling so a slow
     connection can never leave the page blank.
     ============================================================ */
  var images = Array.prototype.slice.call(
    document.querySelectorAll(".collage img")
  );

  function whenImagesReady(done) {
    var pending = images.length;
    var fired = false;

    function finish() {
      if (fired) return;
      fired = true;
      done();
    }

    if (!pending) return finish();

    // Never wait longer than this, however slow the connection.
    var ceiling = window.setTimeout(finish, 2500);

    images.forEach(function (img) {
      var settle = function () {
        pending -= 1;
        if (pending <= 0) {
          window.clearTimeout(ceiling);
          finish();
        }
      };

      if (img.complete && img.naturalWidth) return settle();
      img.addEventListener("load", settle, { once: true });
      // A broken image should not hold the whole intro hostage.
      img.addEventListener("error", settle, { once: true });
    });
  }

  function play() {
    body.classList.add("intro-play");

    // The nav and the fan-out should not compete for attention, so the
    // nav arrives as the last piece lands.
    var navDelay = reduced ? 0 : 2400;
    window.setTimeout(function () {
      if (nav) nav.classList.add("is-ready");
    }, navDelay);
  }

  // Type replayIntro() in the browser console to watch it again.
  window.replayIntro = function () {
    body.classList.remove("intro-play");
    void document.querySelector(".hero-inner").offsetWidth;
    body.classList.add("intro-play");
  };

  whenImagesReady(play);

  /* ============================================================
     2. MOUSE PARALLAX

     The point is that no two pieces move alike. Each has its own
     --px / --py / --pr / --pl in v2.css, and each keeps its OWN lagged
     copy of the cursor rather than sharing one, so the laggy pieces
     visibly trail the quick ones instead of the whole group sliding
     as a single slab.
     ============================================================ */
  /* How much of the drift to apply overall. 1 is the original amount;
     0.5 halves every part of it at once, including the rotation, which
     is what you want if it ever feels too busy. Changing the two DRIFT
     numbers below would leave the rotation untouched, so scale here.

     Exposed as PARALLAX so you can try amounts live in the browser
     console without editing the file:  PARALLAX.amount = 0.75  */
  var PARALLAX = { amount: 0.5 };
  window.PARALLAX = PARALLAX;

  var DRIFT_X = 22; // px of sideways drift at --px: 1, cursor at the edge
  var DRIFT_Y = 13; // px of vertical drift at --py: 1

  var canHover = window.matchMedia("(hover: hover)").matches;

  var items = Array.prototype.slice
    .call(document.querySelectorAll(".layer"))
    .map(function (layer) {
      var piece = layer.firstElementChild;
      var style = piece ? getComputedStyle(piece) : null;
      var read = function (name, fallback) {
        if (!style) return fallback;
        var value = parseFloat(style.getPropertyValue(name));
        return isNaN(value) ? fallback : value;
      };
      return {
        layer: layer,
        img: piece ? piece.querySelector("picture, img") : null,
        px: read("--px", 1),
        py: read("--py", 1),
        pr: read("--pr", 0),
        lag: read("--pl", 0.08),
        x: 0,
        y: 0
      };
    });

  var targetX = 0;
  var targetY = 0;
  var started = false;

  function onPointerMove(event) {
    // Convert the cursor to a -1..1 range measured from the centre of
    // the window, so the effect is identical at any screen size.
    targetX = (event.clientX / window.innerWidth - 0.5) * 2;
    targetY = (event.clientY / window.innerHeight - 0.5) * 2;
  }

  function frame() {
    var amount = PARALLAX.amount;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      item.x += (targetX - item.x) * item.lag;
      item.y += (targetY - item.y) * item.lag;

      var x = (item.x * DRIFT_X * item.px * amount).toFixed(2);
      var y = (item.y * DRIFT_Y * item.py * amount).toFixed(2);
      item.layer.style.transform = "translate3d(" + x + "px," + y + "px,0)";

      if (item.img && item.pr) {
        item.img.style.transform =
          "rotate(" + (item.x * item.pr * amount).toFixed(3) + "deg)";
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
  // competes with the intro.
  if (collage) {
    collage.addEventListener("animationend", function (event) {
      if (event.target === collage) startParallax();
    });
  }
  // Belt and braces: if that animation never fires, start anyway.
  window.setTimeout(startParallax, 3400);

  /* ============================================================
     3. THE LIGHT, EASING BACK

     Full strength over the collage, gentler over the sections. This is
     not only atmosphere: a screen blend can only lighten, so at full
     strength the brightest part of the light washes out the cream
     panels the body copy sits on. Easing it back is what keeps the
     sections comfortably readable.

     Both ends of the range live in v2.css as --light-hero and
     --light-sections, so the whole effect is two numbers.
     ============================================================ */
  var lightFrom = parseFloat(
    getComputedStyle(root).getPropertyValue("--light-hero")
  );
  var lightTo = parseFloat(
    getComputedStyle(root).getPropertyValue("--light-sections")
  );

  if (isNaN(lightFrom)) lightFrom = 1;
  if (isNaN(lightTo)) lightTo = 0.35;

  var ticking = false;

  function updateLight() {
    var heroHeight = hero ? hero.getBoundingClientRect().height : window.innerHeight;
    // Fully eased by the time the hero is one screen behind you.
    var progress = Math.min(1, Math.max(0, window.scrollY / (heroHeight * 0.75)));
    // Smoothstep, so it does not visibly start or stop.
    var eased = progress * progress * (3 - 2 * progress);
    var value = lightFrom + (lightTo - lightFrom) * eased;
    root.style.setProperty("--light-strength", value.toFixed(3));
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      updateLight();
      ticking = false;
    });
  }

  updateLight();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  /* The light field itself lives in light.js, which handles its own
     pausing for hidden tabs and reduced motion. */

  /* ============================================================
     4. NAV STATE, REVEALS AND THE MAP
     ============================================================ */
  var links = Array.prototype.slice.call(
    document.querySelectorAll(".site-nav a[href^='#']")
  );

  var sections = links
    .map(function (link) {
      var el = document.getElementById(link.getAttribute("href").slice(1));
      return el ? { link: link, el: el } : null;
    })
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    var visible = new Map();

    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          visible.set(entry.target, entry.isIntersecting);
        });

        var current = null;
        for (var i = 0; i < sections.length; i++) {
          if (visible.get(sections[i].el)) {
            current = sections[i];
            break;
          }
        }

        sections.forEach(function (item) {
          item.link.classList.toggle("is-active", item === current);
        });
      },
      { rootMargin: "-25% 0px -65% 0px", threshold: 0 }
    );

    sections.forEach(function (item) {
      spy.observe(item.el);
    });
  }

  /* Click-to-load map, so a heavy third-party embed never delays the
     page for the many guests who will never scroll to it. */
  var mapButton = document.querySelector(".map-placeholder");

  if (mapButton) {
    mapButton.addEventListener("click", function () {
      var frame = document.createElement("iframe");
      frame.src = mapButton.dataset.mapSrc;
      frame.title = mapButton.dataset.mapTitle || "Map";
      frame.loading = "lazy";
      frame.referrerPolicy = "no-referrer-when-downgrade";
      frame.allowFullscreen = true;
      mapButton.replaceWith(frame);
    });
  }

  /* Section reveals. The class is added here rather than in the HTML so
     that if scripting never runs, nothing is ever hidden. */
  var panels = Array.prototype.slice.call(document.querySelectorAll(".panel"));

  if (!reduced && "IntersectionObserver" in window && panels.length) {
    panels.forEach(function (panel) {
      panel.classList.add("reveal");
    });

    var revealer = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );

    panels.forEach(function (panel) {
      revealer.observe(panel);
    });
  }
})();
