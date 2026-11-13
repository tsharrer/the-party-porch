const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const crypto = require('node:crypto');

process.env.TZ = 'America/Chicago';
const source = fs.readFileSync(path.join(__dirname, '../google-calendar.gs'), 'utf8');
const bookingId = '12345678-1234-4234-8234-123456789abc';
const startTime = Date.parse('2026-11-12T19:00:00-06:00');

function harness(config = {}) {
  let now = startTime;
  const properties = new Map([['STRIPE_SECRET_KEY', 'test-placeholder']]);
  const calls = [];
  const emails = [];
  const logs = [];
  const events = [];
  const invoices = new Map();
  const contacts = [];
  const contactCalls = [];
  let stripeUnavailable = false;
  let locked = false;
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const store = {
    getProperty: key => properties.get(key) || null,
    setProperty: (key, value) => properties.set(key, value),
    deleteProperty: key => properties.delete(key),
    getProperties: () => Object.fromEntries(properties)
  };
  const calendar = {
    getEvents: (start, end) => events.filter(event => event.start < end && event.end > start),
    createEvent(title, start, end, opts) {
      const event = {
        start, end,
        getId: () => `event-${events.length}`,
        getTitle: () => title,
        getStartTime: () => start,
        getDescription: () => opts.description
      };
      events.push(event);
      return event;
    }
  };
  const context = {
    Date: Clock,
    console: {
      error: message => logs.push(message),
      warn: message => logs.push(message),
      log: message => logs.push(message)
    },
    PropertiesService: { getScriptProperties: () => store },
    CalendarApp: { getCalendarById: () => calendar },
    LockService: { getScriptLock: () => {
      let owned = false;
      return {
        waitLock: () => {
          assert.equal(locked, false, 'Do not reacquire a lock held by this execution');
          locked = owned = true;
        },
        hasLock: () => owned,
        releaseLock: () => { locked = owned = false; }
      };
    } },
    Session: { getScriptTimeZone: () => 'America/Chicago' },
    Utilities: {
      getUuid: () => bookingId,
      base64Encode: text => Buffer.from(text).toString('base64'),
      base64EncodeWebSafe: bytes => Buffer.from(bytes).toString('base64url'),
      DigestAlgorithm: {SHA_256: 'sha256'},
      computeDigest: (algorithm, text) => crypto.createHash(algorithm).update(text).digest(),
      formatDate(date, zone, pattern) {
        const pad = number => String(number).padStart(2, '0');
        const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        if (pattern === 'yyyy-MM-dd') return day;
        if (pattern === 'yyyy-MM-dd HH:mm') return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        return date.toISOString();
      }
    },
    MailApp: { sendEmail: email => emails.push(email) },
    ContentService: {
      MimeType: { JSON: 'json', JAVASCRIPT: 'js' },
      createTextOutput: content => ({ content, setMimeType() { return this; } })
    },
    UrlFetchApp: { fetch(url, options) {
      if (stripeUnavailable) throw new Error('Stripe unavailable');
      calls.push({url, ...options});
      const route = url.replace('https://api.stripe.com/v1/', '');
      let body;
      const twilio = url.startsWith('https://api.twilio.com/');
      if (twilio) body = {sid: 'SM_test', status: 'queued'};
      else if (route === 'customers') body = {id: 'cus_test'};
      else if (route === 'invoices') {
        body = {id: 'in_test', status: 'draft', due_date: Number(options.payload.due_date)};
        invoices.set(body.id, body);
      } else if (route === 'invoiceitems') body = {id: 'ii_test'};
      else {
        const invoice = invoices.get(route.split('/')[1]);
        assert.ok(invoice, `Unexpected invoice request: ${route}`);
        if (route.endsWith('/finalize')) {
          invoice.status = 'open';
          invoice.hosted_invoice_url = 'https://invoice.stripe.com/i/test';
        } else if (route.endsWith('/void')) {
          assert.notEqual(invoice.status, 'paid', 'Must never void a paid invoice');
          invoice.status = 'void';
        }
        body = invoice;
      }
      return {
        getResponseCode: () => twilio ?
          (typeof config.twilioStatus === 'function' ? config.twilioStatus(options.payload.To) : (config.twilioStatus || 201)) : 200,
        getContentText: () => JSON.stringify(body)
      };
    } },
    People: {People: {
      Connections: {list(resource, options) {
        contactCalls.push({method: 'list', resource, options});
        if (config.contactFailure === 'list') throw new Error('Contacts unavailable');
        const start = Number(options.pageToken || 0);
        const size = config.contactPageSize || options.pageSize;
        return {
          connections: contacts.slice(start, start + size),
          nextPageToken: start + size < contacts.length ? String(start + size) : undefined
        };
      }},
      get(resource) {
        contactCalls.push({method: 'get', resource});
        const person = contacts.find(item => item.resourceName === resource);
        assert.ok(person, 'Cached contact must exist');
        return person;
      },
      createContact(person) {
        contactCalls.push({method: 'create', person});
        const created = {
          ...person, resourceName: `people/contact-${contacts.length + 1}`,
          etag: 'person-etag', metadata: {sources: [{type: 'CONTACT', etag: 'contact-etag'}]}
        };
        contacts.push(created);
        if (config.contactFailure === 'create') throw new Error('Contact creation outcome uncertain');
        return created;
      },
      updateContact(person, resource, options) {
        contactCalls.push({method: 'update', person, resource, options});
        const index = contacts.findIndex(item => item.resourceName === resource);
        assert.ok(index >= 0);
        assert.ok(person.metadata.sources[0].etag);
        contacts[index] = {...contacts[index], ...person};
        return contacts[index];
      }
    }}
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const booking = {
    bookingId, name: 'Test Customer', email: 'customer@example.com',
    date: '2026-12-19', time: '14:00', estimate: '$390',
    items: 'nerf', rental: 'Nerf Battles', consent: 'No'
  };
  const post = (data = booking) => JSON.parse(context.doPost({postData: {contents: JSON.stringify(data)}}).content);
  const lookup = (id = bookingId) => JSON.parse(context.doGet({parameter: {action: 'checkout', bookingId: id}}).content);
  return {
    context, properties, calls, emails, logs, events, invoices, contacts, contactCalls, booking, post, lookup,
    setNow: value => { now = value; },
    failStripe: () => { stripeUnavailable = true; }
  };
}

test('deadline is seven days, capped by the event start; invalid/past dates are rejected', () => {
  const {context} = harness();
  assert.equal(context.depositDeadline('2026-12-19', '14:00', new Date(startTime)), startTime / 1000 + 7 * 86400);
  assert.equal(context.depositDeadline('2026-11-14', '16:00', new Date(startTime)), Date.parse('2026-11-14T16:00:00-06:00') / 1000);
  assert.throws(() => context.depositDeadline('2026-02-30', '14:00', new Date(startTime)));
  assert.throws(() => context.depositDeadline('2026-11-11', '14:00', new Date(startTime)));
});

test('one booking creates one invoice and all lookups reuse the emailed payment link', () => {
  const h = harness();
  assert.equal(h.post().ok, true);
  const invoiceCall = h.calls.find(call => call.url.endsWith('/invoices'));
  assert.equal(invoiceCall.payload.collection_method, 'send_invoice');
  assert.equal(invoiceCall.payload.due_date, String(startTime / 1000 + 7 * 86400));
  assert.equal(h.calls.find(call => call.url.endsWith('/invoiceitems')).payload.amount, '19500');
  assert.equal(h.calls.find(call => call.url.endsWith('/invoiceitems')).payload.invoice, 'in_test');
  assert.ok(h.calls.every(call => call.method === 'get' || call.headers['Idempotency-Key']));
  assert.equal(h.lookup().url, 'https://invoice.stripe.com/i/test');
  assert.equal(h.lookup().url, 'https://invoice.stripe.com/i/test');
  assert.ok(h.emails[0].htmlBody.includes(h.lookup().url));
  assert.ok(h.emails[0].body.includes('2026-11-20T01:00:00.000Z'));
  assert.equal(h.post().duplicate, true);
  assert.equal(h.events.length, 1);
  assert.equal(h.calls.filter(call => call.url.endsWith('/invoices')).length, 1);
});

test('lookup before the POST finishes waits without creating an invoice', () => {
  const h = harness();
  assert.equal(h.lookup().pending, true);
  assert.equal(h.calls.length, 0);
  assert.equal(h.lookup('invalid').error, 'missing_booking_id');
});

test('pending Nerf blocks its day and the following day', () => {
  const h = harness();
  h.post();
  assert.deepEqual(Array.from(h.context.availability('2026-12-19').booked), ['nerf']);
  assert.deepEqual(Array.from(h.context.availability('2026-12-20').booked), ['nerf']);
  assert.deepEqual(Array.from(h.context.availability('2026-12-21').booked), []);
});

test('a later-day Nerf booking prevents an overlapping overnight reservation', () => {
  const h = harness();
  h.post();
  const result = h.post({...h.booking, bookingId: '22345678-1234-4234-8234-123456789abc', date: '2026-12-18'});
  assert.equal(result.ok, false);
  assert.equal(h.events.length, 1);
  assert.equal(h.calls.filter(call => call.url.endsWith('/invoices')).length, 1);
});

test('expired unpaid invoice is voided before inventory is released', () => {
  const h = harness();
  h.post();
  h.setNow(startTime + 7 * 86400000);
  assert.deepEqual(Array.from(h.context.availability('2026-12-19').booked), []);
  assert.equal(h.invoices.get('in_test').status, 'void');
  assert.equal(h.lookup().error, 'hold_expired');
});

test('paid invoice retains the reservation after the deadline and is never voided', () => {
  const h = harness();
  h.post();
  h.invoices.get('in_test').status = 'paid';
  h.setNow(startTime + 8 * 86400000);
  assert.deepEqual(Array.from(h.context.availability('2026-12-19').booked), ['nerf']);
  assert.equal(h.calls.some(call => call.url.endsWith('/void')), false);
});

test('Stripe failures do not silently release inventory or return a successful payment link', () => {
  const h = harness();
  h.post();
  h.setNow(startTime + 8 * 86400000);
  h.failStripe();
  assert.equal(h.context.availability('2026-12-19').ok, false);
  assert.equal(h.lookup().error, 'invoice_unavailable');
  assert.notEqual(h.context.loadBooking(bookingId).status, 'released');
});

test('invoice creation failure is explicit and does not send a success email', () => {
  const h = harness();
  h.failStripe();
  assert.equal(h.post().ok, false);
  assert.equal(h.lookup().error, 'invoice_failed');
  assert.equal(h.emails.length, 0);
  assert.ok(h.logs.length > 0);
  assert.deepEqual(Array.from(h.context.availability('2026-12-19').booked), []);
});

test('legacy calendar bookings stay reserved and other inventory is not blocked the next day', () => {
  const h = harness();
  h.events.push({
    start: new Date('2026-12-19T14:00:00-06:00'),
    end: new Date('2026-12-19T17:00:00-06:00'),
    getDescription: () => 'Items: nerf,movie',
    getTitle: () => 'Legacy booking'
  });
  assert.deepEqual(Array.from(h.context.availability('2026-12-19').booked).sort(), ['movie', 'nerf']);
  assert.deepEqual(Array.from(h.context.availability('2026-12-20').booked), ['nerf']);
});

test('custom quotes remain a manual request without an invoice or inventory hold', () => {
  const h = harness();
  assert.equal(h.post({...h.booking, estimate: 'Custom quote'}).quote, true);
  assert.equal(h.lookup().quote, true);
  assert.equal(h.calls.length, 0);
  assert.equal(h.events.length, 0);
  assert.equal(h.emails.length, 2);
  assert.ok(h.emails[1].body.includes('no date is held'));
});

test('deposit SMS requires consent and uses the same hosted invoice URL', () => {
  for (const consent of ['No', 'Yes']) {
    const h = harness();
    h.properties.set('TWILIO_ACCOUNT_SID', 'AC_test');
    h.properties.set('TWILIO_AUTH_TOKEN', 'test-placeholder');
    h.properties.set('TWILIO_FROM', '+12025550100');
    h.post({...h.booking, consent, phone: '2025550110'});
    const messages = h.calls.filter(call => call.url.startsWith('https://api.twilio.com/'));
    assert.equal(messages.length, consent === 'Yes' ? 1 : 0);
    if (messages.length) assert.ok(messages[0].payload.Body.includes(h.lookup().url));
  }
});

function configureOwnerSms(h) {
  h.properties.set('TWILIO_ACCOUNT_SID', 'AC_test');
  h.properties.set('TWILIO_AUTH_TOKEN', 'test-placeholder');
  h.properties.set('TWILIO_FROM', '+12025550100');
  h.properties.set('OWNER_SMS_TO', '+12025550199');
}

function addReminderEvent(h, days, options = {}) {
  const start = new Date(startTime);
  start.setDate(start.getDate() + days);
  start.setHours(14, 0, 0, 0);
  const end = new Date(start.getTime() + (options.hours || 3) * 3600000);
  h.events.push({
    start, end,
    getStartTime: () => start,
    getId: () => options.id || `manual-${days}`,
    getTitle: () => options.title || 'Manual booking',
    getDescription: () => options.description || 'Created manually'
  });
}

test('new requests notify only the configured owner when the customer declined texts, without duplicate alerts', () => {
  const h = harness();
  configureOwnerSms(h);
  h.properties.set('WEBHOOK_URL', 'https://script.google.com/exec');
  assert.equal(h.post({...h.booking, consent: 'No', phone: '2025550110'}).ok, true);
  h.post();
  const messages = h.calls.filter(call => call.url.startsWith('https://api.twilio.com/'));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].payload.To, '+12025550199');
  assert.equal(messages[0].payload.StatusCallback, 'https://script.google.com/exec');
  assert.ok(messages[0].payload.Body.includes('New booking request'));
  assert.ok(messages[0].payload.Body.includes('$195 deposit pending'));
});

