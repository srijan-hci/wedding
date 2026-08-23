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

/* Shown whenever the form cannot be sent, so a reply is never lost. */
var RSVP_FALLBACK_EMAIL = "hello@akriti-srijan.com";

(function () {
  var form = document.getElementById("rsvp-form");
  if (!form) return;

  var status = document.getElementById("rsvp-status");
  var submit = document.getElementById("rsvp-submit");
  var details = document.getElementById("rsvp-attending-details");
  var attendingInputs = form.querySelectorAll("input[name='attending']");

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = "form-status" + (kind ? " is-" + kind : "");
  }

  /* ---------- Hide the "who and where" questions for a no ----------
     Someone who cannot come should not be asked how many are coming or
     whether they want a room. Disabling the inputs as well as hiding
     them keeps them out of the submitted data and out of the tab order,
     and it is also what stops the required room choice from blocking a
     "no" at submit: constraint validation skips disabled fields. */
  function syncDetails() {
    var choice = form.querySelector("input[name='attending']:checked");
    var coming = !choice || choice.value === "Yes";

    details.hidden = !coming;
    details.querySelectorAll("input, select, textarea").forEach(function (el) {
      el.disabled = !coming;
    });
  }

  attendingInputs.forEach(function (input) {
    input.addEventListener("change", syncDetails);
  });
  syncDetails();

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
        "This form is not connected yet. Please email us at " +
          RSVP_FALLBACK_EMAIL +
          " and we will add you by hand.",
        "error"
      );
      return;
    }

    submit.disabled = true;
    setStatus("Sending...");

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

    data.forEach(function (value, key) {
      if (key === "website") return;
      body.append(key, value);
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
          "Something went wrong sending that. Please try again, or email us at " +
            RSVP_FALLBACK_EMAIL +
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
      ? "We have got your reply and we cannot wait to see you in February. If anything changes, or you did not mean to send that, email us at " +
        RSVP_FALLBACK_EMAIL +
        "."
      : "We have got your reply. We will miss you, but thank you for letting us know. If your plans change, email us at " +
        RSVP_FALLBACK_EMAIL +
        ".";

    done.appendChild(title);
    done.appendChild(message);
    form.replaceWith(done);
    done.scrollIntoView({ block: "center", behavior: "smooth" });
  }
})();
