/**
 * Tests for menstrual-cycle-compact-status-card.js
 *
 * Covers:
 *  A) Layout: right icon-right-wrap container present and positioned after .info
 *  B) Size: .icon-right-btn uses same clamp() dimensions as .circle-wrap
 *  C) Tooltip: shown with product_usage_today and symptom_data_today data
 *  D) Tooltip: fallback when no data available
 *  E) Regression: progress and icon-text modes unaffected
 *  F) Regression: cycle modes (period, pms, fertile, ovulation, neutral) all render right icon
 *
 * Run with:  node tests/menstrual-cycle-compact-status-card.test.js
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Minimal browser / DOM stubs
// ---------------------------------------------------------------------------

class FakeShadowRoot {
  constructor() { this._html = ''; }
  set innerHTML(v) { this._html = v; }
  get innerHTML() { return this._html; }
  getElementById() { return null; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

global.window = { customCards: [] };
global.document = undefined;
global.HTMLElement = class HTMLElement {};
const _definedElements = {};
global.customElements = {
  get: (name) => _definedElements[name],
  define: (name, cls) => { _definedElements[name] = cls; },
};

// Load product-icons so ProductIcons is available on window
const productIconsSrc = fs.readFileSync(
  path.join(__dirname, '../custom_components/menstruation_gauge/www/product-icons.js'),
  'utf8',
);
// eslint-disable-next-line no-eval
eval(productIconsSrc);

// Load the compact-status card
const cardSrc = fs.readFileSync(
  path.join(__dirname, '../custom_components/menstruation_gauge/www/menstrual-cycle-compact-status-card.js'),
  'utf8',
);
// eslint-disable-next-line no-eval
eval(cardSrc);

const CardClass = _definedElements['menstrual-cycle-compact-status'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard() {
  const shadow = new FakeShadowRoot();
  const el = Object.create(CardClass.prototype);
  el.attachShadow = () => shadow;
  Object.defineProperty(el, 'shadowRoot', { get: () => shadow, configurable: true });
  el.addEventListener = () => {};
  el.dispatchEvent = () => {};
  return el;
}

function buildHass(state, attrs = {}) {
  return {
    locale: { language: 'en' },
    states: {
      'sensor.menstruation': {
        state,
        attributes: {
          avg_cycle_length: '28',
          days_until_next_start: '10',
          period_duration_days: '5',
          ...attrs,
        },
      },
    },
  };
}

function renderCard(state, attrs = {}) {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation' });
  card._hass = buildHass(state, attrs);
  card._render();
  return card.shadowRoot.innerHTML;
}

/** Returns the HTML body after the closing </style> tag (excludes CSS). */
function bodyOf(html) {
  const styleEnd = html.indexOf('</style>');
  return styleEnd === -1 ? html : html.substring(styleEnd + '</style>'.length);
}

// ---------------------------------------------------------------------------
// A) Layout tests – right icon container present
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('Layout: right icon container');

test('period mode: icon-right-wrap present', () => {
  const html = renderCard('period');
  assert.ok(html.includes('icon-right-wrap'), 'missing icon-right-wrap');
});

test('pms mode: icon-right-wrap present', () => {
  const html = renderCard('pms');
  assert.ok(html.includes('icon-right-wrap'), 'missing icon-right-wrap in pms');
});

test('fertile mode: icon-right-wrap present', () => {
  const html = renderCard('fertile');
  assert.ok(html.includes('icon-right-wrap'), 'missing icon-right-wrap in fertile');
});

test('neutral mode: icon-right-wrap present', () => {
  const html = renderCard('neutral');
  assert.ok(html.includes('icon-right-wrap'), 'missing icon-right-wrap in neutral');
});

test('cycle mode: icon comes AFTER .info in DOM order', () => {
  const html = renderCard('period');
  const body = bodyOf(html);
  const infoPos = body.indexOf('class="info"');
  const iconPos = body.indexOf('icon-right-wrap');
  assert.ok(infoPos !== -1, '.info not found in body');
  assert.ok(iconPos !== -1, 'icon-right-wrap not found in body');
  assert.ok(iconPos > infoPos, 'icon-right-wrap should appear after .info');
});

test('cycle mode: no legacy status-icon small-icon in wrap', () => {
  const html = renderCard('period');
  // The old status-icon span inside .status-line should not appear
  assert.ok(!html.includes('class="status-line"'), 'old .status-line should be removed');
  assert.ok(!html.includes('class="status-icon"'), 'old .status-icon should be removed');
});

