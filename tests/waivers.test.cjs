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
  let contactJournalFailure = !!options.failContactSavedJournal;
  const files = [];
  const emails = [];
  const logs = [];
  const conversions = [];
  const contacts = options.contacts || [];
  const contactCalls = [];
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
    getFiles() {
      const snapshot = files.slice();
      let index = 0;
      return {hasNext: () => index < snapshot.length, next: () => snapshot[index++]};
    },
    createFile(contents) {
      const file = {
        name: contents.getName(), contents: contents.getDataAsString(),
        getName: () => file.name,
        getBlob: () => blob(file.contents, 'application/pdf', file.name),
        setContent(value) {
          if (contactJournalFailure && JSON.parse(value).contactStatus === 'saved') {
            contactJournalFailure = false;
            throw new Error('Contact outcome journal write failed');
          }
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
      formatDate: (date, zone, pattern) => pattern === 'yyyy-MM-dd' ?
        new Intl.DateTimeFormat('en-CA', {timeZone: zone}).format(date) :
        date.toISOString() + ' America/Chicago'
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
    People: {People: {
      Connections: {list() {
        contactCalls.push({method: 'list'});
        if (options.contactFailure === 'list') throw new Error('Contacts unavailable');
        return {connections: contacts};
      }},
      get(resourceName) {
        contactCalls.push({method: 'get', resourceName});
        const person = contacts.find(contact => contact.resourceName === resourceName);
        assert.ok(person);
        return person;
      },
      createContact(person) {
        contactCalls.push({method: 'create', person});
        const contact = {...person, resourceName: 'people/waiver-' + (contacts.length + 1)};
        contacts.push(contact);
        if (options.contactFailure === 'create') throw new Error('Contact write outcome uncertain');
        return contact;
      }
    }},
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
    context, properties, files, emails, conversions, logs, open, input, contacts, contactCalls,
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
  const feeSection = h.journal().document.sections.find(section => section.title.includes('equipment fees'));
  assert.ok(feeSection, 'The accepted host snapshot must include equipment fees');
  for (const phrase of [
    'agrees to pay a loss/damage fee', 'reasonable, documented repair cost',
    'Normal wear, pre-existing damage, equipment defects and staff-caused damage are excluded',
    'replace individual pieces when available', 'itemized explanation',
    'does not authorize automatic charges to a saved card'
  ]) {
    assert.ok(feeSection.paragraphs[0].includes(phrase), phrase);
    assert.ok(html.includes(phrase), 'Saved PDF must include: ' + phrase);
  }
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
  assert.equal(h.conversions[0].includes('agrees to pay a loss/damage fee'), false);
});

test('guardian signs a separate minor form and guardian authorization is retained', () => {
  const h = harness();
  const input = {...h.input('participant'), name: 'Test Child', participantType: 'minor', dateOfBirth: '2015-12-01',
    relationship: 'Parent', guardianConsent: true};
  assert.equal(h.context.submitWaiver(input).ok, true);
  assert.equal(h.journal().data.signer, 'Test Adult');
  assert.equal(h.journal().data.guardianConsent, true);
  assert.equal(h.journal().data.dateOfBirth, '2015-12-01');
  assert.equal(h.journal().data.age, 11);
  assert.ok(h.conversions[0].includes("Child&#39;s date of birth"));
  assert.ok(h.conversions[0].includes('2015-12-01'));
  assert.ok(h.conversions[0].includes('Age on event date'));
  assert.ok(h.conversions[0].includes('does not by itself establish an enforceable release'));
});

test('completed host/adult waivers save only the adult signer name/email in private Contacts', () => {
  for (const kind of ['host', 'participant']) {
    const h = harness();
    const result = h.context.submitWaiver(h.input(kind));
    assert.equal(result.ok, true);
    assert.equal(result.contactStatus, 'saved');
    assert.equal(h.contacts.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(h.contactCalls.find(call => call.method === 'create').person)), {
      names: [{unstructuredName: 'Test Adult'}],
      emailAddresses: [{value: 'test@example.com', type: 'other'}]
    });
    assert.equal(h.journal().contactStatus, 'saved');
    assert.ok(h.journal().contactResourceName);
    assert.match(h.emails[0].body, /Adult signer contact: saved/);
    assert.equal(h.emails[0].to, 'yourpartyporch@gmail.com', 'No promotional or signer email is sent');
  }
});

test('guardian forms save the guardian, never the child/emergency contact, and duplicate signers reuse Contacts', () => {
  const h = harness();
  const input = {...h.input('participant'), name: 'Test Child', participantType: 'minor',
    dateOfBirth: '2015-12-01', relationship: 'Parent', guardianConsent: true};
  assert.equal(h.context.submitWaiver(input).contactStatus, 'saved');
  h.context.Utilities.getUuid = () => '22345678-1234-4234-8234-123456789abc';
  assert.equal(h.context.submitWaiver({...h.input('participant'), ...input,
    token: h.open('participant').token, name: 'Second Test Child'}).contactStatus, 'saved');
  assert.equal(h.contacts.length, 1);
  assert.equal(h.contacts[0].names[0].unstructuredName, 'Test Adult');
  assert.equal(JSON.stringify(h.contacts).includes('Test Child'), false);
  assert.equal(JSON.stringify(h.contacts).includes('2015-12-01'), false);
  assert.equal(JSON.stringify(h.contacts).includes('Test Emergency'), false);
  assert.equal(h.contactCalls.filter(call => call.method === 'create').length, 1);
  const calls = h.contactCalls.length;
  h.context.submitWaiver(input);
  assert.equal(h.contactCalls.length, calls, 'Exact waiver retry skips its completed contact save');
});

