/**
 * plugin-settings aracı: allowlist, yasaklar, canlı red, dry-run, yedek/restore; yerel WP'de gerçek kanıt.
 * Ağ yok, ssh yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  ALLOWLIST,
  PS_EVAL_FILE,
  assertPhpWriteSurface,
  backupName,
  buildPsCommand,
  normalizeValue,
  parseSetSpec,
  resolvePsEnv,
  runPluginSettings,
  validateBackup,
} from '../../../scripts/lib/plugin-settings.mjs';
import { parseArgs } from '../../../scripts/plugin-settings.mjs';
import { allowIkramWpCommand } from '../../../scripts/lib/ikram-wp-guard.mjs';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';

const PREV = Object.fromEntries(Object.keys(ALLOWLIST).map((k) => [k, { present: false, value: null }]));

/** Sahte PHP: show -> PREV; set/restore -> değişiklikleri döner. */
function fakeEval(log, prev = PREV) {
  return (payload) => {
    log.push(payload);
    if (payload.op === 'show') return { ok: true, previous: prev, option_exists: false };
    const src = payload.op === 'set' ? Object.fromEntries(Object.entries(payload.values).map(([p, v]) => [p, { present: true, value: v }])) : payload.restore;
    const changes = Object.entries(src).map(([p, after]) => ({ path: p, before: prev[p], after, changed: true }));
    return { ok: true, op: payload.op, dry: !!payload.dry, written: !payload.dry, changes };
  };
}

describe('plugin-settings: allowlist ve değerler', () => {
  it('geçerli çiftleri ayrıştırır ve tiplendirir', () => {
    assert.deepEqual(parseSetSpec('modules.side_cart=1,modules.campaign=off,modules.impact=on,thanks.celebrate=0'), {
      'modules.side_cart': true,
      'modules.campaign': false,
      'modules.impact': true,
      'thanks.celebrate': false,
    });
  });

  it('bilinmeyen anahtar reddedilir', () => {
    assert.throws(() => parseSetSpec('modules.bilinmeyen=1'), /izinsiz/);
    assert.throws(() => parseSetSpec('general.delete_data_on_uninstall=1'), /izinsiz/);
    assert.throws(() => parseSetSpec('admin.wizard=done'), /izinsiz/);
  });

  it('yasak seçenek adları reddedilir (wc_, woocommerce_, blog*, siteurl, active_plugins)', () => {
    for (const k of ['wc_currency', 'woocommerce_currency', 'blogname', 'blogdescription', 'siteurl', 'active_plugins', 'home', 'template']) {
      assert.throws(() => parseSetSpec(`${k}=x`), /Yasak anahtar/, k);
    }
  });

  it('geçersiz değerler reddedilir', () => {
    assert.throws(() => normalizeValue('admin.ui', 'x'), /izinsiz|geçersiz/);
    assert.throws(() => normalizeValue('thanks.celebrate', 'x'), /geçersiz/);
    assert.throws(() => normalizeValue('modules.thanks', 'belki'), /geçersiz/);
    assert.throws(() => normalizeValue('thanks.message', 'a\u0000b'), /denetim/);
    assert.throws(() => parseSetSpec('modules.thanks'), /Geçersiz çift/);
  });

  it('allowlist yalnız izinli modüller + motor/ekran + thanks/tax_relief alt ayarları', () => {
    assert.equal(ALLOWLIST['modules.donor_account'].type, 'bool');
    assert.equal(Object.keys(ALLOWLIST).filter((k) => k.startsWith('modules.')).length, 7);
    assert.ok(!Object.keys(ALLOWLIST).some((k) => /^(wc_|woocommerce_|blog|siteurl|active_plugins)/.test(k)));
  });
});

