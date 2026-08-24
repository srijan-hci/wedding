/* ============================================================
   RSVP FORM

   GitHub Pages only serves files. It cannot receive a form
   submission, so the form posts to a small Google Apps Script that
   you own, which writes a row into your own Google Sheet.

   ----------------------------------------------------------------
   SETUP: do this once, then paste the URL below.

   The full walkthrough lives at the top of google-apps-script.js
   in this repo. The short version:

   1. Open the wedding planning spreadsheet and choose
      Extensions > Apps Script.
   2. Paste in the contents of google-apps-script.js and save.
   3. Deploy > New deployment > type "Web app".
   4. Execute as Me, Who has access Anyone. Deploy, then authorise.
   5. Copy the Web app URL. It ends in /exec.
   6. Paste it between the quotes on the ENDPOINT line below.

   Replies land in the "RSVPs" tab. No other tab is touched.

   To change the questions later, edit the form in rsvp/index.html
   and add the matching column in the Apps Script.
   ---------------------------------------------------------------- */

/* The Apps Script Web app URL. Deployed from google-apps-script.js;
   writes one row into the "RSVPs" tab of the planning spreadsheet.
   If this is ever emptied, the form politely tells people to email
   instead, rather than silently losing their reply. */
var RSVP_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbyWqY8AlldZPx5sPeKqTJSxCBBQp4Z9-QqEuGalQh5a90mQveM26D89OS-EyXGd6iVHpg/exec";

/* Optional. The RSVP posts with mode: "no-cors", so a "sent" here means
   delivered, not confirmed: the browser will not let us read the reply,
   so we cannot tell a written row from a script that threw. Every
   message below therefore offers a way to reach a human.

   Left empty, those messages say "reach out to us" rather than naming an
   address that does not exist, which is worse than vague. Put a real
   address in and all four start naming it again, with no other edit. */
var RSVP_FALLBACK_EMAIL = "";

/* The one phrase every message shares, so the address only has to be
   worded in a single place. */
function contactUs() {
  return RSVP_FALLBACK_EMAIL
    ? "email us at " + RSVP_FALLBACK_EMAIL
    : "reach out to us";
}

