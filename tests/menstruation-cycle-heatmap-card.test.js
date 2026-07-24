/**
 * Tests for menstruation-cycle-heatmap-card.js render gating.
  *
 * Run with: node tests/menstruation-cycle-heatmap-card.test.js
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

global.window = {};
global.document = { createElement: () => ({}) };
global.customElements = { get: () => null, define: () => {} };
global.HTMLElement = class HTMLElement {
  attachShadow() {
    this.shadowRoot = { innerHTML: '', querySelector: () => null, getElementById: () => null };
    return this.shadowRoot;
  }
};

const src = fs.readFileSync(
  path.join(__dirname, '../custom_components/menstruation_gauge/www/menstruation-cycle-heatmap-card.js'),
  'utf8',
);

let CardClass;
const origDefine = global.customElements.define;
global.customElements.define = (name, cls) => { if (name === 'menstruation-cycle-heatmap-card') CardClass = cls; };
// eslint-disable-next-line no-eval
eval(src);
global.customElements.define = origDefine;

function baseHass() {
  return {
    locale: { language: 'en' },
    states: {
      'sensor.menstruation': {
        state: 'ok',
        last_changed: '2026-07-19T10:00:00+00:00',
        last_updated: '2026-07-19T10:00:00+00:00',
        attributes: {
          history: ['2026-07-01'],
          grouped_starts: ['2026-07-01', '2026-07-29'],
          period_duration_days: 5,
        },
      },
      'sensor.other': {
        state: 'a',
        last_changed: '2026-07-19T10:00:00+00:00',
        last_updated: '2026-07-19T10:00:00+00:00',
        attributes: {},
      },
      'sensor.symptom': {
        state: 'x',
        last_changed: '2026-07-19T10:00:00+00:00',
        last_updated: '2026-07-19T10:00:00+00:00',
        attributes: { dates: ['2026-07-01'] },
      },
    },
  };
}

function makeCard(config) {
  const card = new CardClass();
  card._ensureRoot = () => {};
  card._renderCalls = 0;
  card._render = () => { card._renderCalls += 1; };
  card.setConfig({ entity: 'sensor.menstruation', ...config });
  return card;
}

function makeRenderedCard(config) {
  const card = new CardClass();
  card.setConfig({ title: 'History', entity: 'sensor.menstruation', ...config });
  return card;
}

function testSkipsRenderOnUnchangedRelevantData() {
  const card = makeCard();
  const hass1 = baseHass();
  card.hass = hass1;
  const afterFirst = card._renderCalls;

  const hassOnlyOtherUpdated = {
    ...hass1,
    states: {
      ...hass1.states,
      'sensor.other': {
        ...hass1.states['sensor.other'],
        state: 'b',
        last_changed: '2026-07-19T10:05:00+00:00',
        last_updated: '2026-07-19T10:05:00+00:00',
      },
    },
  };

  card.hass = hassOnlyOtherUpdated;
  assert.strictEqual(card._renderCalls, afterFirst, 'no rerender for unrelated websocket update');
  console.log('  ✓ skips rerender for unchanged heatmap data');
}

function testRerendersOnMainEntityChange() {
  const card = makeCard();
  const hass1 = baseHass();
  card.hass = hass1;
  const afterFirst = card._renderCalls;

  const hassMainChanged = {
    ...hass1,
    states: {
      ...hass1.states,
      'sensor.menstruation': {
        ...hass1.states['sensor.menstruation'],
        last_changed: '2026-07-19T10:10:00+00:00',
        last_updated: '2026-07-19T10:10:00+00:00',
        attributes: {
          ...hass1.states['sensor.menstruation'].attributes,
          grouped_starts: ['2026-07-01', '2026-07-28'],
        },
      },
    },
  };

  card.hass = hassMainChanged;
  assert.strictEqual(card._renderCalls, afterFirst + 1, 'rerender occurs when main heatmap entity changes');
  console.log('  ✓ rerenders when main entity data changes');
}

function testRerendersOnConfiguredSymptomEntityChange() {
  const card = makeCard({ symptom_entities: ['sensor.symptom'] });
  const hass1 = baseHass();
  card.hass = hass1;
  const afterFirst = card._renderCalls;

  const hassSymptomChanged = {
    ...hass1,
    states: {
      ...hass1.states,
      'sensor.symptom': {
        ...hass1.states['sensor.symptom'],
        last_changed: '2026-07-19T10:08:00+00:00',
        last_updated: '2026-07-19T10:08:00+00:00',
      },
    },
  };

  card.hass = hassSymptomChanged;
  assert.strictEqual(card._renderCalls, afterFirst + 1, 'rerender occurs when configured symptom source changes');
  console.log('  ✓ rerenders when configured symptom source changes');
}

function testDarkModeActualPeriodStyleExists() {
  const card = makeRenderedCard();
  card.hass = baseHass();

  const html = card.shadowRoot.innerHTML;
  assert.ok(
    html.includes('.is-period-day {') && html.includes('@media (prefers-color-scheme: dark)'),
    'rendered stylesheet should include an explicit dark-mode style for actual period days',
  );
  assert.ok(
    html.includes('class="cell is-period-window is-period-day'),
    'logged period days should still render with the actual-period class',
  );
  console.log('  ✓ keeps explicit dark-mode styling for actual period days');
}

function testBuildCyclesIncludesMultiplePredictions() {
  const card = new CardClass();
  const cycles = card._buildCycles(
    ['2026-07-01', '2026-07-29'],
    ['2026-08-26', '2026-09-23', '2026-10-21'],
  );
  assert.strictEqual(cycles.length, 4, 'should include 1 historical + 3 predicted cycles');
  assert.deepStrictEqual(
    cycles.map((cycle) => cycle.start),
    ['2026-07-01', '2026-07-29', '2026-08-26', '2026-09-23'],
  );
  assert.deepStrictEqual(
    cycles.map((cycle) => cycle.end),
    ['2026-07-29', '2026-08-26', '2026-09-23', '2026-10-21'],
  );
  assert.deepStrictEqual(
    cycles.map((cycle) => cycle.predicted),
    [false, true, true, true],
  );
  console.log('  ✓ builds multiple predicted cycles from predicted_cycle_starts');
}

let failed = 0;

[
  testSkipsRenderOnUnchangedRelevantData,
  testRerendersOnMainEntityChange,
  testRerendersOnConfiguredSymptomEntityChange,
  testDarkModeActualPeriodStyleExists,
  testBuildCyclesIncludesMultiplePredictions,
].forEach((fn) => {
  try {
    fn();
  } catch (err) {
    console.error(`  ✗ ${fn.name}: ${err.message}`);
    failed += 1;
  }
});

if (failed > 0) {
  console.error(`\n${failed} test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('\nAll tests passed.');
}