test('waiver Contacts reuse existing matching emails without replacing names or phone numbers', () => {
  const existing = {resourceName: 'people/existing', names: [{unstructuredName: 'Existing name'}],
    emailAddresses: [{value: 'TEST@example.com'}], phoneNumbers: [{value: '+12025550999'}]};
  const h = harness({contacts: [existing]});
  assert.equal(h.context.submitWaiver(h.input()).contactStatus, 'saved');
  assert.equal(h.contacts.length, 1);
  assert.equal(h.contactCalls.filter(call => call.method === 'create').length, 0);
  assert.equal(existing.names[0].unstructuredName, 'Existing name');
  assert.equal(existing.phoneNumbers[0].value, '+12025550999');
});

test('failed/uncertain contact saves do not undo signing or repeat creation/alerts on waiver retry', () => {
  for (const contactFailure of ['list', 'create']) {
    const h = harness({contactFailure});
    const input = h.input();
    const result = h.context.submitWaiver(input);
    assert.equal(result.ok, true);
    assert.equal(result.emailStatus, 'sent');
    assert.equal(result.contactStatus, 'needs_review');
    assert.equal(h.files.length, 2);
    const calls = h.contactCalls.length;
    assert.equal(h.context.submitWaiver(input).contactStatus, 'needs_review');
    assert.equal(h.contactCalls.length, calls);
    assert.equal(h.emails.length, 2, 'One failure alert and one signed-PDF email, not duplicate sends');
    assert.ok(h.emails.some(email => email.subject.includes('Waiver signer Google Contacts save')));
  }
});

test('an interrupted contact save becomes owner-visible review rather than an automatic repeat', () => {
  const h = harness();
  const input = h.input();
  h.context.submitWaiver(input);
  const journal = h.files.find(file => file.name.endsWith('.json'));
  const record = JSON.parse(journal.contents);
  record.contactStatus = 'saving';
  journal.contents = JSON.stringify(record);
  const calls = h.contactCalls.length;
  assert.equal(h.context.submitWaiver(input).contactStatus, 'needs_review');
  assert.equal(h.contactCalls.length, calls);
  assert.equal(h.emails.length, 2);
  h.context.submitWaiver(input);
  assert.equal(h.emails.length, 2);
});

test('lost contact-outcome journal writes and ambiguous emails need review without duplicating Contacts', () => {
  for (const options of [
    {failContactSavedJournal: true},
    {contacts: [
      {resourceName: 'people/one', emailAddresses: [{value: 'test@example.com'}]},
      {resourceName: 'people/two', emailAddresses: [{value: 'TEST@example.com'}]}
    ]}
  ]) {
    const h = harness(options);
    const input = h.input();
    assert.equal(h.context.submitWaiver(input).contactStatus, 'needs_review');
    const count = h.contacts.length;
    const calls = h.contactCalls.length;
    assert.equal(h.context.submitWaiver(input).ok, true);
    assert.equal(h.contacts.length, count);
    assert.equal(h.contactCalls.length, calls);
    assert.equal(h.files.length, 2);
    assert.equal(h.emails.length, 2);
  }
});

function legacyWaivers(h, count = 1, withPdf = true) {
  h.context.submitWaiver(h.input());
  const template = h.journal();
  h.files.length = h.contacts.length = h.emails.length = h.contactCalls.length = 0;
  for (const key of h.properties.keys()) {
    if (key.startsWith(h.context.CONTACT_PREFIX)) h.properties.delete(key);
  }
  for (let i = 1; i <= count; i++) {
    const record = JSON.parse(JSON.stringify(template));
    record.data.id = '12345678-1234-4234-8234-' + String(i).padStart(12, '0');
    record.pdfName = 'Party-Porch-host-2026-12-01-' + record.data.id + '.pdf';
    delete record.contactStatus;
    delete record.contactResourceName;
    h.context.DriveApp.getFolderById('private-folder').createFile(
      h.context.Utilities.newBlob(JSON.stringify(record), 'application/json', 'waiver-' + record.data.id + '.json'));
    if (withPdf) h.context.DriveApp.getFolderById('private-folder').createFile(
      h.context.Utilities.newBlob('test PDF', 'application/pdf', record.pdfName));
  }
}

