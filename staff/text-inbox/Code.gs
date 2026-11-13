/**
 * SEPARATE private Apps Script project. Never add this to the public booking app.
 * Deploy as Me / Only myself. Every browser-callable operation also checks owner.
 * Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM in Script Properties.
 */
var INBOX_OWNER = "yourpartyporch@gmail.com";
var INBOX_RECEIPT_PREFIX = "inbox_send_";
var INBOX_PAGE_SIZE = 100;
var INBOX_TOKEN_LIFETIME = 86400000;

function requireInboxOwner_() {
  if (Session.getActiveUser().getEmail().toLowerCase() !== INBOX_OWNER) {
    throw new Error("Access denied. Sign in as the Party Porch business account.");
  }
}

function doGet() {
  requireInboxOwner_();
  return HtmlService.createHtmlOutputFromFile("Index").setTitle("Party Porch Text Inbox");
}

function inboxError_(message, kind, definite) {
  var err = new Error(message);
  err.kind = kind || "configuration";
  err.definite = definite === true;
  return err;
}

function inboxFailure_(err, canEdit) {
  console.error("Text inbox operation failed: " + (err.kind || "internal"));
  return {ok: false, error: err.kind ? err.message : "The inbox operation failed. Check Apps Script executions and try again.",
    canEdit: canEdit === true};
}

function inboxCredentials_() {
  var props = PropertiesService.getScriptProperties();
  var sid = props.getProperty("TWILIO_ACCOUNT_SID") || "";
  var token = props.getProperty("TWILIO_AUTH_TOKEN") || "";
  var from = props.getProperty("TWILIO_FROM") || "";
  if (!/^AC[a-f0-9]{32}$/i.test(sid) || !token || !/^\+1\d{10}$/.test(from)) {
    throw inboxError_("Set valid TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM in this project's private Script Properties.");
  }
  return {sid: sid, token: token, from: from};
}

function inboxTwilio_(resource, method, payload) {
  var credentials = inboxCredentials_();
  if (!/^(IncomingPhoneNumbers\.json|Messages(?:\/(?:SM|MM)[a-f0-9]{32})?\.json)(\?|$)/i.test(resource)) {
    throw inboxError_("Unsupported Twilio resource.", "validation", true);
  }
  var options = {
    method: method, muteHttpExceptions: true,
    headers: {Authorization: "Basic " + Utilities.base64Encode(credentials.sid + ":" + credentials.token)}
  };
  if (payload) options.payload = payload;
  var response;
  try {
    response = UrlFetchApp.fetch("https://api.twilio.com/2010-04-01/Accounts/" +
      credentials.sid + "/" + resource, options);
  } catch (err) {
    throw inboxError_("The connection to Twilio failed. A send may already have been accepted; do not resend without checking.", "network");
  }
  var status = response.getResponseCode();
  var data;
  try { data = JSON.parse(response.getContentText()); }
  catch (err) { throw inboxError_("Twilio returned an unreadable response. Check the inbox before repeating a send.", "provider"); }
  if (status < 200 || status >= 300) {
    throw inboxError_("Twilio request failed (HTTP " + status +
      (typeof data.code === "number" ? ", code " + data.code : "") +
      "). Check Twilio logs, credentials, balance and messaging registration.", "provider", status >= 400 && status < 500);
  }
  return data;
}

function inboxPageToken_(data, resource) {
  if (!data.next_page_uri) return "";
  var prefix = "/2010-04-01/Accounts/" + inboxCredentials_().sid + "/" + resource + "?";
  if (typeof data.next_page_uri !== "string" || data.next_page_uri.indexOf(prefix) !== 0) {
    throw inboxError_("Twilio returned an unexpected pagination address.", "provider");
  }
  var match = data.next_page_uri.match(/[?&]PageToken=([^&]+)/);
  if (!match) throw inboxError_("Twilio pagination token is missing.", "provider");
  return decodeURIComponent(match[1]);
}

function inboxSenders_(fresh) {
  var cache = CacheService.getScriptCache();
  var cacheKey = "inbox_senders_" + inboxCredentials_().sid;
  var cached = fresh ? null : cache.get(cacheKey);
  if (cached) return JSON.parse(cached);
  var senders = [], pageToken = "";
  for (var page = 0; page < 10; page++) {
    var data = inboxTwilio_("IncomingPhoneNumbers.json?PageSize=100" +
      (pageToken ? "&PageToken=" + encodeURIComponent(pageToken) : ""), "get");
    if (!Array.isArray(data.incoming_phone_numbers)) throw inboxError_("Twilio's phone-number list is unavailable.", "provider");
    data.incoming_phone_numbers.forEach(function(item) {
      if (item.capabilities && item.capabilities.sms === true && /^\+1\d{10}$/.test(item.phone_number)) {
        senders.push({number: item.phone_number, label: item.friendly_name || item.phone_number});
      }
    });
    pageToken = inboxPageToken_(data, "IncomingPhoneNumbers.json");
    if (!pageToken) {
      if (!senders.length) throw inboxError_("No SMS-capable US phone numbers were found in this Twilio account.");
      cache.put(cacheKey, JSON.stringify(senders), 60);
      return senders;
    }
  }
  throw inboxError_("Too many phone-number pages. Review this account's sender configuration.", "provider");
}

