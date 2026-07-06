/**
 * The Party Porch — Google Calendar booking webhook
 * ---------------------------------------------------
 * Paste this into a Google Apps Script project (script.google.com), deploy it
 * as a Web App, and put the resulting /exec URL into GCAL_WEBHOOK_URL in the
 * booking site. Every booking then creates an event on your Google Calendar
 * and (optionally) emails the customer a calendar invite.
 *
 * SETUP (2 minutes):
 *  1. Go to https://script.google.com  ->  New project.
 *  2. Delete the sample code, paste ALL of this file, click Save.
 *  3. Deploy -> New deployment -> type "Web app".
 *       - Description: Party Porch bookings
 *       - Execute as: Me (yourpartyporch@gmail.com)
 *       - Who has access: Anyone
 *     Click Deploy, authorize when prompted (choose your Gmail, Advanced ->
 *     "Go to project (unsafe)" -> Allow — it's your own script).
 *  4. Copy the Web app URL (ends in /exec) and paste it into GCAL_WEBHOOK_URL
 *     in website/index.html (and index-wordpress.html).
 *
 * To use a calendar OTHER than your default, set CALENDAR_ID below to that
 * calendar's ID (Calendar settings -> "Integrate calendar" -> Calendar ID).
 */

var CALENDAR_ID = "";           // "" = your default calendar; or paste a calendar ID
var EVENT_HOURS = 3;            // block length: ~2h play + setup/teardown
var INVITE_CUSTOMER = true;     // email the customer a calendar invite too

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var cal = CALENDAR_ID ? CalendarApp.getCalendarById(CALENDAR_ID)
                          : CalendarApp.getDefaultCalendar();

    var start = parseStart(d.date, d.time);
    var end = new Date(start.getTime() + EVENT_HOURS * 60 * 60 * 1000);

    var title = "🎉 Party Porch — " + (d.name || "Booking") +
                " (" + (d.players || "") + ")";

    var desc = [
      "Service: "  + (d.service  || ""),
      "Players: "  + (d.players  || ""),
      "Add-ons: "  + (d.addons   || "None"),
      "Estimate: " + (d.estimate || ""),
      "",
      "Customer: " + (d.name  || ""),
      "Phone: "    + (d.phone || ""),
      "Email: "    + (d.email || ""),
      "Area/ZIP: " + (d.zip   || ""),
      "Notes: "    + (d.notes || "")
    ].join("\n");

    var opts = { description: desc, location: (d.zip || "") };
    if (INVITE_CUSTOMER && d.email && /@/.test(d.email)) {
      opts.guests = d.email;
      opts.sendInvites = true;
    }

    cal.createEvent(title, start, end, opts);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/** Builds a Date from an <input type="date"> value + optional <input type="time">. */
function parseStart(dateStr, timeStr) {
  var p = String(dateStr || "").split("-");
  var y = parseInt(p[0], 10), m = parseInt(p[1], 10) - 1, day = parseInt(p[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(day)) {
    // No valid date supplied — default to tomorrow at noon so nothing is lost.
    var t = new Date(); t.setDate(t.getDate() + 1); t.setHours(12, 0, 0, 0);
    return t;
  }
  var hh = 12, mm = 0;
  if (timeStr && timeStr.indexOf(":") > -1) {
    var tp = timeStr.split(":");
    hh = parseInt(tp[0], 10); mm = parseInt(tp[1], 10);
  }
  return new Date(y, m, day, hh, mm, 0);
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