describe('plugin-settings: ortam ve canlı red', () => {
  it('yalnız local, staging-hedef, ikram-aid (takma adlarla)', () => {
    assert.equal(resolvePsEnv('ikram'), 'ikram-aid');
    assert.equal(resolvePsEnv('staging'), 'staging-hedef');
    assert.equal(resolvePsEnv('hedef'), 'staging-hedef');
    assert.equal(resolvePsEnv('local'), 'local');
  });

  it('canlı hedef ve bilinmeyen ortam kesin red', () => {
    for (const bad of ['hedefdernegi.org', 'www.hedefdernegi.org', 'live', 'canli', 'production', '', 'ikramaid.uk']) { // live-scan:allow-reject-test
      assert.throws(() => resolvePsEnv(bad), /Geçersiz ortam/, bad);
    }
  });

  it('--env zorunlu; bilinmeyen bayrak red', () => {
    assert.throws(() => parseArgs(['--show']), /--env zorunlu/);
    assert.throws(() => parseArgs(['--env', 'local']), /İşlem yok/);
    assert.throws(() => parseArgs(['--env', 'local', '--show', '--foo']), /Bilinmeyen bayrak/);
    assert.equal(parseArgs(['--env', 'ikram-aid', '--set', 'modules.thanks=1', '--dry-run']).dry, true);
  });

  it('uzak komut yalnız seçili wp yolunu hedefler ve PHP yükünü gömer', () => {
    const cmd = buildPsCommand('~/www/ikramaid.uk/public_html', { evalB64: Buffer.from('<?php echo 1;').toString('base64'), payload: { op: 'show' } });
    assert.match(cmd, /eval-file/);
    assert.match(cmd, /WDP_E2E_PS_PAYLOAD_FILE=/);
    assert.ok(!/hedefdernegi\.org\/public_html/.test(cmd)); // live-scan:allow-reject-test
  });
});

describe('plugin-settings: PHP yazma yüzeyi', () => {
  const src = fs.readFileSync(path.join(ROOT, PS_EVAL_FILE), 'utf8');

  it('gerçek dosyada yalnız tek update_option(Settings::OPTION_NAME) var', () => {
    assert.deepEqual(assertPhpWriteSurface(src), { ok: true });
    assert.match(src, /OPTION_NAME/);
  });

  it('ek yazma çağrısı eklenirse red', () => {
    assert.equal(assertPhpWriteSurface(`${src}\nupdate_option( 'blogname', 'x' );`).ok, false);
    assert.equal(assertPhpWriteSurface(`${src}\nupdate_post_meta( 1, 'a', 'b' );`).ok, false);
    assert.equal(assertPhpWriteSurface(`${src}\n$wpdb->query('x');`).ok, false);
    assert.equal(assertPhpWriteSurface(src.replace('update_option( $wdp_ps_option', 'update_option( "woocommerce_currency"')).ok, false);
  });
});