test('owner importer saves existing completed waiver signers without attendee email or repeated Contacts writes', () => {
  const h = harness();
  legacyWaivers(h, 2);
  const result = h.context.importWaiverSignerContacts();
  assert.equal(result.saved, 2);
  assert.equal(result.remaining, 0);
  assert.equal(h.contacts.length, 1);
  assert.equal(h.emails.length, 0);
  const calls = h.contactCalls.length;
  assert.equal(h.context.importWaiverSignerContacts().alreadySaved, 2);
  assert.equal(h.contactCalls.length, calls);
});

test('importer is owner-only and rechecks storage privacy before reading records or Contacts', () => {
  for (const changed of [{activeEmail: ''}, {activeEmail: 'other@example.com'}, {collaborators: true}]) {
    const options = {};
    const h = harness(options);
    legacyWaivers(h);
    Object.assign(options, changed);
    assert.throws(() => h.context.importWaiverSignerContacts(), /Run this importer|unshared My Drive/);
    assert.equal(h.contactCalls.length, 0);
    assert.equal(h.emails.length, 0);
  }
});

test('importer skips incomplete PDFs, reports invalid journals and never repeats uncertain contact creates', () => {
  const incomplete = harness();
  legacyWaivers(incomplete, 1, false);
  assert.equal(incomplete.context.importWaiverSignerContacts().incomplete, 1);
  assert.equal(incomplete.contacts.length, 0);
  const failed = harness();
  legacyWaivers(failed);
  const journal = failed.files.find(file => file.name.endsWith('.json'));
  journal.contents = '{bad JSON';
  assert.equal(failed.context.importWaiverSignerContacts().needsReview, 1);
  assert.equal(failed.contacts.length, 0);
  const options = {};
  const uncertain = harness(options);
  legacyWaivers(uncertain);
  options.contactFailure = 'create';
  assert.equal(uncertain.context.importWaiverSignerContacts().needsReview, 1);
  const calls = uncertain.contactCalls.length;
  assert.equal(uncertain.context.importWaiverSignerContacts().needsReview, 1);
  assert.equal(uncertain.contactCalls.length, calls);
  assert.equal(uncertain.contacts.length, 1);
  assert.equal(uncertain.emails.length, 1, 'Only an owner failure alert, never an attendee email');
});

test('importer limits each run to 25 contact attempts and resumes without duplicating earlier work', () => {
  const h = harness();
  legacyWaivers(h, 26);
  const first = h.context.importWaiverSignerContacts();
  assert.equal(first.saved, 25);
  assert.equal(first.remaining, 1);
  const second = h.context.importWaiverSignerContacts();
  assert.equal(second.alreadySaved, 25);
  assert.equal(second.saved, 1);
  assert.equal(second.remaining, 0);
  assert.equal(h.contacts.length, 1);
  assert.equal(h.emails.length, 0);
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
  assert.equal(h.contactCalls.length, 0);
});

test('rejects host-only signatures for minors and unauthorized relationships', () => {
  const h = harness();
  const valid = {...h.input('participant'), name: 'Test Child', participantType: 'minor',
    dateOfBirth: '2015-12-01', relationship: 'Parent', guardianConsent: true};
  for (const change of [{guardianConsent: false}, {relationship: 'Host'}]) {
    assert.equal(h.context.submitWaiver({...valid, ...change}).ok, false);
  }
  assert.equal(h.files.length, 0);
});

test('minor birth date is required and must be real, not future, and within the existing age range at the event', () => {
  const h = harness();
  const valid = {...h.input('participant'), name: 'Test Child', participantType: 'minor',
    dateOfBirth: '2015-12-01', relationship: 'Parent', guardianConsent: true};
  for (const dateOfBirth of [undefined, '', 'not-a-date', '2015-02-29', '2027-01-01', '2008-12-01', '2026-01-01']) {
    const result = h.context.submitWaiver({...valid, dateOfBirth, age: 11});
    assert.equal(result.ok, false, String(dateOfBirth));
    assert.equal(result.canEdit, true);
  }
  const beforeBirth = h.context.submitWaiver({...valid, dateOfBirth: '2015-12-01', eventDate: '2015-11-30'});
  assert.equal(beforeBirth.ok, false);
  assert.equal(h.files.length, 0);
  assert.equal(h.emails.length, 0);
});

test('minor age is calculated on the event date at birthday and leap-day boundaries, never trusted from the client', () => {
  for (const [dateOfBirth, eventDate, age] of [
    ['2015-12-01', '2026-12-01', 11],
    ['2015-12-02', '2026-12-01', 10],
    ['2008-12-02', '2026-12-01', 17],
    ['2012-02-29', '2024-02-29', 12],
    ['2012-02-29', '2025-02-28', 12],
    ['2012-02-29', '2025-03-01', 13]
  ]) {
    const h = harness();
    const input = {...h.input('participant'), name: 'Test Child', participantType: 'minor',
      dateOfBirth, eventDate, age: 99, relationship: 'Parent', guardianConsent: true};
    assert.equal(h.context.submitWaiver(input).ok, true);
    assert.equal(h.journal().data.age, age);
    assert.equal(h.context.submitWaiver(input).ok, true);
    assert.equal(h.files.length, 2);
    assert.equal(h.emails.length, 1);
  }
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
  assert.equal(h.contactCalls.length, 0);
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
