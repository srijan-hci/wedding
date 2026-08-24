/* ============================================================
   GOOGLE APPS SCRIPT: RSVP receiver

   This file does NOT run on the website. It is the code you paste
   into Google Apps Script so that RSVPs land in your own Google
   Sheet. It lives in the repo purely so it is not lost.

   It writes into the "RSVPs" tab of the wedding planning
   spreadsheet. It never reads, edits or touches any other tab,
   so the guest list is safe.

   ----------------------------------------------------------------
   HOW TO SET IT UP (about five minutes, no coding needed)

   1.  Open the wedding planning spreadsheet:
       https://docs.google.com/spreadsheets/d/1xV8bFDqyMMbiC_yCEdOb3N2A32cIWFlQJVh0JY8Ejl0/edit
       The "RSVPs" tab already exists with its heading row.

   2.  In the menu, choose  Extensions > Apps Script.
       A code editor opens in a new tab.

   3.  Select everything in that editor and delete it, then copy
       this entire file and paste it in.

   4.  Click the save icon (or press Cmd+S).

   5.  Click  Deploy > New deployment  in the top right.

   6.  Next to "Select type", click the gear icon and pick
       "Web app".

   7.  Fill in:
         Description      RSVP receiver
         Execute as       Me
         Who has access   Anyone
       "Anyone" is required: your guests are not signed in to your
       Google account. They can only ever add a row, never read one.

   8.  Click Deploy. Google will ask you to authorise it. It will
       warn that the app "isn't verified", which is expected,
       because you just wrote it yourself. Click Advanced, then
       "Go to ... (unsafe)", then Allow.

   9.  Copy the "Web app" URL it shows you. It ends with /exec.

   10. Open rsvp.js in this repo and paste that URL between the
       quotes on the RSVP_ENDPOINT line.

   11. Visit that /exec URL in a browser. It should say
       "RSVP endpoint is running." That confirms step 8 worked.

   IMPORTANT: if you ever edit this script, you must redeploy it
   for the change to take effect. Use
   Deploy > Manage deployments > pencil icon > Version: New version
   > Deploy. Creating a brand new deployment instead would give you
   a different URL.
   ---------------------------------------------------------------- */

/* The column order of the RSVPs tab. The left name must match the
   `name` attribute of a field in rsvp/index.html; the right one is
   the heading shown in the sheet. Add a field in both places and it
   starts being recorded. Anything a guest sends that is not listed
   here is ignored. */
var COLUMNS = [
  ["submittedAt", "Submitted"],
  ["name", "Name"],
  ["email", "Email"],
  ["attending", "Attending"],
  ["guests", "Party size"],
  ["room", "Accommodation"],
  ["note", "Note"],
  /* ⚠️ Deliberately last, not next to "Accommodation" where it belongs
     by meaning. Rows are written by POSITION, so slotting a new column
     into the middle would leave every reply already in the sheet with
     its note sitting under a heading that now says "Nights". Adding at
     the end cannot disturb anything already there. Move it by hand in
     the sheet later if the order matters, and move it here to match. */
  ["nights", "Nights"]
];

/* The tab to write into. The emoji is part of the name. */
var SHEET_NAME = "\uD83D\uDC8C RSVPs";

/* Runs every time the website posts the form. */
function doPost(e) {
  // A lock stops two people submitting at the same instant from
  // overwriting each other's row.
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    var sheet = getSheet_();
    var params = (e && e.parameter) || {};

    var row = COLUMNS.map(function (column) {
      return params[column[0]] || "";
    });

    sheet.getRange(nextRow_(sheet), 1, 1, row.length).setValues([row]);
    return json_({ result: "ok" });
  } catch (error) {
    return json_({ result: "error", message: String(error) });
  } finally {
    lock.releaseLock();
  }
}

/* Visiting the deployment URL in a browser hits this. Useful only
   as a quick "is it alive?" check. */
function doGet() {
  return json_({ result: "ok", message: "RSVP endpoint is running." });
}

/* The row to write the next reply into.

   ⚠️ Deliberately not appendRow(). appendRow() writes below the last row
   the grid has ever been *touched* in, which is not the same as the last
   row with anything in it. Clearing a row by hand leaves cells that are
   empty but still counted, so appendRow() skips past them and every
   future reply lands further down an increasingly empty sheet. Reading
   the values back and finding the last one with real content in it costs
   one extra read and heals that instead of compounding it. */
function nextRow_(sheet) {
  var last = sheet.getLastRow();
  if (last < 1) return 1;

  var values = sheet.getRange(1, 1, last, COLUMNS.length).getValues();

  for (var r = values.length - 1; r >= 0; r--) {
    for (var c = 0; c < values[r].length; c++) {
      if (String(values[r][c]).trim() !== "") {
        return r + 2; // r is 0-based, and we want the row after it.
      }
    }
  }

  return 1; // Nothing in the tab at all.
}

/* Finds the RSVPs tab, creating it with a header row the first
   time. The header is frozen so it stays visible as the list grows. */
function getSheet_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(SHEET_NAME);

  /* If the tab has been renamed, fall back to any tab with "RSVP" in
     its name. Without this, a rename as small as dropping the emoji
     would quietly start a second, empty tab beside the real one, and
     replies would look like they had vanished. */
  if (!sheet) {
    var all = book.getSheets();
    for (var i = 0; i < all.length; i++) {
      if (all[i].getName().toUpperCase().indexOf("RSVP") !== -1) {
        sheet = all[i];
        break;
      }
    }
  }

  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
  }

  /* The heading row, kept in step with COLUMNS on every run rather than
     only when the tab is empty.

     ⚠️ It has to be every run. A "first run only" check never fires on a
     tab whose headings were typed by hand at setup, which is how this
     one was made, so renaming a field would leave the old heading
     sitting above the new data. That is not hypothetical: when the
     dietary question became the room question, column F would have
     filled up with "Yes" and "No" under a heading that still read
     "Dietary needs", with nothing anywhere to say so.

     Only written when it actually differs, so a sheet that is already
     correct is not rewritten on every single reply. setValues does not
     clear formatting, so the bold set below survives a correction. */
  var headers = COLUMNS.map(function (column) {
    return column[1];
  });

  var current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var stale = false;
  for (var h = 0; h < headers.length; h++) {
    if (String(current[h]).trim() !== headers[h]) {
      stale = true;
      break;
    }
  }

  if (stale) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  /* Also safe to run every time, and separate for the same reason. */
  if (sheet.getFrozenRows() < 1) {
    sheet.getRange(1, 1, 1, COLUMNS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