describe('plugin-settings: dry-run, yedek, restore', () => {
  it('dry-run yedek yazmaz ve PHP\'ye dry=true gönderir', () => {
    const log = [];
    const writes = [];
    const res = runPluginSettings({ envId: 'ikram-aid', op: 'set', values: { 'modules.side_cart': '1' }, dry: true, runEval: fakeEval(log), writeFile: (p) => writes.push(p) });
    assert.equal(writes.length, 0);
    assert.equal(res.written, false);
    assert.equal(res.backup, null);
    assert.equal(log.at(-1).dry, true);
  });

  it('set önce yedeği yazar (yazmadan ÖNCE), biçim doğru ve kişisel veri yok', () => {
    const log = [];
    let order = '';
    const files = {};
    const res = runPluginSettings({
      envId: 'ikram-aid',
      op: 'set',
      values: { 'modules.side_cart': '1', 'modules.impact': '1' },
      runEval: (p) => { if (p.op === 'set') order += 'set;'; return fakeEval(log)(p); },
      writeFile: (p, d) => { order += 'backup;'; files[p] = JSON.parse(d); },
      now: new Date('2026-10-26T09:30:00Z'),
      backupDirAbs: '/tmp/x',
    });
    assert.equal(order, 'backup;set;');
    assert.equal(res.backup, `/tmp/x/${backupName('ikram-aid', new Date('2026-10-26T09:30:00Z'))}`);
    assert.match(path.basename(res.backup), /^ikram-aid-\d{8}T\d{6}Z\.json$/);
    const b = files[res.backup];
    assert.equal(b.option_name, 'donation_panel_settings');
    assert.equal(b.env, 'ikram-aid');
    assert.deepEqual(Object.keys(b.previous).sort(), Object.keys(ALLOWLIST).sort());
    assert.deepEqual(b.requested, { 'modules.side_cart': true, 'modules.impact': true });
    assert.ok(res.table.some((l) => l.startsWith('modules.side_cart') && l.includes('DEĞİŞTİ')));
  });

  it('allowlist dışı anahtar PHP çağrılmadan reddedilir', () => {
    const log = [];
    assert.throws(() => runPluginSettings({ envId: 'ikram-aid', op: 'set', values: { 'woocommerce_currency': 'USD' }, runEval: fakeEval(log), writeFile: () => {} }), /Yasak/);
    assert.equal(log.length, 0);
  });

  it('restore yedeği uygular; yalnız istenen anahtarlar; başka ortamın yedeği red', () => {
    const prev = { ...PREV, 'modules.side_cart': { present: true, value: false } };
    const backup = { option_name: 'donation_panel_settings', env: 'ikram-aid', previous: prev, requested: { 'modules.side_cart': true } };
    const log = [];
    const res = runPluginSettings({ envId: 'ikram-aid', op: 'restore', restoreFile: 'x.json', readFile: () => JSON.stringify(backup), runEval: fakeEval(log, prev) });
    assert.deepEqual(Object.keys(log.at(-1).restore), ['modules.side_cart']);
    assert.deepEqual(log.at(-1).restore['modules.side_cart'], { present: true, value: false });
    assert.equal(res.ok, true);
    assert.throws(() => runPluginSettings({ envId: 'staging-hedef', op: 'restore', restoreFile: 'x.json', readFile: () => JSON.stringify(backup), runEval: fakeEval([]) }), /ait/);
  });

  it('bozuk yedek red', () => {
    assert.throws(() => validateBackup({ option_name: 'x' }, 'ikram-aid'), /biçimi/);
    assert.throws(() => validateBackup({ option_name: 'donation_panel_settings', env: 'ikram-aid', previous: { 'wc_x': { present: true, value: 1 } } }, 'ikram-aid'), /Yasak/);
  });
});

describe('ikram-wp-guard gevşemedi', () => {
  it('option update ve diğer eval-file dosyaları hâlâ reddedilir', () => {
    assert.equal(allowIkramWpCommand('option update donation_panel_settings x').ok, false);
    assert.equal(allowIkramWpCommand('option update blogname x').ok, false);
    assert.equal(allowIkramWpCommand(`eval-file ${PS_EVAL_FILE}`).ok, false);
    assert.equal(allowIkramWpCommand('eval-file tests/e2e/helpers/curcy-rates.php').ok, false);
    assert.equal(allowIkramWpCommand("eval 'update_option(\"a\",1);'").ok, false);
  });
});

const WP_LOADED = fs.existsSync(path.join(process.env.WDP_LOCAL_WP_DIR || path.join(ROOT, 'build/local-wp/wordpress'), 'wp-load.php'));

