/*
 * Timekeeper – Google Apps Script backend
 *
 * SETUP
 * -----
 * 1. Create a new Google Sheet.
 * 2. Add a header row in A1:F1:
 *      Project | Date | Start | End | Description | Submitted At
 * 3. Open  Extensions → Apps Script.
 * 4. Replace the contents of Code.gs with this entire file.
 * 5. Click  Deploy → New deployment.
 *      - Type: Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 6. Authorise when prompted, then copy the Web app URL.
 * 7. Paste that URL into  SHEET_URL  in  web/timekeeper/app.js.
 * 8. Push to main (auto-deploys to GitHub Pages).
 *
 * Each POST from the PWA sends JSON:
 *   { project, date, start, end, description, submitted_at }
 * and this script appends one row to the active sheet.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    sheet.appendRow([
      data.project      || "",
      data.date          || "",
      data.start         || "",
      data.end           || "",
      data.description   || "",
      data.submitted_at  || new Date().toISOString(),
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
