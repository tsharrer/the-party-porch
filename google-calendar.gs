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
var EVENT_HOURS = 3;            // calendar block for the scheduled party start/referee window
var INVITE_CUSTOMER = true;     // email the customer a calendar invite too

// --- Confirmation email + deposit --------------------------------------------
var BUSINESS_NAME  = "The Party Porch";
var BUSINESS_EMAIL = "yourpartyporch@gmail.com";   // shown as reply-to / signature
var BUSINESS_PHONE = "";                            // optional, e.g. "(713) 555-0142" — shows in the email if set
var SEND_CONFIRM_EMAIL = true;                      // master switch for the auto confirmation email
var NERF_GUIDE_URL = "https://yourpartyporch.com/customer/nerf-party-guide.html";

// --- Text the customer their deposit link (Twilio SMS) -----------------------
// Sends the deposit link by SMS through Twilio. Your Twilio credentials are read
// from Script Properties (never stored in this file / the public repo):
//   Apps Script → Project Settings (gear) → Script Properties → add:
//     TWILIO_ACCOUNT_SID = ACxxxxxxxx...
//     TWILIO_AUTH_TOKEN  = your auth token
//     TWILIO_FROM        = +18325551234   (your Twilio number, E.164 format)
// Set SEND_SMS = false to disable texting.
var SEND_SMS = true;

// Owner-only alerts use comma-separated mobile numbers in OWNER_SMS_TO.
// Run installBookingAutomations() once for reminders around 9 AM Houston time.
var OWNER_REMINDER_HOUR = 9;
var OWNER_REMINDER_PREFIX = "owner_reminder_";
// Customer contacts require the advanced People service and the contacts scope.
var CONTACT_PREFIX = "customer_contact_";

// --- Stripe deposit (percentage of the booking estimate) ---------------------
// The deposit is created dynamically on Stripe for each booking, so it scales
// with the order. Your Stripe SECRET key is read from Script Properties and is
// NEVER stored in this file / the public repo.
//   Set it once:  Apps Script → Project Settings (gear) → Script Properties →
//   Add property   STRIPE_SECRET_KEY = sk_live_...  (use a restricted key that
//   can read/write Customers, Invoices and Invoice Items). Use sk_test_... while testing.
var DEPOSIT_PERCENT = 50;      // % of the estimate collected as the deposit
var DEPOSIT_MIN     = 25;      // never charge less than this ($)
var DEPOSIT_MAX     = 2000;    // safety cap ($)
var DEPOSIT_DAYS    = 7;
var BOOKING_PREFIX = "booking_";
var CURRENCY        = "usd";
var bookingLock;

function getBookingLock() {
  if (!bookingLock) bookingLock = LockService.getScriptLock();
  return bookingLock;
}

function stripeKey() {
  return PropertiesService.getScriptProperties().getProperty("STRIPE_SECRET_KEY") || "";
}