test('quote requests get owner alerts without claiming a confirmed booking or a held date', () => {
  const h = harness();
  configureOwnerSms(h);
  assert.equal(h.post({...h.booking, estimate: 'Custom quote'}).quote, true);
  const message = h.calls.find(call => call.url.startsWith('https://api.twilio.com/'));
  assert.ok(message.payload.Body.includes('New quote request'));
  assert.ok(message.payload.Body.includes('no date held'));
});

test('owner SMS failure emails the owner without failing the booking or creating another invoice', () => {
  const h = harness({twilioStatus: 400});
  configureOwnerSms(h);
  assert.equal(h.post().ok, true);
  assert.equal(h.lookup().ok, true);
  assert.ok(h.emails.some(email => email.subject.includes('owner text alert failed')));
  assert.equal(h.calls.filter(call => call.url.endsWith('/invoices')).length, 1);
});

test('booking alerts and owner tests reach both normalized recipients without duplicate numbers', () => {
  const h = harness();
  configureOwnerSms(h);
  h.properties.set('OWNER_SMS_TO', '+12025550199, 202-555-0198, (202) 555-0199');
  assert.equal(h.post().ok, true);
  const messages = () => h.calls.filter(call => call.url.startsWith('https://api.twilio.com/'));
  assert.deepEqual(messages().map(message => message.payload.To), ['+12025550199', '+12025550198']);
  h.context.testOwnerSms();
  assert.equal(messages().length, 4);
  assert.equal(h.events.length, 1);
  assert.equal(h.calls.filter(call => call.url.endsWith('/invoices')).length, 1);
  h.properties.set('OWNER_SMS_TO', '+12025550199, invalid');
  assert.throws(() => h.context.testOwnerSms(), /Every OWNER_SMS_TO entry/);
  assert.equal(messages().length, 4);
});

