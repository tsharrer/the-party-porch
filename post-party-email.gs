// Add as PostPartyAutomation.gs in the existing booking/waiver Apps Script project.
function postPartyOwner_() {
  if (Session.getActiveUser().getEmail().toLowerCase() !== BUSINESS_EMAIL) {
    throw new Error("Run this action as " + BUSINESS_EMAIL + ".");
  }
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
}

function postPartyFolder_() {
  var id = PropertiesService.getScriptProperties().getProperty("WAIVER_FOLDER_ID");
  if (!id) throw new Error("Install private waiver storage first.");
  var folder = DriveApp.getFolderById(id);
  assertWaiverFolderPrivate_(folder);
  return folder;
}

function postPartyDate_(date) {
  return Utilities.formatDate(date, "America/Chicago", "yyyy-MM-dd");
}

function postPartyShift_(date, days) {
  var value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function postPartyEmail_(value) {
  if (typeof value !== "string") throw new Error("A valid adult email address is required.");
  var email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("A valid adult email address is required.");
  }
  return email;
}

function postPartyConfig_(requireSending) {
  var props = PropertiesService.getScriptProperties();
  var address = String(props.getProperty("POST_PARTY_MAILING_ADDRESS") || "").trim();
  var url = String(props.getProperty("POST_PARTY_WEBAPP_URL") || "").trim();
  if (requireSending) {
    if (address.length < 15 || !/[a-z]/i.test(address) || !/\d/.test(address) ||
        /required|placeholder|example|\[|\]/i.test(address)) {
      throw new Error("Set POST_PARTY_MAILING_ADDRESS to a full valid business postal address or PO box. A ZIP code alone is not enough.");
    }
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url)) {
      throw new Error("Set POST_PARTY_WEBAPP_URL to the existing public booking /exec URL.");
    }
    if (Session.getScriptTimeZone() !== "America/Chicago") throw new Error("Set the project time zone to America/Chicago.");
  }
  var suppressed = {};
  String(props.getProperty("POST_PARTY_SUPPRESS_EMAILS") || "").split(/[,;\s]+/).filter(Boolean).forEach(function(email) {
    suppressed[postPartyEmail_(email)] = true;
  });
  return {address: address, url: url, suppressed: suppressed};
}

function postPartyEvent_(event) {
  var data = customerWaiverEvent_(event);
  var description = String(event.getDescription() || "");
  var keys = eventItemKeys(event);
  var references = [event.getId(), data.bookingId];
  if (data.name) references.push(makeRef(data.name, data.date));
  description.replace(/^(?:Booking reference|Reference):[ \t]*([^\r\n]+)/gim, function(_, ref) { references.push(ref); });
  data.event = event;
  data.references = references.filter(Boolean).map(function(ref) { return String(ref).trim().toLowerCase(); });
  var nonParty = /BLOCKED|CLOSED|UNAVAILABLE|VACATION|PICKUP|PICK.UP|CLEANING|\bTEST\b|\bQUOTE\b/i.test(event.getTitle());
  data.party = !nonParty && (keys.length > 0 || data.nerf);
  data.excluded = data.excluded || /\bTEST\b|\bQUOTE\b/i.test(event.getTitle()) ||
    /^(?:Status|Booking status):[ \t]*(?:cancelled|canceled|released|quote_requested)\b/im.test(description);
  if (data.bookingId) {
    var booking = loadBooking(data.bookingId);
    if (!booking || booking.status !== "paid") data.excluded = true;
  }
  if (event.getEndTime().getTime() > Date.now()) data.excluded = true;
  return data;
}

function postPartyRecords_(folder) {
  var files = folder.getFiles(), records = [], seen = {};
  while (files.hasNext()) {
    var file = files.next(), name = file.getName();
    if (!/^waiver-[a-f0-9-]{36}\.json$/i.test(name)) continue;
    if (seen[name]) throw new Error("Duplicate waiver receipt requires review: " + name);
    seen[name] = true;
    var record = JSON.parse(file.getBlob().getDataAsString());
    if (!record.data) throw new Error("Missing signer data in " + name);
    records.push({name: name, record: record});
  }
  return {folder: folder, records: records};
}