/**
 * Availability check (used by the website's date picker + cart).
 * The site calls this via JSONP:  GET ...?action=availability&date=YYYY-MM-DD&callback=fn
 *
 * Inventory model: you own ONE of each item to start, so an item is UNAVAILABLE
 * on a date once it's already booked that day. Nerf is also unavailable the day
 * after a booking so the overnight rental can be collected, cleaned and reset.
 * Each event stores item keys as "Items: nerf,movie,photobooth" in its description.
 *
 * A whole date is CLOSED (nothing available) if you add an all-day event that day
 * whose title contains BLOCKED / CLOSED / UNAVAILABLE / VACATION (your manual day-off).
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === "availability") {
    return reply(availability(p.date), p.callback);
  }
  if (p.action === "checkout") {
    if (!validBookingId(p.bookingId)) return reply({ ok: false, error: "missing_booking_id" }, p.callback);
    try {
      var booking = loadBooking(p.bookingId);
      if (!booking || booking.status === "preparing") return reply({ ok: false, pending: true }, p.callback);
      if (booking.status === "failed") return reply({ ok: false, error: "invoice_failed" }, p.callback);
      if (booking.status === "quote_requested") return reply({ ok: true, quote: true }, p.callback);
      if (!bookingHoldActive(p.bookingId)) return reply({ ok: false, error: "hold_expired" }, p.callback);
      return reply({ ok: true, url: booking.url, due: booking.due }, p.callback);
    } catch (err) {
      console.error("Deposit lookup failed: " + String(err));
      return reply({ ok: false, error: "invoice_unavailable" }, p.callback);
    }
  }
  return reply({ ok: true, service: "Party Porch availability" }, p.callback);
}

function availability(dateStr) {
  try {
    var start = parseStart(dateStr, "00:00"); start.setHours(0, 0, 0, 0);
    if (isNaN(start.getTime())) return { ok: false, error: "bad date" };
    var end = new Date(start); end.setDate(end.getDate() + 1);
    var previousStart = new Date(start); previousStart.setDate(previousStart.getDate() - 1);
    var cal = CALENDAR_ID ? CalendarApp.getCalendarById(CALENDAR_ID)
                          : CalendarApp.getDefaultCalendar();
    var evs = cal.getEvents(start, end);
    var previousEvs = cal.getEvents(previousStart, start);
    var closed = false, booked = {};
    for (var i = 0; i < evs.length; i++) {
      var t = String(evs[i].getTitle() || "").toUpperCase();
      if (t.indexOf("BLOCKED") > -1 || t.indexOf("CLOSED") > -1 ||
          t.indexOf("UNAVAILABLE") > -1 || t.indexOf("VACATION") > -1) closed = true;
      if (eventHoldActive(evs[i])) eventItemKeys(evs[i]).forEach(function (k) { booked[k] = true; });
    }
    for (var j = 0; j < previousEvs.length; j++) {
      if (eventHoldActive(previousEvs[j]) && eventItemKeys(previousEvs[j]).indexOf("nerf") > -1) booked.nerf = true;
    }
    return { ok: true, date: dateStr, closed: closed, booked: Object.keys(booked) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function eventItemKeys(event) {
  var m = String(event.getDescription() || "").match(/Items?:[ \t]*([a-z0-9_,\t ]+)/i);
  if (!m) return [];
  return m[1].split(",").map(function (k) {
    return k.trim().toLowerCase();
  }).filter(function (k) {
    return !!k;
  });
}

function doPost(e) {
  var tp = (e && e.parameter) || {};

  // Twilio delivery-status callback (form-encoded) → email us if a text FAILED.
  if (tp.MessageStatus || tp.SmsStatus) {
    return handleStatusCallback(tp);
  }
  // Twilio INBOUND SMS to our number (form-encoded) → forward the full,
  // un-redacted text to our email (works without 10DLC; great for OTP codes).
  if (typeof tp.Body !== "undefined" && tp.From) {
    return handleInboundSms(tp);
  }

  var lock = getBookingLock();
  var bookingId = "";
  var booking;
  try {
    lock.waitLock(30000);
    var d = JSON.parse(e.postData.contents);
    bookingId = d.bookingId || Utilities.getUuid();
    if (!validBookingId(bookingId)) throw new Error("Invalid booking ID");
    booking = loadBooking(bookingId);
    if (booking) return json({ ok: booking.status !== "failed" && booking.status !== "released", duplicate: true });
    var due = depositDeadline(d.date, d.time, new Date());
    booking = { status: "preparing", due: due };
    saveBooking(bookingId, booking);
    var depDollars = depositDollars(d.estimate);
    if (!depDollars) {
      MailApp.sendEmail({
        to: BUSINESS_EMAIL,
        subject: BUSINESS_NAME + " - manual quote request " + bookingId,
        body: JSON.stringify(d, null, 2)
      });
      if (SEND_CONFIRM_EMAIL) sendConfirmationEmail(d, "", 0, null);
      booking.status = "quote_requested";
      saveBooking(bookingId, booking);
      syncCustomerContact(d);
      notifyOwnerBooking(d, 0);
      return json({ ok: true, quote: true });
    }
    var available = availability(d.date);
    if (!available.ok) throw new Error("Could not verify inventory: " + available.error);
    var items = String(d.items || "").split(",").map(function(k) { return k.trim().toLowerCase(); }).filter(Boolean);
    if (available.closed || items.some(function(k) { return available.booked.indexOf(k) > -1; })) {
      throw new Error("Selected inventory is no longer available");
    }
    if (items.indexOf("nerf") > -1) {
      var nextDay = parseStart(d.date, "00:00"); nextDay.setDate(nextDay.getDate() + 1);
      var nextAvailable = availability(Utilities.formatDate(nextDay, Session.getScriptTimeZone(), "yyyy-MM-dd"));
      if (!nextAvailable.ok || nextAvailable.booked.indexOf("nerf") > -1) {
        throw new Error("Nerf inventory is unavailable for the overnight rental");
      }
    }
    var cal = CALENDAR_ID ? CalendarApp.getCalendarById(CALENDAR_ID)
                          : CalendarApp.getDefaultCalendar();

    var start = parseStart(d.date, d.time);
    var end = new Date(start.getTime() + EVENT_HOURS * 60 * 60 * 1000);

    var title = "🎉 Party Porch — " + (d.name || "Booking") +
                " (" + (d.players || "") + ")";

    var desc = [
      "Booking ID: " + bookingId,
      "Deposit due: " + new Date(due * 1000).toISOString(),
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
      "SMS/Email consent: " + (d.consent || "No"),
      "Notes: "    + (d.notes || "")
    ].join("\n");

    var opts = { description: desc, location: (d.address || d.zip || "") };
    if (INVITE_CUSTOMER && d.email && /@/.test(d.email)) {
      opts.guests = d.email;
      opts.sendInvites = true;
    }

    var event = cal.createEvent(title, start, end, opts);
    booking.eventId = event.getId();
    saveBooking(bookingId, booking);

    var invoice = createDepositInvoice(d, bookingId, booking, depDollars);
    var depUrl = invoice.hosted_invoice_url;
    booking.status = "pending";
    booking.url = depUrl;
    saveBooking(bookingId, booking);
    syncCustomerContact(d);

    if (SEND_CONFIRM_EMAIL && d.email && /@/.test(d.email)) {
      try { sendConfirmationEmail(d, depUrl, depDollars, due); }
      catch (mailErr) { console.error("Booking confirmation email failed: " + String(mailErr)); }
    }

    if (SEND_SMS && d.consent === "Yes" && depUrl) {
      try { sendDepositText(d, depUrl, depDollars, due); }
      catch (smsErr) { console.error("Deposit SMS failed: " + String(smsErr)); }
    }

    notifyOwnerBooking(d, depDollars);
    return json({ ok: true, depositUrl: depUrl, deposit: depDollars });
  } catch (err) {
    console.error("Booking invoice failed: " + String(err));
    if (bookingId && booking) {
      booking.status = "failed";
      saveBooking(bookingId, booking);
    }
    return json({ ok: false, error: "Booking could not be completed. Please contact The Party Porch." });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

/** Empty TwiML so Twilio is satisfied (we don't auto-reply to the sender). */
function twiml() {
  return ContentService
    .createTextOutput('<?xml version="1.0" encoding="UTF-8"?><Response></Response>')
    .setMimeType(ContentService.MimeType.XML);
}