test('each recipient receives each reminder milestone only once', () => {
  const h = harness();
  configureOwnerSms(h);
  h.properties.set('OWNER_SMS_TO', '+12025550199,+12025550198');
  for (const days of [7, 1, 0]) addReminderEvent(h, days);
  h.context.sendOwnerBookingReminders();
  h.context.sendOwnerBookingReminders();
  const messages = h.calls.filter(call => call.url.startsWith('https://api.twilio.com/'));
  assert.equal(messages.length, 6);
  for (const phone of ['+12025550199', '+12025550198']) {
    assert.equal(messages.filter(message => message.payload.To === phone).length, 3);
  }
});

test('one recipient failing does not block the other, or cause successful reminders to resend', () => {
  const h = harness({twilioStatus: to => to === '+12025550199' ? 400 : 201});
  configureOwnerSms(h);
  h.properties.set('OWNER_SMS_TO', '+12025550199,+12025550198');
  addReminderEvent(h, 0);
  assert.throws(() => h.context.sendOwnerBookingReminders(), /Could not confirm 1 owner reminder/);
  assert.throws(() => h.context.sendOwnerBookingReminders(), /Could not confirm 1 owner reminder/);
  const messages = h.calls.filter(call => call.url.startsWith('https://api.twilio.com/'));
  assert.deepEqual(messages.map(message => message.payload.To), ['+12025550199', '+12025550198']);
  assert.equal(h.emails.filter(email => email.subject.includes('owner reminder failed')).length, 1);
});

