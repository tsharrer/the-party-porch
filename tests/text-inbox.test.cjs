const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../staff/text-inbox/Code.gs'), 'utf8');
const owner = 'yourpartyporch@gmail.com';
const from = '+12025550100';
const to = '+12025550110';
const sid = 'AC' + 'a'.repeat(32);
const messageSid = 'SM' + 'b'.repeat(32);
function message(overrides = {}) {
  return {sid: messageSid, from, to, body: 'Test message', status: 'delivered',
    date_created: 'Fri, 13 Nov 2026 16:00:00 GMT', num_media: '0', error_code: null, ...overrides};
}

function harness(options = {}) {
  let now = Date.parse('2026-11-13T16:00:00Z'), sequence = 0, locked = false;
  const calls = [], logs = [], properties = new Map([
    ['TWILIO_ACCOUNT_SID', sid], ['TWILIO_AUTH_TOKEN', 'private-test-token'], ['TWILIO_FROM', from]
  ]);
  const cache = new Map();
  const context = {
    console: {log: value => logs.push(value), error: value => logs.push(value)},
    Session: {getActiveUser: () => ({getEmail: () => options.activeEmail === undefined ? owner : options.activeEmail})},
    PropertiesService: {getScriptProperties: () => ({
      getProperty: key => properties.get(key) || null,
      getProperties: () => Object.fromEntries(properties),
      setProperty(key, value) {
        if (options.failAcceptedWrite && key.startsWith('inbox_send_') && JSON.parse(value).state === 'accepted') {
          throw new Error('Storage failed after API send');
        }
        properties.set(key, value);
      },
      deleteProperty: key => properties.delete(key)
    })},
    CacheService: {getScriptCache: () => ({
      get: key => cache.get(key) || null, put: (key, value) => cache.set(key, value)
    })},
    ScriptApp: {AuthMode: {FULL: 'full'}, requireAllScopes: () => {}},
    HtmlService: {createHtmlOutputFromFile(name) {
      assert.equal(name, 'Index');
      return {setTitle: title => ({title})};
    }},
    Utilities: {
      getUuid: () => '12345678-1234-4234-8234-' + String(++sequence).padStart(12, '0'),
      base64Encode: value => Buffer.from(value).toString('base64'),
      base64EncodeWebSafe: value => Buffer.from(value).toString('base64url'),
      base64DecodeWebSafe: value => [...Buffer.from(value, 'base64url')],
      newBlob: value => ({getDataAsString: () => Buffer.from(value).toString()}),
      computeHmacSha256Signature: (value, secret) => [...crypto.createHmac('sha256', secret).update(value).digest()],
      DigestAlgorithm: {SHA_256: 'sha256'},
      computeDigest: (algorithm, value) => [...crypto.createHash(algorithm).update(value).digest()]
    },
    LockService: {getScriptLock: () => {
      let owned = false;
      return {
        waitLock() { assert.equal(locked, false); locked = owned = true; },
        hasLock: () => owned,
        releaseLock() { locked = owned = false; }
      };
    }},
    UrlFetchApp: {fetch(url, request) {
      calls.push({url, ...request});
      assert.ok(url.startsWith('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/'));
      assert.equal(request.headers.Authorization, 'Basic ' + Buffer.from(sid + ':private-test-token').toString('base64'));
      const resource = new URL(url);
      let data, status = 200;
      if (resource.pathname.endsWith('/IncomingPhoneNumbers.json')) {
        data = (typeof options.numbers === 'function' ? options.numbers(resource.searchParams.get('PageToken')) : options.numbers) || {incoming_phone_numbers: [
          {phone_number: from, friendly_name: 'Business', capabilities: {sms: true}},
          {phone_number: '+12025550101', friendly_name: 'Second line', capabilities: {sms: true}},
          {phone_number: '+12025550102', capabilities: {sms: false}},
          {phone_number: '+442055550100', capabilities: {sms: true}}
        ], next_page_uri: null};
      } else if (request.method === 'post') {
        if (options.postNetworkFailure) throw new Error('Lost response after send');
        status = options.postStatus || 201;
        data = options.postResponse || (status === 201 ? {sid: messageSid, status: 'queued'} : {code: 21610});
      } else if (resource.pathname.endsWith('/Messages/' + messageSid + '.json')) {
        data = message();
      } else {
        assert.ok(resource.pathname.endsWith('/Messages.json'));
        data = typeof options.pages === 'function' ? options.pages(resource.searchParams.get('PageToken')) :
          {messages: options.messages || [message()], next_page_uri: null};
      }
      return {getResponseCode: () => status,
        getContentText: () => options.unreadable && request.method === 'post' ? 'not JSON' : JSON.stringify(data)};
    }}
  };
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  context.Date = Clock;
  vm.createContext(context);
  vm.runInContext(source, context);
  if (!options.uninitialized) context.initializeTextInbox();
  const input = () => ({
    token: context.createInboxSendToken().token, from, to: '(202) 555-0110',
    body: 'TEST ONLY - private inbox test', consent: true
  });
  return {context, calls, logs, properties, input, advance: milliseconds => {now += milliseconds;}};
}