/**
 * Forwards an inbound text (sent TO our Twilio number) to our email, with the
 * full un-redacted body. Twilio hides verification codes in the Console log, but
 * the webhook payload still has them — so this is how you actually read an OTP.
 */
function handleInboundSms(p) {
  try {
    var from = p.From || "unknown";
    var body = p.Body || "";
    MailApp.sendEmail({
      to: BUSINESS_EMAIL,
      subject: "📩 Text to your Party Porch line from " + from,
      body: "From: " + from + "\nTo: " + (p.To || "") + "\n\n" + body
    });
  } catch (mailErr) { /* ignore */ }
  return twiml();
}

/**
 * Twilio delivery-status callback. Emails us when a text we sent FAILED or was
 * UNDELIVERED so we can follow up (the customer likely didn't get their link).
 */
function handleStatusCallback(p) {
  var status = p.MessageStatus || p.SmsStatus || "";
  if (status === "failed" || status === "undelivered") {
    try {
      MailApp.sendEmail({
        to: BUSINESS_EMAIL,
        subject: "⚠️ Party Porch text " + status.toUpperCase() + " to " + (p.To || ""),
        body: "A booking/deposit text was " + status +
              (p.ErrorCode ? (" (Twilio error " + p.ErrorCode + ")") : "") + ".\n" +
              "To: " + (p.To || "") + "\nMessageSid: " + (p.MessageSid || "") + "\n\n" +
              "The customer may not have received their payment link — follow up by email or call."
      });
    } catch (mailErr) { /* ignore */ }
  }
  return twiml();
}

/** Parses the estimate (e.g. "$280") and returns the deposit in whole dollars. */
function depositDollars(estimateStr) {
  var n = parseFloat(String(estimateStr || "").replace(/[^0-9.]/g, ""));
  if (!n || isNaN(n)) return 0;                 // no usable estimate (e.g. "custom quote")
  var dep = Math.round(n * DEPOSIT_PERCENT / 100);
  if (dep < DEPOSIT_MIN) dep = DEPOSIT_MIN;
  if (dep > DEPOSIT_MAX) dep = DEPOSIT_MAX;
  return dep;
}

/** A stable reference so a Stripe payment can be matched back to the booking. */
function makeRef(name, date) {
  return String((name || "") + "_" + (date || "")).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 180);
}

