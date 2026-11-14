/**
 * Add this as Waivers.gs and add WaiverForm.html in the SAME Apps Script project
 * as google-calendar.gs. Run installWaiverStorage from the editor, then redeploy.
 * Records remain private. Setup requires the signed-in business account.
 */
var WAIVER_VERSION = "2026-11-13.3";
var WAIVER_BUSINESS = "The Party Porch, a Sharrer Investments LLC company";
var WAIVER_EMAIL = "yourpartyporch@gmail.com";
var WAIVER_ESIGN = "I consent to use electronic records and signatures for this agreement. " +
  "By typing my full legal name and selecting Sign and submit, I intend to sign this agreement " +
  "electronically. I can download a copy after submission or request one from yourpartyporch@gmail.com. " +
  "If I do not want to sign electronically, I will contact The Party Porch for a paper form before participating.";

function installWaiverStorage() {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  if (Session.getActiveUser().getEmail().toLowerCase() !== WAIVER_EMAIL) {
    throw new Error("Run this installer as " + WAIVER_EMAIL + ".");
  }
  var properties = PropertiesService.getScriptProperties();
  var folderId = properties.getProperty("WAIVER_FOLDER_ID");
  var folder = folderId ? DriveApp.getFolderById(folderId) :
    DriveApp.getRootFolder().createFolder("Party Porch - Signed Waivers");
  assertWaiverFolderPrivate_(folder);
  properties.setProperty("WAIVER_FOLDER_ID", folder.getId());
  if (!properties.getProperty("WAIVER_SIGNING_SECRET")) {
    properties.setProperty("WAIVER_SIGNING_SECRET", Utilities.getUuid() + Utilities.getUuid());
  }
  console.log("Private signed-waiver folder: " + folder.getUrl());
}

function assertWaiverFolderPrivate_(folder) {
  var owner = folder.getOwner();
  if (!owner || owner.getEmail().toLowerCase() !== WAIVER_EMAIL ||
      folder.getSharingAccess() !== DriveApp.Access.PRIVATE ||
      folder.getEditors().length || folder.getViewers().length || folder.isTrashed()) {
    throw new Error("Waiver storage must be an unshared My Drive folder owned by " + WAIVER_EMAIL + ".");
  }
}

function waiverReady_() {
  var properties = PropertiesService.getScriptProperties();
  return !!(properties.getProperty("WAIVER_FOLDER_ID") && properties.getProperty("WAIVER_SIGNING_SECRET"));
}

