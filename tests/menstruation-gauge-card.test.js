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
  path.join(__dirname, '../custom_components/menstruation_gauge/www/menstruation-icons.js'),
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
// D) Regression: fertile/ovulation datetime attributes render in gauge
// ---------------------------------------------------------------------------

function testFertileAndOvulationFromDateTimeAttributes() {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation', show_fertile_period: true });
  card._viewDate = new Date(2026, 6, 1, 12, 0, 0, 0);
  card._hass = makeHass({
    state: 'fertile',
    attributes: {
      fertile_window_start: '2026-07-10T00:00:00+00:00',
      fertile_window_end: '2026-07-15T00:00:00+00:00',
      ovulation_day: '2026-07-13T00:00:00+00:00',
    },
  });

  const model = card._buildModel();
  assert.strictEqual(model.fertileStart, '2026-07-10', 'fertile start must normalize from datetime');
  assert.strictEqual(model.fertileEnd, '2026-07-15', 'fertile end must normalize from datetime');
  assert.strictEqual(model.ovulationDay, '2026-07-13', 'ovulation day must normalize from datetime');
  assert.ok(model.series.some((step) => step.fertile), 'fertile days must be computed from normalized dates');
  assert.ok(model.series.some((step) => step.ovulation), 'ovulation day must be computed from normalized date');

  card._render();
  const html = card.shadowRoot.innerHTML;
  assert.ok(html.includes('stroke-opacity=".62"'), 'fertile arc segments must be rendered');
  assert.ok(html.includes('opacity="0.90"></circle>'), 'ovulation marker must be rendered');

  console.log('  ✓ fertile/ovulation render from datetime-formatted attributes');
}

// ---------------------------------------------------------------------------
// D2) Historical cycles: fertile/ovulation computed from grouped_starts
// ---------------------------------------------------------------------------