// ---------------------------------------------------------------------------
// B) Size: .icon-right-btn uses same clamp() as .circle-wrap
// ---------------------------------------------------------------------------

console.log('\nSize: icon-right-btn matches circle-wrap dimensions');

test('CSS contains matching clamp() for .circle-wrap and .icon-right-btn', () => {
  const html = renderCard('period');
  // Both should use clamp(64px, 22vw, 80px) – find them in the style block
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(styleMatch, 'no <style> block found');
  const css = styleMatch[1];
  const circleMatches = css.match(/\.circle-wrap\s*\{[^}]*clamp\(64px,\s*22vw,\s*80px\)/);
  const btnMatches = css.match(/\.icon-right-btn\s*\{[^}]*clamp\(64px,\s*22vw,\s*80px\)/);
  assert.ok(circleMatches, '.circle-wrap should use clamp(64px, 22vw, 80px)');
  assert.ok(btnMatches, '.icon-right-btn should use same clamp(64px, 22vw, 80px)');
});

test('icon-right-btn has border-radius: 50% (circular shape)', () => {
  const html = renderCard('period');
  assert.ok(html.includes('border-radius: 50%'), 'icon-right-btn should be circular');
});

// ---------------------------------------------------------------------------
// C) Tooltip: with product and symptom data
// ---------------------------------------------------------------------------

console.log('\nTooltip: with data');

test('tooltip shows product usage when product_usage_today has entries', () => {
  const html = renderCard('period', {
    product_usage_today: { tampon: 3, pad: 0, cup: 0, liner: 0, underwear: 0 },
  });
  assert.ok(html.includes('icon-tooltip'), 'tooltip container missing');
  assert.ok(html.includes('Product Usage'), 'product usage heading missing');
  assert.ok(html.includes('Tampon'), 'tampon label missing');
  assert.ok(html.includes('>3<'), 'tampon count 3 missing');
});

test('tooltip shows multiple products when several are non-zero', () => {
  const html = renderCard('period', {
    product_usage_today: { tampon: 2, pad: 1, cup: 0, liner: 0, underwear: 0 },
  });
  assert.ok(html.includes('Tampon'), 'tampon missing');
  assert.ok(html.includes('Pad'), 'pad missing');
  assert.ok(!html.includes('Cup'), 'cup should not appear when count is 0');
});

test('tooltip shows symptom bleeding_strength', () => {
  const html = renderCard('period', {
    symptom_data_today: { bleeding_strength: 'strong' },
  });
  assert.ok(html.includes('Symptoms'), 'symptoms heading missing');
  assert.ok(html.includes('Bleeding'), 'bleeding label missing');
  assert.ok(html.includes('strong'), 'bleeding value missing');
});

test('tooltip shows mood symptom', () => {
  const html = renderCard('period', {
    symptom_data_today: { mood: 'happy' },
  });
  assert.ok(html.includes('Mood'), 'mood label missing');
  assert.ok(html.includes('happy'), 'mood value missing');
});

test('tooltip shows pain_types as comma list', () => {
  const html = renderCard('period', {
    symptom_data_today: { pain_types: ['cramps', 'headache'] },
  });
  assert.ok(html.includes('Pain'), 'pain label missing');
  assert.ok(html.includes('cramps'), 'cramps missing');
  assert.ok(html.includes('headache'), 'headache missing');
});

test('tooltip shows both products and symptoms sections together', () => {
  const html = renderCard('period', {
    product_usage_today: { tampon: 1, pad: 0, cup: 0, liner: 0, underwear: 0 },
    symptom_data_today: { bleeding_strength: 'medium' },
  });
  assert.ok(html.includes('Product Usage'), 'product section missing');
  assert.ok(html.includes('Symptoms'), 'symptoms section missing');
});

test('tooltip DE locale: shows German labels', () => {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation' });
  card._hass = {
    locale: { language: 'de' },
    states: {
      'sensor.menstruation': {
        state: 'period',
        attributes: {
          avg_cycle_length: '28',
          days_until_next_start: '10',
          period_duration_days: '5',
          product_usage_today: { tampon: 2, pad: 0, cup: 0, liner: 0, underwear: 0 },
        },
      },
    },
  };
  card._render();
  const html = card.shadowRoot.innerHTML;
  assert.ok(html.includes('Produktverbrauch'), 'German product heading missing');
  assert.ok(html.includes('Tampon'), 'German tampon label missing');
});

// ---------------------------------------------------------------------------
// D) Tooltip: fallback when no data
// ---------------------------------------------------------------------------

console.log('\nTooltip: fallback / no data');

