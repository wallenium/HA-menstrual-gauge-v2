/**
 * Tests for menstrual-product-stats-card.js
 *
 * Covers:
 *  - calculateStats: liner + underwear per-cycle averages extracted correctly
 *  - renderTimeline / usageByDate: all product types incl. liner + underwear
 *  - multiple entries on the same day (correct summation in timeline grouping)
 *  - empty data / unknown product types handled robustly
 *
 * Run with:  node tests/menstrual-product-stats-card.test.js
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Minimal browser-global stubs
// ---------------------------------------------------------------------------
global.window = {};
global.document = { createElement: () => ({}) };
global.customElements = { get: () => null, define: () => {} };
global.HTMLElement = class HTMLElement {
  get innerHTML() { return this._html || ''; }
  set innerHTML(v) { this._html = v; }
};

// Stub ProductIcons so the card doesn't crash when _getSvgIcon is called.
global.window.ProductIcons = { getSvgIcon: () => '' };

const src = fs.readFileSync(
  path.join(__dirname, '../custom_components/menstruation_gauge/www/menstrual-product-stats-card.js'),
  'utf8',
);
// eslint-disable-next-line no-eval
eval(src);

// Retrieve the registered class from the customElements stub.
let CardClass;
const origDefine = global.customElements.define;
global.customElements.define = (name, cls) => { if (name === 'menstrual-product-stats-card') CardClass = cls; };
eval(src); // re-eval to trigger define()
global.customElements.define = origDefine;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard() {
  const card = new CardClass();
  card._hass = { locale: { language: 'en' }, states: {} };
  card.config = { entity: 'sensor.test' };
  return card;
}

// ---------------------------------------------------------------------------
// calculateStats
// ---------------------------------------------------------------------------

function testCalculateStatsAllProducts() {
  const card = makeCard();
  const thisCycle = { tampon: 2, pad: 1, cup: 0, liner: 3, underwear: 4 };
  const usageStats = {
    average_per_cycle: { tampon: 5.0, pad: 2.5, cup: 1.2, liner: 3.0, underwear: 2.0 },
    cycles_considered: 3,
  };

  const result = card.calculateStats(thisCycle, usageStats, 10);

  assert.strictEqual(result.tamponsPerCycle, 5.0, 'tamponsPerCycle');
  assert.strictEqual(result.padsPerCycle, 2.5, 'padsPerCycle');
  assert.strictEqual(result.cupEmptiesPerDay, 1.2, 'cupEmptiesPerDay');
  assert.strictEqual(result.linersPerCycle, 3.0, 'linersPerCycle');
  assert.strictEqual(result.underwearPerCycle, 2.0, 'underwearPerCycle');
  assert.strictEqual(result.cyclesConsidered, 3, 'cyclesConsidered');
  assert.strictEqual(result.planningDays, 10, 'planningDays');

  console.log('  ✓ calculateStats – all products incl. liner + underwear');
}

function testCalculateStatsMissingLinerUnderwear() {
  // If backend provides no liner/underwear keys, defaults to 0 (no crash).
  const card = makeCard();
  const thisCycle = {};
  const usageStats = {
    average_per_cycle: { tampon: 3.0, pad: 1.0, cup: 0.5 },
    cycles_considered: 2,
  };

  const result = card.calculateStats(thisCycle, usageStats, 5);

  assert.strictEqual(result.linersPerCycle, 0, 'linersPerCycle defaults to 0');
  assert.strictEqual(result.underwearPerCycle, 0, 'underwearPerCycle defaults to 0');

  console.log('  ✓ calculateStats – missing liner/underwear keys default to 0');
}

function testCalculateStatsEmptyStats() {
  const card = makeCard();
  const result = card.calculateStats({}, {}, 0);

  assert.strictEqual(result.tamponsPerCycle, 0);
  assert.strictEqual(result.padsPerCycle, 0);
  assert.strictEqual(result.cupEmptiesPerDay, 0);
  assert.strictEqual(result.linersPerCycle, 0);
  assert.strictEqual(result.underwearPerCycle, 0);
  assert.strictEqual(result.cyclesConsidered, 0);
  assert.strictEqual(result.planningDays, 0);

  console.log('  ✓ calculateStats – fully empty input produces all-zero result');
}

function testCalculateStatsFallsBackToCurrentCycle() {
  const card = makeCard();
  const result = card.calculateStats(
    { tampon: 2, pad: 1, cup: 3, liner: 4, underwear: 5 },
    { average_per_cycle: {}, cycles_considered: 0 },
    7,
  );

  assert.strictEqual(result.tamponsPerCycle, 2);
  assert.strictEqual(result.padsPerCycle, 1);
  assert.strictEqual(result.cupEmptiesPerDay, 3);
  assert.strictEqual(result.linersPerCycle, 4);
  assert.strictEqual(result.underwearPerCycle, 5);

  console.log('  ✓ calculateStats – falls back to current-cycle totals when no averages exist');
}

// ---------------------------------------------------------------------------
// renderTimeline / usageByDate grouping
// ---------------------------------------------------------------------------

function makeFakeHassState(timeline) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Use yesterday so diffDays = 1 (within 30-day window)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  // Replace placeholder dates in timeline with yesterday's date
  return timeline.map((e) => ({ ...e, date: dateStr }));
}

function testRenderTimelineAllProducts() {
  const card = makeCard();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  const timeline = [
    { date: dateStr, product: 'tampon', quantity: 2 },
    { date: dateStr, product: 'pad', quantity: 1 },
    { date: dateStr, product: 'cup', action: 'emptied', quantity: 1 },
    { date: dateStr, product: 'liner', quantity: 3 },
    { date: dateStr, product: 'underwear', quantity: 1 },
  ];

  const html = card.renderTimeline(timeline);

  assert.ok(!html.includes('no_usage_last_30_days') && !html.includes('No products'), 'timeline is not empty');
  assert.ok(html.includes('chip tampon'), 'tampon chip present');
  assert.ok(html.includes('chip pad'), 'pad chip present');
  assert.ok(html.includes('chip cup'), 'cup chip present');
  assert.ok(html.includes('chip liner'), 'liner chip present');
  assert.ok(html.includes('chip underwear'), 'underwear chip present');

  console.log('  ✓ renderTimeline – all 5 product types render as chips');
}

function testRenderTimelineMultipleEntriesSameDay() {
  // Multiple liner entries on the same day should both appear as separate chips.
  const card = makeCard();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  const timeline = [
    { date: dateStr, product: 'liner', quantity: 2 },
    { date: dateStr, product: 'liner', quantity: 1 },
    { date: dateStr, product: 'underwear', quantity: 1 },
  ];

  const html = card.renderTimeline(timeline);
  // Both liner entries appear (×2 and ×1)
  assert.ok(html.includes('×2'), 'first liner entry quantity ×2');
  assert.ok(html.includes('×1'), 'second entry quantity ×1');
  // The date key appears exactly once in a timeline-row
  const rowMatches = (html.match(/timeline-row/g) || []).length;
  assert.strictEqual(rowMatches, 1, 'exactly one date row for a single date');

  console.log('  ✓ renderTimeline – multiple entries same day: separate chips, single date row');
}

function testRenderTimelineEmptyInput() {
  const card = makeCard();
  const html = card.renderTimeline([]);
  assert.ok(
    html.includes('No products') || html.includes('no_usage_last_30_days') || html.includes('no products'),
    'empty state shown for empty input',
  );

  console.log('  ✓ renderTimeline – empty input renders empty state');
}

function testRenderTimelineUnknownProductType() {
  // Unknown product types should not crash; they still render with their raw name.
  const card = makeCard();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  const timeline = [
    { date: dateStr, product: 'sponge', quantity: 1 },
  ];

  let html;
  assert.doesNotThrow(() => { html = card.renderTimeline(timeline); }, 'unknown product does not throw');
  assert.ok(typeof html === 'string', 'returns a string');

  console.log('  ✓ renderTimeline – unknown product type handled without crash');
}

function testRenderTimelineOutsideWindow() {
  // Entries older than 30 days should be ignored.
  const card = makeCard();
  const old = new Date();
  old.setDate(old.getDate() - 31);
  const dateStr = old.toISOString().slice(0, 10);

  const timeline = [
    { date: dateStr, product: 'liner', quantity: 1 },
    { date: dateStr, product: 'underwear', quantity: 1 },
  ];

  const html = card.renderTimeline(timeline);
  assert.ok(
    html.includes('No products') || html.includes('no_usage_last_30_days') || html.includes('no products'),
    'entries >30 days old are excluded → empty state',
  );

  console.log('  ✓ renderTimeline – entries outside 30-day window excluded');
}

function testRenderTimelineExactCutoffIncluded() {
  const card = makeCard();
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - 29);
  const dateStr = cutoff.toISOString().slice(0, 10);

  const html = card.renderTimeline([
    { date: dateStr, product: 'tampon', quantity: 1 },
  ]);

  assert.ok(html.includes('chip tampon'), 'cutoff-day entry remains visible');

  console.log('  ✓ renderTimeline – exact cutoff day is included');
}

function testRenderTimelineNormalizesDatetimeAndAliases() {
  const card = makeCard();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  today.setDate(today.getDate() - 1);
  const isoDay = today.toISOString().slice(0, 10);

  const html = card.renderTimeline([
    { created_at: `${isoDay}T09:15:00Z`, product: 'pantyliners', quantity: 2 },
    { date: `${isoDay}T10:30:00+02:00`, product: 'period panties', quantity: 1 },
    { date: isoDay, product: 'binde', quantity: 1 },
  ]);

  assert.ok(html.includes('chip liner'), 'pantyliners normalize to liner');
  assert.ok(html.includes('chip underwear'), 'period panties normalize to underwear');
  assert.ok(html.includes('chip pad'), 'binde normalizes to pad');

  console.log('  ✓ renderTimeline – datetime fields and product aliases normalize correctly');
}

// ---------------------------------------------------------------------------
// productLabel
// ---------------------------------------------------------------------------

function testProductLabelLinerUnderwear() {
  const card = makeCard();
  // English
  assert.strictEqual(card.productLabel({ product: 'liner' }), 'Liner');
  assert.strictEqual(card.productLabel({ product: 'underwear' }), 'Period underwear');

  // German
  card._hass = { locale: { language: 'de' }, states: {} };
  assert.strictEqual(card.productLabel({ product: 'liner' }), 'Slipeinlage');
  assert.strictEqual(card.productLabel({ product: 'underwear' }), 'Periodenunterwäsche');

  console.log('  ✓ productLabel – liner + underwear labels (DE/EN)');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

let failed = 0;

[
  testCalculateStatsAllProducts,
  testCalculateStatsMissingLinerUnderwear,
  testCalculateStatsEmptyStats,
  testCalculateStatsFallsBackToCurrentCycle,
  testRenderTimelineAllProducts,
  testRenderTimelineMultipleEntriesSameDay,
  testRenderTimelineEmptyInput,
  testRenderTimelineUnknownProductType,
  testRenderTimelineOutsideWindow,
  testRenderTimelineExactCutoffIncluded,
  testRenderTimelineNormalizesDatetimeAndAliases,
  testProductLabelLinerUnderwear,
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