function validBookingId(id) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(id || ""));
}

function loadBooking(id) {
  var stored = PropertiesService.getScriptProperties().getProperty(BOOKING_PREFIX + id);
  return stored ? JSON.parse(stored) : null;
}

function saveBooking(id, booking) {
  PropertiesService.getScriptProperties().setProperty(BOOKING_PREFIX + id, JSON.stringify(booking));
}

function depositDeadline(dateStr, timeStr, now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr)) || !/^\d{2}:\d{2}$/.test(String(timeStr))) {
    throw new Error("An event date and start time are required");
  }
  var eventStart = parseStart(dateStr, timeStr);
  if (Utilities.formatDate(eventStart, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm") !== dateStr + " " + timeStr ||
      eventStart.getTime() <= now.getTime()) throw new Error("Event must start in the future");
  return Math.floor(Math.min(now.getTime() + DEPOSIT_DAYS * 86400000, eventStart.getTime()) / 1000);
}

function stripeRequest(path, method, payload, idempotencyKey) {
  var key = stripeKey();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  var headers = { "Authorization": "Bearer " + key };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  var options = { method: method, headers: headers, muteHttpExceptions: true };
  if (payload) options.payload = payload;
  var res = UrlFetchApp.fetch("https://api.stripe.com/v1/" + path, options);
  var status = res.getResponseCode();
  var body = JSON.parse(res.getContentText());
  if (status < 200 || status >= 300) {
    throw new Error("Stripe " + status + ": " + (body.error ? body.error.message : "request failed"));
  }
  return body;
}

function createDepositInvoice(d, bookingId, booking, dollars) {
  if (!dollars || !d.email || !/@/.test(d.email)) throw new Error("A deposit amount and customer email are required");
  var prefix = "party-porch-" + bookingId;
  var customer = stripeRequest("customers", "post", {
    email: d.email, name: d.name || "", "metadata[booking_id]": bookingId
  }, prefix + "-customer");
  var invoice = stripeRequest("invoices", "post", {
    customer: customer.id,
    collection_method: "send_invoice",
    due_date: String(booking.due),
    auto_advance: "false",
    pending_invoice_items_behavior: "exclude",
    description: BUSINESS_NAME + " - " + DEPOSIT_PERCENT + "% deposit for " + d.date,
    footer: "The remaining balance is due on the event day. The date is held until the deposit deadline; unpaid holds are released.",
    "payment_settings[payment_method_types][0]": "card",
    "metadata[booking_id]": bookingId,
    "metadata[ref]": makeRef(d.name, d.date),
    "metadata[deposit_percent]": String(DEPOSIT_PERCENT)
  }, prefix + "-invoice");
  booking.invoiceId = invoice.id;
  saveBooking(bookingId, booking);
  stripeRequest("invoiceitems", "post", {
    customer: customer.id,
    invoice: invoice.id,
    amount: String(Math.round(dollars * 100)),
    currency: CURRENCY,
    description: (d.rental || "Party") + " deposit - " + d.date
  }, prefix + "-item");
  invoice = stripeRequest("invoices/" + invoice.id + "/finalize", "post", {
    auto_advance: "false"
  }, prefix + "-finalize");
  if (!invoice.hosted_invoice_url) throw new Error("Stripe did not return a hosted invoice URL");
  return invoice;
}

function eventHoldActive(event) {
  var match = String(event.getDescription() || "").match(/^Booking ID: ([a-f0-9-]{36})$/im);
  return !match || bookingHoldActive(match[1]);
}

function bookingHoldActive(bookingId) {
  var lock = getBookingLock();
  var acquired = !lock.hasLock();
  if (acquired) lock.waitLock(30000);
  try {
    return reconcileBookingHold(bookingId);
  } finally {
    if (acquired) lock.releaseLock();
  }
}

function reconcileBookingHold(bookingId) {
  var booking = loadBooking(bookingId);
  if (!booking) throw new Error("Missing booking hold record");
  if (booking.status === "quote_requested") return false;
  if (booking.status === "failed" && !booking.invoiceId) return false;
  if (booking.status === "paid") return true;
  if (booking.status === "released") return false;
  if (Date.now() < booking.due * 1000) return true;
  if (booking.invoiceId) {
    var invoice = stripeRequest("invoices/" + booking.invoiceId, "get");
    if (invoice.status === "paid") {
      booking.status = "paid";
      saveBooking(bookingId, booking);
      return true;
    }
    if (invoice.status === "open" || invoice.status === "uncollectible") {
      invoice = stripeRequest("invoices/" + booking.invoiceId + "/void", "post", null, "expire-" + booking.invoiceId);
      if (invoice.status !== "void") throw new Error("Invoice could not be voided");
    } else if (invoice.status !== "draft" && invoice.status !== "void") {
      throw new Error("Unexpected invoice state: " + invoice.status);
    }
  }
  booking.status = "released";
  saveBooking(bookingId, booking);
  return false;
}

