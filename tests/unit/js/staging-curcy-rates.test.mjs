/**
 * staging-curcy-rates mantığı — ağ yok (sahte uzak).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ALLOWED_DEPLOY_TARGETS, inspectRemoteCommand } from '../../../scripts/lib/deploy-guards.mjs';
import { ROOT, assertStagingTarget, assertReadOnlyReportSource } from '../../../scripts/lib/staging-tools.mjs';
import {
  BACKUP_FILE,
  CURCY_EVAL_FILE,
  EXPECTED_EVAL_FILE,
  buildCurcyCommand,
  parseRates,
  runCurcyOp,
  runExpectedTotal,
  sha256,
} from '../../../scripts/lib/staging-curcy-rates.mjs';

const T = ALLOWED_DEPLOY_TARGETS.find((t) => t.id === 'staging-hedef');
const ENV = { DEPLOY_SSH_ALIAS: T.sshAlias, DEPLOY_WP_PATH: T.wpPath, DEPLOY_SITE_URL: T.siteUrl };

/** Sahte uzak: seçeneği bellekte tutar; PHP mantığını (yalnız kur alanı, sha256) benzetir. */
function fakeSite(initial) {
  let opt = JSON.parse(JSON.stringify(initial));
  const hash = () => sha256(JSON.stringify(opt));
  const calls = [];
  const fn = (cmd) => {
    calls.push(cmd);
    if (cmd.startsWith('wp option get siteurl')) return ENV.DEPLOY_SITE_URL;
    const op = (cmd.match(/WDP_E2E_CURCY_OP='(\w+)'/) || [])[1];
    const rates = Object.fromEntries(opt.currency.map((c, i) => [c, opt.currency_rate[i]]));
    const base = { ok: true, op, option_name: 'woo_multi_currency_params', key_count: Object.keys(opt).length, sha256: hash(), rates };
    if (op === 'backup') return JSON.stringify({ ...base, value: opt });
    if (op === 'set') {
      const spec = cmd.match(/WDP_E2E_CURCY_RATES='([^']*)'/)[1];
      for (const p of spec.split(',')) {
        const [c, r] = p.split('=');
        opt.currency_rate[opt.currency.indexOf(c)] = r;
      }
      return JSON.stringify({ ...base, sha256: hash(), changed: [] });
    }
    if (op === 'restore') {
      return JSON.stringify({ ...base, restored_ok: true, sha256: fn.restoreHash || hash() });
    }
    return JSON.stringify(base);
  };
  return { fn, calls, get opt() { return opt; }, hash, set: (v) => { opt = v; } };
}

const INITIAL = { currency_default: 'TRY', currency: ['TRY', 'EUR', 'USD'], currency_rate: ['1', '0.03', '0.03'], other: { a: 1 } };

function files() {
  const store = {};
  return {
    store,
    exists: (r) => r in store,
    writeFile: (r, d) => { store[r] = d; },
    readFile: (r) => (r in store ? Buffer.from(store[r]) : fs.readFileSync(path.join(ROOT, r))),
  };
}

describe('parseRates', () => {
  it('geçerli ve geçersiz', () => {
    assert.deepEqual(parseRates('EUR=0.02,USD=0.022'), { EUR: '0.02', USD: '0.022' });
    for (const bad of ['', 'EUR', 'eur=0.02', 'EUR=0', 'EUR=-1', 'EUR=1;rm', 'EURO=1']) assert.throws(() => parseRates(bad), bad);
  });
});

describe('koruma', () => {
  it('canlı alan adı / yanlış yol reddedilir', () => {
    assert.equal(assertStagingTarget({ ...ENV, DEPLOY_SITE_URL: 'https://hedefdernegi.org' }, undefined).ok, false); // live-scan:blacklist-def
    assert.equal(assertStagingTarget({ ...ENV, DEPLOY_WP_PATH: '~/www/hedefdernegi.org/public_html' }, undefined).ok, false); // live-scan:blacklist-def
    const f = files();
    assert.throws(() => runCurcyOp({ ...ENV, DEPLOY_SITE_URL: 'https://x.example' }, 'status', { remoteFn: fakeSite(INITIAL).fn, ...f }));
  });
  it('komutlar uzak korumadan geçer', () => {
    const evalB64 = fs.readFileSync(path.join(ROOT, CURCY_EVAL_FILE)).toString('base64');
    for (const op of ['backup', 'status']) {
      assert.equal(inspectRemoteCommand(buildCurcyCommand(T.wpPath, op, { evalB64 }), { wpPath: T.wpPath }).ok !== false, true);
    }
    const cmd = buildCurcyCommand(T.wpPath, 'set', { evalB64, rates: { EUR: '0.02' } });
    assert.match(cmd, /WDP_E2E_CURCY_RATES='EUR=0.02'/);
    assert.throws(() => buildCurcyCommand(T.wpPath, 'set', { evalB64, rates: { EUR: "1'; rm" } }));
    assert.throws(() => buildCurcyCommand(T.wpPath, 'restore', { evalB64 }));
    assert.throws(() => buildCurcyCommand(T.wpPath, 'nuke', { evalB64 }));
  });
});

