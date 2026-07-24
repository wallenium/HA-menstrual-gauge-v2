/**
 * Tests for menstruation-calendar-card and editor.
 *
 * Run with: node tests/menstruation-calendar-card.test.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

global.window = { customCards: [] };
const defined = {};
global.customElements = {
  define: (name, cls) => { defined[name] = cls; },
  get: (name) => defined[name] || null,
};

global.document = {
  createElement: () => ({}),
};

global.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
    this.bubbles = init.bubbles;
    this.composed = init.composed;
  }
};

global.HTMLElement = class HTMLElement {
  attachShadow() {
    this.shadowRoot = {
      innerHTML: '',
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
    };
    return this.shadowRoot;
  }

  dispatchEvent() {}
};

const cardSrc = fs.readFileSync(
  path.join(__dirname, '../custom_components/menstruation_gauge/www/menstruation-calendar-card.js'),
  'utf8',
);
// eslint-disable-next-line no-eval
eval(cardSrc);

const editorSrc = fs.readFileSync(
  path.join(__dirname, '../custom_components/menstruation_gauge/www/menstruation-calendar-card-editor.js'),
  'utf8',
);
// eslint-disable-next-line no-eval
eval(editorSrc);

const CardClass = defined['menstruation-calendar-card'];
const EditorClass = defined['menstruation-calendar-card-editor'];

function makeHass() {
  return {
    locale: { language: 'en' },
    callService: async () => {},
    states: {
      'sensor.menstruation': {
        state: 'ok',
        attributes: {
          entry_id: 'entry-1',
          profile: 'default',
          history: ['2026-07-02', '2026-07-03'],
          grouped_starts: ['2026-07-02', '2026-07-30'],
          fertile_window_start: '2026-07-10',
          fertile_window_end: '2026-07-16',
          ovulation_day: '2026-07-14',
          avg_cycle_length: 28,
          symptom_history: [
            { date: '2026-07-14', symptom_data: { bleeding_strength: 'light' } },
          ],
        },
      },
    },
  };
}

function testRegistration() {
  assert.ok(CardClass, 'calendar card is registered');
  assert.ok(EditorClass, 'calendar card editor is registered');
  assert.ok(
    Array.isArray(global.window.customCards)
    && global.window.customCards.some((c) => c.type === 'menstruation-calendar-card'),
    'card is listed in window.customCards',
  );
  console.log('  ✓ registers card and editor');
}

function testWeekStartOption() {
  const card = new CardClass();
  card.setConfig({ entity: 'sensor.menstruation', week_start: 'sunday' });
  const labels = card._weekdayLabels('en');
  assert.strictEqual(labels[0].toLowerCase().startsWith('sun'), true, 'sunday week start uses Sunday first');
  card.setConfig({ entity: 'sensor.menstruation', week_start: 'monday' });
  const labelsMon = card._weekdayLabels('en');
  assert.strictEqual(labelsMon[0].toLowerCase().startsWith('mon'), true, 'monday week start uses Monday first');
  console.log('  ✓ supports configurable week start');
}

function testCalendarRenderingStates() {
  const card = new CardClass();
  card.setConfig({
    entity: 'sensor.menstruation',
    show_fertile_period: true,
    show_ovulation_marker: true,
    show_cycle_day_numbers: true,
  });
  card.hass = makeHass();
  card._viewDate = new Date(2026, 6, 1, 12, 0, 0, 0);
  const model = card._buildModel();
  const html = card._calendarGrid(model, 'en');
  assert.ok(html.includes('is-period-day'), 'period days are marked');
  assert.ok(html.includes('is-fertile'), 'fertile days are marked');
  assert.ok(html.includes('is-ovulation'), 'ovulation day is marked');
  assert.ok(html.includes('ovulation-dot'), 'ovulation marker is rendered');
  assert.ok(html.includes('cycle-day'), 'cycle day labels render when enabled');
  assert.ok(html.includes('Cycle day:'), 'tooltip includes cycle day info');
  console.log('  ✓ renders phase markers and cycle-day tooltip');
}

function testOvulationMarkerToggle() {
  const card = new CardClass();
  card.setConfig({
    entity: 'sensor.menstruation',
    show_fertile_period: true,
    show_ovulation_marker: false,
  });
  card.hass = makeHass();
  card._viewDate = new Date(2026, 6, 1, 12, 0, 0, 0);
  const model = card._buildModel();
  const html = card._calendarGrid(model, 'en');
  assert.ok(!html.includes('is-ovulation'), 'ovulation day styling is disabled when marker is off');
  assert.ok(!html.includes('ovulation-dot'), 'ovulation marker dot is hidden when disabled');
  console.log('  ✓ supports ovulation marker toggle');
}

let failed = 0;
[
  testRegistration,
  testWeekStartOption,
  testCalendarRenderingStates,
  testOvulationMarkerToggle,
].forEach((fn) => {
  try {
    fn();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`  ✗ ${fn.name}: ${err.message}`);
    failed += 1;
  }
});

if (failed > 0) {
  // eslint-disable-next-line no-console
  console.error(`\n${failed} test(s) failed.`);
  process.exitCode = 1;
} else {
  // eslint-disable-next-line no-console
  console.log('\nAll tests passed.');
}
