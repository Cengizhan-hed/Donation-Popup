#!/usr/bin/env node
/**
 * YALNIZ yerel: eski eklenti → güncel göç provası + idempotentlik.
 *
 *   node scripts/migration-rehearsal.mjs
 *   node scripts/migration-rehearsal.mjs --from 10.28.12 --source build/handoff/onceki.zip
 *
 * Uzak site yok. Eklenti PHP/JS/CSS değiştirilmez.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT } from '../tests/e2e/helpers/env-root.mjs';
import { resetLocalWp, phpEvalFile } from './local-wp.mjs';
import { extractKeysFromTrees, buildKeyset, extractRemapTable } from './lib/migration-keys.mjs';
import { compareSnapshots, compareIdempotent, formatCompareMarkdown } from './lib/migration-compare-core.mjs';
import { formatSnapshotConsole } from './lib/migration-util.mjs';
import { SNAPSHOT_PHP, MIGRATION_DIR, defaultOutPath } from './migration-snapshot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REHEARSAL_ROOT = path.join(MIGRATION_DIR, 'local-wp');
const PLUGIN_SLUG = 'woo-donation-popup';
const WC_SLUG = 'woocommerce';
const OPS = 'tests/local-wp/migration-ops.php';
const WC_ZIP = path.join(MIGRATION_DIR, 'cache/woocommerce.latest-stable.zip');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function run(bin, args, opts = {}) {
  const r = spawnSync(bin, args, { encoding: 'utf8', cwd: ROOT, ...opts });
  if (r.status !== 0) {
    throw new Error(`${bin} ${args[0] || ''} başarısız: ${(r.stderr || r.stdout || '').slice(0, 500)}`);
  }
  return r.stdout || '';
}

function parseJsonLine(text) {
  const raw = String(text || '');
  const i = raw.indexOf('{');
  const j = raw.lastIndexOf('}');
  if (i < 0 || j < i) throw new Error(`JSON yok: ${raw.slice(0, 240)}`);
  return JSON.parse(raw.slice(i, j + 1));
}

/**
 * @param {string[]} argv
 */
export function parseRehearsalArgs(argv) {
  const a = argv.filter((x) => x !== '--');
  const out = { from: '', source: '', snapshot: '', skipWc: false };
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--from') out.from = String(a[++i] || '');
    else if (x === '--source') out.source = String(a[++i] || '');
    else if (x === '--snapshot') out.snapshot = String(a[++i] || '');
    else if (x === '--skip-wc') out.skipWc = true;
  }
  return out;
}

export function resolveOncekiZip() {
  const candidates = [
    path.join(ROOT, 'build/handoff/onceki.zip'),
    path.join(ROOT, '../Donation Popup/build/handoff/onceki.zip'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || '';
}

export function resolve1031Source() {
  const candidates = [
    path.join(ROOT, 'build/migration/source/10.3.1/woo-donation-popup'),
    path.join(ROOT, '../Donation Popup/build/migration/source/10.3.1/woo-donation-popup'),
  ];
  return candidates.find((p) => fs.existsSync(path.join(p, 'woo-donation-popup.php'))) || '';
}

function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  run('curl', ['-fsSL', '-L', '-o', dest, url]);
}

function pluginDir(wpDir) {
  return path.join(wpDir, 'wp-content/plugins', PLUGIN_SLUG);
}

function installPluginFromSource(wpDir, source) {
  const dest = pluginDir(wpDir);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
  const st = fs.statSync(source);
  if (st.isFile() && source.endsWith('.zip')) {
    const tmp = path.join(MIGRATION_DIR, 'extracted-old');
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    run('unzip', ['-q', '-o', source, '-d', tmp]);
    const inner = fs.existsSync(path.join(tmp, PLUGIN_SLUG, 'woo-donation-popup.php'))
      ? path.join(tmp, PLUGIN_SLUG)
      : tmp;
    fs.cpSync(inner, dest, { recursive: true });
    return dest;
  }
  if (!fs.existsSync(path.join(source, 'woo-donation-popup.php'))) {
    throw new Error(`eklenti kaynağı yok: ${source}`);
  }
  fs.cpSync(source, dest, { recursive: true });
  return dest;
}

function installCurrentPlugin(wpDir) {
  const dest = pluginDir(wpDir);
  const cssBundle = path.join(ROOT, 'assets/css/donation-modal.css');
  const jsBundle = path.join(ROOT, 'assets/js/donation-modal.js');
  if (!fs.existsSync(cssBundle) || !fs.existsSync(jsBundle)) {
    run('npm', ['run', 'build']);
  }
  const parts = [
    'includes',
    'src',
    'assets',
    'templates',
    'blocks',
    'languages',
    'woo-donation-popup.php',
    'uninstall.php',
    'readme.txt',
    'index.php',
  ];
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const p of parts) {
    const src = path.join(ROOT, p);
    if (!fs.existsSync(src)) continue;
    fs.cpSync(src, path.join(dest, p), { recursive: true });
  }
  return dest;
}