describe('plugin-settings: yerel WP kanıtı', { skip: !WP_LOADED }, () => {
  const run = (...a) => spawnSync('node', ['scripts/plugin-settings.mjs', '--env', 'local', ...a], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, WDP_UNIT_TEST: '1' } });
  const show = () => JSON.parse(run('--show').stdout).previous;

  it('gerçek değişiklik + geri yükleme; yasak/bilinmeyen anahtar yazmaz', () => {
    const before = show();
    const dry = run('--set', 'modules.side_cart=1,modules.impact=1', '--dry-run');
    assert.equal(dry.status, 0, dry.stderr);
    assert.deepEqual(show(), before, 'dry-run yazmamalı');

    const bad = run('--set', 'woocommerce_currency=USD');
    assert.notEqual(bad.status, 0);
    assert.deepEqual(show(), before);

    const set = run('--set', 'modules.side_cart=1,modules.thanks=1,modules.impact=1,tax_relief.title=Test Baslik');
    assert.equal(set.status, 0, set.stderr);
    const backupLine = set.stdout.split('\n').find((l) => l.startsWith('Yedek: '));
    assert.ok(backupLine, 'yedek yolu yazılmalı');
    const backupFile = backupLine.slice('Yedek: '.length).trim();
    try {
      const after = show();
      assert.deepEqual(after['modules.side_cart'], { present: true, value: true });
      assert.deepEqual(after['modules.impact'], { present: true, value: true });
      assert.deepEqual(after['tax_relief.title'], { present: true, value: 'Test Baslik' });
      const rest = run('--restore', backupFile);
      assert.equal(rest.status, 0, rest.stderr);
      assert.deepEqual(show(), before, 'geri yükleme önceki duruma dönmeli');
    } finally {
      fs.rmSync(backupFile, { force: true });
    }
  });
});

// WP-CLI `eval-file` betiği bir FONKSİYON kapsamında çalıştırır (dosya düzeyi değişkenler global değildir);
// tests/local-wp/eval-file.php ise dosya düzeyinde require eder. Burada gerçek WP-CLI kapsamı taklit edilir.
describe('plugin-settings: eval-file fonksiyon kapsamı (WP-CLI davranışı)', { skip: !WP_LOADED }, () => {
  const wpDir = process.env.WDP_LOCAL_WP_DIR || path.join(ROOT, 'build/local-wp/wordpress');
  const helper = path.join(ROOT, 'tests/e2e/helpers/plugin-settings.php');
  const driver = `<?php
$_SERVER['HTTP_HOST'] = '127.0.0.1'; $_SERVER['SERVER_NAME'] = '127.0.0.1'; $_SERVER['REQUEST_URI'] = '/';
require ${JSON.stringify(path.join(wpDir, 'wp-load.php'))};
function wdp_test_eval_file_scope( $file ) { include $file; }
wdp_test_eval_file_scope( ${JSON.stringify(helper)} );
wdp_test_eval_file_scope( ${JSON.stringify(helper)} ); // ikinci çağrı: fatal olmamalı
`;
  const evalScoped = (payload) => {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'wdp-ps-'));
    try {
      const pf = path.join(dir, 'payload.json');
      const df = path.join(dir, 'driver.php');
      fs.writeFileSync(pf, JSON.stringify(payload));
      fs.writeFileSync(df, driver);
      const r = spawnSync('php', [df], { encoding: 'utf8', env: { ...process.env, WDP_E2E_PS_PAYLOAD_FILE: pf } });
      const lines = r.stdout.split('\n').filter((l) => l.startsWith('{'));
      return { r, outs: lines.map((l) => JSON.parse(l)) };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };

  it('show: allowlist fonksiyon kapsamında dolu, iki kez çağrı fatal vermez', () => {
    const { r, outs } = evalScoped({ op: 'show' });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(outs.length, 2);
    assert.equal(outs[0].ok, true);
    assert.ok('modules.side_cart' in outs[0].previous);
  });

  it('set --dry-run: izinli yol path-not-allowed vermez, hiçbir şey yazılmaz', () => {
    const { r, outs } = evalScoped({ op: 'set', dry: true, values: { 'modules.side_cart': true } });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.equal(outs[0].ok, true, JSON.stringify(outs[0]));
    assert.equal(outs[0].dry, true);
    assert.equal(outs[0].written, false);
  });

  it('izinsiz yol hâlâ reddedilir', () => {
    const { outs } = evalScoped({ op: 'set', dry: true, values: { blogname: 'x' } });
    assert.equal(outs[0].ok, false);
    assert.equal(outs[0].error, 'path-not-allowed');
  });
});
