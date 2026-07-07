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

var CALENDAR_ID = "yourpartyporch@gmail.com";  // "" = default calendar; pinned to your Party Porch calendar
var EVENT_HOURS = 3;            // block length: ~2h play + setup/teardown
var INVITE_CUSTOMER = true;     // email the customer a calendar invite too

// --- Confirmation email + deposit --------------------------------------------
var BUSINESS_NAME  = "The Party Porch";
var BUSINESS_EMAIL = "yourpartyporch@gmail.com";   // shown as reply-to / signature
var BUSINESS_PHONE = "";                            // optional, e.g. "(713) 555-0142" — shows in the email if set
var DEPOSIT_AMOUNT = 50;                            // deposit dollars to reserve the date
var DEPOSIT_LINK   = "";                            // PASTE your Stripe/PayPal/Venmo/Cash App link here; blank = email says we'll text a link
var SEND_CONFIRM_EMAIL = true;                      // master switch for the auto confirmation email

/**
 * Availability check (used by the website's date picker + cart).
 * The site calls this via JSONP:  GET ...?action=availability&date=YYYY-MM-DD&callback=fn
 *
 * Inventory model: you own ONE of each item to start, so an item is UNAVAILABLE
 * on a date once it's already booked that day. Each booking event stores its item
 * keys in the description as "Items: nerf,movie,photobooth" — we read those back.
 *
 * A whole date is CLOSED (nothing available) if you add an all-day event that day
 * whose title contains BLOCKED / CLOSED / UNAVAILABLE / VACATION (your manual day-off).
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === "availability") {
    return reply(availability(p.date), p.callback);
  }
  return reply({ ok: true, service: "Party Porch availability" }, p.callback);
}

function availability(dateStr) {
  try {
    var start = parseStart(dateStr, "00:00"); start.setHours(0, 0, 0, 0);
    if (isNaN(start.getTime())) return { ok: false, error: "bad date" };
    var end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    var cal = CALENDAR_ID ? CalendarApp.getCalendarById(CALENDAR_ID)
                          : CalendarApp.getDefaultCalendar();
    var evs = cal.getEvents(start, end);
    var closed = false, booked = {};
    for (var i = 0; i < evs.length; i++) {
      var t = String(evs[i].getTitle() || "").toUpperCase();
      if (t.indexOf("BLOCKED") > -1 || t.indexOf("CLOSED") > -1 ||
          t.indexOf("UNAVAILABLE") > -1 || t.indexOf("VACATION") > -1) closed = true;
      var m = String(evs[i].getDescription() || "").match(/Items?:[ \t]*([a-z0-9_,\t ]+)/i);
      if (m) {
        m[1].split(",").forEach(function (k) {
          k = k.trim().toLowerCase();
          if (k) booked[k] = true;
        });
      }
    }
    return { ok: true, date: dateStr, closed: closed, booked: Object.keys(booked) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

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
      "Items: "    + (d.items    || ""),
      "Cart: "     + (d.cart     || ""),
      "Service: "  + (d.service  || ""),
      "Players: "  + (d.players  || ""),
      "Add-ons: "  + (d.addons   || "None"),
      "Estimate: " + (d.estimate || ""),
      "",
      "Customer: " + (d.name  || ""),
      "Phone: "    + (d.phone || ""),
      "Email: "    + (d.email || ""),
      "Area/ZIP: " + (d.zip   || ""),
      "Address: "  + (d.address || ""),
      "Notes: "    + (d.notes || "")
    ].join("\n");

    var opts = { description: desc, location: (d.address || d.zip || "") };
    if (INVITE_CUSTOMER && d.email && /@/.test(d.email)) {
      opts.guests = d.email;
      opts.sendInvites = true;
    }

    cal.createEvent(title, start, end, opts);

    if (SEND_CONFIRM_EMAIL && d.email && /@/.test(d.email)) {
      try { sendConfirmationEmail(d); } catch (mailErr) { /* don't fail the booking on email trouble */ }
    }

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

