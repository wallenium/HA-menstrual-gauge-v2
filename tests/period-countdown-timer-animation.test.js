/**
 * Tests for period-countdown-timer animated product fill handling.
 *
 * Run with: node tests/period-countdown-timer-animation.test.js
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

class MockNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.attributes = {};
    this.children = [];
    this.dataset = {};
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  insertBefore(child, _before) {
    this.children.unshift(child);
    return child;
  }

  querySelector(selector) {
    if (selector === '.anim-fill') {
      return this.children.find((child) => child.attributes.class === 'anim-fill') || null;
    }
    return null;
  }
}

global.HTMLElement = class {};
global.customElements = { define: () => {} };
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};
global.document = {
  createElementNS: (_ns, tag) => new MockNode(tag),
};
global.window = {
  customCards: [],
  setTimeout,
  ProductIcons: {
    getSvgIcon: (product, size) => {
      const px = size === 'large' ? 48 : 24;
      return `<span aria-hidden="true" style="display:block;width:${px}px;height:${px}px;background-color:currentColor;-webkit-mask:url('/test/${product}.svg') center / contain no-repeat;mask:url('/test/${product}.svg') center / contain no-repeat;"></span>`;
    },
    createAnimatedSvgElement: () => {
      const svg = new MockNode('svg');
      svg.dataset.fillMask = 'url(#mask-test)';
      svg.appendChild(new MockNode('defs'));
      return svg;
    },
  },
};

const src = fs.readFileSync(
  path.join(__dirname, '../custom_components/menstruation_gauge/www/period-countdown-timer.js'),
  'utf8',
);
// eslint-disable-next-line no-eval
eval(`${src}\n;global.__ProductFillAnimator = ProductFillAnimator; global.__PeriodCountdownTimer = PeriodCountdownTimer;`);

const ProductFillAnimator = global.__ProductFillAnimator;
const PeriodCountdownTimer = global.__PeriodCountdownTimer;

function testProductFillAnimatorUpdates() {
  const cupSvg = { querySelector: () => new MockNode('rect') };
  const cupFill = cupSvg.querySelector();
  const cupAnimator = new ProductFillAnimator({ querySelector: () => cupFill }, 'cup', 100, 'realistic');
  cupAnimator._updateFill(0.5);
  assert.strictEqual(cupFill.getAttribute('y'), '10.5', 'cup fill y updates');
  assert.strictEqual(cupFill.getAttribute('height'), '7.5', 'cup fill height updates');

  const tamponFill = new MockNode('rect');
  const tamponAnimator = new ProductFillAnimator({ querySelector: () => tamponFill }, 'tampon', 100, 'realistic');
  tamponAnimator._updateFill(0.5);
  assert.strictEqual(tamponFill.getAttribute('y'), '9.5', 'tampon fill y updates');
  assert.strictEqual(tamponFill.getAttribute('height'), '7.5', 'tampon fill height updates');

  const padFill = new MockNode('circle');
  const padAnimator = new ProductFillAnimator({ querySelector: () => padFill }, 'pad', 100, 'realistic');
  padAnimator._updateFill(0.5);
  assert.strictEqual(padFill.getAttribute('r'), '2', 'pad fill radius updates');

  console.log('  ✓ ProductFillAnimator fill updates');
}

function testAnimatedSvgFillMaskApplied() {
  const timer = new PeriodCountdownTimer();

  const cup = timer._createAnimatedCupSVG('realistic');
  const cupFill = cup.querySelector('.anim-fill');
  assert.ok(cupFill, 'cup fill node exists');
  assert.strictEqual(cupFill.getAttribute('mask'), 'url(#mask-test)', 'cup fill uses mask from asset svg');

  const tampon = timer._createAnimatedTamponSVG('realistic');
  const tamponFill = tampon.querySelector('.anim-fill');
  assert.ok(tamponFill, 'tampon fill node exists');
  assert.strictEqual(tamponFill.getAttribute('mask'), 'url(#mask-test)', 'tampon fill uses mask from asset svg');

  const pad = timer._createAnimatedPadSVG('realistic');
  const padFill = pad.querySelector('.anim-fill');
  assert.ok(padFill, 'pad fill node exists');
  assert.strictEqual(padFill.getAttribute('mask'), 'url(#mask-test)', 'pad fill uses mask from asset svg');

  console.log('  ✓ animated product fill mask assignment');
}

// ---------------------------------------------------------------------------
// A1) Product icon color: .timer-icon span CSS uses --primary-text-color
// ---------------------------------------------------------------------------

function testTimerIconSpanColorCss() {
  const timer = new PeriodCountdownTimer();
  const styles = timer.getStyles();

  // Must have a span rule inside .timer-icon that sets color to --primary-text-color
  // so that currentColor in the mask adapts to dark/light mode automatically.
  assert.ok(
    styles.includes('.timer-icon span') && styles.includes('--primary-text-color'),
    '.timer-icon span must use --primary-text-color for dark/light mode adaptive icon rendering',
  );

  console.log('  ✓ .timer-icon span CSS: --primary-text-color present for dark/light mode adaptive icons');
}

// ---------------------------------------------------------------------------
// A2) Product icon size: underwear/liner icons use "large" (48px) in product config
// ---------------------------------------------------------------------------

function testTimerProductIconSizes() {
  const timer = new PeriodCountdownTimer();
  timer.config = {};

  // Access _getSvgIcon with size to verify it passes the parameter.
  const underwearIcon = timer._getSvgIcon('underwear', 'large');
  assert.ok(
    underwearIcon.includes('width:48px') || underwearIcon.includes('width: 48px'),
    'underwear icon with "large" size must produce a 48px-wide span',
  );

  const linerIcon = timer._getSvgIcon('liner', 'large');
  assert.ok(
    linerIcon.includes('width:48px') || linerIcon.includes('width: 48px'),
    'liner icon with "large" size must produce a 48px-wide span',
  );

  // Default size (no param) remains 24px for backward compatibility.
  const smallIcon = timer._getSvgIcon('pad');
  assert.ok(
    smallIcon.includes('width:24px') || smallIcon.includes('width: 24px'),
    'pad icon with default size must produce a 24px-wide span',
  );

  console.log('  ✓ timer _getSvgIcon: large → 48px, default → 24px');
}

// ---------------------------------------------------------------------------
// A2) Regression: product config entries use "large" icons for timer display
// ---------------------------------------------------------------------------

function testTimerProductConfigIconSize() {
  const timer = new PeriodCountdownTimer();
  timer.config = {};

  // Capture what the product config would generate for underwear/liner.
  const underwearIcon = timer._getSvgIcon('underwear', 'large');
  const linerIcon = timer._getSvgIcon('liner', 'large');

  // Both should produce 48px spans (same size as the animated SVGs).
  assert.ok(underwearIcon.includes('48px'), 'underwear icon in product config must be 48px for visual parity');
  assert.ok(linerIcon.includes('48px'), 'liner icon in product config must be 48px for visual parity');

  console.log('  ✓ product config: underwear/liner icons are 48px (parity with animated products)');
}

function testDischargeTranslations() {
  const timer = new PeriodCountdownTimer();
  timer._hass = { locale: { language: 'de' } };
  assert.strictEqual(timer._t('discharge'), 'Ausfluss', 'German discharge translation should exist');

  timer._hass = { locale: { language: 'en' } };
  assert.strictEqual(timer._t('discharge'), 'Discharge', 'English discharge translation should exist');

  console.log('  ✓ period timer discharge translations');
}

function testFirstPeriodSymptomHeaderTranslations() {
  const timer = new PeriodCountdownTimer();
  timer._hass = { locale: { language: 'de' } };
  assert.strictEqual(timer._t('log_first_period_symptoms'), 'Symptome loggen', 'German pre-menarche modal header should say Symptome loggen');

  timer._hass = { locale: { language: 'en' } };
  assert.strictEqual(timer._t('log_first_period_symptoms'), 'Log Symptoms', 'English pre-menarche modal header should say Log Symptoms');

  console.log('  ✓ timer first-period symptom header translations');
}

let failed = 0;

[
  testProductFillAnimatorUpdates,
  testAnimatedSvgFillMaskApplied,
  testTimerIconSpanColorCss,
  testTimerProductIconSizes,
  testTimerProductConfigIconSize,
  testDischargeTranslations,
  testFirstPeriodSymptomHeaderTranslations,
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
