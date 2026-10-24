/**
 * Eklenti açık/kapalı karşılaştırma — YEREL WP (PHP + SQLite). Uzak yok.
 * Gerçek eklenti: yeşil. Bilerek hata ekleyen sahte (bizden) kod: kırmızı. Sahte üçüncü taraf: iki durumda eşit.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runOnOffCompare } from '../../../scripts/plugin-onoff-compare.mjs';

describe('plugin açık/kapalı (yerel WP)', { timeout: 600000 }, () => {
  it('eklenti hata eklemiyor: yeşil (üçüncü taraf gürültüsü fark vermez)', async () => {
    const res = await runOnOffCompare({ browser: false });
    assert.equal(res.compare.red, false, res.line);
    assert.ok(res.states.on.home.thirdParty >= 1, 'sahte üçüncü taraf uyarısı iki durumda da görünmeli');
    assert.ok(res.states.off.home.thirdParty >= 1);
    assert.equal(res.states.on.home.phpIssues, res.states.off.home.phpIssues);
    for (const n of ['wc-settings', 'orders', 'product-edit', 'product', 'cart', 'checkout', 'donations']) {
      assert.ok(res.pageNames.includes(n), `kapsam: ${n}`);
    }
  });

  it('eklenti hata ekliyor (bilerek): kırmızı', async () => {
    const res = await runOnOffCompare({ browser: false, injectOurs: true });
    assert.equal(res.compare.red, true, res.line);
    assert.ok(res.compare.rows.some((r) => r.ours > 0));
  });
});
