/* ============================================================
   RSVP: ONE QUESTION AT A TIME

   This is progressive enhancement in the strict sense. The page ships
   one ordinary form with every question visible and a working submit
   button. If this file never loads, or fails, the form still works: the
   only thing lost is the pacing.

   Submission is NOT handled here. rsvp.js owns that, along with the
   endpoint and the fallback email, and it binds to the same #rsvp-form.
   This file only decides which question you are looking at.

   Two deliberate choices, both taken from measuring the reference the
   owner picked:

     * The URL does not change per step. A step is not a place; it is a
       position in one form. Adding history entries would mean Back
       leaves the flow half-finished and, on a reload, half-lost.
     * Enter advances from a single-line field. Multi-line fields keep
       Enter for what it is for.
   ============================================================ */
(function () {
  var form = document.getElementById("rsvp-form");
  if (!form) return;

  var steps = Array.prototype.slice.call(form.querySelectorAll("[data-step]"));
  if (steps.length < 2) return;

  var progress = form.querySelector("[data-progress]");
  var backBtn = form.querySelector("[data-back]");
  var nextBtn = form.querySelector("[data-next]");
  var sendBtn = document.getElementById("rsvp-submit");
  var status = document.getElementById("rsvp-status");
  var reviewList = form.querySelector("[data-review-list]");

  var index = 0;

  form.classList.add("is-stepped");
  if (progress) progress.hidden = false;
  if (nextBtn) nextBtn.hidden = false;

  /* A step counts as live unless something around it has been hidden.
     rsvp.js hides #rsvp-attending-details for anyone who cannot come, so
     the "how many" and "food" questions drop out of the flow without
     this file needing to know why.

     ⚠️ This deliberately does NOT look at the step's own `hidden`
     attribute, and show() deliberately does not set one. Which step you
     are looking at is a class, `.is-current`, and `hidden` is left to
     mean one thing only: "this question does not apply to you". When
     both meanings shared the same attribute, hiding the five steps you
     are not on made live() report a single step and the counter read
     "1 of 1" from the second question onwards. */
  function live() {
    return steps.filter(function (step) {
      return !step.closest("[hidden]");
    });
  }

  function labelFor(field) {
    var id = field.id;
    var label = id && form.querySelector("label[for='" + id + "']");
    if (label) return label.textContent.trim();
    var legend = field.closest("fieldset");
    legend = legend && legend.querySelector(".rsvp-q");
    if (!legend) return field.name;
    var clone = legend.cloneNode(true);
    var kicker = clone.querySelector(".rsvp-kicker");
    if (kicker) kicker.remove();
    return clone.textContent.trim();
  }

  /* The review step is built from the form itself rather than from a
     parallel list of questions, so it can never drift out of step with
     what was actually asked. */
  function buildReview() {
    if (!reviewList) return;
    reviewList.textContent = "";

    live().forEach(function (step) {
      if (step.hasAttribute("data-review")) return;

      var fields = Array.prototype.slice.call(
        step.querySelectorAll("input, select, textarea")
      );

      fields.forEach(function (field) {
        if (field.disabled || field.type === "hidden") return;

        var value;
        if (field.type === "radio") {
          if (!field.checked) return;
          value = field.parentElement.textContent.trim();
        } else {
          value = (field.value || "").trim();
        }
        if (!value) return;

        var row = document.createElement("div");
        var dt = document.createElement("dt");
        var dd = document.createElement("dd");
        dt.textContent = labelFor(field);
        dd.textContent = value;
        row.appendChild(dt);
        row.appendChild(dd);
        reviewList.appendChild(row);
      });
    });

    if (!reviewList.children.length) {
      var empty = document.createElement("p");
      empty.className = "rsvp-help";
      empty.textContent = "Nothing filled in yet.";
      reviewList.appendChild(empty);
    }
  }

  function show(next, moveFocus) {
    var items = live();
    index = Math.max(0, Math.min(next, items.length - 1));

    steps.forEach(function (step) {
      step.classList.remove("is-current");
    });

    var current = items[index];
    current.classList.add("is-current");

    var last = index === items.length - 1;
    if (last) buildReview();

    if (progress) {
      progress.textContent = index + 1 + " of " + items.length;
    }
    if (backBtn) backBtn.hidden = index === 0;
    if (nextBtn) nextBtn.hidden = last;
    if (sendBtn) sendBtn.hidden = !last;

    if (status) status.textContent = "";

    /* Focus moves to the question, not the first input. Announcing "What
       is your name?" before the field it belongs to is the difference
       between a screen reader user knowing where they are and hearing a
       bare text box. */
    if (moveFocus) {
      var heading = current.querySelector(".rsvp-q");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function valid(step) {
    var fields = Array.prototype.slice.call(
      step.querySelectorAll("input, select, textarea")
    );
    var ok = true;

    fields.forEach(function (field) {
      if (field.disabled) return;
      if (!field.checkValidity()) ok = false;
    });

    if (!ok) {
      form.classList.add("was-validated");
      var bad = fields.filter(function (f) {
        return !f.disabled && !f.checkValidity();
      })[0];
      if (bad) bad.reportValidity();
      if (status) status.textContent = "Please fill this in before carrying on.";
    }

    return ok;
  }

  function advance() {
    var items = live();
    if (!valid(items[index])) return;
    show(index + 1, true);
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", advance);
  }

  if (backBtn) {
    backBtn.addEventListener("click", function () {
      show(index - 1, true);
    });
  }

  /* Enter advances from a single-line field. In a textarea it stays a
     newline, and on a button it stays a click. */
  form.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;
    var el = event.target;
    if (el.tagName === "TEXTAREA" || el.tagName === "BUTTON") return;
    if (el.tagName !== "INPUT") return;
    var items = live();
    if (index === items.length - 1) return;
    event.preventDefault();
    advance();
  });

  /* Choosing an answer can change how many steps there are, because
     saying no removes two of them. Re-running show() keeps the counter
     and the buttons honest. rsvp.js has already updated the hidden state
     by the time this listener runs, because it is registered first. */
  form.addEventListener("change", function (event) {
    if (event.target.name !== "attending") return;
    show(index, false);
  });

  show(0, false);
})();