function waiverDocument_(kind) {
  var commonRisk = "Nerf/foam-dart play involves moving players, foam projectiles, blasters and inflatable cover. " +
    "Risks include trips, falls, collisions, impacts, eye injuries, equipment misuse, heat, weather and hazards " +
    "at the event site. Injuries can be serious. Safety rules and eye protection reduce risk but do not " +
    "eliminate it. Participation must be voluntary.";
  if (kind === "host") {
    return {
      title: "Nerf Rental & Host Safety Agreement",
      intro: "The adult host/renter signs this agreement. Each participant needs a separate participant form.",
      sections: [
        { title: "1. Activity and risks", paragraphs: [commonRisk] },
        { title: "2. Host responsibilities", bullets: [
          "Provide a suitable, flat play area away from traffic, pools, grills, sharp objects and breakables; clear debris and keep spectators out of active play.",
          "Provide adult supervision throughout use. Without a Party Porch referee, the host must remain present or designate a responsible adult to supervise all play, give the safety briefing, enforce boundaries and safety rules, and stop unsafe play. Delivery, pickup or setup alone does not include staff supervision. Never allow unsupervised play.",
          "If a Party Porch referee is booked, their scheduled service does not replace the host's responsibility for children before or after that service.",
          "Require the supplied eye protection during play. No intentional face/head shots, point-blank shots, pushing, tackling or climbing on obstacles. Stop play for safety concerns.",
          "Use only supplied/approved equipment and darts. Do not modify equipment. Stop using damaged or unstable items and notify The Party Porch.",
          "If referee setup is booked, provide a hose with running water and an accessible electrical outlet. Keep water and electrical equipment safely separated.",
          "Follow the customer guide: one gallon of water per inflatable before adding air; water and air use the same shared dual-valve assembly."
        ] },
        { title: "3. Service, overnight rental and return", paragraphs: [
          "For refereed parties, the referee handles setup, two hours of games, teardown, packing and equipment removal at the end. The host provides the hose/water and outlet, not the setup or teardown labor. Rentals without a Party Porch referee are overnight; the host follows the setup guide unless separate setup service is booked. For these rentals, the host must return all blasters, darts, glasses, inflatables and the pump. Deflate, drain every inflatable completely and clean and fully dry all equipment before packing. Put everything back in the bin and place the bin on the porch for the agreed pickup date and time. Report loss or damage promptly."
        ] },
        { title: "4. Lost or damaged equipment fees", paragraphs: [
          "The host/renter agrees to pay a loss/damage fee for missing, lost, stolen or broken equipment while in the host's or guests' care. The fee is the reasonable, documented repair cost or the cost of an equivalent replacement. Normal wear, pre-existing damage, equipment defects and staff-caused damage are excluded. Repair charges cannot exceed equivalent replacement cost; replace individual pieces when available, not the whole set. The Party Porch will provide an itemized explanation and repair quote/replacement price before invoicing. Fees are invoiced separately; this agreement does not authorize automatic charges to a saved card."
        ] },
        { title: "5. Scope of the host's signature", paragraphs: [
          "The host signs only for the host's own agreement and rental responsibilities. A host's signature is not a substitute for each participant's required paperwork or a minor's parent/legal guardian authorization."
        ] }
      ]
    };
  }
  if (kind !== "participant") throw new Error("Choose a host or participant form.");
  return {
    title: "Participant Acknowledgment & Release",
    intro: "Use a separate form for each participant. An adult participant signs for themselves. For a minor, the participant's parent or legal guardian signs the authorization below.",
    sections: [
      { title: "1. Acknowledgment and safe participation", paragraphs: [
        "This form applies with or without a Party Porch referee. Without one, the host or their designated responsible adult supervises play and gives the safety briefing; Party Porch staff do not supervise the activity. Delivery or setup does not include a referee. I agree to follow the supervising adult's safety instructions.",
        "I understand that foam-dart activities involve running or movement, foam projectiles and inflatable obstacles, with risks of falls, collisions, impacts, eye injuries, heat/weather exposure and other injury. These risks cannot be eliminated. I have had an opportunity to ask questions and choose not to participate.",
        "I agree to follow the safety briefing, wear the provided eye protection during play, stay inside the boundaries, avoid intentional shots at faces/heads, and avoid pushing, tackling, grabbing or climbing on obstacles. I will stop when a pause is called and report unsafe equipment or conditions. I will not participate if I cannot do so safely."
      ] },
      { title: "2. Assumption of risk & adult participant release", release: true, paragraphs: [
        "For an adult signing on their own behalf: I voluntarily accept the inherent risks of the described activity. To the extent permitted by applicable law, I release " + WAIVER_BUSINESS + ", from claims for injury or property damage arising from my participation, including claims based on ordinary negligence, but not gross negligence, reckless conduct, intentional misconduct, or liabilities that cannot lawfully be released."
      ] },
      { title: "3. Parent/guardian authorization", paragraphs: [
        "If signing for a minor, I identify myself as that participant's parent or legal guardian and authorize the child's participation subject to the activity's safety rules. I understand this authorization does not by itself establish an enforceable release of the child's claims. I will remain available or identify the supervising adult to the host."
      ] },
      { title: "4. Emergency response and privacy", paragraphs: [
        "The host or supervising adult must stop unsafe play, notify the emergency contact and call 911 when needed. Party Porch staff may also do so when present. This form does not authorize staff to diagnose conditions or administer medication. Contact information is for event operations and emergency follow-up, not permission for marketing, photography or promotional use."
      ] }
    ]
  };
}

function waiverTokenSignature_(value) {
  var secret = PropertiesService.getScriptProperties().getProperty("WAIVER_SIGNING_SECRET");
  if (!secret) throw new Error("Online signing is not configured.");
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(value, secret));
}

function renderWaiverForm_(kind) {
  if (!waiverReady_()) {
    return HtmlService.createHtmlOutput("<h1>Online signing is not available yet</h1><p>Please contact yourpartyporch@gmail.com for a paper form.</p>");
  }
  var document = waiverDocument_(kind);
  var value = Utilities.base64EncodeWebSafe(JSON.stringify({
    id: Utilities.getUuid(), issued: Date.now(), kind: kind, version: WAIVER_VERSION
  }));
  var template = HtmlService.createTemplateFromFile("WaiverForm");
  template.configJson = JSON.stringify({
    kind: kind, version: WAIVER_VERSION, business: WAIVER_BUSINESS,
    today: Utilities.formatDate(new Date(), "America/Chicago", "yyyy-MM-dd"),
    document: document, electronicConsent: WAIVER_ESIGN,
    token: value + "." + waiverTokenSignature_(value)
  }).replace(/</g, "\\u003c");
  return template.evaluate().setTitle(document.title + " | The Party Porch");
}