function postPartyPlan_(date, source) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || postPartyShift_(date, 0) !== date) throw new Error("Use a valid YYYY-MM-DD party date.");
  source = source || postPartyRecords_(postPartyFolder_());
  var folder = source.folder;
  var config = postPartyConfig_(false);
  var calendar = CALENDAR_ID ? CalendarApp.getCalendarById(CALENDAR_ID) : CalendarApp.getDefaultCalendar();
  // Keep excluded parties in the candidate set: their signers must not be reassigned to a different party.
  var parties = calendar.getEvents(parseStart(date, "00:00"), parseStart(postPartyShift_(date, 1), "00:00"))
    .map(postPartyEvent_).filter(function(party) { return party.party && party.date === date; });
  var recipients = parties.map(function() { return {}; });
  var issues = [];
  source.records.forEach(function(entry) {
    var record = entry.record, name = entry.name;
    try {
      var data = record.data;
      if (data.eventDate !== date) return;
      if (name !== "waiver-" + data.id + ".json" ||
          ["host", "participant"].indexOf(data.kind) === -1 ||
          data.adultConsent !== true || data.electronicConsent !== true || data.termsConsent !== true ||
          typeof data.signer !== "string" || !data.signer.trim() ||
          (data.kind === "participant" && ["adult", "minor"].indexOf(data.participantType) === -1) ||
          (data.kind === "participant" && data.participantType === "minor" && data.guardianConsent !== true) ||
          !record.pdfName || !waiverFileByName_(folder, record.pdfName)) {
        throw new Error("Incomplete or invalid signed adult record.");
      }
      var email = postPartyEmail_(data.email);
      var reference = String(data.reference || "").trim().toLowerCase();
      var matches = parties.map(function(party, index) { return {party: party, index: index}; })
        .filter(function(match) { return !reference || match.party.references.indexOf(reference) !== -1; });
      if (matches.length !== 1) throw new Error("Party match is missing or ambiguous; correct the booking reference before sending.");
      var match = matches[0];
      if (!match.party.excluded && !config.suppressed[email]) recipients[match.index][email] = true;
    } catch (err) {
      var recordedEmail = typeof data.email === "string" && data.email.trim() ?
        data.email.trim().replace(/[\r\n]/g, " ").slice(0, 254) : "Unavailable (missing signer email)";
      issues.push("Held before sending | Date: " + date + " | Adult signer email (as recorded): " +
        recordedEmail + " | Receipt: " + name + " | Reason: " + String(err.message || err));
    }
  });
  return {folder: folder, parties: parties.map(function(party, index) {
    party.recipients = Object.keys(recipients[index]);
    return party;
  }), issues: issues};
}

function postPartyJson_(folder, name) {
  var file = waiverFileByName_(folder, name);
  return file ? {file: file, data: JSON.parse(file.getBlob().getDataAsString())} : null;
}

function postPartySave_(folder, name, stored, data) {
  if (stored) stored.file.setContent(JSON.stringify(data));
  else folder.createFile(Utilities.newBlob(JSON.stringify(data), "application/json", name));
}

function postPartyContact_(folder, email) {
  var hash = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, email)).replace(/=+$/, "");
  var name = "post-party-contact-" + hash + ".json";
  var found = postPartyJson_(folder, name);
  if (found) {
    if (found.data.email !== email || typeof found.data.unsubscribed !== "boolean" ||
        typeof found.data.token !== "string" || !/^[a-zA-Z0-9_-]{43}\.[a-f0-9-]{36}$/.test(found.data.token) ||
        found.data.token.indexOf(hash + ".") !== 0) {
      throw new Error("Invalid private email preferences require review.");
    }
    return found;
  }
  var token = hash + "." + Utilities.getUuid();
  var data = {email: email, token: token, unsubscribed: false};
  postPartySave_(folder, name, null, data);
  return postPartyJson_(folder, name);
}

function postPartyMessage_(party, config, unsubscribeUrl) {
  var template = HtmlService.createTemplateFromFile("PostPartyEmail");
  template.nerf = party.nerf;
  template.address = config.address || "[Full business mailing address required before sending]";
  template.unsubscribeUrl = unsubscribeUrl;
  template.offerActive = Date.now() < Date.parse("2027-01-01T06:00:00Z");
  var subject = party.nerf ? "Thanks for joining the Nerf fun!" : "Thanks for celebrating with The Party Porch!";
  var body = "Hey, party crew!\n\n" +
    (party.nerf ? "Thank you for joining the Nerf fun with The Party Porch!" : "Thank you for celebrating with The Party Porch!") +
    " We hope you and your family had a wonderful time.\n\nBook your next party: https://yourpartyporch.com/#book\n\n" +
    (template.offerActive ? "Use NERFTHANKS10 for 10% off rental charges when you book by December 31, 2026, Houston time. " +
      "Excludes staff/setup, delivery, supply packs and taxes. No review required.\n\n" : "") +
    "An honest Google review is completely optional: https://g.page/r/CauEr6BR1sANEBM/review\n\n" +
    "Have a question? Reply to this email.\n\nThe Party Porch\n\n" +
    "Unsubscribe from future promotional emails: " + unsubscribeUrl +
    "\nOr reply unsubscribe. This is a promotional message.\n" + template.address;
  return {subject: subject, body: body, htmlBody: template.evaluate().getContent()};
}

