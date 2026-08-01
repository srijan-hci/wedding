/* ============================================================
   RSVP FORM

   GitHub Pages only serves files. It cannot receive a form
   submission, so the form posts to a small Google Apps Script that
   you own, which writes a row into your own Google Sheet.

   ----------------------------------------------------------------
   SETUP: do this once, then paste the URL below.

   1. Create a new Google Sheet. Name it something like
      "Wedding RSVPs".
   2. In that sheet, choose Extensions > Apps Script.
   3. Delete whatever code is there and paste in the script from
      google-apps-script.js in this repo.
   4. Click Deploy > New deployment.
   5. Next to "Select type", click the gear and choose "Web app".
   6. Set "Execute as" to Me, and "Who has access" to Anyone.
   7. Click Deploy, then Authorize access and allow it. Google will
      warn that the app is not verified: that is expected, because
      you wrote it. Click Advanced, then "Go to ... (unsafe)".
   8. Copy the Web app URL. It ends in /exec.
   9. Paste it between the quotes on the ENDPOINT line below.

   To change the questions later, edit the form in index.html and
   add the matching column in the Apps Script.
   ---------------------------------------------------------------- */

/* PASTE YOUR APPS SCRIPT WEB APP URL HERE, between the quotes.
   Until you do, the form will politely tell people to email instead,
   rather than silently losing their reply. */
var RSVP_ENDPOINT = "";

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

  /* ---------- Hide the "who and what" questions for a no ----------
     Someone who cannot come should not be asked about dietary
     requirements. Disabling the inputs as well as hiding them keeps
     them out of the submitted data and out of the tab order. */
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

    var data = new FormData(form);
    // Checkboxes arrive as repeated entries; join them into one cell.
    var body = new URLSearchParams();
    var days = [];

    data.forEach(function (value, key) {
      if (key === "website") return;
      if (key === "days") {
        days.push(value);
        return;
      }
      body.append(key, value);
    });

    body.append("days", days.join(", "));
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
        showThankYou();
      })
      .catch(function () {
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
