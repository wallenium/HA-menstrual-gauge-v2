'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

global.window = {};
global.document = { createElement: () => ({}) };
global.customElements = { get: () => null, define: () => {} };
global.HTMLElement = class HTMLElement {
  attachShadow() {
    this.shadowRoot = { innerHTML: '' };
    return this.shadowRoot;
  }
};

const src = fs.readFileSync(
  path.join(__dirname, '../custom_components/menstruation_gauge/www/menstruation-cycle-history-card-row.js'),
  'utf8',
);

let CardClass;
const originalDefine = global.customElements.define;
global.customElements.define = (name, cls) => { if (name === 'menstruation-cycle-history-card-row') CardClass = cls; };
// eslint-disable-next-line no-eval
eval(src);
global.customElements.define = originalDefine;

function testBuildCyclesWithMultiplePredictions() {
  const card = new CardClass();
  const cycles = card._buildCycles(
    ['2026-07-01', '2026-07-29'],
    ['2026-08-26', '2026-09-23'],
  );
  assert.deepStrictEqual(
    cycles.map((cycle) => [cycle.start, cycle.end, cycle.predicted]),
    [
      ['2026-08-26', '2026-09-23', true],
      ['2026-07-29', '2026-08-26', true],
      ['2026-07-01', '2026-07-29', false],
    ],
  );
  console.log('  ✓ history row builds multiple future predicted cycles');
}

let failed = 0;
[
  testBuildCyclesWithMultiplePredictions,
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