test('tooltip shows "No additional data" when no product or symptom attrs', () => {
  const html = renderCard('period');
  assert.ok(html.includes('icon-tooltip'), 'tooltip container missing');
  assert.ok(html.includes('No additional data'), 'no-data fallback missing');
});

test('tooltip shows no-data when product_usage_today all zeros', () => {
  const html = renderCard('period', {
    product_usage_today: { tampon: 0, pad: 0, cup: 0, liner: 0, underwear: 0 },
  });
  assert.ok(html.includes('No additional data'), 'should show no-data when all counts are 0');
  assert.ok(!html.includes('Product Usage'), 'should not show product section when all 0');
});

test('tooltip shows no-data when symptom_data_today is empty object', () => {
  const html = renderCard('period', {
    symptom_data_today: {},
  });
  assert.ok(html.includes('No additional data'), 'should show no-data for empty symptom object');
});

test('tooltip does not break for null attrs', () => {
  const html = renderCard('period', {
    product_usage_today: null,
    symptom_data_today: null,
  });
  assert.ok(html.includes('No additional data'), 'null attrs should give no-data fallback');
});

test('tooltip accessible: role=tooltip present', () => {
  const html = renderCard('period');
  assert.ok(html.includes('role="tooltip"'), 'role=tooltip missing for accessibility');
  assert.ok(html.includes('id="status-tooltip"'), 'tooltip id missing');
  assert.ok(html.includes('aria-describedby="status-tooltip"'), 'aria-describedby missing on button');
});

test('tooltip accessible: button is keyboard focusable (tabindex=0)', () => {
  const html = renderCard('period');
  assert.ok(html.includes('tabindex="0"'), 'tabindex=0 missing on icon button');
});

// ---------------------------------------------------------------------------
// E) Regression: progress modes unaffected
// ---------------------------------------------------------------------------

console.log('\nRegression: progress modes');

test('pregnant mode: renders progress-layout, no icon-right-wrap', () => {
  const html = renderCard('pregnant', {
    weeks_pregnant: 12,
    due_date: '2026-12-01',
    is_pregnant: true,
  });
  assert.ok(html.includes('progress-layout'), 'progress-layout missing for pregnant');
  assert.ok(!bodyOf(html).includes('icon-right-wrap'), 'icon-right-wrap should not appear in pregnant mode');
});

test('pre_menarche mode: renders progress-layout, no icon-right-wrap', () => {
  const html = renderCard('pre_menarche', {
    awaiting_menarche: true,
    days_until_menarche: 100,
  });
  assert.ok(html.includes('progress-layout'), 'progress-layout missing for pre_menarche');
  assert.ok(!bodyOf(html).includes('icon-right-wrap'), 'icon-right-wrap should not appear in pre_menarche mode');
});

test('postpartum mode: renders progress-layout, no icon-right-wrap', () => {
  const html = renderCard('postpartum', {
    is_postpartum: true,
    birth_date: '2026-06-01',
    postpartum_duration: 42,
  });
  assert.ok(html.includes('progress-layout'), 'progress-layout missing for postpartum');
  assert.ok(!bodyOf(html).includes('icon-right-wrap'), 'icon-right-wrap should not appear in postpartum mode');
});

// ---------------------------------------------------------------------------
// F) Regression: icon-text modes unaffected
// ---------------------------------------------------------------------------

console.log('\nRegression: icon-text modes');

test('menopause mode: renders icon-text-layout, no icon-right-wrap', () => {
  const html = renderCard('menopause', { menopause_start_date: '2020-01-01' });
  assert.ok(html.includes('icon-text-layout'), 'icon-text-layout missing for menopause');
  assert.ok(!bodyOf(html).includes('icon-right-wrap'), 'icon-right-wrap should not appear in menopause mode');
});

test('menarche mode: renders icon-text-layout', () => {
  const html = renderCard('menarche');
  assert.ok(html.includes('icon-text-layout'), 'icon-text-layout missing for menarche');
});

// ---------------------------------------------------------------------------
// G) Regression: entity not found
// ---------------------------------------------------------------------------

console.log('\nRegression: error states');

test('missing entity: shows entity_not_found message', () => {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.nonexistent' });
  card._hass = { locale: { language: 'en' }, states: {} };
  card._render();
  const html = card.shadowRoot.innerHTML;
  assert.ok(html.includes('Entity not found'), 'should show error for missing entity');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('');
if (failed > 0) {
  console.error(`${failed} test(s) FAILED, ${passed} passed.`);
  process.exit(1);
} else {
  console.log(`All ${passed} tests passed.`);
}