function postPartyRecordOptOuts_(folder, suppressed) {
  var lock = getBookingLock();
  lock.waitLock(30000);
  try {
    Object.keys(suppressed).forEach(function(email) {
      var contact = postPartyContact_(folder, email);
      if (contact.data.unsubscribed) return;
      contact.data.unsubscribed = true;
      contact.data.unsubscribedAt = new Date().toISOString();
      contact.file.setContent(JSON.stringify(contact.data));
    });
  } finally { lock.releaseLock(); }
}

function savePostPartyOptOuts() {
  postPartyOwner_();
  var suppressed = postPartyConfig_(false).suppressed;
  postPartyRecordOptOuts_(postPartyFolder_(), suppressed);
  console.log("Recorded " + Object.keys(suppressed).length + " promotional email opt-out(s). No email was sent.");
}

function postPartyVerifyEndpoint_(url) {
  var response = UrlFetchApp.fetch(url + "?action=postPartyStatus&verify=" + Date.now(), {muteHttpExceptions: true});
  if (response.getResponseCode() !== 200 || JSON.parse(response.getContentText()).version !== "post-party-v1") {
    throw new Error("Deploy updated Code.gs and PostPartyAutomation.gs before enabling emails: unsubscribe routing is not ready.");
  }
}

function previewPostPartyEmails() {
  postPartyOwner_();
  var props = PropertiesService.getScriptProperties();
  var date = props.getProperty("POST_PARTY_PREVIEW_DATE") || postPartyShift_(postPartyDate_(new Date()), -2);
  var plan = postPartyPlan_(date), config = postPartyConfig_(false);
  var html = "<!doctype html><meta charset=\"utf-8\"><h1>Private post-party preview: " + waiverEscape_(date) + "</h1>" +
    "<p>No attendee email has been sent. Past uncancelled parties are assumed to have happened; waiver signing does not prove attendance.</p>";
  plan.parties.forEach(function(party) {
    html += "<h2>" + waiverEscape_(party.event.getTitle()) + "</h2><p>" +
      (party.excluded ? "Excluded: cancelled, unpaid, future, pickup, test or quote." :
        "Matched adult signer addresses before stored opt-outs / previous-send filtering: " + party.recipients.length) +
      "</p><p>" + party.recipients.map(waiverEscape_).join("<br>") + "</p>";
  });
  html += "<h2>Needs review</h2><pre>" + waiverEscape_(plan.issues.join("\n") || "None") + "</pre>";
  if (plan.parties.length) {
    html += "<h2>Message preview (unsubscribe link is a placeholder)</h2>" +
      postPartyMessage_(plan.parties[0], config, "#preview-only-not-an-unsubscribe-link").htmlBody;
  }
  var name = "post-party-preview.html";
  var file = waiverFileByName_(plan.folder, name);
  if (file) file.setContent(html);
  else file = plan.folder.createFile(Utilities.newBlob(html, "text/html", name));
  console.log("Private preview: " + file.getUrl() + ". No email was sent.");
  return {url: file.getUrl(), parties: plan.parties.length, needsReview: plan.issues.length};
}

function sendPostPartyTestEmail() {
  postPartyOwner_();
  var config = postPartyConfig_(true);
  postPartyVerifyEndpoint_(config.url);
  var folder = postPartyFolder_(), lock = getBookingLock();
  lock.waitLock(30000);
  try {
    var contact = postPartyContact_(folder, BUSINESS_EMAIL);
    var message = postPartyMessage_({nerf: true}, config, config.url + "?action=unsubscribe&token=" + contact.data.token);
    message.to = BUSINESS_EMAIL;
    message.replyTo = BUSINESS_EMAIL;
    message.name = BUSINESS_NAME;
    message.subject = "[OWNER TEST] " + message.subject;
    MailApp.sendEmail(message);
    PropertiesService.getScriptProperties().setProperty("POST_PARTY_TEST_SENT_AT", new Date().toISOString());
  } finally { lock.releaseLock(); }
  console.log("Owner test accepted. Check Gmail, every link and the unsubscribe confirmation before installing. No attendee email was sent.");
}

