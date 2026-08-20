/* ============================================================
   Page behaviour

   Four small jobs:
     1. Play the intro once the images are actually ready.
     2. Drift the collage with the mouse afterwards.
     3. Nav state and section reveals.
     4. The three detail drawers.

   All of it degrades safely. Everything this file hides is hidden by
   a `.js`-scoped CSS rule, so if this never runs, nothing disappears.
   ============================================================ */
(function () {
  var root = document.documentElement;
  var body = document.body;
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

    // The nav, the assembly and the headline should not compete for
    // attention, so they arrive in that reading order: collage, then
    // headline at 3000ms, then the nav just behind it. On a page with no
    // collage, such as /rsvp, there is nothing to wait for.
    var navDelay = reduced || !collage ? 0 : 3300;
    window.setTimeout(function () {
      if (nav) nav.classList.add("is-ready");
    }, navDelay);
  }

  // Type replayIntro() in the browser console to watch it again.
  window.replayIntro = function () {
    var stage = document.querySelector(".hero-stage");
    if (!stage) return;
    body.classList.remove("intro-play");
    void stage.offsetWidth; // forces a reflow so the restart takes
    body.classList.add("intro-play");
  };

  whenImagesReady(play);

  /* ============================================================
     2. MOUSE PARALLAX

     The point is that no two pieces move alike. Each has its own
     --px / --py / --pr / --pl in styles.css, and each keeps its OWN lagged
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
  // Belt and braces: if that animation never fires, start anyway. This has
  // to land after the last piece settles, which is 3125ms.
  window.setTimeout(startParallax, 3300);

  /* ============================================================
     3. THE LIGHT, CONSTANT

     This used to ease the light back to 35% below the hero, because the
     body copy sat on cream panels and a screen blend can only lighten,
     so full strength washed them out.

     The panels are gone. Text now sits straight on the wall, and the
     shadow is meant to fall across the whole page exactly as it falls
     across the collage. Anything that changed with scroll would read as
     a bug, so the strength is simply left where the stylesheet sets it
     and nothing here touches it.
     ============================================================ */

  /* The light field itself lives in light.js, which handles its own
     pausing for hidden tabs and reduced motion. */

  /* ============================================================
     3. NAV STATE, REVEALS AND THE MAP
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

  /* Section reveals. Everything below the collage now fades up as it
     arrives, one block at a time. The class is added here rather than in
     the HTML so that if scripting never runs, nothing is ever hidden. */
  var reveals = Array.prototype.slice.call(
    document.querySelectorAll(".invite, .details, .closing, .signoff")
  );

  if (!reduced && "IntersectionObserver" in window && reveals.length) {
    reveals.forEach(function (el) {
      el.classList.add("reveal");
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

    reveals.forEach(function (el) {
      revealer.observe(el);
    });
  }

  /* ============================================================
     4. THE DETAIL MODALS

     Three modal cards, one per card in the details section.

     The focus trap is the reason this is more than twenty lines. The
     reference this was modelled on sets aria-modal="true" but leaves
     focus loose, so a keyboard user tabs straight out of the dialog
     and into the page behind it, which is still visible through the
     scrim and still scrollable-looking but inert. That is worse than
     no dialog at all, because there is no way to tell where you are.
     Here Tab and Shift+Tab wrap inside the card, Escape closes it, and
     focus returns to the exact card that opened it.

     The variable names still say "drawer". These were bottom sheets
     first, then Polaroids, and the class is load-bearing
     across three files, so renaming it is a job of its own.
     ============================================================ */
  var drawerRoot = document.querySelector(".drawer-root");

  if (drawerRoot) {
    var openDrawer = null;
    var lastFocused = null;
    var scrollLocked = false;

    var FOCUSABLE = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    function focusablesIn(el) {
      return Array.prototype.slice
        .call(el.querySelectorAll(FOCUSABLE))
        .filter(function (node) {
          return node.offsetWidth > 0 || node.offsetHeight > 0;
        });
    }

    /* Locking the page behind the card. Setting overflow on <html> and
       <body> is what actually holds on iOS Safari, where either one on
       its own is ignored. */
    function lockScroll() {
      if (scrollLocked) return;
      root.style.overflow = "hidden";
      body.style.overflow = "hidden";
      scrollLocked = true;
    }

    function unlockScroll() {
      if (!scrollLocked) return;
      root.style.overflow = "";
      body.style.overflow = "";
      scrollLocked = false;
    }

    function open(id, trigger) {
      var drawer = document.getElementById(id);
      if (!drawer || openDrawer) return;

      lastFocused = trigger || document.activeElement;
      openDrawer = drawer;

      drawerRoot.hidden = false;
      drawer.hidden = false;
      lockScroll();

      /* Two frames, not one. The first paints the card at its starting
         opacity and scale; only after that has been committed does
         adding the class produce a transition rather than an instant
         jump. */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          drawerRoot.classList.add("is-open");
          drawer.classList.add("is-open");
        });
      });

      if (trigger) trigger.setAttribute("aria-expanded", "true");

      /* The card itself takes focus, not the close button. Focusing a
         button paints a focus ring the instant the card opens, which
         reads as a highlighted control rather than a dialog arriving.
         The card carries tabindex="-1" so it can hold focus without
         becoming a tab stop, and a screen reader announces the dialog
         and its title rather than just "Close, button". The trap below
         already handles focus sitting on the card rather than on one of
         its ends: the first Tab walks into the content normally. */
      drawer.focus();

      document.addEventListener("keydown", onKeydown, true);
    }

    function close() {
      if (!openDrawer) return;
      var drawer = openDrawer;
      openDrawer = null;

      drawerRoot.classList.remove("is-open");
      drawer.classList.remove("is-open");
      document.removeEventListener("keydown", onKeydown, true);

      var trigger = lastFocused;
      if (trigger && trigger.hasAttribute("aria-expanded")) {
        trigger.setAttribute("aria-expanded", "false");
      }

      /* Wait for the fade out before hiding, so it does not vanish
         mid-animation. transitionend alone is not safe: if the card is
         off screen the browser may never fire it, so a timer backs it
         up and whichever lands first wins. */
      var done = false;

      function finish() {
        if (done) return;
        done = true;
        drawer.hidden = true;
        drawerRoot.hidden = true;
        unlockScroll();
        if (trigger && typeof trigger.focus === "function") trigger.focus();
      }

      drawer.addEventListener("transitionend", finish, { once: true });
      window.setTimeout(finish, 560);
    }

    function onKeydown(event) {
      if (!openDrawer) return;

      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== "Tab") return;

      var items = focusablesIn(openDrawer);
      if (!items.length) {
        event.preventDefault();
        return;
      }

      var first = items[0];
      var last = items[items.length - 1];
      var active = document.activeElement;

      /* Focus can end up outside the card entirely, for instance after
         clicking the scrim, so pull it back rather than assuming it is
         on one of the two ends. */
      if (!openDrawer.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    /* The scrollbar is invisible until you actually scroll, then fades
       back out once you stop. Only the thumb ever appears: the track
       stays transparent at all times, so there is no groove sitting on
       the paper.

       Only the colours change, never the width, so the gutter is
       reserved the whole time and text never reflows as the bar comes
       and goes.

       Scroll events do not bubble, so this listens in the capture phase
       on the root. One listener covers all three cards. */
    var scrollHide = null;

    drawerRoot.addEventListener(
      "scroll",
      function (event) {
        var body = event.target;
        if (!body.classList || !body.classList.contains("drawer-body")) return;

        body.classList.add("is-scrolling");
        window.clearTimeout(scrollHide);
        scrollHide = window.setTimeout(function () {
          body.classList.remove("is-scrolling");
        }, 900);
      },
      true
    );

    document.addEventListener("click", function (event) {
      var opener = event.target.closest("[data-drawer]");
      if (opener) {
        event.preventDefault();
        open(opener.getAttribute("data-drawer"), opener);
        return;
      }
      if (event.target.closest("[data-close]")) {
        event.preventDefault();
        close();
      }
    });
  }
})();