test('initialization verifies only SMS-capable owned US senders and exposes no credentials', () => {
  const h = harness();
  const config = h.context.getInboxConfiguration();
  assert.equal(config.ok, true);
  assert.equal(config.defaultSender, from);
  assert.equal(config.senders.length, 2);
  assert.equal(h.calls.some(call => call.method === 'post'), false);
  assert.ok(!JSON.stringify(config).includes('private-test-token'));
  assert.ok(!JSON.stringify(config).includes(sid));
  assert.ok(!h.logs.join('\n').includes('private-test-token'));
});

test('all browser and setup entry points reject anonymous and different users before Twilio access', () => {
  for (const activeEmail of ['', 'other@example.com']) {
    const h = harness({activeEmail, uninitialized: true});
    for (const name of ['doGet', 'initializeTextInbox', 'createInboxSendToken', 'getInboxConfiguration', 'getInboxMessages', 'sendInboxText', 'checkInboxSend']) {
      assert.throws(() => h.context[name]({}), /Access denied/, name);
    }
    assert.equal(h.calls.length, 0);
    assert.equal(h.properties.has('INBOX_TOKEN_SECRET'), false);
  }
});

test('initialization fails explicitly on a configured sender not owned by the account', () => {
  const h = harness({uninitialized: true});
  h.properties.set('TWILIO_FROM', '+12025550999');
  assert.throws(() => h.context.initializeTextInbox(), /not an SMS-capable US number/);
  assert.equal(h.properties.has('INBOX_TOKEN_SECRET'), false);
});

test('owned-number discovery follows account-specific pages and rejects an invalid next address', () => {
  const h = harness({numbers: cursor => ({
    incoming_phone_numbers: [{phone_number: cursor ? '+12025550101' : from, capabilities: {sms: true}}],
    next_page_uri: cursor ? null : '/2010-04-01/Accounts/' + sid + '/IncomingPhoneNumbers.json?PageToken=numbers-next'
  })});
  assert.equal(h.context.getInboxConfiguration().senders.length, 2);
  assert.ok(h.calls[1].url.endsWith('&PageToken=numbers-next'));
  const bad = harness({uninitialized: true, numbers: {
    incoming_phone_numbers: [], next_page_uri: '/2010-04-01/Accounts/other/IncomingPhoneNumbers.json?PageToken=next'
  }});
  assert.throws(() => bad.context.initializeTextInbox(), /unexpected pagination/);
  assert.equal(bad.calls.length, 1);
});

test('history includes inbound/outbound selected-line messages, metadata, redaction and MMS indicators', () => {
  const h = harness({messages: [
    message(),
    message({sid: 'SM' + 'c'.repeat(32), from: to, to: from, body: '<script>test</script>', status: 'received', num_media: '1'}),
    message({sid: 'SM' + 'd'.repeat(32), body: null, status: 'undelivered', error_code: 21610}),
    message({from: '+12025550101', to: '+12025550111'})
  ]});
  const result = h.context.getInboxMessages({sender: from});
  assert.equal(result.ok, true);
  assert.equal(result.messages.length, 3);
  assert.equal(result.messages[1].outbound, false);
  assert.equal(result.messages[1].peer, to);
  assert.equal(result.messages[1].mediaCount, 1);
  assert.equal(result.messages[2].body, null);
  assert.equal(result.messages[2].errorCode, 21610);
  assert.equal(result.messages[0].at, '2026-11-13T16:00:00.000Z');
});

test('history pagination uses encoded tokens on the fixed account route, never a returned external URL', () => {
  const cursor = 'cursor+/=';
  const h = harness({pages: token => ({
    messages: token ? [] : [message()],
    next_page_uri: token ? null :
      '/2010-04-01/Accounts/' + sid + '/Messages.json?PageSize=100&PageToken=' + encodeURIComponent(cursor)
  })});
  const first = h.context.getInboxMessages({sender: from});
  assert.equal(first.nextPageToken, cursor);
  assert.equal(h.context.getInboxMessages({sender: from, pageToken: cursor}).nextPageToken, '');
  assert.ok(h.calls.at(-1).url.endsWith('PageToken=' + encodeURIComponent(cursor)));
  const bad = harness({pages: () => ({messages: [], next_page_uri: 'https://external.example/secret'})});
  assert.equal(bad.context.getInboxMessages({sender: from}).ok, false);
  assert.ok(bad.calls.every(call => call.url.startsWith('https://api.twilio.com/')));
});

