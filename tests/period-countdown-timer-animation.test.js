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

let failed = 0;

[
  testProductFillAnimatorUpdates,
  testAnimatedSvgFillMaskApplied,
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