(function () {
  var form = document.getElementById("rsvp-form");
  if (!form) return;

  var status = document.getElementById("rsvp-status");
  var submit = document.getElementById("rsvp-submit");
  var details = document.getElementById("rsvp-attending-details");
  var attendingInputs = form.querySelectorAll("input[name='attending']");
  var roomInputs = form.querySelectorAll("input[name='room']");
  var nights = document.getElementById("rsvp-nights");
  var nightInputs = nights
    ? Array.prototype.slice.call(
        nights.querySelectorAll("input[type='checkbox']")
      )
    : [];

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = "form-status" + (kind ? " is-" + kind : "");
  }

  /* ---------- Hide the "who and where" questions for a no ----------
     Someone who cannot come should not be asked how many are coming or
     whether they want somewhere to stay. Disabling the inputs as well as
     hiding them keeps them out of the submitted data and out of the tab
     order, and it is also what stops the required accommodation choice
     from blocking a "no" at submit: constraint validation skips disabled
     fields. */
  function syncDetails() {
    var choice = form.querySelector("input[name='attending']:checked");
    var coming = !choice || choice.value === "Yes";

    details.hidden = !coming;
    details.querySelectorAll("input, select, textarea").forEach(function (el) {
      el.disabled = !coming;
    });
  }

  /* ---------- Which nights ----------
     Only asked of someone who wants a bed booked, and only ever as a
     follow-up inside the accommodation step: this reveals a block, never
     a seventh question. Hidden and disabled together, for the same
     reasons as above.

     ⚠️ Must run AFTER syncDetails(), which enables every control inside
     the details block including these. Run the other way round and
     saying "yes, I'm coming" would switch the nights back on regardless
     of the accommodation answer.

     A checkbox group has no group-level `required` in HTML: `required`
     on a checkbox means that one box must be ticked. So it goes on every
     box while none is ticked and comes off all of them the moment one
     is, which is what makes "at least one" work with checkValidity(). */
  function syncNights() {
    if (!nights) return;

    var choice = form.querySelector("input[name='room']:checked");
    var wanted = !details.hidden && !!choice && choice.value === "Yes";

    nights.hidden = !wanted;

    var picked = nightInputs.some(function (el) {
      return el.checked;
    });

    nightInputs.forEach(function (el) {
      el.disabled = !wanted;
      el.required = wanted && !picked;
    });
  }

  function sync() {
    syncDetails();
    syncNights();
  }

  attendingInputs.forEach(function (input) {
    input.addEventListener("change", sync);
  });
  roomInputs.forEach(function (input) {
    input.addEventListener("change", syncNights);
  });
  nightInputs.forEach(function (input) {
    input.addEventListener("change", syncNights);
  });
  sync();

  /* ---------- Submitting ---------- */
  form.addEventListener("submit", function (event) {
    event.preventDefault();

    // Silently drop anything that filled in the honeypot.
    if (form.elements.website && form.elements.website.value) return;

    // Let the browser do the validating, then show its own messages.
    form.classList.add("was-validated");
    if (!form.checkValidity()) {
      setStatus("Please fill in the highlighted fields.", "error");
      form.reportValidity();
      return;
    }

    if (!RSVP_ENDPOINT) {
      setStatus(
        "This form is not connected yet. Please " +
          contactUs() +
          " and we will add you by hand.",
        "error"
      );
      return;
    }

    submit.disabled = true;
    setStatus("Sending, please wait...");

    /* The round trip to Apps Script takes about five seconds on a good
       connection, and considerably longer on a slow one. Deliberately no
       timeout: cutting it off would report a failure for a reply that was
       actually delivered, and the guest would send it twice. Instead just
       say so, so a slow connection does not look like a frozen button. */
    var stillGoing = setTimeout(function () {
      setStatus("Still sending. This can take a moment on a slow connection.");
    }, 6000);

    var data = new FormData(form);
    var body = new URLSearchParams();

    /* ⚠️ A checkbox group sends one entry per ticked box, so "nights"
       arrives three times over. Apps Script's e.parameter only ever hands
       back the FIRST value for a repeated key, so posting them as-is
       would silently record one night and drop the rest. Joining them
       here means the sheet gets one readable cell and the script stays a
       plain key-to-column map. */
    var multi = {};

    data.forEach(function (value, key) {
      if (key === "website") return;
      multi[key] = multi[key] ? multi[key] + ", " + value : value;
    });

    Object.keys(multi).forEach(function (key) {
      body.append(key, multi[key]);
    });

    body.append("submittedAt", new Date().toISOString());

    /* Sent as URL-encoded form data on purpose. That counts as a
       "simple request", so the browser does not send a CORS preflight
       that Apps Script would reject.

       The trade-off is `mode: "no-cors"`: the request goes through and
       the row is written, but the browser refuses to let us read the
       reply. So a success here means "delivered", not "confirmed by
       the server". That is why the thank-you also gives an email
       address to fall back on. */
    fetch(RSVP_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    })
      .then(function () {
        clearTimeout(stillGoing);
        showThankYou();
      })
      .catch(function () {
        clearTimeout(stillGoing);
        submit.disabled = false;
        setStatus(
          "Something went wrong sending that. Please try again, or " +
            contactUs() +
            ".",
          "error"
        );
      });
  });

  function showThankYou() {
    var name = (form.elements.name.value || "").trim().split(" ")[0];
    var choice = form.querySelector("input[name='attending']:checked");
    var coming = choice && choice.value === "Yes";

    var done = document.createElement("div");
    done.className = "rsvp-done";
    done.setAttribute("role", "status");

    var title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = name ? "Thank you, " + name : "Thank you";

    var message = document.createElement("p");
    message.textContent = coming
      ? "We have got your reply and we cannot wait to see you in February. If anything changes, please " +
        contactUs() +
        "."
      : "We have got your reply. We will miss you, but thank you for letting us know. If your plans change, please " +
        contactUs() +
        ".";

    done.appendChild(title);
    done.appendChild(message);
    form.replaceWith(done);
    done.scrollIntoView({ block: "center", behavior: "smooth" });
  }
})();
