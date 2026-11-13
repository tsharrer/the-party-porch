const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

process.env.TZ = 'America/Chicago';
const source = fs.readFileSync(path.join(__dirname, '../google-calendar.gs'), 'utf8');
const bookingId = '12345678-1234-4234-8234-123456789abc';
const startTime = Date.parse('2026-11-12T19:00:00-06:00');

function harness() {
  let now = startTime;
  const properties = new Map([['STRIPE_SECRET_KEY', 'test-placeholder']]);
  const calls = [];
  const emails = [];
  const logs = [];
  const events = [];
  const invoices = new Map();
  let stripeUnavailable = false;
  let locked = false;
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const store = {
    getProperty: key => properties.get(key) || null,
    setProperty: (key, value) => properties.set(key, value),
    getProperties: () => Object.fromEntries(properties)
  };
  const calendar = {
    getEvents: (start, end) => events.filter(event => event.start < end && event.end > start),
    createEvent(title, start, end, opts) {
      const event = {
        start, end,
        getId: () => `event-${events.length}`,
        getTitle: () => title,
        getDescription: () => opts.description
      };
      events.push(event);
      return event;
    }
  };
  const context = {
    Date: Clock,
    console: { error: message => logs.push(message) },
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
      if (url.startsWith('https://api.twilio.com/')) body = {sid: 'SM_test'};
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
      return {getResponseCode: () => 200, getContentText: () => JSON.stringify(body)};
    } }
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
    context, properties, calls, emails, logs, events, invoices, booking, post, lookup,
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
