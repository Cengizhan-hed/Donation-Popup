import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { colorSyncNeeded, parseColor, textOn, contrast, syncColors } from '../../../assets/src/ui2-shared/color-sync.mjs';
import { classify, toHex, lowContrast } from '../../../assets/src/admin/color-field.mjs';

test('parseColor: hex, rgb(), rgba(), boşluklu rgb ve color(srgb)', () => {
  assert.deepEqual(parseColor('#123456'), [0x12, 0x34, 0x56]);
  assert.deepEqual(parseColor(' #ABC '), [0xaa, 0xbb, 0xcc]);
  assert.deepEqual(parseColor('rgb(18, 52, 86)'), [18, 52, 86]);
  assert.deepEqual(parseColor('rgba(255, 0, 0, 0.5)'), [255, 0, 0]);
  assert.deepEqual(parseColor('rgb(1 2 3 / 50%)'), [1, 2, 3]);
  assert.deepEqual(parseColor('color(srgb 1 0.5 0)'), [255, 128, 0]);
  assert.equal(parseColor('oklab(0.5 0 0)'), null);
  assert.equal(parseColor('var(--x)'), null);
  assert.equal(parseColor(''), null);
});

test('textOn: her zeminde seçilen yazı rengi ≥4.5:1', () => {
  for (let r = 0; r <= 255; r += 17) {
    for (let g = 0; g <= 255; g += 17) {
      for (let b = 0; b <= 255; b += 51) {
        const fg = parseColor(textOn([r, g, b]));
        assert.ok(contrast([r, g, b], fg) >= 4.5, `${r},${g},${b}`);
      }
    }
  }
  assert.equal(textOn([0x12, 0x34, 0x56]), '#ffffff');
  assert.equal(textOn([0xff, 0xd6, 0x0a]), '#000000');
});

test('syncColors: DOM yokken güvenle 0 döner', () => {
  assert.equal(syncColors(), 0);
});

test('classify: sunucu kurallarıyla aynı', () => {
  assert.equal(classify('').kind, 'empty');
  assert.equal(classify('#12305a').kind, 'hex');
  assert.deepEqual(classify('var(--e-global-color-primary)'), { kind: 'var', name: 'e-global-color-primary', fallback: '' });
  assert.deepEqual(classify('var(--a, #fff)'), { kind: 'var', name: 'a', fallback: '#fff' });
  for (const bad of ['red', 'var(--a);x', 'var(--a, var(--b))', 'url(x)', 'var(--a)}', 'var(--a, red)', '#abcd']) {
    assert.equal(classify(bad).kind, 'bad', bad);
  }
});

test('colorSyncNeeded: işaret yalnız eklenti satır içi stilinde ya da style özniteliğinde aranır (stil hesabı yok)', () => {
  const doc = (html) => new JSDOM(`<!doctype html><html><head>${html}</head><body></body></html>`).window.document;
  assert.equal(colorSyncNeeded(doc('<style id="donation-panel-inline-experiences">.a{--dp-color-primary:#123}</style>')), false);
  assert.equal(colorSyncNeeded(doc('<style id="donation-panel-inline-experiences">:root{--dp-color-dynamic:1}</style>')), true);
  assert.equal(colorSyncNeeded(doc('<style id="theme">:root{--dp-color-dynamic:1}</style>')), false, 'eklentiye ait olmayan stil sayılmaz');
  const d = doc('');
  d.body.innerHTML = '<div class="donation-panel" style="--dp-color-primary:var(--x,#123);--dp-color-dynamic:1"></div>';
  assert.equal(colorSyncNeeded(d), true);
  assert.equal(colorSyncNeeded(null), false);
});

test('toHex ve lowContrast', () => {
  assert.equal(toHex([18, 52, 90]), '#12345a');
  assert.equal(lowContrast([0x12, 0x30, 0x5a]), '');
  assert.equal(lowContrast([0xff, 0xd6, 0x0a]), '1.4');
});