function ensureWooCommerce(wpDir) {
  const dest = path.join(wpDir, 'wp-content/plugins', WC_SLUG);
  if (fs.existsSync(path.join(dest, 'woocommerce.php'))) return dest;
  console.log('WooCommerce indiriliyor (wordpress.org)…');
  download('https://downloads.wordpress.org/plugin/woocommerce.latest-stable.zip', WC_ZIP);
  run('unzip', ['-q', '-o', WC_ZIP, '-d', path.join(wpDir, 'wp-content/plugins')]);
  return dest;
}

function ops(wpDir, cmd, extra = '') {
  const extraArgs = extra ? [cmd, extra] : [cmd];
  const raw = phpEvalFile(OPS, { WDP_LOCAL_WP_DIR: wpDir }, extraArgs);
  return parseJsonLine(raw);
}

function takeSnapshot(wpDir, envId, label, sources) {
  const extracted = extractKeysFromTrees(sources);
  const keyset = buildKeyset(extracted);
  fs.mkdirSync(MIGRATION_DIR, { recursive: true });
  const keyFile = path.join(MIGRATION_DIR, 'keyset-current.json');
  fs.writeFileSync(keyFile, JSON.stringify(keyset, null, 2) + '\n');
  const raw = phpEvalFile(SNAPSHOT_PHP, {
    WDP_LOCAL_WP_DIR: wpDir,
    WDP_MIG_KEYS_FILE: keyFile,
  });
  const snap = parseJsonLine(raw);
  snap.env = envId;
  snap.label = label;
  const outFile = defaultOutPath(envId, label);
  fs.writeFileSync(outFile, JSON.stringify(snap, null, 2) + '\n');
  console.log(`görüntü: ${path.relative(ROOT, outFile)}`);
  console.log(formatSnapshotConsole(snap));
  return { snap, outFile, keyset };
}

function writeCompare(result, outFile, title, beforeLabel, afterLabel) {
  const md = formatCompareMarkdown(result, { title, beforeLabel, afterLabel });
  fs.writeFileSync(outFile, md, 'utf8');
  console.log(`karşılaştırma: ${path.relative(ROOT, outFile)}`);
  const c = result.counts;
  console.log(
    `sınıflar: KORUNDU=${c.KORUNDU} KORUNDU(tür)=${c['KORUNDU (tür)']} TAŞINDI=${c.TAŞINDI} DEĞİŞTİ=${c.DEĞİŞTİ} VARSAYILANA=${c['VARSAYILANA DÖNDÜ']} KAYBOLDU=${c.KAYBOLDU} YENİ=${c.YENİ} BEKLENEN=${c['BEKLENEN DEĞİŞİM']}`
  );
  if (result.problems.length) {
    console.log('sorunlu anahtarlar:');
    for (const r of result.problems) console.log(`- ${r.class} ${r.key}`);
  }
  return md;
}

/**
 * @param {{ from: string, source: string, snapshot: string, skipWc: boolean }} spec
 */
