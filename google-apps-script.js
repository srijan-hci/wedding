/* ============================================================
   GOOGLE APPS SCRIPT: RSVP receiver

   This file does NOT run on the website. It is the code you paste
   into Google Apps Script so that RSVPs land in your own Google
   Sheet. It lives in the repo purely so it is not lost.

   ----------------------------------------------------------------
   HOW TO SET IT UP (about five minutes, no coding needed)

   1.  Go to sheets.new to create a new Google Sheet, and name it
       something like "Wedding RSVPs".

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
       "Go to Wedding RSVPs (unsafe)", then Allow.

   9.  Copy the "Web app" URL it shows you. It ends with /exec.

   10. Open rsvp.js in this repo and paste that URL between the
       quotes on the RSVP_ENDPOINT line.

   IMPORTANT: if you ever edit this script, you must redeploy it
   for the change to take effect. Use
   Deploy > Manage deployments > pencil icon > Version: New version
   > Deploy. Creating a brand new deployment instead would give you
   a different URL.
   ---------------------------------------------------------------- */

/* The column order of your sheet. Add a field here and in the form
   in index.html, and it will start being recorded. */
var COLUMNS = [
  ["submittedAt", "Submitted"],
  ["name", "Name"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["travellingFrom", "Travelling from"],
  ["attending", "Attending"],
  ["guests", "Party size"],
  ["guestNames", "Names of guests"],
  ["days", "Days"],
  ["dietary", "Dietary needs"],
  ["song", "Song request"],
  ["note", "Note"]
];

var SHEET_NAME = "RSVPs";

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

    sheet.appendRow(row);
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

/* Finds the RSVPs tab, creating it with a header row the first
   time. The header is frozen so it stays visible as the list grows. */
function getSheet_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    var headers = COLUMNS.map(function (column) {
      return column[1];
    });
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}