test('old single-recipient reminder markers do not suppress a newly added recipient', () => {
  const h = harness();
  configureOwnerSms(h);
  h.properties.set('OWNER_SMS_TO', '+12025550199,+12025550198');
  addReminderEvent(h, 0);
  const event = h.events[0];
  const legacyKey = 'owner_reminder_2026-11-12_' +
    encodeURIComponent(event.getId() + '_' + event.getStartTime().getTime() + '_0');
  h.properties.set(legacyKey, 'sent');
  h.context.sendOwnerBookingReminders();
  h.context.sendOwnerBookingReminders();
  const messages = h.calls.filter(call => call.url.startsWith('https://api.twilio.com/'));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].payload.To, '+12025550198');
});

test('reminders cover manual and recurring bookings at 7 days, 1 day and day-of, once per milestone', () => {
  const h = harness();
  configureOwnerSms(h);
  for (const days of [7, 1, 0]) addReminderEvent(h, days, {id: 'same-recurring-calendar-id'});
  addReminderEvent(h, 2);
  h.context.sendOwnerBookingReminders();
  h.context.sendOwnerBookingReminders();
  const messages = () => h.calls.filter(call => call.url.startsWith('https://api.twilio.com/'));
  assert.equal(messages().length, 3);
  for (const label of ['In 1 week', 'Tomorrow', 'Today']) {
    assert.ok(messages().some(message => message.payload.Body.includes(label)));
  }
  h.setNow(startTime + 86400000);
  h.context.sendOwnerBookingReminders();
  assert.equal(messages().length, 5, 'The next day must send both its day-of and tomorrow reminders');
  assert.ok(messages().slice(3).some(message => message.payload.Body.includes('Today')));
});

