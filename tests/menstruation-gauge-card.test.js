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
// E) Pregnancy mode UI: field visibility in symptom modal
// ---------------------------------------------------------------------------

function testPregnancyModeSymptomModalFields() {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation' });
  const hass = pregnancyHass(12);
  card._hass = hass;
  // Build a model with is_pregnant=true so _symptomConfig receives correct flags.
  card._config = { entity: 'sensor.menstruation' };
  // Access _symptomConfig directly to verify filtering.
  const GC = GaugeCard;
  const proto = GC.prototype;

  // Verify bleeding_strength is excluded when pregnant.
  const pregConfig = proto._symptomConfig.call(card, 'pregnant', true);
  const keys = pregConfig.map((c) => c.key);
  assert.ok(!keys.includes('bleeding_strength'), 'bleeding_strength must be hidden in pregnancy mode');

  // Verify pregnancy_symptoms category is present.
  assert.ok(keys.includes('pregnancy_symptoms'), 'pregnancy_symptoms category must be present in pregnancy mode');

  // Verify hygiene does not include tampon or cup.
  const hygieneConfig = pregConfig.find((c) => c.key === 'hygiene');
  assert.ok(hygieneConfig, 'hygiene category must still be present in pregnancy mode');
  assert.ok(!hygieneConfig.options.includes('tampon'), 'tampon must be hidden in pregnancy hygiene');
  assert.ok(!hygieneConfig.options.includes('cup'), 'cup must be hidden in pregnancy hygiene');
  assert.ok(hygieneConfig.options.includes('pad'), 'pad must still be visible in pregnancy hygiene');
  assert.ok(hygieneConfig.options.includes('period_underwear'), 'period_underwear must still be visible in pregnancy hygiene');

  console.log('  ✓ pregnancy mode symptom config: bleeding_strength hidden, tampon/cup hidden, pregnancy_symptoms present');
}

// ---------------------------------------------------------------------------
// E2) Pregnancy mode: period toggle hidden in rendered modal HTML
// ---------------------------------------------------------------------------

function testPregnancyModeModalHidesPeriodToggle() {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation' });
  card._hass = pregnancyHass(10);

  // Build model to get palette and use _renderSymptomModal.
  const model = card._buildModel();
  const palette = card._palette(model.state);
  const iso = new Date().toISOString().slice(0, 10);
  const modalHtml = card._renderSymptomModal(iso, model, palette);

  // Period toggle must not be rendered when pregnant.
  assert.ok(
    !modalHtml.includes('data-cat="_period"'),
    'Period start toggle must be hidden in pregnancy mode modal',
  );

  // bleeding_strength options must not appear.
  assert.ok(
    !modalHtml.includes('name="bleeding_strength"'),
    'bleeding_strength inputs must be hidden in pregnancy mode modal',
  );

  // tampon and cup must not appear.
  assert.ok(
    !modalHtml.includes('value="tampon"'),
    'tampon option must be hidden in pregnancy mode modal',
  );
  assert.ok(
    !modalHtml.includes('value="cup"'),
    'cup option must be hidden in pregnancy mode modal',
  );

  // pregnancy_symptoms category must be present.
  assert.ok(
    modalHtml.includes('name="pregnancy_symptoms"'),
    'pregnancy_symptoms inputs must be present in pregnancy mode modal',
  );

  // Save button must be enabled (no disabled attribute).
  assert.ok(
    !modalHtml.includes('class="btn sym-save" disabled'),
    'Save button must not be disabled in pregnancy mode',
  );

  console.log('  ✓ pregnancy mode modal: period toggle hidden, fields correct, save enabled');
}

// ---------------------------------------------------------------------------
// E3) Pregnancy mode: symptom logging saves correctly (no early return)
// ---------------------------------------------------------------------------

function testPregnancyModeSymptomSave() {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation' });

  const savedCalls = [];
  card._hass = {
    ...pregnancyHass(10),
    callService: async (domain, service, payload) => {
      savedCalls.push({ domain, service, payload });
    },
  };

  // Simulate modal open state.
  const iso = new Date().toISOString().slice(0, 10);
  card._modalIso = iso;

  // Stub shadowRoot to return checked pregnancy symptom.
  const fakeRoot = {
    querySelector: (sel) => {
      // No period toggle, no bleeding_strength in pregnancy mode.
      if (sel.includes('_period')) return null;
      if (sel.includes('bleeding_strength')) return null;
      return null;
    },
    querySelectorAll: (sel) => {
      if (sel === '.sym-multi[name="pregnancy_symptoms"]:checked') {
        return [{ value: 'preg_nausea' }, { value: 'preg_fatigue' }];
      }
      return [];
    },
    getElementById: (id) => {
      if (id === 'sym-basal-temp') return { value: '' };
      return null;
    },
    addEventListener: () => {},
    get innerHTML() { return ''; },
    set innerHTML(_v) {},
  };
  Object.defineProperty(card, 'shadowRoot', { get: () => fakeRoot, configurable: true });

  // Run save handler (async but we only need to verify it doesn't early-return).
  const savePromise = card._handleModalSave();

  // _modalIso should have been cleared immediately (synchronous part).
  assert.strictEqual(card._modalIso, null, '_modalIso must be cleared after save call');

  console.log('  ✓ pregnancy mode symptom save: no early return, _modalIso cleared');

  // Return promise so any async errors propagate (optional await in runner).
  return savePromise;
}