function validateWaiver_(input) {
  if (!input || typeof input !== "object" || input.website) throw new Error("Invalid form submission.");
  if (typeof input.token !== "string" || input.token.length > 1500) throw new Error("Reload the form before signing.");
  var parts = input.token.split(".");
  if (parts.length !== 2 || parts[1] !== waiverTokenSignature_(parts[0])) throw new Error("Reload the form before signing.");
  var token = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (!validBookingId(token.id) || ["host", "participant"].indexOf(token.kind) === -1 ||
      token.version !== WAIVER_VERSION || typeof token.issued !== "number" ||
      token.issued > Date.now() + 60000 || Date.now() - token.issued > 86400000) {
    throw new Error("This form has expired or changed. Reload it and review the current agreement.");
  }
  function text(key, label, max, optional) {
    var value = input[key];
    if (typeof value !== "string" || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
      throw new Error("Enter a valid " + label + ".");
    }
    value = value.trim();
    if (!optional && !value) throw new Error("Enter " + label + ".");
    return value;
  }
  function date(key, label) {
    var value = text(key, label, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        isNaN(Date.parse(value + "T12:00:00Z")) ||
        new Date(value + "T12:00:00Z").toISOString().slice(0, 10) !== value) {
      throw new Error("Enter a valid " + label + ".");
    }
    return value;
  }
  function time(key, label) {
    var value = text(key, label, 5);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("Enter a valid " + label + ".");
    return value;
  }
  if (input.termsConsent !== true || input.electronicConsent !== true || input.adultConsent !== true) {
    throw new Error("An adult must read and accept the agreement and electronic-signature consent.");
  }
  var data = {
    id: token.id, kind: token.kind, version: token.version,
    service: text("service", "service type", 20),
    name: text("name", token.kind === "host" ? "host name" : "participant name", 120),
    eventDate: date("eventDate", "event date"),
    reference: text("reference", "booking reference", 120, true),
    email: text("email", "signer's email", 254),
    phone: text("phone", "signer's phone", 40),
    signer: text("signer", "signer's full legal name", 120),
    termsConsent: true, electronicConsent: true, adultConsent: true
  };
  if (["unrefereed", "refereed"].indexOf(data.service) === -1) throw new Error("Choose the service type.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new Error("Enter a valid email address.");
  if (data.phone.replace(/\D/g, "").length < 10) throw new Error("Enter a valid phone number.");
  if (token.kind === "host") {
    data.eventTime = time("eventTime", "event start time");
    data.address = text("address", "event address", 300);
    data.inventory = text("inventory", "equipment reference", 200, true);
    if (data.service === "unrefereed") {
      data.pickupDate = date("pickupDate", "agreed pickup date");
      data.pickupTime = time("pickupTime", "agreed pickup time");
      if (data.pickupDate < data.eventDate) throw new Error("Pickup cannot be before the event date.");
    }
  } else {
    data.participantType = text("participantType", "participant type", 10);
    if (["adult", "minor"].indexOf(data.participantType) === -1) throw new Error("Choose adult or minor.");
    data.emergencyName = text("emergencyName", "emergency contact name", 120);
    data.emergencyPhone = text("emergencyPhone", "emergency contact phone", 40);
    if (data.emergencyPhone.replace(/\D/g, "").length < 10) throw new Error("Enter a valid emergency contact phone.");
    if (data.participantType === "minor") {
      data.dateOfBirth = date("dateOfBirth", "child's date of birth");
      if (data.dateOfBirth > Utilities.formatDate(new Date(), "America/Chicago", "yyyy-MM-dd") ||
          data.dateOfBirth > data.eventDate) {
        throw new Error("The child's date of birth cannot be in the future or after the event date.");
      }
      data.age = Number(data.eventDate.slice(0, 4)) - Number(data.dateOfBirth.slice(0, 4)) -
        (data.eventDate.slice(5) < data.dateOfBirth.slice(5) ? 1 : 0);
      if (data.age < 1 || data.age > 17) {
        throw new Error("The minor must be age 1-17 on the event date. Participants age 18 or older must use the adult participant option.");
      }
      data.relationship = text("relationship", "relationship to the minor", 20);
      if (["Parent", "Legal guardian"].indexOf(data.relationship) === -1 || input.guardianConsent !== true) {
        throw new Error("Only this participant's parent or legal guardian may authorize their participation.");
      }
      data.guardianConsent = true;
    }
  }
  if ((data.kind === "host" || data.participantType === "adult") &&
      data.name.toLowerCase() !== data.signer.toLowerCase()) {
    throw new Error("The signature must match the host or adult participant's full legal name.");
  }
  return data;
}

function waiverEscape_(value) {
  return String(value).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function waiverTermsHtml_(document) {
  return "<p>" + waiverEscape_(document.intro) + "</p>" + document.sections.map(function (section) {
    return '<section' + (section.release ? ' class="release"' : "") + "><h2>" +
      waiverEscape_(section.title) + "</h2>" + (section.paragraphs || []).map(function (p) {
        return "<p>" + waiverEscape_(p) + "</p>";
      }).join("") + (section.bullets ? "<ul>" + section.bullets.map(function (p) {
        return "<li>" + waiverEscape_(p) + "</li>";
      }).join("") + "</ul>" : "") + "</section>";
  }).join("");
}

function waiverPdfHtml_(record) {
  var d = record.data;
  var fields = [
    ["Business", WAIVER_BUSINESS], ["Form version", d.version], ["Receipt ID", d.id],
    [d.kind === "host" ? "Host / renter" : "Participant", d.name],
    ["Service", d.service === "refereed" ? "Party Porch referee" : "No Party Porch referee"],
    ["Event date", d.eventDate], ["Booking reference", d.reference],
    ["Signer email", d.email], ["Signer phone", d.phone]
  ];
  if (d.kind === "host") {
    fields.push(["Event start time (Houston)", d.eventTime], ["Event address", d.address], ["Equipment reference", d.inventory]);
    if (d.pickupDate) fields.push(["Agreed pickup (Houston)", d.pickupDate + " " + d.pickupTime]);
  } else {
    fields.push(["Participant type", d.participantType], ["Emergency contact", d.emergencyName], ["Emergency phone", d.emergencyPhone]);
    if (d.participantType === "minor") fields.push(
      ["Child's date of birth", d.dateOfBirth], ["Age on event date", d.age],
      ["Parent / legal guardian", d.signer], ["Relationship", d.relationship]);
  }
  var consent = "I have read and agree to the agreement above. I am at least 18 and sign for myself as host/adult participant, or as this minor's parent/legal guardian.";
  if (d.guardianConsent) consent += " I confirm I am this minor's parent or legal guardian and authorize their participation.";
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
    "@page{size:Letter;margin:.5in}body{font-family:Arial,sans-serif;font-size:10pt;line-height:1.35;color:#12263a}" +
    "h1{font-size:20pt}h2{font-size:12pt}dt{font-weight:bold}dd{margin:0 0 5px}li{margin:4px 0}" +
    ".release{border:2px solid #12263a;padding:10px}.signature{border-top:2px solid #12263a;margin-top:18px;padding-top:10px;break-inside:avoid}" +
    "</style></head><body><h1>" + waiverEscape_(record.document.title) + "</h1><dl>" +
    fields.map(function (field) { return "<dt>" + waiverEscape_(field[0]) + "</dt><dd>" + waiverEscape_(field[1] || "Not provided") + "</dd>"; }).join("") +
    "</dl>" + waiverTermsHtml_(record.document) +
    '<section class="signature"><h2>Electronic signature</h2><p>' + waiverEscape_(consent) +
    "</p><p>" + waiverEscape_(record.electronicConsent) + "</p><p><strong>Signed by: " + waiverEscape_(d.signer) +
    "</strong></p><p>Accepted at (UTC): " + waiverEscape_(record.acceptedAt) +
    "<br>Accepted at (Houston): " + waiverEscape_(record.acceptedAtHouston) +
    "</p><p>Signature method: typed name with affirmative consent. This record does not verify the signer's identity.</p>" +
    "<p>Contact: yourpartyporch@gmail.com</p></section></body></html>";
}

function waiverFileByName_(folder, name) {
  var files = folder.getFilesByName(name);
  var file = files.hasNext() ? files.next() : null;
  if (files.hasNext()) throw new Error("Duplicate waiver record files require owner review.");
  return file;
}

function saveWaiverSignerContact_(record, journal) {
  if (record.contactStatus === "saved" || record.contactStatus === "needs_review") return;
  try {
    if (record.contactStatus === "saving") {
      throw new Error("An interrupted waiver contact save needs review in Google Contacts before retrying.");
    }
    record.contactStatus = "saving";
    journal.setContent(JSON.stringify(record));
    record.contactResourceName = saveCustomerContact({
      name: record.data.signer, email: record.data.email, phone: ""
    });
    record.contactStatus = "saved";
    journal.setContent(JSON.stringify(record));
  } catch (err) {
    record.contactStatus = "needs_review";
    try { journal.setContent(JSON.stringify(record)); }
    catch (saveError) { console.error("Waiver contact outcome could not be recorded: " + String(saveError)); }
    reportOwnerAutomationFailure("Waiver signer Google Contacts save", err,
      "Receipt: " + record.data.id + "\nAdult signer: " + record.data.signer +
      "\nEmail: " + record.data.email + "\nThe signed waiver remains saved in Drive. Review Contacts before a manual retry.");
  }
}

function submitWaiver(input) {
  var data;
  try {
    data = validateWaiver_(input);
  } catch (err) {
    console.error("Waiver validation rejected: " + String(err));
    return { ok: false, canEdit: true, error: String(err.message || "Review the form and try again.") };
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var folderId = PropertiesService.getScriptProperties().getProperty("WAIVER_FOLDER_ID");
    if (!folderId) throw new Error("Waiver storage has not been installed.");
    var folder = DriveApp.getFolderById(folderId);
    assertWaiverFolderPrivate_(folder);
    var fingerprint = Utilities.base64EncodeWebSafe(Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256, JSON.stringify(data)));
    var journalName = "waiver-" + data.id + ".json";
    var journal = waiverFileByName_(folder, journalName);
    var record;
    if (journal) {
      record = JSON.parse(journal.getBlob().getDataAsString());
      if (record.fingerprint !== fingerprint) throw new Error("A receipt cannot be reused with changed information.");
    } else {
      var accepted = new Date();
      record = {
        data: data, fingerprint: fingerprint, document: waiverDocument_(data.kind),
        electronicConsent: WAIVER_ESIGN, acceptedAt: accepted.toISOString(),
        acceptedAtHouston: Utilities.formatDate(accepted, "America/Chicago", "yyyy-MM-dd HH:mm:ss z"),
        pdfName: "Party-Porch-" + data.kind + "-" + data.eventDate + "-" + data.id + ".pdf",
        emailStatus: "pending"
      };
      journal = folder.createFile(Utilities.newBlob(JSON.stringify(record), "application/json", journalName));
    }
    var pdf = waiverFileByName_(folder, record.pdfName);
    if (!pdf) {
      var blob = Utilities.newBlob(waiverPdfHtml_(record), "text/html", "waiver.html").getAs(MimeType.PDF);
      pdf = folder.createFile(blob.setName(record.pdfName));
    }
    saveWaiverSignerContact_(record, journal);
    if (record.emailStatus === "pending") {
      record.emailStatus = "sending";
      journal.setContent(JSON.stringify(record));
      try {
        MailApp.sendEmail({
          to: WAIVER_EMAIL, subject: "Signed Party Porch " + data.kind + " waiver - " + data.eventDate + " - " + data.id,
          body: "A waiver was signed online and saved privately in Google Drive.\n\n" +
            "Form: " + record.document.title + "\nEvent date: " + data.eventDate +
            "\nReceipt: " + data.id + "\nSigned at: " + record.acceptedAtHouston +
            "\nAdult signer contact: " + record.contactStatus +
            "\nPrivate PDF: " + pdf.getUrl() + "\n\nThe signed PDF is attached. " +
            "A host form does not replace individual participant/guardian forms. A typed signature does not independently verify identity.",
          attachments: [pdf.getBlob().setName(record.pdfName)]
        });
        record.emailStatus = "sent";
        journal.setContent(JSON.stringify(record));
      } catch (mailError) {
        record.emailStatus = "uncertain";
        journal.setContent(JSON.stringify(record));
        console.error("Waiver " + data.id + " saved; email delivery is unconfirmed: " + String(mailError));
      }
    }
    return {
      ok: true, id: data.id, signedAt: record.acceptedAt, emailStatus: record.emailStatus,
      contactStatus: record.contactStatus,
      pdfName: record.pdfName, pdfBase64: Utilities.base64Encode(pdf.getBlob().getBytes())
    };
  } catch (err) {
    console.error("Waiver " + data.id + " submission failed: " + String(err));
    return { ok: false, canEdit: false, error: "We could not confirm the signed PDF was saved. Retry this same submission. If this continues, contact yourpartyporch@gmail.com with receipt " + data.id + ". Do not assume the waiver is complete." };
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}