test('reminders skip closed dates, released holds and the second day of an overnight event', () => {
  const h = harness();
  configureOwnerSms(h);
  addReminderEvent(h, 7, {title: 'CLOSED'});
  addReminderEvent(h, 1, {description: `Booking ID: ${bookingId}\nItems: nerf`});
  h.context.saveBooking(bookingId, {status: 'released', due: startTime / 1000});
  addReminderEvent(h, -1, {hours: 30});
  addReminderEvent(h, 0);
  h.properties.set('owner_reminder_2026-10-01_old', 'sent');
  h.properties.set('unrelated_setting', 'preserve');
  h.context.sendOwnerBookingReminders();
  assert.equal(h.calls.filter(call => call.url.startsWith('https://api.twilio.com/')).length, 1);
  assert.equal(h.properties.has('owner_reminder_2026-10-01_old'), false);
  assert.equal(h.properties.get('unrelated_setting'), 'preserve');
});

test('failed reminders are explicit and cannot send twice on a rerun', () => {
  const h = harness({twilioStatus: 400});
  configureOwnerSms(h);
  addReminderEvent(h, 0);
  assert.throws(() => h.context.sendOwnerBookingReminders(), /Could not confirm 1 owner reminder/);
  assert.throws(() => h.context.sendOwnerBookingReminders(), /Could not confirm 1 owner reminder/);
  assert.equal(h.calls.filter(call => call.url.startsWith('https://api.twilio.com/')).length, 1);
  assert.equal(h.emails.filter(email => email.subject.includes('owner reminder failed')).length, 1);
});