export function runOneRehearsal(spec) {
  const label = spec.from || 'old';
  const source = spec.source;
  if (!source || !fs.existsSync(source)) {
    throw new Error(`kaynak yok (${label}): ${source || '(boş)'}`);
  }

  console.log(`\n=== prova ${label} → güncel ===`);
  const wpDir = resetLocalWp(REHEARSAL_ROOT);

  let wcOk = false;
  if (!spec.skipWc) {
    try {
      ensureWooCommerce(wpDir);
      const act = ops(wpDir, 'activate', 'woocommerce/woocommerce.php');
      wcOk = !!act.ok;
      if (!wcOk) console.error(`WooCommerce etkinleştirme: ${act.error || 'fail'}`);
    } catch (e) {
      console.error(`WooCommerce kurulumu atlandı: ${e.message || e}`);
    }
  }

  const oldDir = installPluginFromSource(wpDir, source);
  const actOld = ops(wpDir, 'activate', `${PLUGIN_SLUG}/woo-donation-popup.php`);
  if (!actOld.ok) throw new Error(`eski eklenti etkin değil: ${actOld.error || ''}`);

  let importInfo = null;
  if (spec.snapshot && fs.existsSync(spec.snapshot)) {
    importInfo = ops(wpDir, 'import', spec.snapshot);
    if (!importInfo.ok) throw new Error(`içe aktarma: ${importInfo.error || ''}`);
  } else {
    ops(wpDir, 'seed', spec.from === '10.3.1' ? '10.3.1' : '');
  }

  const probeOld = ops(wpDir, 'probe');
  const sources = [oldDir, ROOT];
  const before = takeSnapshot(wpDir, 'local', `before-${label}`, sources);

  installCurrentPlugin(wpDir);
  const actNew = ops(wpDir, 'activate', `${PLUGIN_SLUG}/woo-donation-popup.php`);
  if (!actNew.ok) throw new Error(`güncel eklenti etkin değil: ${actNew.error || ''}`);

  const mig1 = ops(wpDir, 'migrate');
  const after = takeSnapshot(wpDir, 'local', `after-${label}`, [ROOT, oldDir]);

  const remap = extractRemapTable(
    fs.readFileSync(path.join(ROOT, 'includes/class-migrations.php'), 'utf8')
  );
  const cmp1 = compareSnapshots(before.snap, after.snap, {
    remap,
    defaults: after.keyset.defaults || {},
    fieldDefaults: after.keyset.fieldDefaults || {},
    idMap: importInfo?.id_map || {},
  });
  const cmpFile1 = path.join(MIGRATION_DIR, `compare-${label}-upgrade.md`);
  writeCompare(cmp1, cmpFile1, `Göç ${label} → güncel`, before.outFile, after.outFile);

  const mig2 = ops(wpDir, 'migrate', 'force');
  const third = takeSnapshot(wpDir, 'local', `idempotent-${label}`, [ROOT, oldDir]);
  const cmp2 = compareIdempotent(after.snap, third.snap);
  const cmpFile2 = path.join(MIGRATION_DIR, `compare-${label}-idempotent.md`);
  writeCompare(cmp2, cmpFile2, `İdempotent ${label}`, after.outFile, third.outFile);

  const summary = {
    from: label,
    source,
    wcOk,
    probeOld: {
      migrations: probeOld.migrations,
      is_fresh_install: probeOld.is_fresh_install,
      needs_run: probeOld.needs_run,
      wc_active: probeOld.wc_active,
      product_post_type: probeOld.product_post_type,
    },
    migrate: {
      is_fresh_install: mig1.is_fresh_install,
      needs_run: mig1.needs_run,
      ran: mig1.ran,
      ok: mig1.ok,
      needs_run_after: mig1.needs_run_after,
    },
    migrate2: { ran: mig2.ran, ok: mig2.ok },
    upgrade: {
      counts: cmp1.counts,
      fail: cmp1.fail,
      problems: cmp1.problems.map((p) => ({ class: p.class, key: p.key, beforeHash: p.beforeHash, afterHash: p.afterHash })),
      expectedChange: cmp1.rows
        .filter((p) => p.class === 'BEKLENEN DEĞİŞİM')
        .map((p) => p.key),
    },
    idempotent: {
      counts: cmp2.counts,
      fail: cmp2.fail,
      problems: cmp2.problems.map((p) => ({ class: p.class, key: p.key, beforeHash: p.beforeHash, afterHash: p.afterHash })),
    },
    files: {
      before: before.outFile,
      after: after.outFile,
      third: third.outFile,
      compareUpgrade: cmpFile1,
      compareIdempotent: cmpFile2,
    },
  };
  const sumFile = path.join(MIGRATION_DIR, `rehearsal-${label}.json`);
  fs.writeFileSync(sumFile, JSON.stringify(summary, null, 2) + '\n');
  console.log(`özet: ${path.relative(ROOT, sumFile)}`);
  console.log(
    `is_fresh_install önce=${summary.probeOld.is_fresh_install} göç=${summary.migrate.is_fresh_install}`
  );
  return summary;
}

export function defaultLegs() {
  /** @type {Array<{ from: string, source: string, snapshot: string, skipWc: boolean }>} */
  const legs = [];
  const onceki = resolveOncekiZip();
  if (onceki) legs.push({ from: '10.28.12', source: onceki, snapshot: '', skipWc: false });
  const src1031 = resolve1031Source();
  if (src1031) legs.push({ from: '10.3.1', source: src1031, snapshot: '', skipWc: false });
  return legs;
}

function main() {
  try {
    fs.mkdirSync(MIGRATION_DIR, { recursive: true });
    const args = parseRehearsalArgs(process.argv.slice(2));
    let legs = [];
    if (args.from || args.source) {
      const source = args.source || (args.from === '10.3.1' ? resolve1031Source() : resolveOncekiZip());
      legs = [{ from: args.from || 'old', source, snapshot: args.snapshot, skipWc: args.skipWc }];
    } else {
      legs = defaultLegs().map((l) => ({ ...l, skipWc: args.skipWc }));
    }
    if (!legs.length) {
      fail(
        'Kaynak yok: build/migration/source/10.3.1/woo-donation-popup, build/handoff/onceki.zip veya --source verin.'
      );
    }
    const results = [];
    for (const leg of legs) {
      results.push(runOneRehearsal(leg));
    }
    const allFile = path.join(MIGRATION_DIR, 'rehearsal-summary.json');
    fs.writeFileSync(allFile, JSON.stringify(results, null, 2) + '\n');
    console.log(`\nTüm prova özeti: ${path.relative(ROOT, allFile)}`);
    const hardFail = results.some((r) => r.idempotent.fail);
    if (hardFail) process.exit(2);
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