function expireBookingHolds() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var failures = [];
  Object.keys(props).forEach(function(key) {
    if (key.indexOf(BOOKING_PREFIX) !== 0) return;
    try { bookingHoldActive(key.slice(BOOKING_PREFIX.length)); }
    catch (err) {
      console.error("Hold expiration failed for " + key + ": " + String(err));
      failures.push(key);
    }
  });
  if (failures.length) throw new Error("Could not reconcile " + failures.length + " booking hold(s)");
}

function installBookingHoldTrigger() {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  var exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === "expireBookingHolds";
  });
  if (!exists) ScriptApp.newTrigger("expireBookingHolds").timeBased().everyMinutes(5).create();
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
function sendConfirmationEmail(d, depUrl, depDollars, due) {
  var first = String(d.name || "there").split(" ")[0];
  var when  = prettyDate(d.date);
  var cart  = d.cart || d.service || "your party";
  var est   = d.estimate ? String(d.estimate) : "";
  var phoneLine = BUSINESS_PHONE ? ("<br>Call/text: <strong>" + BUSINESS_PHONE + "</strong>") : "";
  var hasNerf = String(d.items || "").split(",").indexOf("nerf") > -1 ||
                d.rental === "Nerf Battles" || /Nerf Battles/.test(cart);
  var refereedNerf = hasNerf && d.service === "Rental + Referee";
  var nerfServiceNote = refereedNerf ?
    "Your referee handles setup, runs two hours of games, then tears down, packs and removes the equipment. Please provide a hose with running water and an accessible outlet for setup." :
    "Your rental-only Nerf gear stays overnight. Return everything clean, completely dry and empty in its bin on the porch for the agreed pickup date and time.";

  var amt  = depDollars ? ("$" + depDollars) : "";
  var link = depUrl;
  var pctLabel = amt ? (amt + " (" + DEPOSIT_PERCENT + "% deposit)") : (DEPOSIT_PERCENT + "% deposit");
  var deadline = due ? Utilities.formatDate(new Date(due * 1000), Session.getScriptTimeZone(), "MMM d, yyyy 'at' h:mm a z") : "";

  var depositBlock;
  if (link && amt) {
    depositBlock =
      '<p style="margin:22px 0 10px">To lock in your date, please place your <strong>' + pctLabel +
      '</strong> (applied to your total):</p>' +
      '<p style="text-align:center;margin:0 0 26px">' +
        '<a href="' + link + '" style="background:#ff5a5f;color:#fff;text-decoration:none;' +
        'font-weight:700;padding:14px 30px;border-radius:999px;display:inline-block;font-size:16px">' +
        'Pay ' + amt + ' deposit &rarr;</a></p>' +
      '<p style="font-size:13px;color:#667">Your date is held until <strong>' + esc(deadline) +
      '</strong>. Pay by this deadline to confirm it. Unpaid holds are released.</p>';
  } else {
    depositBlock =
      '<p style="margin:22px 0 10px">We\u2019ll follow up with a tailored quote and confirm ' +
      'availability. No payment is due and no date is held until we issue a deposit invoice.</p>';
  }

  var guideBlock = hasNerf ?
    '<div style="margin:22px 0;padding:18px;border-radius:12px;background:#fff8f0;border:1px solid #e7ded3">' +
      '<strong style="color:#12263a">Your Nerf party setup &amp; game guide</strong>' +
      '<p style="margin:6px 0 12px;color:#4b5968">' + esc(nerfServiceNote) + ' This guide covers setup, safety rules, games and returns.</p>' +
      '<a href="' + NERF_GUIDE_URL + '" style="color:#e04347;font-weight:700">Open the customer guide &rarr;</a>' +
    '</div>' : "";

  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e">' +
      '<h2 style="color:#ff5a5f;margin:0 0 6px">Request received, ' + esc(first) + '! 🎉</h2>' +
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
      guideBlock +
      '<hr style="border:none;border-top:1px solid #eee;margin:22px 0">' +
      '<p style="font-size:13px;color:#667;line-height:1.6">' +
        'Delivery is free within 12 miles of 77018 (a small fee applies beyond that). ' +
        (refereedNerf ? 'Your referee handles setup and teardown. ' : 'Setup is available as a +$40 add-on. ') +
        'We\u2019ll confirm final details before your date.' +
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
          (link && amt ? ("Place your " + amt + " (" + DEPOSIT_PERCENT + "%) deposit here: " + link)
                       : ("We'll follow up with a tailored quote and confirm availability. No payment is due and no date is held until we issue a deposit invoice.")) +
          (deadline ? " Your date is held until " + deadline + ". Unpaid holds are released." : "") +
          (hasNerf ? (" " + nerfServiceNote + " Setup and game guide: " + NERF_GUIDE_URL) : "")
  });
}