function inboxValidateSender_(number) {
  if (typeof number !== "string" || !inboxSenders_(false).some(function(sender) { return sender.number === number; })) {
    throw inboxError_("Choose an SMS-capable phone number owned by this Twilio account.", "validation", true);
  }
  return number;
}

function initializeTextInbox() {
  requireInboxOwner_();
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  var credentials = inboxCredentials_();
  var senders = inboxSenders_(true);
  if (!senders.some(function(sender) { return sender.number === credentials.from; })) {
    throw inboxError_("TWILIO_FROM is not an SMS-capable US number in this account.");
  }
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty("INBOX_TOKEN_SECRET")) {
    props.setProperty("INBOX_TOKEN_SECRET", Utilities.getUuid() + Utilities.getUuid());
  }
  console.log("Private inbox connection verified. No text was sent and no webhook was changed.");
}

function inboxTokenSignature_(value) {
  var secret = PropertiesService.getScriptProperties().getProperty("INBOX_TOKEN_SECRET");
  if (!secret) throw inboxError_("Run initializeTextInbox in the Apps Script editor first.");
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(value, secret));
}

function createInboxSendToken() {
  requireInboxOwner_();
  try {
    var value = Utilities.base64EncodeWebSafe(JSON.stringify({id: Utilities.getUuid(), owner: INBOX_OWNER, issued: Date.now()}));
    return {ok: true, token: value + "." + inboxTokenSignature_(value)};
  } catch (err) { return inboxFailure_(err, true); }
}

function inboxReadToken_(token) {
  if (typeof token !== "string" || token.length > 1500) throw inboxError_("Reload the inbox before sending.", "validation", true);
  var parts = token.split(".");
  if (parts.length !== 2 || parts[1] !== inboxTokenSignature_(parts[0])) throw inboxError_("Reload the inbox before sending.", "validation", true);
  var data = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (!/^[a-f0-9-]{36}$/i.test(data.id) || data.owner !== INBOX_OWNER ||
      typeof data.issued !== "number" || data.issued > Date.now() + 60000 ||
      Date.now() - data.issued > INBOX_TOKEN_LIFETIME) {
    throw inboxError_("The send session expired. Reload the inbox; your unsent draft will not be stored.", "expired", true);
  }
  return data;
}

function getInboxConfiguration() {
  requireInboxOwner_();
  try {
    var credentials = inboxCredentials_();
    var senders = inboxSenders_(false);
    if (!senders.some(function(sender) { return sender.number === credentials.from; })) {
      throw inboxError_("TWILIO_FROM does not match an available sender.");
    }
    var token = createInboxSendToken();
    if (!token.ok) return token;
    return {ok: true, owner: INBOX_OWNER, senders: senders, defaultSender: credentials.from, sendToken: token.token};
  } catch (err) { return inboxFailure_(err, true); }
}

function getInboxMessages(input) {
  requireInboxOwner_();
  try {
    if (!input || typeof input !== "object") throw inboxError_("Choose a business number.", "validation", true);
    var sender = inboxValidateSender_(input.sender);
    var pageToken = input.pageToken || "";
    if (typeof pageToken !== "string" || pageToken.length > 3000 || /[\u0000-\u001f]/.test(pageToken)) {
      throw inboxError_("Invalid history page. Refresh the inbox.", "validation", true);
    }
    var data = inboxTwilio_("Messages.json?PageSize=" + INBOX_PAGE_SIZE +
      (pageToken ? "&PageToken=" + encodeURIComponent(pageToken) : ""), "get");
    if (!Array.isArray(data.messages)) throw inboxError_("Twilio's message history is unavailable.", "provider");
    var messages = data.messages.filter(function(message) {
      return message.from === sender || message.to === sender;
    }).map(function(message) {
      var date = new Date(message.date_created);
      if (!/^(SM|MM)[a-f0-9]{32}$/i.test(message.sid) ||
          typeof message.date_created !== "string" || isNaN(date.getTime()) ||
          !Number.isInteger(Number(message.num_media || 0)) || Number(message.num_media || 0) < 0 ||
          typeof message.from !== "string" || typeof message.to !== "string") {
        throw inboxError_("A Twilio message has incomplete metadata. Check the Console.", "provider");
      }
      return {
        id: message.sid, from: message.from, to: message.to,
        outbound: message.from === sender, peer: message.from === sender ? message.to : message.from,
        body: typeof message.body === "string" ? message.body : null,
        status: message.status || "status unavailable", at: date.toISOString(),
        mediaCount: Number(message.num_media || 0), errorCode: message.error_code || null
      };
    });
    return {ok: true, messages: messages, nextPageToken: inboxPageToken_(data, "Messages.json"), checkedAt: new Date().toISOString()};
  } catch (err) { return inboxFailure_(err, true); }
}

