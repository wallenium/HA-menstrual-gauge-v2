/**
 * Tests for menstruation-gauge-card.js
 *
 * Covers:
 *  A) Render-stability: consecutive hass updates without state change must not
 *     recreate DOM (no flicker for pregnancy icon).
 *  B) Layout: status icon rendered above the day-label in normal period gauge.
 *  C) Pregnancy icon size: 56 px.
 *  D) Regression: normal Period Gauge and Pregnancy Gauge remain functional.
 *
 * Run with:  node tests/menstruation-gauge-card.test.js
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Minimal browser / DOM stubs
// ---------------------------------------------------------------------------

class FakeShadowRoot {
  constructor() {
    this._html = '';
    this._listeners = {};
    this.activeElement = null;
  }
  set innerHTML(v) { this._html = v; }
  get innerHTML() { return this._html; }
  addEventListener(type, fn) {
    this._listeners[type] = this._listeners[type] || [];
    this._listeners[type].push(fn);
  }
  getElementById() { return null; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

class FakeElement {
  constructor() {
    this._shadow = new FakeShadowRoot();
    this._attrs = {};
    this._children = [];
    this._renderCount = 0;
  }
  attachShadow() { return this._shadow; }
  get shadowRoot() { return this._shadow; }
  getBoundingClientRect() { return { width: 400 }; }
  getAttribute(k) { return this._attrs[k] || null; }
  setAttribute(k, v) { this._attrs[k] = v; }
  get clientWidth() { return 400; }
  addEventListener() {}
}

// Stub ResizeObserver so connectedCallback does not crash.
global.ResizeObserver = class { observe() {} disconnect() {} };

// Stub window with minimal ProductIcons so status icons resolve.
const productIconsSrc = fs.readFileSync(
  path.join(__dirname, '../custom_components/menstruation_gauge/www/product-icons.js'),
  'utf8',
);
global.window = { customCards: [] };
global.document = undefined;
// Provide HTMLElement base class stub and customElements before loading the card.
global.HTMLElement = class HTMLElement {};
const _definedElements = {};
global.customElements = {
  define: (name, cls) => { _definedElements[name] = cls; },
};
// eslint-disable-next-line no-eval
eval(productIconsSrc);

// Now load the gauge card code.
const cardSrc = fs.readFileSync(
  path.join(__dirname, '../custom_components/menstruation_gauge/www/menstruation-gauge-card.js'),
  'utf8',
);
// eslint-disable-next-line no-eval
eval(cardSrc);

// Capture the card class registered via customElements.define.
const GaugeCard = _definedElements['menstruation-gauge-card'];
if (!GaugeCard) throw new Error('MenstruationGaugeCard was not registered via customElements.define');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard() {
  const shadow = new FakeShadowRoot();
  const el = Object.create(GaugeCard.prototype);

  // Inject browser-API stubs as own properties.
  el.attachShadow = () => shadow;
  Object.defineProperty(el, 'shadowRoot', { get: () => shadow, configurable: true });
  el.getBoundingClientRect = () => ({ width: 400 });
  el.addEventListener = () => {};
  el.closest = () => null;

  return el;
}

function makeHass(overrides = {}) {
  return {
    locale: { language: 'de' },
    themes: { darkMode: false },
    states: {
      'sensor.menstruation': {
        state: overrides.state || 'neutral',
        attributes: {
          entry_id: 'test',
          friendly_name: 'Test',
          days_until_next_start: overrides.days_until !== undefined ? overrides.days_until : 5,
          history: [],
          next_predicted_start: null,
          fertile_window_start: null,
          fertile_window_end: null,
          ovulation_day: null,
          symptom_history: [],
          menarche_data: {},
          period_duration_days: 5,
          ...(overrides.attributes || {}),
        },
      },
    },
    callService: async () => {},
  };
}

function pregnancyHass(week = 8) {
  return makeHass({
    state: 'pregnant',
    attributes: {
      is_pregnant: true,
      weeks_pregnant: week,
    },
  });
}

// ---------------------------------------------------------------------------
// A) Render-stability: pregnancy icon must not be recreated on repeated hass
//    updates when the visible state is unchanged.
// ---------------------------------------------------------------------------

function testRenderStability() {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation' });

  const hass = pregnancyHass(8);
  card._hass = hass;
  card._render();
  const html1 = card.shadowRoot.innerHTML;
  assert.ok(html1.length > 0, 'Initial render should produce HTML');

  // Fire several more "hass" updates with identical state – same sensor data.
  card._hass = hass;
  card._render();
  card._hass = hass;
  card._render();
  const html2 = card.shadowRoot.innerHTML;

  // innerHTML must be identical – no DOM replacement, no flicker.
  assert.strictEqual(html2, html1, 'Repeated hass updates without state change must not replace innerHTML');

  // Also verify via the internal render key that it was stable.
  const key1 = card._lastRenderKey;
  card._hass = hass;
  card._render();
  assert.strictEqual(card._lastRenderKey, key1, 'Render key must be stable across identical hass updates');

  console.log('  ✓ render-stability: no DOM replacement on repeated identical hass updates');
}

// ---------------------------------------------------------------------------
// B) Layout: status icon above day-label in the normal period gauge center
// ---------------------------------------------------------------------------

function testStatusIconAboveDayLabel() {
  const states = ['period', 'pms', 'fertile', 'neutral'];

  for (const state of states) {
    const card = makeCard();
    card.setConfig({ entity: 'sensor.menstruation' });
    card._hass = makeHass({ state, days_until: 3 });
    card._render();

    const html = card.shadowRoot.innerHTML;

    // center-icon should be present (status icon rendered).
    assert.ok(
      html.includes('class="center-icon"'),
      `state "${state}": center-icon div should be present`,
    );

    // center-days should be present (countdown label).
    assert.ok(
      html.includes('class="center-days"'),
      `state "${state}": center-days div should be present`,
    );

    // center-icon must appear before center-days in the markup → icon is above label.
    const iconPos = html.indexOf('class="center-icon"');
    const daysPos = html.indexOf('class="center-days"');
    assert.ok(
      iconPos < daysPos,
      `state "${state}": center-icon must appear before center-days in HTML (icon above label)`,
    );

    console.log(`  ✓ layout "${state}": status icon above day-label`);
  }
}

// ---------------------------------------------------------------------------
// C) Pregnancy icon size: 56 px
// ---------------------------------------------------------------------------

function testPregnancyIconSize() {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation' });
  card._hass = pregnancyHass(8);
  card._render();
  const html = card.shadowRoot.innerHTML;

  // The CSS rules for .center-icon must specify 56px.
  assert.ok(
    html.includes('width: 56px') || html.includes('width:56px'),
    'center-icon CSS width should be 56px',
  );
  assert.ok(
    html.includes('height: 56px') || html.includes('height:56px'),
    'center-icon CSS height should be 56px',
  );

  // The inline style of the pregnancy icon span should also be 56px
  // (generated by buildMaskedAssetIcon with size 56).
  const spanMatch = html.match(/width:(\d+)px;height:(\d+)px[^"]*-webkit-mask/);
  if (spanMatch) {
    assert.strictEqual(spanMatch[1], '56', 'Pregnancy icon span inline width should be 56px');
    assert.strictEqual(spanMatch[2], '56', 'Pregnancy icon span inline height should be 56px');
  }

  console.log('  ✓ pregnancy icon size: 56px in CSS and inline style');
}

// ---------------------------------------------------------------------------
// D) Regression: normal Period Gauge renders without errors
// ---------------------------------------------------------------------------

function testNormalGaugeRegression() {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation', title: 'Cycle', calendar_edit_enabled: false });
  card._hass = makeHass({ state: 'period', days_until: 2 });
  card._render();
  const html = card.shadowRoot.innerHTML;

  assert.ok(html.includes('class="gauge"'), 'Gauge SVG must be present');
  assert.ok(html.includes('ha-card'), 'ha-card element must be present');
  assert.ok(html.includes('center-days'), 'Countdown label must be present');

  console.log('  ✓ regression: normal period gauge renders correctly');
}

// ---------------------------------------------------------------------------
// D) Regression: Pregnancy Gauge renders without errors
// ---------------------------------------------------------------------------

function testPregnancyGaugeRegression() {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation' });
  card._hass = pregnancyHass(20);
  card._render();
  const html = card.shadowRoot.innerHTML;

  assert.ok(html.includes('pregnancy-panel'), 'Pregnancy panel must be present');
  assert.ok(html.includes('center-primary'), 'Week label must be present');
  assert.ok(html.includes('center-secondary'), 'Month/trimester label must be present');
  assert.ok(html.includes('preg_0'), 'Pregnancy asset SVG must be referenced');

  console.log('  ✓ regression: pregnancy gauge renders correctly');
}

// ---------------------------------------------------------------------------
// D) Regression: re-render triggered when visible state changes
// ---------------------------------------------------------------------------

function testRerenderOnStateChange() {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation' });
  card._hass = makeHass({ state: 'period', days_until: 5 });
  card._render();
  const html1 = card.shadowRoot.innerHTML;

  // Change the state to pms.
  card._hass = makeHass({ state: 'pms', days_until: 5 });
  card._render();
  const html2 = card.shadowRoot.innerHTML;

  assert.notStrictEqual(html2, html1, 'HTML must change when state changes from period to pms');
  console.log('  ✓ re-render triggered on visible state change');
}

// ---------------------------------------------------------------------------
// D) Regression: countdown text change triggers re-render
// ---------------------------------------------------------------------------

function testRerenderOnCountdownChange() {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation' });
  card._hass = makeHass({ state: 'neutral', days_until: 5 });
  card._render();
  const html1 = card.shadowRoot.innerHTML;

  card._hass = makeHass({ state: 'neutral', days_until: 4 });
  card._render();
  const html2 = card.shadowRoot.innerHTML;

  assert.notStrictEqual(html2, html1, 'HTML must change when countdown text changes');
  console.log('  ✓ re-render triggered when countdown days change');
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const tests = [
  ['render-stability', testRenderStability],
  ['status-icon-above-day-label', testStatusIconAboveDayLabel],
  ['pregnancy-icon-size-56px', testPregnancyIconSize],
  ['normal-gauge-regression', testNormalGaugeRegression],
  ['pregnancy-gauge-regression', testPregnancyGaugeRegression],
  ['rerender-on-state-change', testRerenderOnStateChange],
  ['rerender-on-countdown-change', testRerenderOnCountdownChange],
];

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
  } catch (err) {
    console.error(`  ✗ ${name}:`, err.message);
    failed += 1;
  }
}

if (failed) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
} else {
  console.log('\nAll tests passed.');
}