/**
 * Texts the customer their deposit link via Twilio. Credentials come from Script
 * Properties (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM).
 * The caller logs SMS failures without invalidating the payment invoice.
 */
function sendDepositText(d, depUrl, depDollars, due) {
  if (!depUrl) throw new Error("Deposit URL is missing");

  var when = prettyDate(d.date) || d.date || "your date";
  var deadline = Utilities.formatDate(new Date(due * 1000), Session.getScriptTimeZone(), "MMM d, h:mm a z");
  var body = BUSINESS_NAME + ": pay your $" + depDollars +
             " deposit for " + when + " by " + deadline + ": " + depUrl +
             " Your date is held until then; unpaid holds are released." +
             " Reply STOP to opt out, HELP for help.";

  return sendTwilioText(d.phone, body);
}

function sendTwilioText(phone, body) {
  var num = tenDigits(phone);
  var props = PropertiesService.getScriptProperties();
  var sid = props.getProperty("TWILIO_ACCOUNT_SID") || "";
  var token = props.getProperty("TWILIO_AUTH_TOKEN") || "";
  var from = props.getProperty("TWILIO_FROM") || "";
  if (!num || !sid || !token || !from) throw new Error("SMS recipient or Twilio configuration is missing");
  var payload = { To: "+1" + num, From: from, Body: body };
  var cbUrl = props.getProperty("WEBHOOK_URL") || "";
  if (cbUrl) payload.StatusCallback = cbUrl;   // so failed texts email us

  var response = UrlFetchApp.fetch("https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json", {
    method: "post",
    headers: { "Authorization": "Basic " + Utilities.base64Encode(sid + ":" + token) },
    payload: payload,
    muteHttpExceptions: true
  });
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) throw new Error("Twilio SMS failed: HTTP " + status);
  var result = JSON.parse(response.getContentText());
  if (!result.sid || result.error_code || result.status === "failed" || result.status === "undelivered") {
    throw new Error("Twilio did not accept the SMS");
  }
  return result.sid;
}

function reportOwnerAutomationFailure(feature, err, body) {
  console.error(feature + " failed: " + String(err));
  try {
    MailApp.sendEmail({
      to: BUSINESS_EMAIL,
      subject: BUSINESS_NAME + " - " + feature + " failed",
      body: "An automation needs attention. Check its result before retrying.\n\n" +
        String(err) + "\n\nNotification:\n" + body
    });
  } catch (mailErr) {
    console.error("Automation fallback email failed: " + String(mailErr));
  }
}

function ownerSmsRecipients() {
  var raw = String(PropertiesService.getScriptProperties().getProperty("OWNER_SMS_TO") || "").trim();
  if (!raw) return [];
  var recipients = [];
  raw.split(",").forEach(function(value) {
    var num = tenDigits(value.trim());
    if (!num) throw new Error("Every OWNER_SMS_TO entry must be a US mobile number, separated by commas.");
    var to = "+1" + num;
    if (recipients.indexOf(to) < 0) recipients.push(to);
  });
  return recipients;
}

function notifyOwnerBooking(d, deposit) {
  var recipients;
  try { recipients = ownerSmsRecipients(); }
  catch (err) {
    reportOwnerAutomationFailure("owner text alert", err, "Check the OWNER_SMS_TO recipient list.");
    return;
  }
  if (!recipients.length) {
    console.warn("Owner SMS alerts are disabled: set OWNER_SMS_TO in Script Properties.");
    return;
  }
  var party = d.cart && d.cart !== "None" ? d.cart : (d.rental || "Party");
  var body = BUSINESS_NAME + ": New " + (deposit ? "booking" : "quote") +
    " request - " + (d.name || "Customer") + ". " + party + ". " + d.date +
    (d.time ? " " + d.time + " CT" : "") + ". " +
    (deposit ? "Estimate " + d.estimate + "; $" + deposit + " deposit pending." : "Pricing needed; no date held.") +
    " See email for details.";
  recipients.forEach(function(to) {
    try { sendTwilioText(to, body); }
    catch (err) { reportOwnerAutomationFailure("owner text alert", err, body); }
  });
}