function inboxValidateSend_(input) {
  if (!input || typeof input !== "object") throw inboxError_("Enter a recipient and message.", "validation", true);
  var session = inboxReadToken_(input.token);
  if (typeof input.from !== "string" || !/^\+1\d{10}$/.test(input.from) ||
      typeof input.to !== "string" || input.to.length > 40) throw inboxError_("Choose a sender and valid US recipient.", "validation", true);
  var digits = input.to.replace(/[()\s.+-]/g, "");
  if (digits.length === 11 && digits.charAt(0) === "1") digits = digits.slice(1);
  if (!/^\d{10}$/.test(digits)) throw inboxError_("Enter a US recipient with 10 digits or +1 followed by 10 digits.", "validation", true);
  if (typeof input.body !== "string" || !input.body.trim() || input.body.length > 1600 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.body)) {
    throw inboxError_("Enter a message of 1-1600 characters without unsupported control characters.", "validation", true);
  }
  if (input.consent !== true) throw inboxError_("Confirm the recipient has agreed to receive business texts.", "validation", true);
  return {id: session.id, from: input.from, to: "+1" + digits, body: input.body.replace(/\r\n?/g, "\n").trim(), consent: true};
}

function inboxReceiptResult_(record) {
  if (record.state === "accepted") return {ok: true, id: record.sid, status: record.status, duplicate: true};
  if (record.state === "rejected") return {ok: false, canEdit: true, error: record.error};
  return {ok: false, canEdit: false,
    error: "Delivery is unconfirmed. The message may already have been sent. Refresh this conversation and check Twilio logs before starting another send."};
}

function sendInboxText(input) {
  requireInboxOwner_();
  var data;
  try { data = inboxValidateSend_(input); }
  catch (err) { return inboxFailure_(err, true); }
  var lock = LockService.getScriptLock();
  var props = PropertiesService.getScriptProperties();
  var record, key = INBOX_RECEIPT_PREFIX + data.id;
  try {
    lock.waitLock(30000);
    var fingerprint = Utilities.base64EncodeWebSafe(Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256, JSON.stringify(data)));
    var previous = props.getProperty(key);
    if (previous) {
      record = JSON.parse(previous);
      if (record.fingerprint !== fingerprint) throw inboxError_("This send session was already used with different message details. Start a new draft.", "validation", true);
      return inboxReceiptResult_(record);
    }
    inboxValidateSender_(data.from);
    var cutoff = Date.now() - 8 * 86400000;
    Object.keys(props.getProperties()).forEach(function(name) {
      if (name.indexOf(INBOX_RECEIPT_PREFIX) === 0 && JSON.parse(props.getProperty(name)).created < cutoff) {
        props.deleteProperty(name);
      }
    });
    record = {fingerprint: fingerprint, state: "sending", created: Date.now(), consent: true};
    props.setProperty(key, JSON.stringify(record));
    var result = inboxTwilio_("Messages.json", "post", {From: data.from, To: data.to, Body: data.body});
    if (!/^(SM|MM)[a-f0-9]{32}$/i.test(result.sid) || !result.status) {
      throw inboxError_("Twilio did not confirm the message receipt. Check the conversation before sending again.", "provider");
    }
    if (result.error_code || result.status === "failed" || result.status === "undelivered") {
      throw inboxError_("Twilio reports the message failed" +
        (result.error_code ? " (code " + result.error_code + ")" : "") + ". Check the Console before another attempt.", "provider", true);
    }
    record.state = "accepted"; record.sid = result.sid; record.status = result.status;
    props.setProperty(key, JSON.stringify(record));
    return {ok: true, id: result.sid, status: result.status, duplicate: false};
  } catch (err) {
    if (record && record.state === "sending") {
      record.state = err.definite ? "rejected" : "uncertain";
      record.error = err.kind ? err.message : "Could not confirm the send. Check the conversation before repeating it.";
      try { props.setProperty(key, JSON.stringify(record)); }
      catch (saveError) { console.error("Could not record inbox send outcome. Do not repeat the send without checking."); }
      return inboxReceiptResult_(record);
    }
    return inboxFailure_(err, record ? false : true);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function checkInboxSend(input) {
  requireInboxOwner_();
  try {
    var session = inboxReadToken_(input && input.token);
    var stored = PropertiesService.getScriptProperties().getProperty(INBOX_RECEIPT_PREFIX + session.id);
    if (!stored) return {ok: false, canEdit: false, error: "No send receipt was found. Check the conversation before starting another attempt."};
    var record = JSON.parse(stored);
    if (record.state !== "accepted") return inboxReceiptResult_(record);
    var message = inboxTwilio_("Messages/" + record.sid + ".json", "get");
    return {ok: true, id: record.sid, status: message.status || "status unavailable", errorCode: message.error_code || null};
  } catch (err) { return inboxFailure_(err, false); }
}