function installPostPartyEmails() {
  postPartyOwner_();
  var config = postPartyConfig_(true);
  postPartyFolder_();
  postPartyVerifyEndpoint_(config.url);
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty("POST_PARTY_TEST_SENT_AT")) throw new Error("Run sendPostPartyTestEmail and check the owner test first.");
  var start = props.getProperty("POST_PARTY_START_DATE") || postPartyShift_(postPartyDate_(new Date()), -2);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || postPartyShift_(start, 0) !== start) throw new Error("POST_PARTY_START_DATE must be YYYY-MM-DD.");
  if (!ScriptApp.getProjectTriggers().some(function(trigger) { return trigger.getHandlerFunction() === "sendPostPartyEmails_"; })) {
    ScriptApp.newTrigger("sendPostPartyEmails_").timeBased().atHour(9).nearMinute(0).everyDays(1).inTimezone("America/Chicago").create();
  }
  props.setProperty("POST_PARTY_START_DATE", start);
  props.setProperty("POST_PARTY_EMAILS", "enabled");
  console.log("Post-party follow-up enabled around 9 AM Houston, two days after each party, with seven days of catch-up. Installation sends no attendee email.");
}

function disablePostPartyEmails() {
  postPartyOwner_();
  PropertiesService.getScriptProperties().setProperty("POST_PARTY_EMAILS", "disabled");
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "sendPostPartyEmails_") ScriptApp.deleteTrigger(trigger);
  });
  console.log("Automatic promotional emails disabled. Keep the web app deployed so unsubscribe links continue to work.");
}

function postPartySend_(party, folder, config, reviewDetails) {
  reviewDetails = reviewDetails || [];
  var lock = getBookingLock();
  lock.waitLock(30000);
  try {
    if (PropertiesService.getScriptProperties().getProperty("POST_PARTY_EMAILS") !== "enabled") return "disabled";
    config = postPartyConfig_(true);
    var current = postPartyEvent_(party.event);
    if (current.excluded || current.date !== party.date) return "excluded";
    var id = current.bookingId || current.event.getId() + "_" + current.date;
    var digest = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, id)).replace(/=+$/, "");
    var name = "post-party-delivery-" + digest + ".json";
    var stored = postPartyJson_(folder, name);
    var state = stored ? stored.data : {recipients: {}};
    var email = party.recipient;
    if (state.recipients[email]) {
      var previous = state.recipients[email];
      if (previous.status === "sent") return "alreadySent";
      reviewDetails.push("Previous delivery requires review; not resent | Date: " + party.date +
        " | Adult email: " + email + " | Journal: " + name + " | Status: " + previous.status +
        " | Reason: " + (previous.error || "An earlier attempt was interrupted or its outcome was not confirmed.") +
        " Check Gmail Sent and the private journal before any manual resend.");
      return "needsReview";
    }
    var contact = postPartyContact_(folder, email);
    if (contact.data.unsubscribed || config.suppressed[email]) return "suppressed";
    if (MailApp.getRemainingDailyQuota() < 2) {
      reviewDetails.push("Not attempted | Date: " + party.date + " | Adult email: " + email +
        " | Reason: Daily email quota reserve reached; pending for a later run.");
      return "remaining";
    }
    var message = postPartyMessage_(current, config, config.url + "?action=unsubscribe&token=" + contact.data.token);
    message.to = email;
    message.replyTo = BUSINESS_EMAIL;
    message.name = BUSINESS_NAME;
    state.recipients[email] = {status: "sending", at: new Date().toISOString()};
    postPartySave_(folder, name, stored, state);
    stored = postPartyJson_(folder, name);
    try {
      MailApp.sendEmail(message);
      state.recipients[email].status = "sent";
      postPartySave_(folder, name, stored, state);
      return "sent";
    } catch (err) {
      state.recipients[email].status = "uncertain";
      state.recipients[email].error = String(err.message || err);
      try { postPartySave_(folder, name, stored, state); }
      catch (writeErr) { console.error("Post-party delivery status write failed: " + String(writeErr)); }
      reportOwnerAutomationFailure("post-party email", err,
        "Event: " + party.event.getId() + "\nDate: " + party.date + "\nAdult email: " + email +
        "\nDo not resend before checking Gmail Sent and the private delivery journal.");
      reviewDetails.push("Delivery outcome uncertain; not automatically retried | Date: " + party.date +
        " | Adult email: " + email + " | Journal: " + name + " | Reason: " + String(err.message || err) +
        " Check Gmail Sent and the private journal before any manual resend.");
      return "needsReview";
    }
  } finally { lock.releaseLock(); }
}