function installBookingAutomations() {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  if (!ownerSmsRecipients().length) throw new Error("Set OWNER_SMS_TO to the owner mobile number(s) first.");
  People.People.Connections.list("people/me", { pageSize: 1, personFields: "metadata" });
  var exists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === "sendOwnerBookingReminders";
  });
  if (!exists) {
    ScriptApp.newTrigger("sendOwnerBookingReminders").timeBased()
      .atHour(OWNER_REMINDER_HOUR).nearMinute(0).everyDays(1)
      .inTimezone("America/Chicago").create();
  }
}

function testOwnerSms() {
  var recipients = ownerSmsRecipients();
  if (!recipients.length) throw new Error("Set OWNER_SMS_TO before sending an owner test.");
  var failures = 0;
  var body = BUSINESS_NAME + ": Owner booking alerts test. No booking or invoice was created.";
  recipients.forEach(function(to, index) {
    try {
      var sid = sendTwilioText(to, body);
      console.log("Owner test SMS for recipient " + (index + 1) + " accepted by Twilio: " + sid + ". Check that phone to confirm delivery.");
    } catch (err) {
      reportOwnerAutomationFailure("owner SMS test", err, body);
      failures++;
    }
  });
  if (failures) throw new Error("Could not confirm " + failures + " owner test message(s). Check Twilio.");
}

function sendOwnerBookingReminders() {
  var props = PropertiesService.getScriptProperties();
  var recipients = ownerSmsRecipients();
  if (!recipients.length) throw new Error("OWNER_SMS_TO is missing.");
  var timezone = Session.getScriptTimeZone();
  if (timezone !== "America/Chicago") throw new Error("Set the project time zone to America/Chicago for owner reminders.");
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var todayStr = Utilities.formatDate(today, timezone, "yyyy-MM-dd");
  var cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 8);
  var cutoffStr = Utilities.formatDate(cutoff, timezone, "yyyy-MM-dd");
  Object.keys(props.getProperties()).forEach(function(key) {
    if (key.indexOf(OWNER_REMINDER_PREFIX) === 0 &&
        key.slice(OWNER_REMINDER_PREFIX.length, OWNER_REMINDER_PREFIX.length + 10) < cutoffStr) {
      props.deleteProperty(key);
    }
  });
  var calendar = CALENDAR_ID ? CalendarApp.getCalendarById(CALENDAR_ID) : CalendarApp.getDefaultCalendar();
  var failures = 0;
  [7, 1, 0].forEach(function(daysBefore) {
    var start = new Date(today); start.setDate(start.getDate() + daysBefore);
    var end = new Date(start); end.setDate(end.getDate() + 1);
    var dateStr = Utilities.formatDate(start, timezone, "yyyy-MM-dd");
    calendar.getEvents(start, end).forEach(function(event) {
      if (Utilities.formatDate(event.getStartTime(), timezone, "yyyy-MM-dd") !== dateStr) return;
      if (/BLOCKED|CLOSED|UNAVAILABLE|VACATION/i.test(String(event.getTitle() || ""))) return;
      recipients.forEach(function(to, index) {
        try {
          if (queueOwnerBookingReminder(event, daysBefore, todayStr, to, index === 0) === false) failures++;
        } catch (err) {
          reportOwnerAutomationFailure("owner reminder", err, "Reminder for calendar event " + event.getId());
          failures++;
        }
      });
    });
  });
  if (failures) throw new Error("Could not confirm " + failures + " owner reminder(s). Check email and Twilio before retrying.");
}

function queueOwnerBookingReminder(event, daysBefore, todayStr, to, primaryRecipient) {
  var props = PropertiesService.getScriptProperties();
  var legacyKey = OWNER_REMINDER_PREFIX + todayStr + "_" +
    encodeURIComponent(event.getId() + "_" + event.getStartTime().getTime() + "_" + daysBefore);
  var key = legacyKey + "_" + encodeURIComponent(to);
  var lock = getBookingLock();
  lock.waitLock(30000);
  try {
    if (!eventHoldActive(event)) return null;
    var previous = props.getProperty(key);
    // Older single-recipient markers belong to the first configured mobile.
    if (!previous && primaryRecipient) previous = props.getProperty(legacyKey);
    if (previous) return previous === "sent" ? null : false;
    // Reserve before sending so overlapping runs cannot send duplicate reminders.
    props.setProperty(key, "sending");
  } finally {
    lock.releaseLock();
  }
  var label = daysBefore === 0 ? "Today" : (daysBefore === 1 ? "Tomorrow" : "In 1 week");
  var when = Utilities.formatDate(event.getStartTime(), Session.getScriptTimeZone(), "MMM d, h:mm a z");
  var body = BUSINESS_NAME + " reminder - " + label + ": " + event.getTitle() +
    ". " + when + ". Check Calendar for details and payment status.";
  try {
    sendTwilioText(to, body);
    props.setProperty(key, "sent");
    return true;
  } catch (err) {
    props.setProperty(key, "failed");
    reportOwnerAutomationFailure("owner reminder", err, body);
    return false;
  }
}

