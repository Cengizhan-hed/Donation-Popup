/**
 * E2X sözleşme: plugins_loaded 10'da çalışan snippet eklenti API'sini çağırırsa fatal yok, çıktı güvenli;
 * 20'den sonra aynı çağrı doğru çalışır. Yerel WP (build/local-wp) yoksa atlanır. Uzak yok.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';

const WP = path.join(ROOT, 'build/local-wp/wordpress');
const HAVE = fs.existsSync(path.join(WP, 'wp-load.php')) && fs.existsSync(path.join(WP, 'wp-content/plugins/woocommerce/woocommerce.php'));
const MU_DIR = path.join(WP, 'wp-content/mu-plugins');
const MU = path.join(MU_DIR, 'wdp-e2x-hook-order.php');
const PLUGIN_PARTS = ['includes', 'src', 'assets', 'templates', 'blocks', 'languages', 'woo-donation-popup.php', 'uninstall.php', 'readme.txt', 'index.php'];

function evalProbe(mode) {
  const r = spawnSync('php', ['-d', 'memory_limit=1024M', path.join(ROOT, 'tests/local-wp/eval-file.php'), 'tests/local-wp/hook-order-probe.php', mode], {
    encoding: 'utf8',
    cwd: ROOT,
    env: { ...process.env, WDP_LOCAL_WP_DIR: WP },
    timeout: 120000,
  });
  assert.equal(r.status, 0, `php çıkış ${r.status}: ${(r.stderr || r.stdout || '').slice(0, 600)}`);
  const text = String(r.stdout);
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

describe('kanca sırası sözleşmesi (yerel WP)', { skip: !HAVE && 'yerel WP yok' }, () => {
  let report;
  before(() => {
    const dest = path.join(WP, 'wp-content/plugins/woo-donation-popup');
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
    for (const p of PLUGIN_PARTS) {
      const src = path.join(ROOT, p);
      if (fs.existsSync(src)) fs.cpSync(src, path.join(dest, p), { recursive: true });
    }
    const ens = evalProbe('ensure');
    assert.deepEqual(ens.active, [true, true]);
    fs.mkdirSync(MU_DIR, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'tests/local-wp/hook-order-mu.php'), MU);
    report = evalProbe('report');
  });
  after(() => {
    fs.rmSync(MU, { force: true });
  });

  it('(a) plugins_loaded 10: fatal/uyarı yok, çıktı boş ya da işlenmemiş etiket, filtreler varsayılanı döner', () => {
    const e = report.early;
    assert.ok(e, 'erken ölçüm yok');
    assert.equal(e.fatal, false);
    assert.deepEqual(e.errors, []);
    assert.equal(e.stray_output, '');
    for (const [tag, out] of Object.entries(e.shortcodes)) {
      assert.ok(out === '' || out === `[${tag} id="1"]`, `${tag}: ${out.slice(0, 80)}`);
    }
    assert.equal(e.filters.wdp_min_donation_amount, 5);
    assert.equal(e.filters.wdp_convert_amount, 100);
    assert.equal(e.filters.module_enabled, true);
    assert.equal(e.classes.plugin, true);
    assert.equal(e.legacy_launched, false, 'eski çekirdek 20 öncesi başlamamalı');
  });

  it('(a2) plugins_loaded 15: eski çekirdek henüz başlamadı (kanca sırası 20), fatal yok', () => {
    const m = report.mid;
    assert.ok(m, 'orta ölçüm yok');
    assert.equal(m.fatal, false);
    assert.deepEqual(m.errors, []);
    assert.equal(m.legacy_launched, false);
  });

  it('(b) plugins_loaded 20 sonrası: kısa kodlar kayıtlı, eklenti başlamış, çıktı gerçek', () => {
    const l = report.late_mu;
    assert.ok(l, 'geç ölçüm yok');
    assert.equal(l.fatal, false);
    assert.equal(l.legacy_launched, true);
    assert.equal(l.classes.plugin && l.classes.legacy, true);
    for (const t of Object.keys(report.registered_after)) assert.equal(report.registered_after[t], true, t);
    assert.equal(report.after_output_is_literal, false);
    assert.ok(report.after_output_len > 0);
    assert.equal(report.launched, true);
  });
});
