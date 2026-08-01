/* Navigation, scroll state, and section reveals.

   Three small jobs:
     1. Show the nav once the intro animation has had its moment.
     2. Swap the nav to its solid cream state once you scroll off the
        hero, and highlight whichever section you are looking at.
     3. Ease each section up as it scrolls into view.

   All of it degrades safely: if this file fails to load, the nav is
   revealed by CSS fallback below and every section is visible. */
(function () {
  const nav = document.querySelector(".site-nav");
  if (!nav) return;

  const toggle = nav.querySelector(".nav-toggle");
  const links = Array.from(nav.querySelectorAll(".site-nav-links a[href^='#']"));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. Reveal the nav after the intro ----------
     The intro runs for roughly 3.4s. Waiting means the nav does not
     compete with the collage for attention. Anyone arriving at a
     deep link, or with reduced motion on, gets it immediately. */
  const introIsRunning =
    !reduced && !window.location.hash && window.scrollY < 40;

  window.setTimeout(
    function () {
      nav.classList.add("is-ready");
    },
    introIsRunning ? 3400 : 0
  );

  /* ---------- 2. Scrolled state ----------
     The bar only grows its cream background once you have left the
     hero, so the opening screen stays clean. */
  function heroHeight() {
    const hero = document.querySelector(".hero-section");
    return hero ? hero.getBoundingClientRect().height : window.innerHeight;
  }

  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      nav.classList.toggle("is-scrolled", window.scrollY > heroHeight() * 0.6);
      ticking = false;
    });
  }

  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  function closeMenu() {
    nav.classList.remove("is-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // Tapping a link, pressing Escape, or clicking away all close it.
  links.forEach(function (link) {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });

  document.addEventListener("click", function (event) {
    if (!nav.contains(event.target)) closeMenu();
  });

  /* ---------- Active link highlighting ----------
     Rather than guessing from scroll position, watch the sections
     themselves and mark whichever one is nearest the top of the
     viewport. The rootMargin pulls the detection line down below the
     nav and up from the bottom, so exactly one section qualifies at
     a time in the common case. */
  const sections = links
    .map(function (link) {
      const id = link.getAttribute("href").slice(1);
      const el = document.getElementById(id);
      return el ? { link: link, el: el } : null;
    })
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    const visible = new Map();

    const spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          visible.set(entry.target, entry.isIntersecting);
        });

        let current = null;
        for (let i = 0; i < sections.length; i++) {
          if (visible.get(sections[i].el)) {
            current = sections[i];
            break;
          }
        }

        sections.forEach(function (item) {
          item.link.classList.toggle("is-active", item === current);
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    sections.forEach(function (item) {
      spy.observe(item.el);
    });
  }

  /* ---------- Click-to-load map ----------
     The Google Maps embed is only fetched when someone asks for it,
     so it cannot slow the page down or delay the shadow video for
     the majority of guests who never scroll to the venue map. */
  const mapButton = document.querySelector(".map-placeholder");

  if (mapButton) {
    mapButton.addEventListener("click", function () {
      const frame = document.createElement("iframe");
      frame.src = mapButton.dataset.mapSrc;
      frame.title = mapButton.dataset.mapTitle || "Map";
      frame.loading = "lazy";
      frame.referrerPolicy = "no-referrer-when-downgrade";
      frame.allowFullscreen = true;
      mapButton.replaceWith(frame);
    });
  }

  /* ---------- 3. Section reveals ----------
     The .reveal class is added here rather than in the HTML so that
     if JavaScript never runs, nothing is ever hidden. */
  const panels = Array.from(document.querySelectorAll(".section-inner"));

  if (!reduced && "IntersectionObserver" in window && panels.length) {
    panels.forEach(function (panel) {
      panel.classList.add("reveal");
    });

    const revealer = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.06 }
    );

    panels.forEach(function (panel) {
      revealer.observe(panel);
    });
  }
})();