test('history rejects missing timestamps rather than inventing a date, and rejects unowned number selection', () => {
  const h = harness({messages: [message({date_created: null})]});
  assert.equal(h.context.getInboxMessages({sender: from}).ok, false);
  const count = h.calls.length;
  assert.equal(h.context.getInboxMessages({sender: '+12025550999'}).ok, false);
  assert.equal(h.calls.length, count);
});

test('malformed attachment metadata is rejected without displaying an invalid attachment count', () => {
  for (const num_media of ['invalid', '-1', '1.5']) {
    const h = harness({messages: [message({num_media})]});
    assert.equal(h.context.getInboxMessages({sender: from}).ok, false);
  }
});

test('manual send requires consent, normalizes the US recipient and never sets or changes a webhook', () => {
  const h = harness();
  const result = h.context.sendInboxText(h.input());
  assert.equal(result.ok, true);
  assert.equal(result.status, 'queued');
  const sent = h.calls.find(call => call.method === 'post');
  assert.deepEqual(JSON.parse(JSON.stringify(sent.payload)), {From: from, To: to, Body: 'TEST ONLY - private inbox test'});
  assert.ok(sent.url.endsWith('/Messages.json'));
  assert.ok(!sent.payload.StatusCallback);
});

test('invalid recipient/body/consent/sender or a forged/expired token never sends an SMS', () => {
  const h = harness();
  const valid = h.input();
  for (const change of [
    {to: '123'}, {to: '+442055550100'}, {to: []}, {body: ''}, {body: 'x'.repeat(1601)},
    {body: 'bad\u0000text'}, {consent: false}, {consent: 'true'},
    {from: '+12025550999'}, {token: 'forged.token'}
  ]) {
    assert.equal(h.context.sendInboxText({...valid, ...change}).ok, false);
  }
  h.advance(86400001);
  assert.match(h.context.sendInboxText(valid).error, /expired/);
  assert.equal(h.calls.some(call => call.method === 'post'), false);
});

test('accepted send replay uses one message receipt and changed details cannot reuse the same token', () => {
  const h = harness();
  const input = h.input();
  assert.equal(h.context.sendInboxText(input).duplicate, false);
  assert.equal(h.context.sendInboxText(input).duplicate, true);
  assert.equal(h.context.sendInboxText({...input, body: 'Changed'}).ok, false);
  assert.equal(h.calls.filter(call => call.method === 'post').length, 1);
  const receipts = [...h.properties].filter(([key]) => key.startsWith('inbox_send_')).map(([,value]) => value);
  assert.equal(receipts.length, 1);
  assert.ok(!receipts[0].includes(input.body));
  assert.ok(!receipts[0].includes(to));
});

test('network, unreadable response, 5xx and receipt-write failures remain unconfirmed and never auto-resend', () => {
  for (const options of [
    {postNetworkFailure: true}, {unreadable: true}, {postStatus: 500}, {failAcceptedWrite: true}
  ]) {
    const h = harness(options);
    const input = h.input();
    const first = h.context.sendInboxText(input);
    assert.equal(first.ok, false);
    assert.equal(first.canEdit, false);
    assert.equal(h.context.sendInboxText(input).ok, false);
    assert.equal(h.calls.filter(call => call.method === 'post').length, 1);
    assert.ok(!h.logs.join('\n').includes(input.body));
  }
});

test('definite 4xx rejection is explicit and repeating that token does not repeat the SMS request', () => {
  const h = harness({postStatus: 400});
  const input = h.input();
  const result = h.context.sendInboxText(input);
  assert.equal(result.ok, false);
  assert.equal(result.canEdit, true);
  assert.match(result.error, /21610/);
  h.context.sendInboxText(input);
  assert.equal(h.calls.filter(call => call.method === 'post').length, 1);
});

test('check send status queries the accepted message SID and does not send another message', () => {
  const h = harness();
  const input = h.input();
  h.context.sendInboxText(input);
  const checked = h.context.checkInboxSend({token: input.token});
  assert.equal(checked.ok, true);
  assert.equal(checked.status, 'delivered');
  assert.equal(h.calls.filter(call => call.method === 'post').length, 1);
});

test('receipts expire after replay tokens, preserving unrelated private settings', () => {
  const h = harness();
  h.properties.set('inbox_send_old', JSON.stringify({created: Date.parse('2026-11-01T00:00:00Z'), state: 'accepted'}));
  h.properties.set('unrelated', 'preserve');
  h.context.sendInboxText(h.input());
  assert.equal(h.properties.has('inbox_send_old'), false);
  assert.equal(h.properties.get('unrelated'), 'preserve');
});