test('automation installer schedules one 9 AM Chicago daily trigger and validates the owner recipient', () => {
  const h = harness();
  const triggers = [];
  h.context.ScriptApp = {
    AuthMode: {FULL: 'FULL'},
    requireAllScopes() {},
    getProjectTriggers: () => triggers,
    newTrigger(handler) {
      return {
        timeBased() { return this; },
        atHour(hour) { assert.equal(hour, 9); return this; },
        nearMinute(minute) { assert.equal(minute, 0); return this; },
        everyDays(days) { assert.equal(days, 1); return this; },
        inTimezone(zone) { assert.equal(zone, 'America/Chicago'); return this; },
        create() { triggers.push({getHandlerFunction: () => handler}); }
      };
    }
  };
  assert.throws(() => h.context.installBookingAutomations(), /Set OWNER_SMS_TO/);
  configureOwnerSms(h);
  h.context.installBookingAutomations();
  h.context.installBookingAutomations();
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0].getHandlerFunction(), 'sendOwnerBookingReminders');
});

test('accepted bookings save customer contacts and repeat customers reuse the same resource', () => {
  const h = harness();
  assert.equal(h.post({...h.booking, phone: '(202) 555-0110'}).ok, true);
  assert.equal(h.contacts.length, 1);
  assert.equal(h.contacts[0].names[0].unstructuredName, 'Test Customer');
  assert.equal(h.contacts[0].emailAddresses[0].value, 'customer@example.com');
  assert.equal(h.contacts[0].phoneNumbers[0].value, '+12025550110');
  assert.equal(h.post({...h.booking, bookingId: '22345678-1234-4234-8234-123456789abc', date: '2026-12-22'}).ok, true);
  assert.equal(h.contacts.length, 1);
  assert.equal(h.contactCalls.filter(call => call.method === 'create').length, 1);
  assert.ok(h.contactCalls.some(call => call.method === 'get'));
});

test('contact matching paginates, ignores email case and appends a phone without changing existing names', () => {
  const h = harness({contactPageSize: 1});
  h.contacts.push(
    {resourceName: 'people/unrelated', emailAddresses: [{value: 'other@example.com'}]},
    {
      resourceName: 'people/existing', names: [{givenName: 'Manually saved name'}],
      emailAddresses: [{value: 'CUSTOMER@example.com'}],
      phoneNumbers: [{value: '+12025550111'}],
      etag: 'etag', metadata: {sources: [{type: 'CONTACT', etag: 'source-etag'}]}
    }
  );
  assert.equal(h.post({...h.booking, phone: '2025550110'}).ok, true);
  assert.equal(h.contacts.length, 2);
  const update = h.contactCalls.find(call => call.method === 'update');
  assert.equal(update.options.updatePersonFields, 'phoneNumbers');
  assert.equal(update.person.phoneNumbers.length, 2);
  assert.equal(h.contacts[1].names[0].givenName, 'Manually saved name');
});

test('ambiguous contacts and uncertain contact creation require review without failing bookings or duplicating contacts', () => {
  const ambiguous = harness();
  for (const resource of ['people/one', 'people/two']) {
    ambiguous.contacts.push({resourceName: resource, emailAddresses: [{value: 'customer@example.com'}]});
  }
  assert.equal(ambiguous.post().ok, true);
  assert.equal(ambiguous.contacts.length, 2);
  assert.ok(ambiguous.emails.some(email => email.subject.includes('Google Contacts save failed')));

  const uncertain = harness({contactFailure: 'create'});
  assert.equal(uncertain.post().ok, true);
  assert.throws(() => uncertain.context.saveCustomerContact(uncertain.booking), /previous contact creation needs manual review/);
  assert.equal(uncertain.contacts.length, 1);
});

test('event deadlines use Houston DST and reject a nonexistent spring-forward time', () => {
  const {context} = harness();
  const now = new Date('2027-03-12T12:00:00-06:00');
  assert.equal(context.depositDeadline('2027-03-14', '14:00', now), Date.parse('2027-03-14T14:00:00-05:00') / 1000);
  assert.throws(() => context.depositDeadline('2027-03-14', '02:30', now));
});

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

