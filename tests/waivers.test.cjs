const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'google-calendar.gs'), 'utf8') +
  '\n' + fs.readFileSync(path.join(root, 'waivers.gs'), 'utf8');
const id = '12345678-1234-4234-8234-123456789abc';

function harness(options = {}) {
  let now = Date.parse('2026-11-13T14:00:00Z');
  let config;
  let locked = false;
  let sequence = 0;
  let pdfFailure = !!options.pdfFailure;
  let afterPdfFailure = !!options.afterPdfFailure;
  const files = [];
  const emails = [];
  const logs = [];
  const conversions = [];
  const properties = new Map();
  const ownerEmail = 'yourpartyporch@gmail.com';
  const store = {
    getProperty: key => properties.get(key) || null,
    setProperty: (key, value) => properties.set(key, value)
  };
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  function blob(contents, type = 'application/pdf', name = '') {
    let bytes = Buffer.from(contents);
    return {
      getBytes: () => [...bytes],
      getDataAsString: () => bytes.toString(),
      getName: () => name,
      setName(value) { name = value; return this; },
      getAs(mime) {
        assert.equal(mime, 'application/pdf');
        conversions.push(bytes.toString());
        if (pdfFailure) { pdfFailure = false; throw new Error('Conversion quota exhausted'); }
        return blob('test PDF bytes', mime, name);
      }
    };
  }
  const folder = {
    getId: () => 'private-folder',
    getUrl: () => 'https://drive.google.com/drive/folders/private-folder',
    getOwner: () => ({ getEmail: () => options.ownerEmail || ownerEmail }),
    getSharingAccess: () => options.shared ? 'anyone' : 'private',
    getEditors: () => options.collaborators ? [{}] : [],
    getViewers: () => [],
    isTrashed: () => false,
    getFilesByName(name) {
      const matches = files.filter(file => file.name === name);
      let index = 0;
      return { hasNext: () => index < matches.length, next: () => matches[index++] };
    },
    createFile(contents) {
      const file = {
        name: contents.getName(), contents: contents.getDataAsString(),
        getBlob: () => blob(file.contents, 'application/pdf', file.name),
        setContent(value) {
          if (options.failSentJournal && JSON.parse(value).emailStatus === 'sent') {
            throw new Error('Journal write failed after email');
          }
          file.contents = value;
        },
        getUrl: () => `https://drive.google.com/file/d/test-${++sequence}/view`
      };
      files.push(file);
      if (afterPdfFailure && file.name.endsWith('.pdf')) {
        afterPdfFailure = false;
        throw new Error('Lost response after PDF save');
      }
      return file;
    }
  };
  const context = {
    Date: Clock,
    console: { log: value => logs.push(value), error: value => logs.push(value) },
    PropertiesService: { getScriptProperties: () => store },
    ScriptApp: { AuthMode: {FULL: 'full'}, requireAllScopes: () => {} },
    Session: { getActiveUser: () => ({ getEmail: () => options.activeEmail === undefined ? ownerEmail : options.activeEmail }) },
    DriveApp: {
      Access: { PRIVATE: 'private' },
      getRootFolder: () => ({ createFolder(name) { assert.equal(name, 'Party Porch - Signed Waivers'); return folder; } }),
      getFolderById(value) { assert.equal(value, 'private-folder'); return folder; }
    },
    MimeType: {PDF: 'application/pdf'},
    Utilities: {
      getUuid: () => id,
      newBlob: blob,
      base64Encode: value => Buffer.from(value).toString('base64'),
      base64EncodeWebSafe: value => Buffer.from(value).toString('base64url'),
      base64DecodeWebSafe: value => [...Buffer.from(value, 'base64url')],
      computeHmacSha256Signature: (value, key) => [...crypto.createHmac('sha256', key).update(value).digest()],
      DigestAlgorithm: {SHA_256: 'sha256'},
      computeDigest: (algorithm, value) => [...crypto.createHash(algorithm).update(value).digest()],
      formatDate: date => date.toISOString() + ' America/Chicago'
    },
    LockService: { getScriptLock: () => {
      let owned = false;
      return {
        waitLock() { assert.equal(locked, false); locked = owned = true; },
        hasLock: () => owned,
        releaseLock() { locked = owned = false; }
      };
    } },
    MailApp: { sendEmail(email) {
      emails.push(email);
      if (options.mailFailure) throw new Error('Mail service response uncertain');
    } },
    HtmlService: {
      createHtmlOutput: html => ({html}),
      createTemplateFromFile(name) {
        assert.equal(name, 'WaiverForm');
        return {
          evaluate() {
            config = JSON.parse(this.configJson);
            return { setTitle: title => ({title}) };
          }
        };
      }
    },
    ContentService: {
      MimeType: { JSON: 'json', JAVASCRIPT: 'js' },
      createTextOutput: content => ({content, setMimeType() { return this; }})
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  function open(kind = 'host') {
    context.doGet({parameter: {action: 'waiver', type: kind}});
    return config;
  }
  function input(kind = 'host') {
    const formConfig = open(kind);
    return {
      token: formConfig.token, website: '', name: 'Test Adult',
      service: 'unrefereed', eventDate: '2026-12-01', reference: 'TEST ONLY',
      email: 'test@example.com', phone: '202-555-0100', signer: 'Test Adult',
      termsConsent: true, electronicConsent: true, adultConsent: true,
      eventTime: '14:00', address: 'Test event address', inventory: '',
      pickupDate: '2026-12-02', pickupTime: '10:00',
      participantType: 'adult', emergencyName: 'Test Emergency', emergencyPhone: '202-555-0101'
    };
  }
  if (!options.uninstalled) context.installWaiverStorage();
  return {
    context, properties, files, emails, conversions, logs, open, input,
    advance: milliseconds => { now += milliseconds; },
    journal: () => JSON.parse(files.find(file => file.name.endsWith('.json')).contents)
  };
}

test('installer reuses an owner-only private folder and keeps signing disabled until configured', () => {
  const h = harness({uninstalled: true});
  assert.equal(h.context.waiverReady_(), false);
  assert.match(h.context.doGet({parameter: {action: 'waiver', type: 'host'}}).html, /not available/);
  h.context.installWaiverStorage();
  h.context.installWaiverStorage();
  assert.equal(h.properties.get('WAIVER_FOLDER_ID'), 'private-folder');
  const status = h.context.doGet({parameter: {action: 'waiverStatus', callback: 'ready'}});
  assert.match(status.content, /"waiversReady":true/);
  assert.equal(h.emails.length, 0);
  assert.equal(h.files.length, 0);
});

test('installer rejects another account, another owner, public links and collaborator shares', () => {
  for (const options of [{activeEmail: 'other@example.com'}, {ownerEmail: 'other@example.com'}, {shared: true}, {collaborators: true}]) {
    assert.throws(() => harness(options), /Run this installer|unshared My Drive/);
  }
});

test('public setup function rejects anonymous visitors without creating records or configuration', () => {
  const h = harness({uninstalled: true, activeEmail: ''});
  assert.throws(() => h.context.installWaiverStorage(), /Run this installer as/);
  assert.equal(h.properties.size, 0);
  assert.equal(h.files.length, 0);
  assert.equal(h.emails.length, 0);
});

test('host submission saves a PDF with the complete accepted terms and emails the same attachment', () => {
  const h = harness();
  const result = h.context.submitWaiver(h.input());
  assert.equal(result.ok, true);
  assert.equal(result.emailStatus, 'sent');
  assert.equal(h.files.length, 2);
  assert.equal(h.emails.length, 1);
  assert.equal(h.emails[0].to, 'yourpartyporch@gmail.com');
  assert.equal(h.emails[0].attachments[0].getDataAsString(), Buffer.from(result.pdfBase64, 'base64').toString());
  const html = h.conversions[0];
  for (const phrase of ['a Sharrer Investments LLC company', 'Never allow unsupervised play', 'two hours of games', 'place the bin', 'Electronic signature', 'Accepted at (UTC)', 'I consent to use electronic records', 'Test Adult']) {
    assert.ok(html.includes(phrase), phrase);
  }
  assert.equal(h.journal().data.termsConsent, true);
  assert.equal(h.journal().document.title, h.open().document.title);
});

test('refereed host does not need overnight pickup fields', () => {
  const h = harness();
  const input = {...h.input(), service: 'refereed'};
  delete input.pickupDate;
  delete input.pickupTime;
  assert.equal(h.context.submitWaiver(input).ok, true);
  assert.equal(h.journal().data.pickupDate, undefined);
});

test('adult participant signs for themselves without host-only fields', () => {
  const h = harness();
  const input = h.input('participant');
  delete input.address;
  delete input.eventTime;
  assert.equal(h.context.submitWaiver(input).ok, true);
  assert.ok(h.conversions[0].includes('ordinary negligence'));
  assert.ok(h.conversions[0].includes('This form applies with or without a Party Porch referee'));
  assert.equal(h.journal().data.participantType, 'adult');
});

test('guardian signs a separate minor form and guardian authorization is retained', () => {
  const h = harness();
  const input = {...h.input('participant'), name: 'Test Child', participantType: 'minor', age: 11,
    relationship: 'Parent', guardianConsent: true};
  assert.equal(h.context.submitWaiver(input).ok, true);
  assert.equal(h.journal().data.signer, 'Test Adult');
  assert.equal(h.journal().data.guardianConsent, true);
  assert.ok(h.conversions[0].includes('does not by itself establish an enforceable release'));
});

test('rejects missing consents, invalid fields, forged/expired tokens and signers mismatching the adult', () => {
  const h = harness();
  const valid = h.input();
  const changes = [
    {termsConsent: false}, {electronicConsent: false}, {adultConsent: false},
    {termsConsent: 'true'}, {signer: 'Someone Else'}, {name: ''},
    {email: 'not-an-email'}, {phone: '12'}, {service: 'unknown'},
    {eventDate: '2026-02-30'}, {eventTime: '27:12'}, {pickupDate: '2026-11-01'},
    {address: 'x'.repeat(301)}, {name: 'Injected\nvalue'}, {token: 'forged.token'}, {website: 'bot.example'}
  ];
  for (const change of changes) {
    const result = h.context.submitWaiver({...valid, ...change});
    assert.equal(result.ok, false, JSON.stringify(change));
    assert.equal(result.canEdit, true);
  }
  h.advance(86400001);
  assert.match(h.context.submitWaiver(valid).error, /expired/);
  assert.equal(h.files.length, 0);
  assert.equal(h.emails.length, 0);
});

test('rejects host-only signatures for minors, invalid ages and unauthorized relationships', () => {
  const h = harness();
  const valid = {...h.input('participant'), name: 'Test Child', participantType: 'minor',
    age: 11, relationship: 'Parent', guardianConsent: true};
  for (const change of [{guardianConsent: false}, {relationship: 'Host'}, {age: 18}, {age: 0}, {age: 11.5}, {age: '11'}]) {
    assert.equal(h.context.submitWaiver({...valid, ...change}).ok, false);
  }
  assert.equal(h.files.length, 0);
});

test('exact retries preserve one PDF, signing time and email, and changed data is rejected', () => {
  const h = harness();
  const input = h.input();
  const first = h.context.submitWaiver(input);
  h.advance(60000);
  const retry = h.context.submitWaiver(input);
  assert.equal(retry.ok, true);
  assert.equal(retry.signedAt, first.signedAt);
  assert.equal(retry.pdfBase64, first.pdfBase64);
  assert.equal(h.context.submitWaiver({...input, reference: 'CHANGED'}).ok, false);
  assert.equal(h.files.length, 2);
  assert.equal(h.emails.length, 1);
});

test('conversion failure is explicit; a retry completes the same journal without a duplicate', () => {
  const h = harness({pdfFailure: true});
  const input = h.input();
  assert.equal(h.context.submitWaiver(input).ok, false);
  assert.equal(h.files.length, 1);
  assert.equal(h.emails.length, 0);
  assert.equal(h.context.submitWaiver(input).ok, true);
  assert.equal(h.files.length, 2);
  assert.equal(h.emails.length, 1);
});

test('a lost PDF creation response is recovered by receipt filename', () => {
  const h = harness({afterPdfFailure: true});
  const input = h.input();
  assert.equal(h.context.submitWaiver(input).ok, false);
  assert.equal(h.files.length, 2);
  assert.equal(h.context.submitWaiver(input).ok, true);
  assert.equal(h.files.length, 2);
  assert.equal(h.conversions.length, 1);
  assert.equal(h.emails.length, 1);
});

test('uncertain email outcomes preserve the signed PDF and never auto-resend', () => {
  for (const options of [{mailFailure: true}, {failSentJournal: true}]) {
    const h = harness(options);
    const input = h.input();
    const result = h.context.submitWaiver(input);
    assert.equal(result.ok, true);
    assert.equal(result.emailStatus, 'uncertain');
    assert.equal(h.context.submitWaiver(input).emailStatus, 'uncertain');
    assert.equal(h.files.length, 2);
    assert.equal(h.emails.length, 1);
  }
});

test('interrupted sending state is not sent again', () => {
  const h = harness();
  const input = h.input();
  h.context.submitWaiver(input);
  const journal = h.files.find(file => file.name.endsWith('.json'));
  const record = JSON.parse(journal.contents);
  record.emailStatus = 'sending';
  journal.contents = JSON.stringify(record);
  const result = h.context.submitWaiver(input);
  assert.equal(result.ok, true);
  assert.equal(result.emailStatus, 'sending');
  assert.equal(h.emails.length, 1);
});

test('user fields are escaped in PDF HTML and scripts are never interpolated as markup', () => {
  const h = harness();
  const input = {...h.input(), reference: '<script>alert("test")</script>'};
  assert.equal(h.context.submitWaiver(input).ok, true);
  assert.ok(h.conversions[0].includes('&lt;script&gt;'));
  assert.ok(!h.conversions[0].includes('<script>'));
});

test('storage privacy is checked again for every submission, not only installation', () => {
  const options = {};
  const h = harness(options);
  options.collaborators = true;
  const result = h.context.submitWaiver(h.input());
  assert.equal(result.ok, false);
  assert.equal(h.files.length, 0);
  assert.equal(h.emails.length, 0);
});

test('a terms version change requires a new form rather than silently accepting old terms', () => {
  const h = harness();
  const input = h.input();
  h.context.WAIVER_VERSION = 'next-version';
  assert.match(h.context.submitWaiver(input).error, /expired or changed/);
  assert.equal(h.files.length, 0);
});