function sendDuePostPartyEmails() {
  postPartyOwner_();
  return sendPostPartyEmails_();
}

function sendPostPartyEmails_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty("POST_PARTY_EMAILS") !== "enabled") throw new Error("Post-party emails are disabled.");
  var config = postPartyConfig_(true), started = Date.now();
  postPartyVerifyEndpoint_(config.url);
  var today = postPartyDate_(new Date()), due = postPartyShift_(today, -2);
  var start = props.getProperty("POST_PARTY_START_DATE");
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start) || postPartyShift_(start, 0) !== start) throw new Error("Install post-party emails to set a valid start date.");
  var result = {sent: 0, alreadySent: 0, suppressed: 0, excluded: 0, needsReview: 0, remaining: 0, disabled: 0};
  var reviewDetails = [];
  var source = postPartyRecords_(postPartyFolder_());
  postPartyRecordOptOuts_(source.folder, config.suppressed);
  for (var date = postPartyShift_(due, -6); date <= due; date = postPartyShift_(date, 1)) {
    if (date < start) continue;
    var plan = postPartyPlan_(date, source);
    result.needsReview += plan.issues.length;
    plan.issues.forEach(function(issue) {
      console.error("Post-party match review: " + issue);
      reviewDetails.push(issue);
    });
    plan.parties.forEach(function(party) {
      party.recipients.forEach(function(email) {
        if (Date.now() - started > 240000) {
          result.remaining++;
          reviewDetails.push("Not attempted | Date: " + party.date + " | Adult email: " + email +
            " | Reason: Run time limit approached; pending for a later run.");
          return;
        }
        party.recipient = email;
        result[postPartySend_(party, plan.folder, config, reviewDetails)]++;
      });
    });
  }
  console.log("Post-party email run: " + JSON.stringify(result));
  if (result.needsReview || result.remaining) {
    reportOwnerAutomationFailure("post-party follow-up review", new Error(JSON.stringify(result)),
      "Affected adult signer addresses and reasons:\n\n" + reviewDetails.join("\n\n") +
      "\n\nHeld records were not sent. Uncertain outcomes are not proof of failure or delivery. " +
      "Pending recipients can be retried within the seven-day catch-up window; uncertain sends are never automatically repeated.");
  }
  return result;
}

function postPartyUnsubscribe_(params, submitted) {
  var lock = getBookingLock();
  try {
    if (!/^[a-zA-Z0-9_-]{43}\.[a-f0-9-]{36}$/.test(String(params.token || ""))) throw new Error("Invalid preference link.");
    lock.waitLock(30000);
    var folder = postPartyFolder_();
    var contact = postPartyJson_(folder, "post-party-contact-" + params.token.split(".")[0] + ".json");
    if (!contact || contact.data.token !== params.token) throw new Error("Preference link not found.");
    if (submitted) {
      if (params.confirm !== "unsubscribe") throw new Error("Please confirm your email preference.");
      contact.data.unsubscribed = true;
      contact.data.unsubscribedAt = new Date().toISOString();
      contact.file.setContent(JSON.stringify(contact.data));
      return HtmlService.createHtmlOutput("<h1>You are unsubscribed</h1><p>You will not receive future Party Porch promotional emails. Booking confirmations and required service messages are unaffected.</p>");
    }
    var url = String(PropertiesService.getScriptProperties().getProperty("POST_PARTY_WEBAPP_URL") || "");
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url)) throw new Error("Preference service is not configured.");
    return HtmlService.createHtmlOutput('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_top"></head>' +
      '<body style="font:18px Arial;max-width:560px;margin:40px auto;padding:20px"><h1>Party Porch email preferences</h1>' +
      '<p>Stop future promotional emails? This does not cancel bookings or stop required service messages.</p>' +
      '<form method="post" action="' + waiverEscape_(url) + '">' +
      '<input type="hidden" name="action" value="unsubscribe"><input type="hidden" name="token" value="' + waiverEscape_(params.token) + '">' +
      '<button name="confirm" value="unsubscribe" style="padding:14px">Unsubscribe from promotional emails</button></form></body></html>');
  } catch (err) {
    console.error("Post-party email preference failed: " + String(err));
    return HtmlService.createHtmlOutput("<h1>We could not confirm your preference</h1><p>Please reply unsubscribe to the original email or contact " +
      waiverEscape_(BUSINESS_EMAIL) + ". Your request has not been recorded by this page.</p>");
  } finally { if (lock.hasLock()) lock.releaseLock(); }
}