test('trigger installer requests authorization before accessing triggers and does not duplicate the timer', () => {
  const {context} = harness();
  const triggers = [];
  let authorized = false;
  context.ScriptApp = {
    AuthMode: {FULL: 'FULL'},
    requireAllScopes(mode) {
      assert.equal(mode, 'FULL');
      if (!authorized) throw new Error('Authorization required');
    },
    getProjectTriggers() {
      assert.equal(authorized, true);
      return triggers;
    },
    newTrigger(handler) {
      return {
        timeBased() { return this; },
        everyMinutes(minutes) { assert.equal(minutes, 5); return this; },
        create() { triggers.push({getHandlerFunction: () => handler}); }
      };
    }
  };
  assert.throws(() => context.installBookingHoldTrigger(), /Authorization required/);
  assert.equal(triggers.length, 0);
  authorized = true;
  context.installBookingHoldTrigger();
  context.installBookingHoldTrigger();
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0].getHandlerFunction(), 'expireBookingHolds');
});

const frontendSource = html.slice(html.indexOf('var bookingSubmitting ='), html.indexOf('function openEmail(s)'));
function frontendHarness() {
  const scripts = [];
  const timers = new Map();
  const posts = [];
  let now = 0;
  let timerId = 0;
  const button = {};
  const date = {value: '2026-12-19'};
  const form = {reset() {}};
  const context = {
    console: {error() {}},
    crypto: {randomUUID: () => bookingId},
    GCAL_WEBHOOK_URL: 'https://script.google.com/exec',
    FORMSPREE_ID: '',
    BUSINESS_EMAIL: 'business@example.com',
    Date: class extends Date { static now() { return now; } },
    document: {
      querySelector: () => button,
      getElementById: id => id === 'f_date' ? date : form,
      createElement: () => ({remove() { this.removed = true; }}),
      body: {appendChild: script => scripts.push(script)}
    },
    window: {location: {}},
    setTimeout: (callback, delay) => { timers.set(++timerId, {callback, delay}); return timerId; },
    clearTimeout: id => timers.delete(id),
    bookingMinDate: () => '2026-11-17',
    bookingSummary: () => ({date: '2026-12-19', name: 'Test', estimate: '$390'}),
    fetch: (url, opts) => { posts.push(JSON.parse(opts.body)); return Promise.resolve({}); },
    alert() {}, localStorage: {removeItem() {}}, renderCart() {}, calcEstimate() {}
  };
  vm.createContext(context);
  vm.runInContext(frontendSource, context);
  function respond(result) {
    const script = scripts.at(-1);
    const callback = new URL(script.src).searchParams.get('callback');
    context.window[callback](result);
  }
  function tick(delay) {
    const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
    assert.ok(entry, `No ${delay}ms timer scheduled`);
    timers.delete(entry[0]);
    now += delay;
    entry[1].callback();
  }
  return {context, scripts, posts, respond, tick};
}

test('frontend polls a pending booking by ID and returns the shared URL without payment creation parameters', () => {
  const h = frontendHarness();
  let result;
  h.context.requestDeposit({bookingId}, value => { result = value; });
  const params = new URL(h.scripts[0].src).searchParams;
  assert.equal(params.get('bookingId'), bookingId);
  assert.equal(params.has('estimate'), false);
  h.respond({ok: false, pending: true});
  assert.equal(result, undefined);
  h.tick(2000);
  h.respond({ok: true, url: 'https://invoice.stripe.com/i/test'});
  assert.equal(result.url, 'https://invoice.stripe.com/i/test');
  assert.ok(h.scripts.every(script => script.removed));
});

test('frontend exposes lookup errors and timeouts instead of opening a fallback payment', () => {
  for (const mode of ['error', 'timeout', 'network']) {
    const h = frontendHarness();
    let result;
    h.context.requestDeposit({bookingId}, value => { result = value; });
    if (mode === 'error') h.respond({ok: false, error: 'invoice_failed'});
    if (mode === 'timeout') h.tick(20000);
    if (mode === 'network') h.scripts[0].onerror();
    assert.equal(result.ok, false);
    assert.ok(result.error);
    assert.equal(result.url, undefined);
  }
});

test('frontend blocks simultaneous submits and retries an unchanged booking with the same ID', () => {
  const h = frontendHarness();
  const event = {preventDefault() {}};
  h.context.submitBooking(event);
  h.context.submitBooking(event);
  assert.equal(h.posts.length, 1);
  h.respond({ok: false, error: 'invoice_failed'});
  h.context.submitBooking(event);
  assert.equal(h.posts.length, 2);
  assert.equal(h.posts[0].bookingId, h.posts[1].bookingId);
  h.respond({ok: false, error: 'invoice_failed'});
});