function testHistoricalCycleFertileOvulation() {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation', show_fertile_period: true });

  // View a historical month (March 2025) – well before "now" (July 2026)
  card._viewDate = new Date(2025, 2, 1, 12, 0, 0, 0); // March 2025

  // A cycle started on 2025-03-05 (day 1 = Mar 5).
  // Dynamic fertile window for 28-day cycle: ovulationOffset=13 ± 5 days
  // → fertileStartOffset=8 → Mar 13; fertileEndOffset=14 → Mar 19; ovulationOffset=13 → Mar 18.
  card._hass = makeHass({
    state: 'neutral',
    attributes: {
      // No sensor-provided fertile data (only available for current cycle)
      fertile_window_start: null,
      fertile_window_end: null,
      ovulation_day: null,
      grouped_starts: ['2024-10-01', '2024-11-02', '2024-12-04', '2025-01-07', '2025-02-05', '2025-03-05'],
    },
  });

  const model = card._buildModel();

  assert.strictEqual(model.fertileStart, '2025-03-13', 'historical fertile start must be 5 days before ovulation (dynamic formula)');
  assert.strictEqual(model.fertileEnd, '2025-03-19', 'historical fertile end must be 1 day after ovulation (dynamic formula)');
  assert.strictEqual(model.ovulationDay, '2025-03-18', 'historical ovulation must be cycle day 14');
  assert.ok(model.series.some((step) => step.fertile), 'fertile days must be present in historical series');
  assert.ok(model.series.some((step) => step.ovulation), 'ovulation day must be present in historical series');

  // Verify the specific days
  const mar12 = model.series.find((s) => s.iso === '2025-03-12');
  const mar13 = model.series.find((s) => s.iso === '2025-03-13');
  const mar18 = model.series.find((s) => s.iso === '2025-03-18');
  const mar19 = model.series.find((s) => s.iso === '2025-03-19');
  const mar20 = model.series.find((s) => s.iso === '2025-03-20');
  const mar23 = model.series.find((s) => s.iso === '2025-03-23');
  const mar1 = model.series.find((s) => s.iso === '2025-03-01');
  assert.ok(!mar12?.fertile, 'Mar 12 (day 8, before window) must not be fertile');
  assert.ok(mar13?.fertile, 'Mar 13 (day 9, 5 days before ovulation) must be fertile');
  assert.ok(mar18?.fertile, 'Mar 18 (day 14) must be fertile');
  assert.ok(mar18?.ovulation, 'Mar 18 (day 14) must be ovulation day');
  assert.ok(mar19?.fertile, 'Mar 19 (day 15, 1 day after ovulation) must be fertile');
  assert.ok(!mar20?.fertile, 'Mar 20 (day 16, after window) must not be fertile');
  assert.ok(!mar23?.fertile, 'Mar 23 (day 19, after window) must not be fertile');
  assert.ok(!mar1?.fertile, 'Mar 1 (day 1, before fertile window) must not be fertile');

  card._render();
  const html = card.shadowRoot.innerHTML;
  assert.ok(html.includes('stroke-opacity=".62"'), 'fertile arc segments must be rendered for historical month');
  assert.ok(html.includes('opacity="0.90"></circle>'), 'ovulation marker must be rendered for historical month');

  console.log('  ✓ historical cycle: fertile/ovulation computed from grouped_starts');
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
  assert.strictEqual(keys[0], 'pregnancy_symptoms', 'pregnancy_symptoms must be rendered first in pregnancy mode');
  const pregnancySymptoms = pregConfig.find((c) => c.key === 'pregnancy_symptoms');
  assert.deepStrictEqual(
    pregnancySymptoms.options,
    ['nausea', 'fatigue', 'headache', 'back_pain', 'heartburn', 'swelling'],
    'pregnancy symptoms must use backend keys in priority order',
  );

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
        return [{ value: 'nausea' }, { value: 'fatigue' }];
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
  return savePromise.then(() => {
    const symptomCall = savedCalls.find((c) => c.domain === 'menstruation_gauge' && c.service === 'add_symptom');
    assert.ok(symptomCall, 'add_symptom service must be called');
    assert.deepStrictEqual(
      symptomCall.payload.symptom_data.pregnancy_symptoms,
      ['nausea', 'fatigue'],
      'pregnancy symptom payload must use backend keys',
    );
  });
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

function testDischargeSymptomConfigAndOrdering() {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation' });
  const proto = GaugeCard.prototype;

  const periodConfig = proto._symptomConfig.call(card, 'period', false);
  const periodKeys = periodConfig.map((c) => c.key);
  const dischargeIndex = periodKeys.indexOf('discharge');
  const hygieneIndex = periodKeys.indexOf('hygiene');
  const mucusIndex = periodKeys.indexOf('cervical_mucus');
  const cervixIndex = periodKeys.indexOf('cervix_position');
  const intercourseIndex = periodKeys.indexOf('intercourse');
  const libidoIndex = periodKeys.indexOf('libido');
  const bleedingStrengthIndex = periodKeys.indexOf('bleeding_strength');
  const clotsIndex = periodKeys.indexOf('clots');
  const smellIndex = periodKeys.indexOf('smell');
  assert.ok(dischargeIndex !== -1, 'discharge must be present in period mode');
  assert.ok(hygieneIndex !== -1, 'hygiene must be present in period mode');
  assert.ok(mucusIndex !== -1, 'cervical_mucus must be present in period mode');
  assert.ok(cervixIndex !== -1, 'cervix_position must be present in period mode');
  assert.ok(intercourseIndex !== -1, 'intercourse must be present in period mode');
  assert.ok(libidoIndex !== -1, 'libido must be present in period mode');
  assert.strictEqual(bleedingStrengthIndex, 0, 'bleeding_strength must stay first in period mode');
  assert.ok(clotsIndex > bleedingStrengthIndex, 'clots must be prioritized near the top');
  assert.ok(smellIndex > clotsIndex, 'smell must follow clots near the top');
  assert.ok(hygieneIndex > dischargeIndex, 'hygiene must come after discharge');
  assert.ok(mucusIndex > hygieneIndex, 'cervical_mucus must be grouped under hygiene');
  assert.ok(cervixIndex > mucusIndex, 'cervix_position must follow cervical_mucus under hygiene');
  assert.ok(libidoIndex > intercourseIndex, 'libido must be grouped under intercourse');

  const preMenarcheConfig = proto._symptomConfig.call(card, 'pre_menarche', false);
  const preMenarcheKeys = preMenarcheConfig.map((c) => c.key);
  assert.ok(preMenarcheKeys.includes('discharge'), 'discharge must be present in pre_menarche mode');
  assert.ok(preMenarcheKeys.includes('cervical_mucus'), 'cervical_mucus must be present in pre_menarche mode');
  assert.ok(
    preMenarcheKeys.indexOf('cervical_mucus') > preMenarcheKeys.indexOf('hygiene'),
    'pre_menarche: cervical_mucus must stay grouped after hygiene',
  );

  const pregnantConfig = proto._symptomConfig.call(card, 'pregnant', true);
  const pregnantKeys = pregnantConfig.map((c) => c.key);
  assert.ok(pregnantKeys.includes('discharge'), 'discharge must be present in pregnancy mode');
  assert.strictEqual(pregnantKeys[0], 'pregnancy_symptoms', 'pregnancy symptoms must appear first');
  assert.deepStrictEqual(
    pregnantConfig.find((c) => c.key === 'pregnancy_symptoms')?.options,
    ['nausea', 'fatigue', 'headache', 'back_pain', 'heartburn', 'swelling'],
    'pregnancy symptoms must use supported backend keys',
  );

  card._hass = { locale: { language: 'de' } };
  assert.strictEqual(proto._t.call(card, 'cat_discharge'), 'Ausfluss', 'German discharge category translation should exist');
  assert.strictEqual(proto._t.call(card, 'opt_reddish'), 'Rötlich', 'German reddish option translation should exist');
  assert.strictEqual(proto._t.call(card, 'opt_nausea'), 'Übelkeit', 'German nausea translation should use backend key');
  assert.strictEqual(proto._t.call(card, 'opt_fatigue'), 'Müdigkeit', 'German fatigue translation should use backend key');

  card._hass = { locale: { language: 'en' } };
  assert.strictEqual(proto._t.call(card, 'cat_discharge'), 'Discharge', 'English discharge category translation should exist');
  assert.strictEqual(proto._t.call(card, 'opt_reddish'), 'Reddish', 'English reddish option translation should exist');
  assert.strictEqual(proto._t.call(card, 'opt_nausea'), 'Nausea', 'English nausea translation should use backend key');
  assert.strictEqual(proto._t.call(card, 'opt_fatigue'), 'Fatigue', 'English fatigue translation should use backend key');

  console.log('  ✓ discharge symptom config/order/translations');
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
// D3) Ovulation fallback: sensor ovulation_day used when current cycle not in grouped_starts
// ---------------------------------------------------------------------------

function testOvulationFallbackCurrentCycleNotInGroupedStarts() {
  const card = makeCard();
  card.setConfig({ entity: 'sensor.menstruation', show_fertile_period: true });

  // Viewing July 2026. Current cycle started July 10 but is not yet in grouped_starts
  // (period is still ongoing). The sensor provides ovulation_day and fertile window from
  // the current cycle. grouped_starts only contains the previous (June) cycle start.
  card._viewDate = new Date(2026, 6, 1, 12, 0, 0, 0); // July 2026

  card._hass = makeHass({
    state: 'fertile',
    attributes: {
      ovulation_day: '2026-07-23',
      fertile_window_start: '2026-07-14',
      fertile_window_end: '2026-07-28',
      grouped_starts: ['2026-06-10'],
      avg_cycle_length: 28,
    },
  });

  const model = card._buildModel();

  // Sensor's ovulation_day should be used as model.ovulationDay since the grouped_starts
  // calculation would put ovulation in June (June 10 + 13 = June 23), not July.
  assert.strictEqual(model.ovulationDay, '2026-07-23', 'sensor ovulation_day must be used when grouped_starts cycle does not cover viewed month');

  // The series must have the ovulation day marked (via sensor fallback).
  assert.ok(model.series.some((s) => s.ovulation), 'ovulation day must be marked in series via sensor fallback');
  const ovStep = model.series.find((s) => s.ovulation);
  assert.strictEqual(ovStep && ovStep.iso, '2026-07-23', 'series ovulation entry must match sensor ovulation_day');

  // Fertile window from sensor must also be applied.
  assert.ok(model.series.some((s) => s.fertile), 'fertile days must be present via sensor fallback');
  const jul14 = model.series.find((s) => s.iso === '2026-07-14');
  const jul23 = model.series.find((s) => s.iso === '2026-07-23');
  const jul28 = model.series.find((s) => s.iso === '2026-07-28');
  assert.ok(jul14 && jul14.fertile, 'Jul 14 (fertile window start) must be fertile');
  assert.ok(jul23 && jul23.fertile, 'Jul 23 (ovulation) must also be fertile');
  assert.ok(jul28 && jul28.fertile, 'Jul 28 (fertile window end) must be fertile');

  // Rendered HTML must include the ovulation marker.
  card._render();
  const html = card.shadowRoot.innerHTML;
  assert.ok(html.includes('opacity="0.90"></circle>'), 'ovulation marker must render when sensor provides ovulation_day but current cycle is not in grouped_starts');

  console.log('  ✓ ovulation fallback: sensor ovulation_day used when current cycle not in grouped_starts');
}

function testTodaySaveButtonUsesPeriodLifecycleLabels() {
  const todayIso = new Date().toISOString().slice(0, 10);

  const activeCard = makeCard();
  activeCard.setConfig({ entity: 'sensor.menstruation' });
  activeCard._hass = makeHass({
    state: 'period',
    attributes: {
      history: ['2026-07-01'],
      current_bleeding_block: {
        start: '2026-07-01',
        end: '2026-07-01',
        is_active: true,
        today_logged: false,
      },
    },
  });
  const activeModel = activeCard._buildModel();
  assert.strictEqual(
    activeCard._periodSaveLabel(todayIso, activeModel),
    'Heute loggen',
    'active period should use the log-today action label',
  );

  const startCard = makeCard();
  startCard.setConfig({ entity: 'sensor.menstruation' });
  startCard._hass = makeHass({ state: 'neutral' });
  const startModel = startCard._buildModel();
  assert.strictEqual(
    startCard._periodSaveLabel(todayIso, startModel),
    'Periode Start',
    'new period day should use the period-start action label',
  );

  console.log('  ✓ period lifecycle save labels');
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
  ['fertile-ovulation-datetime-attributes', testFertileAndOvulationFromDateTimeAttributes],
  ['historical-cycle-fertile-ovulation', testHistoricalCycleFertileOvulation],
  ['ovulation-fallback-current-cycle-not-in-grouped-starts', testOvulationFallbackCurrentCycleNotInGroupedStarts],
  ['pregnancy-mode-symptom-config', testPregnancyModeSymptomModalFields],
  ['pregnancy-mode-modal-field-visibility', testPregnancyModeModalHidesPeriodToggle],
  ['pregnancy-mode-symptom-save', testPregnancyModeSymptomSave],
  ['non-pregnancy-symptom-config-regression', testNonPregnancySymptomConfig],
  ['discharge-symptom-config-ordering', testDischargeSymptomConfigAndOrdering],
  ['new-symptom-categories-across-modes', testNewSymptomCategoriesAcrossModes],
  ['clot-size-dependency-save', testClotSizeDependencyOnSave],
  ['period-lifecycle-save-labels', testTodaySaveButtonUsesPeriodLifecycleLabels],
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