describe('yedek / set / restore', () => {
  it('yedek yokken set ve restore reddedilir', () => {
    const f = files();
    const s = fakeSite(INITIAL);
    assert.throws(() => runCurcyOp(ENV, 'set', { remoteFn: s.fn, rates: { EUR: '0.02' }, ...f }), /Yedek yok/);
    assert.throws(() => runCurcyOp(ENV, 'restore', { remoteFn: s.fn, ...f }), /Yedek yok/);
    assert.equal(s.calls.some((c) => c.includes("CURCY_OP='set'")), false);
  });
  it('backup değeri dosyaya yazar, ekrana değer vermez; üzerine yazmaz', () => {
    const f = files();
    const s = fakeSite(INITIAL);
    const out = runCurcyOp(ENV, 'backup', { remoteFn: s.fn, ...f });
    assert.equal(out.value, undefined);
    assert.equal(out.rates, undefined);
    assert.deepEqual(out.currencies, ['TRY', 'EUR', 'USD']);
    assert.equal(out.key_count, 4);
    const saved = JSON.parse(f.store[BACKUP_FILE]);
    assert.equal(saved.sha256, s.hash());
    assert.deepEqual(saved.value, INITIAL);
    assert.throws(() => runCurcyOp(ENV, 'backup', { remoteFn: s.fn, ...f }), /üzerine yazılmaz/);
  });
  it('set yalnız kur alanını değiştirir (sahte site), status yedekle farkı gösterir', () => {
    const f = files();
    const s = fakeSite(INITIAL);
    runCurcyOp(ENV, 'backup', { remoteFn: s.fn, ...f });
    runCurcyOp(ENV, 'set', { remoteFn: s.fn, rates: { EUR: '0.02', USD: '0.022' }, ...f });
    assert.deepEqual(s.opt.currency_rate, ['1', '0.02', '0.022']);
    assert.deepEqual(s.opt.other, INITIAL.other);
    assert.equal(s.opt.currency_default, 'TRY');
    assert.equal(runCurcyOp(ENV, 'status', { remoteFn: s.fn, ...f }).matches_backup, false);
  });
  it('restore sha256 eşleşmezse hata verir; eşleşirse geçer', () => {
    const f = files();
    const s = fakeSite(INITIAL);
    runCurcyOp(ENV, 'backup', { remoteFn: s.fn, ...f });
    assert.equal(runCurcyOp(ENV, 'restore', { remoteFn: s.fn, ...f }).matches_backup, true);
    s.fn.restoreHash = 'x'.repeat(64);
    assert.throws(() => runCurcyOp(ENV, 'restore', { remoteFn: s.fn, ...f }), /sha256/);
  });
});

describe('PHP dosyaları', () => {
  const curcy = fs.readFileSync(path.join(ROOT, CURCY_EVAL_FILE), 'utf8');
  it('update_option yalnız curcy-rates.php içinde; tek seçenek adı', () => {
    assert.match(curcy, /update_option\( \$option_name/);
    assert.equal((curcy.match(/update_option\(/g) || []).length, 2);
    assert.match(curcy, /\$option_name = 'woo_multi_currency_params'/);
    const dir = path.join(ROOT, 'tests/e2e/helpers');
    for (const n of fs.readdirSync(dir)) {
      if (n.endsWith('.php') && n !== 'curcy-rates.php' && /\bupdate_option\s*\(/.test(fs.readFileSync(path.join(dir, n), 'utf8')) && n !== 'snippet-manage.php' && n !== 'plugin-settings.php' && n !== 'wdp-admin-sim.php') {
        assert.fail(`update_option başka dosyada: ${n}`);
      }
    }
  });
  it('set yalnız currency_rate alanına yazar', () => {
    const setBlock = curcy.slice(curcy.indexOf("if ( 'set' === $op )"), curcy.indexOf('// restore.'));
    assert.match(setBlock, /\$next\['currency_rate'\]\[ \$idx \]/);
    assert.equal((setBlock.match(/\$next\[/g) || []).length, 1);
  });
  it('expected-total salt okunur', () => {
    assert.equal(assertReadOnlyReportSource(fs.readFileSync(path.join(ROOT, EXPECTED_EVAL_FILE), 'utf8')).ok, true);
  });
});

describe('expected-total', () => {
  it('fark tablosu', () => {
    const remoteFn = (cmd) => {
      if (cmd.startsWith('wp option get siteurl')) return ENV.DEPLOY_SITE_URL;
      return JSON.stringify({ base_currency: 'TRY', expected_total: 5000, plugin_shown: 4800.5, by_currency: { EUR: { orders: 2, amount_sum: 100, expected_base: 4000, rate_src: { live: 2 } } } });
    };
    const progress = { converted_total_base: 4900, by_order_currency: { EUR: { converted_sum: 3900 } } };
    const r = runExpectedTotal(ENV, { remoteFn, progress });
    assert.equal(r.diff_expected_vs_shown, 199.5);
    assert.equal(r.diff_expected_vs_progress, 100);
    assert.equal(r.table[0].plugin_converted, 3900);
  });
});
