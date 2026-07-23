/**
 * Tests for menstruation-statistics-card.js
 *
 * Covers:
 *  - Tab labels/rendering for Periode + Hygiene
 *  - Tab switching keeps filter state stable
 *  - Gear filter toggles and applies days-back filter
 *  - Hygiene tab keeps 30-day product timeline logic
 *  - Compact/reponsive hygiene layout CSS is present
 *
 * Run with: node tests/menstruation-statistics-card.test.js
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

class FakeShadowRoot {
  constructor() {
    this._html = '';
    this._selectors = {};
    this._ids = {};
  }
  set innerHTML(value) { this._html = value; }
  get innerHTML() { return this._html; }
  querySelectorAll(selector) { return this._selectors[selector] || []; }
  getElementById(id) { return this._ids[id] || null; }
  setSelector(selector, nodes) { this._selectors[selector] = nodes; }
  setId(id, node) { this._ids[id] = node; }
}

class FakeButton {
  constructor(dataset = {}) {
    this.dataset = dataset;
    this._listeners = {};
  }
  addEventListener(type, fn) {
    this._listeners[type] = this._listeners[type] || [];
    this._listeners[type].push(fn);
  }
  click() {
    (this._listeners.click || []).forEach((fn) => fn({ target: this }));
  }
}

global.window = { customCards: [], ProductIcons: { getSvgIcon: () => '' } };
global.document = { createElement: () => ({}) };
global.HTMLElement = class HTMLElement {};
const defined = {};
global.customElements = {
  define: (name, cls) => { defined[name] = cls; },
  get: (name) => defined[name] || null,
};

const sharedSrc = fs.readFileSync(
  path.join(__dirname, '../custom_components/menstruation_gauge/www/menstruation-product-stats-shared.js'),
  'utf8',
);
// eslint-disable-next-line no-eval
eval(sharedSrc);

const cardSrc = fs.readFileSync(
  path.join(__dirname, '../custom_components/menstruation_gauge/www/menstruation-statistics-card.js'),
  'utf8',
);
// eslint-disable-next-line no-eval
eval(cardSrc);

const CardClass = defined['menstruation-statistics-card'];

function makeCard() {
  const shadow = new FakeShadowRoot();
  const el = Object.create(CardClass.prototype);
  el.attachShadow = () => shadow;
  Object.defineProperty(el, 'shadowRoot', { get: () => shadow, configurable: true });
  el.addEventListener = () => {};
  return el;
}

function daysAgo(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function makeHass() {
  return {
    locale: { language: 'de' },
    states: {
      'sensor.menstruation': {
        state: 'period',
        attributes: {
          friendly_name: 'Test Sensor',
          grouped_starts: [daysAgo(120), daysAgo(90), daysAgo(60), daysAgo(30), daysAgo(1)],
          history: [daysAgo(120), daysAgo(119), daysAgo(90), daysAgo(60), daysAgo(59), daysAgo(30), daysAgo(29)],
          bleeding_blocks: [
            { start: daysAgo(120), end: daysAgo(116), length: 5 },
            { start: daysAgo(90), end: daysAgo(86), length: 5 },
            { start: daysAgo(60), end: daysAgo(56), length: 5 },
            { start: daysAgo(30), end: daysAgo(26), length: 5 },
          ],
          symptom_history: [
            { date: daysAgo(29), pain: ['cramps'], bleeding_strength: 'heavy' },
            { date: daysAgo(28), pain: ['cramps'], bleeding_strength: 'medium' },
            { date: daysAgo(2), pain: ['headache'], bleeding_strength: 'light' },
          ],
          product_usage_timeline: [
            { date: daysAgo(1), product: 'tampon', quantity: 2 },
            { date: daysAgo(31), product: 'pad', quantity: 1 },
          ],
          product_usage_this_cycle: { tampon: 2, pad: 1, cup: 0, liner: 3, underwear: 1 },
          product_usage_stats: {
            average_per_cycle: { tampon: 5, pad: 2, cup: 1, liner: 4, underwear: 2 },
            cycles_considered: 3,
          },
          days_until_next_start: 12,
        },
      },
    },
    callService: async () => {},
  };
}

function bindInteractiveControls(card, controls = {}) {
  const root = card.shadowRoot;
  root.setSelector('.tab-btn', controls.tabs || []);
  root.setSelector('.days-btn', controls.days || []);
  root.setSelector('button[data-action="add-underwear-shopping"]', controls.actions || []);
  root.setId('statistics-filter-toggle', controls.filterToggle || null);
  root.setId('patient-name', null);
  root.setId('patient-birthdate', null);
  root.setId('export-lang', null);
  root.setId('export-btn', null);
  card._attachListeners();
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${error.message}`);
    failed += 1;
  }
}

console.log('Statistics card tabs and hygiene integration');

test('renders Periode and Hygiene tabs', () => {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation', language: 'de' });
  card._hass = makeHass();
  card._render();
  const html = card.shadowRoot.innerHTML;
  assert.ok(html.includes('>Periode<'), 'Periode tab missing');
  assert.ok(html.includes('>Hygiene<'), 'Hygiene tab missing');
});

test('tab switching updates content and keeps selected days-back state', () => {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation', language: 'de', days_back: 180 });
  card._hass = makeHass();
  card._render();

  const filterToggle = new FakeButton();
  const day365 = new FakeButton({ days: '365' });
  bindInteractiveControls(card, { filterToggle, days: [day365] });
  filterToggle.click();
  bindInteractiveControls(card, { filterToggle, days: [day365] });
  day365.click();
  assert.strictEqual(card._daysBack, 365, 'days-back filter not updated to 365');

  const toHygiene = new FakeButton({ tab: 'hygiene' });
  const toStats = new FakeButton({ tab: 'stats' });
  bindInteractiveControls(card, { tabs: [toHygiene, toStats] });
  toHygiene.click();
  assert.strictEqual(card._tab, 'hygiene', 'tab did not switch to hygiene');
  bindInteractiveControls(card, { tabs: [toHygiene, toStats] });
  toStats.click();

  assert.strictEqual(card._tab, 'stats', 'tab did not switch back to stats');
  assert.strictEqual(card._daysBack, 365, 'days-back filter reset after tab switch');
  assert.ok(card.shadowRoot.innerHTML.includes('von 365 Tage'), 'stats tab does not reflect the preserved filter value');
});

test('gear toggle opens filter popover and days button closes it', () => {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation', language: 'de' });
  card._hass = makeHass();
  card._render();

  const filterToggle = new FakeButton();
  const day90 = new FakeButton({ days: '90' });
  bindInteractiveControls(card, { filterToggle, days: [day90] });
  filterToggle.click();
  assert.strictEqual(card._settingsOpen, true, 'filter popover did not open');
  assert.ok(card.shadowRoot.innerHTML.includes('filter-popover open'), 'open filter markup missing');

  bindInteractiveControls(card, { filterToggle, days: [day90] });
  day90.click();
  assert.strictEqual(card._daysBack, 90, 'filter did not apply 90 days');
  assert.strictEqual(card._settingsOpen, false, 'filter popover did not close after selection');
});

test('hygiene tab keeps 30-day timeline and renders product stats', () => {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation', language: 'de' });
  card._hass = makeHass();
  card._tab = 'hygiene';
  card._render();
  const html = card.shadowRoot.innerHTML;

  assert.ok(html.includes('Tampons / Periode'), 'hygiene stat label missing');
  assert.ok(html.includes('mgp-chip tampon'), 'recent tampon entry missing from hygiene timeline');
  assert.ok(!html.includes('mgp-chip pad'), 'timeline should exclude entries older than 30 days');
  assert.ok(html.includes('Letzte 30 Tage'), '30-day heading changed unexpectedly');
});

test('compact hygiene layout CSS includes responsive stat grid', () => {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation', language: 'de' });
  card._hass = makeHass();
  card._tab = 'hygiene';
  card._render();
  const html = card.shadowRoot.innerHTML;

  assert.ok(html.includes('grid-template-columns: repeat(auto-fit, minmax(116px, 1fr));'), 'compact hygiene stat grid CSS missing');
  assert.ok(html.includes('@media (max-width: 480px)'), 'responsive hygiene media query missing');
  assert.ok(html.includes('min-height: 76px;'), 'compact hygiene tile height CSS missing');
});

if (failed > 0) {
  console.error(`
${failed} test(s) failed, ${passed} passed.`);
  process.exit(1);
}

console.log(`
All ${passed} statistics card test(s) passed.`);