function syncCustomerContact(d) {
  try { return saveCustomerContact(d); }
  catch (err) {
    reportOwnerAutomationFailure("Google Contacts save", err,
      "Customer: " + (d.name || "") + "\nEmail: " + (d.email || "") + "\nPhone: " + (d.phone || ""));
    return null;
  }
}

function saveCustomerContact(d) {
  var email = String(d.email || "").trim().toLowerCase();
  var name = String(d.name || "").trim();
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("A customer name and valid email are required for Contacts.");
  var fields = "names,emailAddresses,phoneNumbers,metadata";
  var props = PropertiesService.getScriptProperties();
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email);
  var key = CONTACT_PREFIX + Utilities.base64EncodeWebSafe(digest).replace(/=+$/, "");
  var stored = props.getProperty(key);
  var matches = [];
  if (stored) {
    var record = JSON.parse(stored);
    if (!record.resourceName) throw new Error("A previous contact creation needs manual review in Google Contacts before retrying.");
    var cached = People.People.get(record.resourceName, { personFields: fields, sources: ["READ_SOURCE_TYPE_CONTACT"] });
    if (!(cached.emailAddresses || []).some(function(item) {
      return String(item.value || "").trim().toLowerCase() === email;
    })) throw new Error("The saved contact no longer matches this email. Review Google Contacts before changing it.");
    matches.push(cached);
  } else {
    var pageToken;
    do {
      var options = { pageSize: 1000, personFields: fields, sources: ["READ_SOURCE_TYPE_CONTACT"] };
      if (pageToken) options.pageToken = pageToken;
      var page = People.People.Connections.list("people/me", options);
      (page.connections || []).forEach(function(person) {
        if ((person.emailAddresses || []).some(function(item) {
          return String(item.value || "").trim().toLowerCase() === email;
        })) matches.push(person);
      });
      pageToken = page.nextPageToken;
    } while (pageToken);
  }
  if (matches.length > 1) throw new Error("Multiple Google Contacts match this email. Merge or review them; no new contact was created.");
  var rawPhone = String(d.phone || "").trim();
  var normalized = tenDigits(rawPhone);
  var phone = normalized ? "+1" + normalized : rawPhone;
  var person;
  if (!matches.length) {
    // Reserve before creating: a timed-out write must not create duplicates on retry.
    props.setProperty(key, JSON.stringify({ creating: true }));
    var contact = { names: [{ unstructuredName: name }], emailAddresses: [{ value: email, type: "other" }] };
    if (phone) contact.phoneNumbers = [{ value: phone, type: "other" }];
    person = People.People.createContact(contact, { personFields: fields });
  } else {
    person = matches[0];
    props.setProperty(key, JSON.stringify({ resourceName: person.resourceName }));
    var phones = person.phoneNumbers || [];
    var alreadySaved = phones.some(function(item) {
      var value = String(item.canonicalForm || item.value || "");
      return (tenDigits(value) || value.replace(/\D/g, "")) === (normalized || phone.replace(/\D/g, ""));
    });
    if (phone && !alreadySaved) {
      person = People.People.updateContact({
        etag: person.etag,
        metadata: person.metadata,
        phoneNumbers: phones.concat([{ value: phone, type: "other" }])
      }, person.resourceName, { updatePersonFields: "phoneNumbers", personFields: fields });
    }
  }
  if (!person.resourceName) throw new Error("Google Contacts did not return a contact resource.");
  props.setProperty(key, JSON.stringify({ resourceName: person.resourceName }));
  return person.resourceName;
}

/** Normalizes a phone number to 10 digits ("" if it isn't a valid US number). */
function tenDigits(phone) {
  var s = String(phone == null ? "" : phone).replace(/[^0-9]/g, "");
  if (s.length === 11 && s.charAt(0) === "1") s = s.slice(1);
  return s.length === 10 ? s : "";
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
