/**
 * Tests for product-icons.js – pregnancy icon mapping.
 *
 * Run with:  node tests/product-icons.test.js
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Provide minimal browser-global stubs before eval-loading the module.
global.window = {};
global.document = undefined;

const src = fs.readFileSync(
  path.join(__dirname, '../custom_components/menstruation_gauge/www/product-icons.js'),
  'utf8',
);
// eslint-disable-next-line no-eval
eval(src);

const {
  weeksToPregnancyMonth,
  resolvePregnancyInfo,
  getPregnancyIcon,
  getPregnancyAssetUrl,
  createAnimatedSvgElement,
} = global.window.ProductIcons;

const ASSET_BASE = '/menstruation_gauge/assets/pregnancy';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function iconFilename(html) {
  const m = html.match(/url\('([^']+)'\)/);
  assert.ok(m, `Expected url(...) in: ${html}`);
  return m[1];
}

function assertWeekIcon(week, expectedFile, label) {
  const html = getPregnancyIcon(week);
  const url = iconFilename(html);
  assert.strictEqual(url, `${ASSET_BASE}/${expectedFile}`, label || `week ${week}`);
}

// ---------------------------------------------------------------------------
// weeksToPregnancyMonth
// ---------------------------------------------------------------------------

function testWeeksToPregnancyMonth() {
  // Typical week values
  assert.strictEqual(weeksToPregnancyMonth(1), 1, 'week 1 → month 1');
  assert.strictEqual(weeksToPregnancyMonth(4), 1, 'week 4 → month 1');
  assert.strictEqual(weeksToPregnancyMonth(5), 2, 'week 5 → month 2');
  assert.strictEqual(weeksToPregnancyMonth(6), 2, 'week 6 → month 2 (not 6!)');
  assert.strictEqual(weeksToPregnancyMonth(8), 2, 'week 8 → month 2');
  assert.strictEqual(weeksToPregnancyMonth(9), 3, 'week 9 → month 3');
  assert.strictEqual(weeksToPregnancyMonth(12), 3, 'week 12 → month 3');
  assert.strictEqual(weeksToPregnancyMonth(13), 4, 'week 13 → month 4');
  assert.strictEqual(weeksToPregnancyMonth(20), 5, 'week 20 → month 5');
  assert.strictEqual(weeksToPregnancyMonth(36), 9, 'week 36 → month 9');
  assert.strictEqual(weeksToPregnancyMonth(40), 9, 'week 40 → month 9 (clamped)');

  // Out-of-range / invalid → default month 1
  assert.strictEqual(weeksToPregnancyMonth(0), 1, 'week 0 → month 1 (default)');
  assert.strictEqual(weeksToPregnancyMonth(-1), 1, 'negative → month 1 (default)');
  assert.strictEqual(weeksToPregnancyMonth(null), 1, 'null → month 1 (default)');
  assert.strictEqual(weeksToPregnancyMonth(undefined), 1, 'undefined → month 1 (default)');
  assert.strictEqual(weeksToPregnancyMonth('abc'), 1, 'non-numeric string → month 1 (default)');

  console.log('  ✓ weeksToPregnancyMonth');
}

// ---------------------------------------------------------------------------
// resolvePregnancyInfo – called with a plain week number (compact-card path)
// ---------------------------------------------------------------------------

function testResolvePregnancyInfoWithNumber() {
  // Plain number → interpreted as weeks
  assert.strictEqual(resolvePregnancyInfo(6).month, 2, 'resolvePregnancyInfo(6).month === 2');
  assert.strictEqual(resolvePregnancyInfo(6).week, 6, 'resolvePregnancyInfo(6).week === 6');
  assert.strictEqual(resolvePregnancyInfo(1).month, 1, 'resolvePregnancyInfo(1).month === 1');
  assert.strictEqual(resolvePregnancyInfo(40).month, 9, 'resolvePregnancyInfo(40).month === 9 (clamped)');

  console.log('  ✓ resolvePregnancyInfo (plain number)');
}

// ---------------------------------------------------------------------------
// resolvePregnancyInfo – called with an object (gauge-card path)
// ---------------------------------------------------------------------------

function testResolvePregnancyInfoWithObject() {
  // Explicit weeks_pregnant field
  const r1 = resolvePregnancyInfo({ weeks_pregnant: 6, is_pregnant: true });
  assert.strictEqual(r1.week, 6, 'weeks_pregnant field → week 6');
  assert.strictEqual(r1.month, 2, 'weeks_pregnant 6 → month 2');
  assert.strictEqual(r1.isPregnant, true, 'is_pregnant flag');

  // Explicit pregnancy_month overrides weeks conversion
  const r2 = resolvePregnancyInfo({ weeks_pregnant: 6, pregnancy_month: 3, is_pregnant: true });
  assert.strictEqual(r2.month, 3, 'explicit pregnancy_month 3 is used as-is');

  // Nested pregnancy_data
  const r3 = resolvePregnancyInfo({ pregnancy_data: { weeks_pregnant: 20 }, is_pregnant: true });
  assert.strictEqual(r3.week, 20, 'nested weeks_pregnant → week 20');
  assert.strictEqual(r3.month, 5, 'nested weeks_pregnant 20 → month 5');

  // State-based is_pregnant
  const r4 = resolvePregnancyInfo({ state: 'pregnant', weeks_pregnant: 12 });
  assert.strictEqual(r4.isPregnant, true, 'state=pregnant → isPregnant');
  assert.strictEqual(r4.month, 3, 'week 12 → month 3');

  // Trimester
  const r5 = resolvePregnancyInfo({ weeks_pregnant: 13 });
  assert.strictEqual(r5.trimester, 1, 'week 13 → trimester 1');
  const r6 = resolvePregnancyInfo({ weeks_pregnant: 14 });
  assert.strictEqual(r6.trimester, 2, 'week 14 → trimester 2');
  const r7 = resolvePregnancyInfo({ weeks_pregnant: 27 });
  assert.strictEqual(r7.trimester, 3, 'week 27 → trimester 3');

  console.log('  ✓ resolvePregnancyInfo (object)');
}

// ---------------------------------------------------------------------------
// getPregnancyIcon – correct SVG asset is chosen
// ---------------------------------------------------------------------------

function testGetPregnancyIcon() {
  assertWeekIcon(1, 'preg_01.svg');
  assertWeekIcon(4, 'preg_01.svg');
  assertWeekIcon(5, 'preg_02.svg');
  // Core regression: week 6 must map to month 2 (preg_02.svg), NOT month 6.
  assertWeekIcon(6, 'preg_02.svg', 'week 6 MUST use preg_02.svg (not preg_06.svg)');
  assertWeekIcon(8, 'preg_02.svg');
  assertWeekIcon(12, 'preg_03.svg');
  assertWeekIcon(20, 'preg_05.svg');
  assertWeekIcon(40, 'preg_09.svg');

  // undefined / out-of-range falls back to preg_01.svg
  assertWeekIcon(undefined, 'preg_01.svg', 'undefined → preg_01.svg');
  assertWeekIcon(0, 'preg_01.svg', '0 → preg_01.svg');

  // Object path (gauge-card)
  const html = getPregnancyIcon({ weeks_pregnant: 6, is_pregnant: true });
  assert.ok(
    iconFilename(html).endsWith('preg_02.svg'),
    'object { weeks_pregnant: 6 } → preg_02.svg',
  );

  console.log('  ✓ getPregnancyIcon');
}

// ---------------------------------------------------------------------------
// getPregnancyAssetUrl – takes a month number directly (no change to API)
// ---------------------------------------------------------------------------

function testGetPregnancyAssetUrl() {
  assert.ok(getPregnancyAssetUrl(1).endsWith('preg_01.svg'), 'month 1 → preg_01.svg');
  assert.ok(getPregnancyAssetUrl(9).endsWith('preg_09.svg'), 'month 9 → preg_09.svg');

  console.log('  ✓ getPregnancyAssetUrl');
}

// ---------------------------------------------------------------------------
// Exports sanity – old name must not be exported
// ---------------------------------------------------------------------------

function testExports() {
  assert.strictEqual(
    typeof global.window.ProductIcons.weeksToPregnancyMonth,
    'function',
    'weeksToPregnancyMonth is exported',
  );
  assert.strictEqual(
    global.window.ProductIcons.normalizePregnancyMonth,
    undefined,
    'normalizePregnancyMonth (old name) is no longer exported',
  );

  console.log('  ✓ exports');
}

// ---------------------------------------------------------------------------
// createAnimatedSvgElement – uses period assets for animated product icons
// ---------------------------------------------------------------------------

class MockNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.attributes = {};
    this.children = [];
    this.dataset = {};
    this._listeners = {};
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  setAttributeNS(_ns, name, value) {
    this.attributes[name] = String(value);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  insertBefore(child, _before) {
    this.children.unshift(child);
    return child;
  }

  addEventListener(name, handler) {
    this._listeners[name] = handler;
  }
}

function createMockDocument() {
  return {
    createElementNS: (_ns, tag) => new MockNode(tag),
  };
}

function findFirst(node, predicate) {
  if (!node) return null;
  if (predicate(node)) return node;
  for (const child of node.children || []) {
    const found = findFirst(child, predicate);
    if (found) return found;
  }
  return null;
}

function testCreateAnimatedSvgElementUsesAssets() {
  const previousDocument = global.document;
  global.document = createMockDocument();

  const expectations = {
    tampon: 'tampon.svg',
    cup: 'menstrual_cup.svg',
    pad: 'pad.svg',
  };

  Object.entries(expectations).forEach(([product, filename]) => {
    const svg = createAnimatedSvgElement(product, 'large');
    assert.ok(svg, `${product}: svg is created`);
    assert.ok(
      svg.dataset.assetSrc.endsWith(`/menstruation_gauge/assets/period/${filename}`),
      `${product}: asset URL points to new period asset`,
    );
    assert.ok(
      String(svg.dataset.fillMask || '').startsWith('url(#pi-asset-mask-'),
      `${product}: fill mask metadata exists for level animation`,
    );

    const image = findFirst(svg, (node) => node.tagName === 'image' && (
      node.attributes.href || node.attributes['xlink:href']
    ));
    const href = image && (image.attributes.href || image.attributes['xlink:href']);
    assert.ok(
      String(href || '').endsWith(`/menstruation_gauge/assets/period/${filename}`),
      `${product}: animated svg references expected asset image`,
    );
  });

  assert.strictEqual(
    createAnimatedSvgElement('does_not_exist', 'large'),
    null,
    'missing/unknown product returns null (fallback path)',
  );

  global.document = previousDocument;
  console.log('  ✓ createAnimatedSvgElement (asset-based + fallback)');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

let failed = 0;

[
  testWeeksToPregnancyMonth,
  testResolvePregnancyInfoWithNumber,
  testResolvePregnancyInfoWithObject,
  testGetPregnancyIcon,
  testGetPregnancyAssetUrl,
  testExports,
  testCreateAnimatedSvgElementUsesAssets,
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
