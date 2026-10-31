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

  it('KORUNDU (tür): "12" → 12 ve "12px" → 12 fail değil', () => {
    const a = snap({
      wdp_button_settings: entry({ button_border_radius: '12', modal_padding_top_desktop: '12px' }),
    });
    const b = snap({
      wdp_button_settings: entry({ button_border_radius: 12, modal_padding_top_desktop: 12 }),
    });
    const r = compareSnapshots(a, b);
    assert.equal(
      r.rows.find((x) => x.key === 'option:wdp_button_settings.button_border_radius').class,
      'KORUNDU (tür)'
    );
    assert.equal(
      r.rows.find((x) => x.key === 'option:wdp_button_settings.modal_padding_top_desktop').class,
      'KORUNDU (tür)'
    );
    assert.equal(r.fail, false);
    assert.equal(r.problems.length, 0);
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

  it('YENİ: yalnız sonra, varsayılan (kullanıcı anahtarı)', () => {
    const a = snap({});
    const b = snap({ wdp_new_flag: entry('1') });
    const r = compareSnapshots(a, b, { defaults: { wdp_new_flag: '1' } });
    assert.equal(r.rows.find((x) => x.key === 'option:wdp_new_flag').class, 'YENİ');
    assert.equal(r.fail, false);
  });

  it('BEKLENEN DEĞİŞİM: sürüm/önbellek/log ve wdp_migrated_* çıkış 2 üretmez', () => {
    const a = snap({
      wdp_version: entry('10.3.1'),
      wdp_db_version: entry(''),
      wdp_cache_version: entry('1'),
      wdp_list_cache_version: entry('1'),
      wdp_migration_log: entry([]),
      wdp_css_signature: entry('oldsig'),
    });
    const b = snap({
      wdp_version: entry('10.34.2'),
      wdp_db_version: entry('10.34.2'),
      wdp_cache_version: entry('99'),
      wdp_list_cache_version: entry('99'),
      wdp_migration_log: entry([{ v: '10.34.0' }]),
      wdp_migrated_10_30_0: entry('1'),
      wdp_css_signature: entry('newsig'),
    });
    const r = compareSnapshots(a, b);
    const keys = [
      'option:wdp_version',
      'option:wdp_db_version',
      'option:wdp_cache_version',
      'option:wdp_list_cache_version',
      'option:wdp_migration_log',
      'option:wdp_migrated_10_30_0',
      'option:wdp_css_signature',
    ];
    for (const k of keys) {
      assert.equal(r.rows.find((x) => x.key === k).class, 'BEKLENEN DEĞİŞİM', k);
    }
    assert.equal(r.fail, false);
    assert.equal(r.problems.length, 0);
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

describe('migration-compare 12.0.0 beklenen farklar', () => {
  it('engine silinmesi + migrations.version değişimi: fail değil', () => {
    const a = snap({
      donation_panel_settings: entry({ experiences: { engine: 'new' }, keep: 'x' }),
      donation_panel_migrations: entry({ version: '11.0.0' }),
    });
    const b = snap({
      donation_panel_settings: entry({ experiences: {}, keep: 'x' }),
      donation_panel_migrations: entry({ version: '12.0.0' }),
    });
    const r = compareSnapshots(a, b, { targetVersion: '12.0.0' });
    assert.equal(r.fail, false);
    assert.equal(r.counts['KAYBOLDU'], 0);
    assert.equal(r.counts['DEĞİŞTİ'], 0);
  });

  it('başka anahtar kaybolursa fail', () => {
    const a = snap({ donation_panel_settings: entry({ keep: 'x', other: 'y' }) });
    const b = snap({ donation_panel_settings: entry({ keep: 'x' }) });
    const r = compareSnapshots(a, b, { targetVersion: '12.0.0' });
    assert.equal(r.fail, true);
    assert.equal(r.counts['KAYBOLDU'], 1);
  });
});
