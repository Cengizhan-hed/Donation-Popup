/**
 * Göç karşılaştırıcı sınıfları + değer sızıntısı yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareSnapshots,
  compareIdempotent,
  formatCompareMarkdown,
} from '../../../scripts/lib/migration-compare-core.mjs';
import { findLeakedValues } from '../../../scripts/lib/migration-util.mjs';

const SECRET = 'LEAK_SECRET_TOKEN_9f3a';
const COLOR_USER = '#c0ffee';
const COLOR_DEFAULT = '#0f608b';

function snap(options, products = []) {
  return { options, products, woocommerce: {} };
}

function entry(value) {
  return { type: typeof value === 'object' ? 'array' : 'string', hash: 'x', value };
}

describe('migration-compare sınıfları', () => {
  it('KORUNDU: aynı değer', () => {
    const a = snap({ wdp_foo: entry('bar') });
    const b = snap({ wdp_foo: entry('bar') });
    const r = compareSnapshots(a, b);
    const row = r.rows.find((x) => x.key === 'option:wdp_foo');
    assert.equal(row.class, 'KORUNDU');
    assert.equal(r.fail, false);
  });

  it('TAŞINDI: eşleme tablosu + eşdeğer değer', () => {
    const a = snap({ wdp_settings_backup_10_27: entry({ k: 1 }) });
    const b = snap({ wdp_settings_backup_10_27_restored: entry({ k: 1 }) });
    const r = compareSnapshots(a, b, {
      remap: { wdp_settings_backup_10_27: 'wdp_settings_backup_10_27_restored' },
    });
    assert.ok(r.rows.some((x) => x.class === 'TAŞINDI'));
    assert.equal(r.counts.KAYBOLDU, 0);
    assert.equal(r.fail, false);
  });

  it('DEĞİŞTİ: aynı anahtar farklı değer', () => {
    const a = snap({ wdp_foo: entry('eski') });
    const b = snap({ wdp_foo: entry('yeni') });
    const r = compareSnapshots(a, b);
    assert.equal(r.rows.find((x) => x.key === 'option:wdp_foo').class, 'DEĞİŞTİ');
    assert.equal(r.fail, true);
  });

  it('VARSAYILANA DÖNDÜ: kullanıcı değeri varsayılana çekildi', () => {
    const a = snap({
      wdp_button_settings: entry({ button_primary_color: COLOR_USER }),
    });
    const b = snap({
      wdp_button_settings: entry({ button_primary_color: COLOR_DEFAULT }),
    });
    const r = compareSnapshots(a, b, {
      fieldDefaults: { button_primary_color: COLOR_DEFAULT },
    });
    const row = r.rows.find((x) => x.key === 'option:wdp_button_settings.button_primary_color');
    assert.equal(row.class, 'VARSAYILANA DÖNDÜ');
    assert.equal(r.fail, true);
  });

  it('KAYBOLDU: sonra yok', () => {
    const a = snap({ wdp_old: entry('x') });
    const b = snap({});
    const r = compareSnapshots(a, b);
    assert.equal(r.rows.find((x) => x.key === 'option:wdp_old').class, 'KAYBOLDU');
    assert.equal(r.fail, true);
  });

  it('YENİ: yalnız sonra, varsayılan', () => {
    const a = snap({});
    const b = snap({ wdp_migrated_10_30_0: entry('1') });
    const r = compareSnapshots(a, b, { defaults: { wdp_migrated_10_30_0: '1' } });
    assert.equal(r.rows.find((x) => x.key === 'option:wdp_migrated_10_30_0').class, 'YENİ');
    assert.equal(r.fail, false);
  });
});

describe('idempotent ve sızıntı', () => {
  it('2. ve 3. görüntü aynı değilse fail', () => {
    const a = snap({ wdp_foo: entry('1') });
    const b = snap({ wdp_foo: entry('2') });
    const r = compareIdempotent(a, b);
    assert.equal(r.fail, true);
  });

  it('birebir aynı görüntüler idempotent geçer', () => {
    const a = snap({ wdp_foo: entry('1') });
    const r = compareIdempotent(a, a);
    assert.equal(r.fail, false);
  });

  it('rapor metninde örnek değer dizgileri geçmez', () => {
    const a = snap({
      wdp_button_settings: entry({ note: SECRET, button_primary_color: COLOR_USER }),
    });
    const b = snap({
      wdp_button_settings: entry({ note: SECRET, button_primary_color: COLOR_DEFAULT }),
    });
    const r = compareSnapshots(a, b, { fieldDefaults: { button_primary_color: COLOR_DEFAULT } });
    const md = formatCompareMarkdown(r, { title: 'sızıntı testi' });
    const leaked = findLeakedValues(md, [SECRET, COLOR_USER, COLOR_DEFAULT]);
    assert.deepEqual(leaked, []);
    assert.ok(md.includes('VARSAYILANA DÖNDÜ'));
    assert.ok(md.includes('option:wdp_button_settings.button_primary_color'));
  });
});
