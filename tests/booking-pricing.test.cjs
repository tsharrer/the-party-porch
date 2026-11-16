const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../booking-pricing.js'), 'utf8'), context);
const now = Date.parse('2026-11-16T22:00:00Z');
const selection = (overrides = {}) => ({rental: 'Nerf Battles', players: '12',
  service: 'rental', cart: [], addons: [], ...overrides});
const price = (input, time = now, code = 'NERFTHANKS10') => context.partyPorchPromoPrice_(input, code, time);

test('discount applies to rentals, not staff, setup or consumable packs', () => {
  const result = price(selection({players: '24', service: 'referee',
    addons: ['Snack Bar', 'Popcorn supplies - up to 45 servings', 'We set up', 'Extra referee hour']}));
  assert.equal(result.rentalCents, 38900);
  assert.equal(result.excludedCents, 30000);
  assert.equal(result.discountCents, 3890);
  assert.equal(result.totalCents, 65010);
  assert.equal(result.service, 'Rental + Referee');
  assert.deepEqual(Array.from(result.items).sort(), ['nerf', 'popcorn']);
});

test('all priced rental categories and rental add-ons receive the offer, preserving cents', () => {
  const singles = {'Photo Booth': 375, 'Flower Backdrop': 225, 'Water Battles': 225,
    'Yard Games': 89, 'Soft Play': 295, 'White Bounce Houses': 255, 'Movie Night': 375};
  for (const [rental, amount] of Object.entries(singles)) {
    const result = price(selection({rental}));
    assert.equal(result.totalCents, amount * 90, rental);
    assert.equal(result.discountCents, amount * 10, rental);
  }
  const snacks = price(selection({rental: 'Snack Bar', addons: ['Cotton Candy', 'Shaved Ice',
    'Cotton candy supplies - up to 45 servings', 'Shaved ice syrups - up to 45 servings']}));
  assert.equal(snacks.totalCents, 18220);
  assert.equal(price(selection({cart: ['yardgames']})).totalCents, 24210);
  assert.deepEqual(Array.from(price(selection({cart: ['yardgames']})).items).sort(), ['nerf', 'yardgames']);
});

test('code is case-insensitive, ends at Houston midnight after December 31 and uses booking time, not party date', () => {
  assert.equal(price(selection(), now, ' nerfthanks10 ').code, 'NERFTHANKS10');
  assert.equal(price(selection(), Date.parse('2027-01-01T05:59:59.999Z')).totalCents, 16200);
  assert.throws(() => price(selection(), Date.parse('2027-01-01T06:00:00Z')), /expired/);
  assert.throws(() => price(selection(), NaN), /expired/);
  assert.throws(() => price(selection(), now, 'WRONG'), /not valid/);
});

test('invalid selections, duplicate entries and unmatched supply packs fail explicitly', () => {
  for (const input of [
    null, selection({rental: 'Custom Package'}), selection({players: '25'}),
    selection({service: 'free'}), selection({cart: ['fake']}),
    selection({addons: ['free']}), selection({cart: ['movie', 'movie']}),
    selection({addons: ['We set up', 'We set up']}),
    selection({addons: ['Popcorn supplies - up to 45 servings']}),
    selection({cart: 'nerf'}), selection({rental: 'Snack Bar'}),
    selection({rental: '__proto__'}), selection({players: '__proto__'})
  ]) assert.throws(() => price(input), JSON.stringify(input));
});