/** Sends the customer an automated booking-received email with a deposit link. */
function sendConfirmationEmail(d) {
  var first = String(d.name || "there").split(" ")[0];
  var when  = prettyDate(d.date);
  var cart  = d.cart || d.service || "your party";
  var est   = d.estimate ? String(d.estimate) : "";
  var phoneLine = BUSINESS_PHONE ? ("<br>Call/text: <strong>" + BUSINESS_PHONE + "</strong>") : "";

  var depositBlock;
  if (DEPOSIT_LINK) {
    depositBlock =
      '<p style="margin:22px 0 10px">To lock in your date, please place your <strong>$' + DEPOSIT_AMOUNT +
      ' refundable deposit</strong> (applied to your total):</p>' +
      '<p style="text-align:center;margin:0 0 26px">' +
        '<a href="' + DEPOSIT_LINK + '" style="background:#ff5a5f;color:#fff;text-decoration:none;' +
        'font-weight:700;padding:14px 30px;border-radius:999px;display:inline-block;font-size:16px">' +
        'Pay $' + DEPOSIT_AMOUNT + ' deposit &rarr;</a></p>' +
      '<p style="font-size:13px;color:#667">Your date isn\u2019t reserved until the deposit is received.</p>';
  } else {
    depositBlock =
      '<p style="margin:22px 0 10px">To lock in your date, we\u2019ll send you a secure link for the ' +
      '<strong>$' + DEPOSIT_AMOUNT + ' refundable deposit</strong> (applied to your total) shortly.</p>';
  }

  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">' +
      '<h2 style="color:#ff5a5f;margin:0 0 6px">You\u2019re on the calendar, ' + esc(first) + '! 🎉</h2>' +
      '<p style="margin:0 0 18px">Thanks for booking with <strong>' + BUSINESS_NAME + '</strong>. ' +
      'We\u2019ve received your request and here\u2019s what we have:</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:15px">' +
        row("Party", esc(cart)) +
        (when ? row("Date", esc(when)) : "") +
        (d.time ? row("Time", esc(d.time)) : "") +
        (d.address ? row("Location", esc(d.address)) : "") +
        (d.players ? row("Guests", esc(d.players)) : "") +
        (d.addons && d.addons !== "None" ? row("Add-ons", esc(d.addons)) : "") +
        (est ? row("Estimate", esc(est)) : "") +
      '</table>' +
      depositBlock +
      '<hr style="border:none;border-top:1px solid #eee;margin:22px 0">' +
      '<p style="font-size:13px;color:#667;line-height:1.6">' +
        'Delivery is free within 12 miles of 77018 (a small fee applies beyond that). ' +
        'Setup is available as a +$40 add-on. We\u2019ll confirm final details before your date.' +
        phoneLine +
      '</p>' +
      '<p style="margin-top:20px">See you soon,<br><strong>' + BUSINESS_NAME + '</strong></p>' +
    '</div>';

  var subject = "🎉 " + BUSINESS_NAME + " — booking received" + (when ? " for " + when : "");
  MailApp.sendEmail({
    to: d.email,
    replyTo: BUSINESS_EMAIL,
    name: BUSINESS_NAME,
    subject: subject,
    htmlBody: html,
    body: "Thanks for booking with " + BUSINESS_NAME + "! We received your request for " + cart +
          (when ? " on " + when : "") + ". " +
          (DEPOSIT_LINK ? ("Place your $" + DEPOSIT_AMOUNT + " deposit here: " + DEPOSIT_LINK)
                        : ("We'll send a secure link for your $" + DEPOSIT_AMOUNT + " deposit shortly."))
  });
}

function row(label, val) {
  return '<tr><td style="padding:6px 0;color:#667;width:110px">' + label +
         '</td><td style="padding:6px 0;font-weight:600">' + val + '</td></tr>';
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** "2026-09-12" -> "Saturday, September 12, 2026" (falls back to the raw string). */
function prettyDate(dateStr) {
  var p = String(dateStr || "").split("-");
  var y = parseInt(p[0], 10), m = parseInt(p[1], 10) - 1, day = parseInt(p[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(day)) return dateStr || "";
  var days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  var mons = ["January","February","March","April","May","June","July","August",
              "September","October","November","December"];
  var dt = new Date(y, m, day);
  return days[dt.getDay()] + ", " + mons[m] + " " + day + ", " + y;
}

function reply(obj, callback) {
  var body = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + body + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}