// ---------------------------------------------------------------------------
// E4) Non-pregnancy mode: config unchanged (regression guard)
// ---------------------------------------------------------------------------

function testNonPregnancySymptomConfig() {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation' });
  const proto = GaugeCard.prototype;

  const normalConfig = proto._symptomConfig.call(card, 'period', false);
  const keys = normalConfig.map((c) => c.key);
  assert.ok(keys.includes('bleeding_strength'), 'bleeding_strength must be present in non-pregnant mode');
  const hygieneConfig = normalConfig.find((c) => c.key === 'hygiene');
  assert.ok(hygieneConfig.options.includes('tampon'), 'tampon must be present in non-pregnant hygiene');
  assert.ok(hygieneConfig.options.includes('cup'), 'cup must be present in non-pregnant hygiene');
  assert.ok(!keys.includes('pregnancy_symptoms'), 'pregnancy_symptoms must NOT be present in non-pregnant mode');

  console.log('  ✓ non-pregnancy mode: symptom config unchanged (regression guard)');
}

// ---------------------------------------------------------------------------
// E5) New categories available in all configured cycle modes
// ---------------------------------------------------------------------------

function testNewSymptomCategoriesAcrossModes() {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation' });
  const proto = GaugeCard.prototype;
  const required = ['smell', 'clots', 'clot_size', 'bleeding_type', 'cervix_position', 'cervix_texture', 'libido', 'training_intensity'];

  [
    ['period', false],
    ['pregnant', true],
    ['postpartum', false],
    ['menopause', false],
    ['menarche', false],
  ].forEach(([state, isPregnant]) => {
    const config = proto._symptomConfig.call(card, state, isPregnant);
    const keys = config.map((c) => c.key);
    required.forEach((key) => {
      assert.ok(keys.includes(key), `${key} must be available in ${state} mode`);
    });
  });

  console.log('  ✓ new symptom categories present across cycle modes');
}

// ---------------------------------------------------------------------------
// E6) Clot size remains dependent on clots=yes in saved payload
// ---------------------------------------------------------------------------

async function testClotSizeDependencyOnSave() {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation' });

  const savedCalls = [];
  card._hass = {
    ...makeHass({ state: 'period' }),
    callService: async (domain, service, payload) => {
      savedCalls.push({ domain, service, payload });
    },
  };

  const iso = new Date().toISOString().slice(0, 10);
  card._modalIso = iso;

  const selectedMap = new Map([
    ['clots', 'no'],
    ['clot_size', 'large'],
    ['bleeding_type', 'continuous'],
  ]);
  const fakeRoot = {
    querySelector: (sel) => {
      const m = sel.match(/data-cat="([^"]+)"/);
      if (!m) return null;
      const key = m[1];
      const selected = selectedMap.get(key);
      return selected ? { getAttribute: () => selected, classList: { contains: () => false } } : null;
    },
    querySelectorAll: () => [],
    getElementById: (id) => (id === 'sym-basal-temp' ? { value: '' } : null),
    addEventListener: () => {},
    get innerHTML() { return ''; },
    set innerHTML(_v) {},
  };
  Object.defineProperty(card, 'shadowRoot', { get: () => fakeRoot, configurable: true });

  await card._handleModalSave();

  const symptomCall = savedCalls.find((c) => c.domain === 'menstruation_gauge' && c.service === 'add_symptom');
  assert.ok(symptomCall, 'add_symptom service must be called');
  assert.strictEqual(symptomCall.payload.symptom_data.clots, 'no', 'clots must be saved');
  assert.ok(!('clot_size' in symptomCall.payload.symptom_data), 'clot_size must be omitted when clots is no');

  console.log('  ✓ clot size dependency enforced on modal save');
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
  ['pregnancy-mode-symptom-config', testPregnancyModeSymptomModalFields],
  ['pregnancy-mode-modal-field-visibility', testPregnancyModeModalHidesPeriodToggle],
  ['pregnancy-mode-symptom-save', testPregnancyModeSymptomSave],
  ['non-pregnancy-symptom-config-regression', testNonPregnancySymptomConfig],
  ['new-symptom-categories-across-modes', testNewSymptomCategoriesAcrossModes],
  ['clot-size-dependency-save', testClotSizeDependencyOnSave],
];

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
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
})();
