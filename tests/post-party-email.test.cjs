const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
process.env.TZ = 'America/Chicago';
const root = path.join(__dirname, '..');
const source = ['google-calendar.gs', 'waivers.gs', 'post-party-email.gs']
  .map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const owner = 'yourpartyporch@gmail.com';
const url = 'https://script.google.com/macros/s/test-booking/exec';
const escape = text => String(text).replace(/[&<>"']/g, char =>
  ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));

function harness(options = {}) {
  let now = Date.parse('2026-11-16T15:00:00Z'), sequence = 0, locked = false;
  const properties = new Map([
    ['WAIVER_FOLDER_ID', 'private-waivers'], ['POST_PARTY_MAILING_ADDRESS', '123 Test Street, Houston, TX 77018'],
    ['POST_PARTY_WEBAPP_URL', url], ['POST_PARTY_START_DATE', '2026-11-14']
  ]);
  const files = [], events = [], emails = [], logs = [], triggers = [];
  const store = {getProperty: key => properties.get(key) || null,
    setProperty(key, value) {properties.set(key, value);}};
  class Clock extends Date {
    constructor(...args) {super(...(args.length ? args : [now]));}
    static now() {return now;}
  }
  const blob = (text, type, name) => ({getDataAsString: () => text, getName: () => name});
  const iterator = array => {let index = 0; return {hasNext: () => index < array.length, next: () => array[index++]};};
  const folder = {
    getOwner: () => ({getEmail: () => owner}),
    getSharingAccess: () => options.shared ? 'anyone' : 'private',
    getEditors: () => [], getViewers: () => [], isTrashed: () => false,
    getFiles: () => iterator(files.slice()),
    getFilesByName: name => iterator(files.filter(file => file.name === name)),
    createFile(contents) {
      const file = {name: contents.getName(), contents: contents.getDataAsString(),
        getName: () => file.name,
        getBlob: () => blob(file.contents, 'application/json', file.name),
        getUrl: () => 'https://drive.google.com/private/test',
        setContent(value) {
          if (options.failSentWrite && file.name.startsWith('post-party-delivery-') &&
              Object.values(JSON.parse(value).recipients).some(item => item.status === 'sent')) {
            throw new Error('Status write failed after accepted email');
          }
          if (options.preferenceWriteFailure && file.name.startsWith('post-party-contact-')) {
            throw new Error('Preference save failed');
          }
          file.contents = value;
        }};
      files.push(file);
      return file;
    }
  };
  const output = html => ({html, getContent: () => html});
  const context = {
    Date: Clock,
    console: {log: text => logs.push(text), error: text => logs.push(text)},
    Session: {getActiveUser: () => ({getEmail: () => options.activeEmail ?? owner}),
      getScriptTimeZone: () => options.timezone || 'America/Chicago'},
    PropertiesService: {getScriptProperties: () => store},
    DriveApp: {Access: {PRIVATE: 'private'}, getFolderById: () => folder},
    CalendarApp: {getCalendarById: () => ({getEvents: (start, end) =>
      events.filter(event => event.getStartTime() < end && event.getEndTime() > start)})},
    Utilities: {
      getUuid: () => `${String(++sequence).padStart(8, '0')}-1234-4234-8234-123456789abc`,
      newBlob: blob, DigestAlgorithm: {SHA_256: 'sha256'},
      computeDigest: (algorithm, value) => [...crypto.createHash(algorithm).update(value).digest()],
      base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url'),
      formatDate: (date, zone, pattern) => {
        assert.equal(pattern, 'yyyy-MM-dd');
        return new Intl.DateTimeFormat('en-CA', {timeZone: zone}).format(date);
      }
    },
    LockService: {getScriptLock() {
      let owned = false;
      return {waitLock() {assert.equal(locked, false); locked = owned = true;},
        hasLock: () => owned, releaseLock() {locked = owned = false;}};
    }},
    MailApp: {getRemainingDailyQuota: () => options.quota ?? 100,
      sendEmail(email) {
        emails.push(email);
        if (options.mailFailure && email.to !== owner) throw new Error('Lost mail response');
      }},
    ScriptApp: {
      AuthMode: {FULL: 'full'}, requireAllScopes() {},
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: trigger => triggers.splice(triggers.indexOf(trigger), 1),
      newTrigger(handler) {
        const trigger = {handler, getHandlerFunction: () => handler,
          timeBased() {return this;}, atHour(hour) {this.hour = hour; return this;},
          nearMinute(minute) {this.minute = minute; return this;},
          everyDays(days) {this.days = days; return this;},
          inTimezone(timezone) {this.timezone = timezone; return this;},
          create() {triggers.push(this);}};
        return trigger;
      }
    },
    UrlFetchApp: {fetch() {return {
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify(options.oldEndpoint ?
        {ok: true, service: 'Party Porch availability'} : {ok: true, version: 'post-party-v1'})
    };}},
    ContentService: {MimeType: {JSON: 'json', JAVASCRIPT: 'js'},
      createTextOutput: content => ({content, setMimeType() {return this;}})},
    HtmlService: {createHtmlOutput: output,
      createTemplateFromFile(name) {
        assert.equal(name, 'PostPartyEmail');
        return {evaluate() {
          const template = fs.readFileSync(path.join(root, 'PostPartyEmail.html'), 'utf8');
          let cursor = 0;
          const parts = ['var html = "";'];
          for (const match of template.matchAll(/<\?([=]?)([\s\S]*?)\?>/g)) {
            parts.push('html += ' + JSON.stringify(template.slice(cursor, match.index)) + ';');
            parts.push(match[1] ? 'html += escape(' + match[2].trim() + ');' : match[2]);
            cursor = match.index + match[0].length;
          }
          parts.push('html += ' + JSON.stringify(template.slice(cursor)) + ';', 'html;');
          return output(vm.runInNewContext(parts.join('\n'), {...this, escape}));
        }};
      }}
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  function event(overrides = {}) {
    const data = {id: 'calendar-party', date: '2026-11-14', time: '14:00', title: 'Party Porch Nerf party',
      description: 'Items: nerf\nCustomer: Test Host\nReference: PARTY-A', ...overrides};
    const item = {data, getId: () => data.id, getTitle: () => data.title, getDescription: () => data.description,
      getStartTime: () => context.parseStart(data.date, data.time),
      getEndTime: () => new Date(context.parseStart(data.date, data.time).getTime() + 3 * 3600000)};
    events.push(item);
    return item;
  }
  function waiver(overrides = {}, extra = {}) {
    const id = context.Utilities.getUuid();
    const data = {id, kind: 'participant', participantType: 'minor', signer: 'Adult Guardian',
      name: 'Child name never mailed', eventDate: '2026-11-14', reference: '',
      adultConsent: true, termsConsent: true, electronicConsent: true, guardianConsent: true,
      email: 'adult@example.com', ...overrides};
    const record = {data, pdfName: 'waiver-' + id + '.pdf', ...extra};
    folder.createFile(blob(JSON.stringify(record), 'application/json', 'waiver-' + id + '.json'));
    if (!extra.noPdf) folder.createFile(blob('PDF', 'application/pdf', record.pdfName));
    return record;
  }
  function enable() {properties.set('POST_PARTY_EMAILS', 'enabled');}
  function run() {return context.sendPostPartyEmails_();}
  function preferenceToken(email = 'adult@example.com') {
    return JSON.parse(files.find(file => file.name.startsWith('post-party-contact-') &&
      JSON.parse(file.contents).email === email).contents).token;
  }
  const attendeeEmails = () => emails.filter(email => email.to !== owner);
  return {context, files, properties, events, emails, logs, triggers, folder,
    event, waiver, enable, run, preferenceToken, attendeeEmails, setNow: value => {now = Date.parse(value);}};
}

test('default is disabled; ZIP-only address, wrong timezone and stale unsubscribe deployment prevent sending or installation', () => {
  const h = harness(); h.event(); h.waiver();
  assert.throws(() => h.run(), /disabled/);
  h.enable(); h.properties.set('POST_PARTY_MAILING_ADDRESS', '77018');
  assert.throws(() => h.run(), /ZIP code alone/);
  assert.throws(() => h.context.installPostPartyEmails(), /ZIP code alone/);
  assert.throws(() => h.context.sendPostPartyTestEmail(), /ZIP code alone/);
  assert.equal(h.emails.length, 0);
  assert.throws(() => harness({timezone: 'UTC'}).context.sendPostPartyTestEmail(), /time zone/);
  assert.throws(() => harness({oldEndpoint: true}).context.sendPostPartyTestEmail(), /unsubscribe routing/);
});

test('preview is owner-only and sends nothing even before a full address exists', () => {
  const h = harness(); h.event(); h.waiver();
  h.properties.delete('POST_PARTY_MAILING_ADDRESS');
  const result = h.context.previewPostPartyEmails();
  assert.equal(result.parties, 1);
  const preview = h.files.find(file => file.name === 'post-party-preview.html').contents;
  assert.match(preview, /adult@example.com/);
  assert.match(preview, /Full business mailing address required/);
  assert.doesNotMatch(preview, /Child name never mailed/);
  assert.equal(h.emails.length, 0);
  for (const action of ['previewPostPartyEmails', 'sendPostPartyTestEmail', 'installPostPartyEmails', 'disablePostPartyEmails', 'savePostPartyOptOuts', 'sendDuePostPartyEmails']) {
    assert.throws(() => harness({activeEmail: ''}).context[action](), /Run this action/);
  }
});

test('owner test sends only to business account; installer adds one Houston 9 AM trigger and no attendee mail', () => {
  const h = harness(); h.event(); h.waiver();
  assert.throws(() => h.context.installPostPartyEmails(), /owner test first/);
  h.context.sendPostPartyTestEmail();
  assert.equal(h.emails.length, 1);
  assert.equal(h.emails[0].to, owner);
  assert.match(h.emails[0].subject, /OWNER TEST/);
  h.context.installPostPartyEmails(); h.context.installPostPartyEmails();
  assert.equal(h.triggers.length, 1);
  assert.equal(h.triggers[0].hour, 9);
  assert.equal(h.triggers[0].timezone, 'America/Chicago');
  assert.equal(h.attendeeEmails().length, 0);
});

test('two-day follow-up deduplicates adult emails, ignores Contacts and does not add unsigned hosts or expose children', () => {
  const h = harness(); h.event(); h.enable();
  h.waiver(); h.waiver({email: ' ADULT@EXAMPLE.COM '});
  h.waiver({kind: 'host', email: 'signing-host@example.com'});
  assert.throws(() => harness().context.sendDuePostPartyEmails(), /disabled/);
  const result = h.context.sendDuePostPartyEmails();
  assert.equal(result.sent, 2);
  assert.deepEqual(h.attendeeEmails().map(email => email.to).sort(), ['adult@example.com', 'signing-host@example.com']);
  const email = h.attendeeEmails()[0];
  assert.equal(email.bcc, undefined);
  assert.equal(email.replyTo, owner);
  assert.match(email.htmlBody, /Epic Nerf battles/);
  assert.match(email.htmlBody, /NERFTHANKS10/);
  assert.match(email.body, /supply packs/);
  assert.doesNotMatch(email.body + email.htmlBody, /Child name never mailed|Test Host/);
  assert.equal(h.context.sendDuePostPartyEmails().sent, 0);
  assert.equal(h.attendeeEmails().length, 2);
});

test('cancellation, closed dates, pickup, quote, test and unpaid/released tracked entries never cause a follow-up', () => {
  for (const title of ['CANCELLED Nerf party', 'CANCELED Nerf party', 'CLOSED Nerf', 'Nerf pickup', 'TEST Nerf party', 'Nerf quote']) {
    const h = harness(); h.event({title}); h.waiver(); h.enable(); h.run();
    assert.equal(h.attendeeEmails().length, 0, title);
  }
  for (const status of ['pending', 'released', 'failed', null]) {
    const h = harness(); h.event({description: 'Items: nerf\nBooking ID: abc'}); h.waiver(); h.enable();
    if (status) h.properties.set('booking_abc', JSON.stringify({status}));
    h.run();
    assert.equal(h.attendeeEmails().length, 0, status);
  }
  const paid = harness(); paid.event({description: 'Items: nerf\nBooking ID: abc'}); paid.waiver(); paid.enable();
  paid.properties.set('booking_abc', JSON.stringify({status: 'paid'}));
  assert.equal(paid.run().sent, 1);
  const operational = harness(); operational.event(); operational.waiver(); operational.enable();
  operational.event({id: 'pickup', title: 'Nerf pickup'});
  operational.event({id: 'closure', title: 'CLOSED Nerf cleaning'});
  assert.equal(operational.run().sent, 1, 'Non-party operations must not make a real party match ambiguous');
});

test('same-day parties require an exact unique reference; excluded parties still make date-only matches ambiguous', () => {
  const h = harness(); h.enable();
  h.event(); h.event({id: 'second-party', title: 'CANCELLED Nerf party', description: 'Items: nerf\nReference: PARTY-B'});
  h.waiver({email: 'ambiguous@example.com'});
  h.waiver({email: 'good@example.com', reference: 'party-a'});
  h.waiver({email: 'cancelled@example.com', reference: 'PARTY-B'});
  h.waiver({email: 'wrong-reference@example.com', reference: 'NO-MATCH'});
  const result = h.run();
  assert.equal(result.sent, 1);
  assert.equal(result.needsReview, 2);
  assert.equal(h.attendeeEmails()[0].to, 'good@example.com');
});

test('unsaved, incomplete or non-adult consent records are held for review, not mailed', () => {
  const h = harness(); h.event(); h.enable();
  h.waiver({email: 'no-consent@example.com', adultConsent: false});
  h.waiver({email: 'no-guardian@example.com', guardianConsent: false});
  h.waiver({email: 'bad-type@example.com', participantType: 'unknown'});
  h.waiver({email: 'no-pdf@example.com'}, {noPdf: true});
  h.waiver({email: 'invalid'});
  assert.equal(h.run().sent, 0);
  assert.equal(h.attendeeEmails().length, 0);
});

test('unsubscribe GET does not change preferences; confirmed POST suppresses all future parties and exposes no email', () => {
  const h = harness(); h.event(); h.waiver(); h.enable(); h.run();
  const token = h.preferenceToken();
  assert.doesNotMatch(token, /adult|example|@/);
  const get = h.context.doGet({parameter: {action: 'unsubscribe', token}});
  assert.match(get.html, /<form method="post"/);
  assert.doesNotMatch(get.html, /adult@example.com/);
  assert.equal(JSON.parse(h.files.find(file => file.name.startsWith('post-party-contact-')).contents).unsubscribed, false);
  assert.equal(h.run().suppressed, 0);
  const post = h.context.doPost({parameter: {action: 'unsubscribe', token, confirm: 'unsubscribe'}});
  assert.match(post.html, /You are unsubscribed/);
  h.event({id: 'later-party', date: '2026-11-15'});
  h.waiver({eventDate: '2026-11-15'});
  h.setNow('2026-11-17T15:00:00Z');
  assert.equal(h.run().suppressed, 1);
  assert.equal(h.attendeeEmails().length, 1);
  h.context.disablePostPartyEmails();
  h.setNow('2027-03-01T15:00:00Z');
  h.properties.delete('POST_PARTY_MAILING_ADDRESS');
  h.properties.set('POST_PARTY_SUPPRESS_EMAILS', 'not-an-email');
  assert.match(h.context.doGet({parameter: {action: 'unsubscribe', token}}).html, /<form/);
  assert.match(h.context.doPost({parameter: {action: 'unsubscribe', token, confirm: 'unsubscribe'}}).html, /You are unsubscribed/);
});

test('forged tokens, unconfirmed POSTs and failed preference writes never claim a successful unsubscribe', () => {
  const h = harness(); h.event(); h.waiver(); h.enable(); h.run();
  const token = h.preferenceToken();
  for (const value of ['invalid', token.slice(0, -1) + '0']) {
    assert.match(h.context.doPost({parameter: {action: 'unsubscribe', token: value, confirm: 'unsubscribe'}}).html, /could not confirm/);
  }
  assert.match(h.context.doPost({parameter: {action: 'unsubscribe', token}}).html, /could not confirm/);
  const fail = harness({preferenceWriteFailure: true}); fail.event(); fail.waiver(); fail.enable(); fail.run();
  assert.match(fail.context.doPost({parameter: {action: 'unsubscribe', token: fail.preferenceToken(), confirm: 'unsubscribe'}}).html, /could not confirm/);
});

test('manual prior opt-outs suppress the first email; removing that list does not reverse a recorded unsubscribe', () => {
  const h = harness(); h.event(); h.waiver(); h.enable();
  h.properties.set('POST_PARTY_SUPPRESS_EMAILS', 'ADULT@example.com');
  h.context.savePostPartyOptOuts();
  assert.equal(h.run().sent, 0);
  assert.equal(h.attendeeEmails().length, 0);
  h.properties.delete('POST_PARTY_SUPPRESS_EMAILS');
  assert.equal(h.run().sent, 0);
  assert.equal(h.run().suppressed, 1);
  h.properties.set('POST_PARTY_SUPPRESS_EMAILS', 'invalid');
  assert.throws(() => h.run(), /valid adult email/);
});

test('uncertain mail responses and failed sent-state writes are never automatically repeated', () => {
  for (const options of [{mailFailure: true}, {failSentWrite: true}]) {
    const h = harness(options); h.event(); h.waiver(); h.enable();
    assert.equal(h.run().needsReview, 1);
    assert.equal(h.attendeeEmails().length, 1);
    assert.equal(h.run().needsReview, 1);
    assert.equal(h.attendeeEmails().length, 1);
    assert.ok(h.emails.some(email => email.to === owner));
  }
});

test('catch-up is bounded, honors the installation start date and waits until two Houston dates after the party', () => {
  const h = harness(); h.enable();
  for (const date of ['2026-11-07', '2026-11-13', '2026-11-14', '2026-11-15']) {
    h.event({id: date, date});
    h.waiver({eventDate: date, email: date + '@example.com'});
  }
  h.run();
  assert.deepEqual(h.attendeeEmails().map(email => email.to), ['2026-11-14@example.com']);
  assert.equal(h.context.postPartyShift_('2026-11-01', -2), '2026-10-30');
  h.properties.set('POST_PARTY_START_DATE', '2026-11-01');
  h.run();
  assert.equal(h.attendeeEmails().length, 2);
  assert.ok(h.attendeeEmails().some(email => email.to === '2026-11-13@example.com'));
  assert.ok(!h.attendeeEmails().some(email => /11-07|11-15/.test(email.to)));
});

test('quota exhaustion leaves recipients pending and reruns safely deliver when quota returns', () => {
  const h = harness({quota: 1}); h.event(); h.waiver(); h.enable();
  assert.equal(h.run().remaining, 1);
  assert.equal(h.attendeeEmails().length, 0);
  h.context.MailApp.getRemainingDailyQuota = () => 50;
  assert.equal(h.run().sent, 1);
});

test('after expiry the evergreen thank-you continues without the expired code or discount promise', () => {
  const h = harness(); h.enable();
  h.properties.set('POST_PARTY_START_DATE', '2026-12-30');
  h.event({date: '2026-12-30', title: 'Photo Booth party', description: 'Items: photobooth'});
  h.waiver({eventDate: '2026-12-30'});
  h.setNow('2027-01-01T15:00:00Z');
  assert.equal(h.run().sent, 1);
  const email = h.attendeeEmails()[0];
  assert.doesNotMatch(email.body + email.htmlBody, /NERFTHANKS10|10%|Nerf|does not affect your discount/);
  assert.match(email.htmlBody, /honest Google review/);
});

test('private storage violations or duplicate receipts stop sending before any attendee mail', () => {
  const shared = harness({shared: true}); shared.event(); shared.waiver(); shared.enable();
  assert.throws(() => shared.run(), /unshared My Drive folder/);
  const h = harness(); h.event(); h.waiver(); h.enable();
  const journal = h.files.find(file => file.name.startsWith('waiver-') && file.name.endsWith('.json'));
  h.files.push({...journal});
  assert.throws(() => h.run(), /Duplicate waiver receipt/);
  assert.equal(h.emails.length, 0);
});
