import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  loadMatrix,
  assertCovering,
  resolveConfig,
  parseMatrixArgs,
  resolveWorkerCount,
  MATRIX_JSON,
} from '../../e2e/helpers/matrix-cover.mjs';
import { formatMoney, formatMinPlaceholder } from '../../e2e/helpers/currency.mjs';
import { amountVisible, pluginConsoleErrors } from '../../e2e/helpers/matrix-scenarios.mjs';
import { ROOT } from '../../e2e/helpers/env-root.mjs';

describe('e2e matrix covering', () => {
  it('matrix.json repo kökünde ve kapsar', () => {
    assert.equal(MATRIX_JSON, path.join(ROOT, 'tests/e2e/matrix.json'));
    const matrix = loadMatrix();
    assertCovering(matrix);
    assert.equal(matrix.configs.length, 4);
    const ids = matrix.configs.map((c) => c.id);
    assert.deepEqual(ids, [
      'tt5-try-blocks-hpos',
      'tt5-eur-classic-nohpos',
      'sf-usd-blocks-nohpos',
      'sf-gbp-classic-hpos',
    ]);
  });

  it('her tema hem blocks hem classic; HPOS her durumda ≥2', () => {
    const matrix = loadMatrix();
    for (const theme of Object.keys(matrix.themes)) {
      const ch = new Set(matrix.configs.filter((c) => c.theme === theme).map((c) => c.checkout));
      assert.equal(ch.has('blocks'), true, theme);
      assert.equal(ch.has('classic'), true, theme);
    }
    assert.ok(matrix.configs.filter((c) => c.hpos).length >= 2);
    assert.ok(matrix.configs.filter((c) => !c.hpos).length >= 2);
  });

  it('--only ve --device ayrıştırır', () => {
    const a = parseMatrixArgs(['--only', 'tt5-try-blocks-hpos,sf-gbp-classic-hpos', '--device', 'iphone']);
    assert.deepEqual(a.only, ['tt5-try-blocks-hpos', 'sf-gbp-classic-hpos']);
    assert.deepEqual(a.devices, ['iphone']);
    const b = parseMatrixArgs(['--device=all']);
    assert.equal(b.devices.length, 3);
    assert.throws(() => parseMatrixArgs(['--device', 'nokia']));
  });

  it('işçi sayısı CPU tavanını aşmaz', () => {
    const n = resolveWorkerCount(99, 3);
    assert.ok(n >= 1);
    assert.ok(n <= 99);
    assert.equal(resolveWorkerCount(0, 3) >= 1, true);
  });

  it('dört mağaza biçimi formatMoney ile beklenen ayırıcı/sembol', () => {
    const matrix = loadMatrix();
    const tryS = matrix.stores.try;
    assert.equal(formatMoney(1234, tryS), '₺1.234');
    const eur = matrix.stores.eur;
    assert.equal(formatMoney(12.5, eur), '12,50 €');
    const usd = matrix.stores.usd;
    assert.equal(formatMoney(12.5, usd), '$12.50');
    const gbp = matrix.stores.gbp;
    assert.equal(formatMoney(12.5, gbp), '£12.50');
    assert.equal(formatMinPlaceholder(10, tryS), 'min: 10');
    assert.equal(formatMinPlaceholder(10, eur), 'min: 10,00');
    assert.equal(formatMinPlaceholder(10, usd), 'min: 10.00');
    assert.equal(formatMinPlaceholder(5, gbp), 'min: 5.00');
    assert.equal(amountVisible('Toplam ₺1.234', 1234, tryS), true);
    assert.equal(amountVisible('Pay 12,50 € now', 12.5, eur), true);
  });

  it('resolveConfig tema+mağaza bağlar', () => {
    const matrix = loadMatrix();
    const cfg = resolveConfig(matrix, 'tt5-try-blocks-hpos');
    assert.equal(cfg.themeSpec.slug, 'twentytwentyfive');
    assert.equal(cfg.storeSpec.currency, 'TRY');
    assert.equal(cfg.hpos, true);
    assert.equal(cfg.checkout, 'blocks');
  });

  it('yalnız eklenti kaynaklı konsol hatalarını ayırır', () => {
    const fatal = pluginConsoleErrors([
      'HTTP 404 http://127.0.0.1/wp-content/themes/storefront/x.css kind=theme',
      'HTTP 404 http://127.0.0.1/wp-content/plugins/woo-donation-popup/x.js kind=plugin',
      'boom src=http://127.0.0.1/wp-content/plugins/woo-donation-popup/assets/js/donation-modal.js kind=plugin',
    ]);
    assert.equal(fatal.length, 2);
  });
});
