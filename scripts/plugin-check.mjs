#!/usr/bin/env node
/**
 * Yerel WP (build/local-wp) üzerinde WordPress Plugin Check.
 * Eklenti dağıtım ZIP'inden kurulur. ZORUNLU: wp-cli / yerel WP / Plugin Check yoksa ya da çalışmazsa
 * net hata + kurulum komutu ile ÇIKIŞ 1 (atlama yok).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureLocalWp } from './local-wp.mjs';
import { downloadHttps } from './lib/https-download.mjs';
import {
  issuesFromPluginCheck,
  summarizeIssues,
  summaryMarkdown,
  writeLintPair,
} from './lib/lint-report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WP_CLI = path.join(ROOT, 'tools/bin/wp-cli.phar');
const OUT = path.join(ROOT, 'build/lint');
const LOCAL = path.join(ROOT, 'build/local-wp');
const SIBLING_LOCAL = path.resolve(ROOT, '../Donation Popup/build/local-wp');
const PLUGIN_SLUG = 'woo-donation-popup';

const INSTALL_HINT = 'Kurulum: node scripts/install-lint-tools.mjs  (wp-cli.phar, sürüm+SHA256 tools/lint-tools.json)';

/** Plugin Check zorunlu: atlama yok, net hata ile çık. */
function skip(reason) {
  const payload = { failed: true, reason, issues: [] };
  writeLintPair(OUT, 'plugin-check', payload, `# Plugin Check\n\nÇALIŞMADI (zorunlu): ${reason}\n`);
  console.error(`plugin-check: HATA — ${reason}\n${INSTALL_HINT}`);
  process.exit(1);
}

function run(bin, args, opts = {}) {
  return spawnSync(bin, args, { encoding: 'utf8', cwd: ROOT, ...opts });
}

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) return dest;
  await downloadHttps(url, dest);
  if (!fs.existsSync(dest) || fs.statSync(dest).size < 1000) {
    throw new Error(`indirilemedi: ${url}`);
  }
  return dest;
}

function copyCache(dest, fallbacks) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) return dest;
  for (const fb of fallbacks) {
    if (fb && fs.existsSync(fb) && fs.statSync(fb).size > 10000) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(fb, dest);
      return dest;
    }
  }
  return dest;
}

if (!fs.existsSync(WP_CLI)) {
  skip('tools/bin/wp-cli.phar yok');
}

async function main() {
  let wpDir;
  try {
    wpDir = ensureLocalWp({ quiet: true });
  } catch (err) {
    skip(`yerel WP kurulamadı: ${err instanceof Error ? err.message : err}`);
  }

  function wp(args, opts = {}) {
    return run('php', [WP_CLI, `--path=${wpDir}`, '--allow-root', ...args], opts);
  }

  const wcZip = path.join(LOCAL, 'woocommerce.latest-stable.zip');
  const pcZip = path.join(LOCAL, 'plugin-check.latest-stable.zip');
  const siblingRoot = path.resolve(ROOT, '../Donation Popup');
  copyCache(wcZip, [
    path.join(SIBLING_LOCAL, 'woocommerce.latest-stable.zip'),
    path.join(siblingRoot, 'build/migration/cache/woocommerce.latest-stable.zip'),
    path.join(siblingRoot, 'build/local-wp/woocommerce.latest-stable.zip'),
  ]);
  copyCache(pcZip, [
    path.join(SIBLING_LOCAL, 'plugin-check.latest-stable.zip'),
    path.join(siblingRoot, 'build/migration/cache/plugin-check.latest-stable.zip'),
  ]);

  try {
    if (!fs.existsSync(path.join(wpDir, 'wp-content/plugins/woocommerce/woocommerce.php'))) {
      console.log('WooCommerce (wp.org) yerel WP için indiriliyor…');
      await download('https://downloads.wordpress.org/plugin/woocommerce.latest-stable.zip', wcZip);
      const ins = wp(['plugin', 'install', wcZip, '--activate', '--force']);
      if (ins.status !== 0) {
        skip(`WooCommerce kurulamadı: ${(ins.stderr || ins.stdout || '').slice(0, 300)}`);
      }
    } else {
      wp(['plugin', 'activate', 'woocommerce']);
    }
    if (
      !fs.existsSync(path.join(wpDir, 'wp-content/plugins/plugin-check/plugin.php')) &&
      !fs.existsSync(path.join(wpDir, 'wp-content/plugins/plugin-check/plugin-check.php'))
    ) {
      console.log('Plugin Check (wp.org) yerel WP için indiriliyor…');
      await download('https://downloads.wordpress.org/plugin/plugin-check.latest-stable.zip', pcZip);
      const ins = wp(['plugin', 'install', pcZip, '--activate', '--force']);
      if (ins.status !== 0) {
        skip(`Plugin Check kurulamadı: ${(ins.stderr || ins.stdout || '').slice(0, 300)}`);
      }
    } else {
      wp(['plugin', 'activate', 'plugin-check']);
    }
  } catch (err) {
    skip(`ağ yok veya indirme başarısız: ${err instanceof Error ? err.message : err}`);
  }

  const buildJs = run('npm', ['run', 'build']);
  if (buildJs.status !== 0) skip('npm run build başarısız; Plugin Check atlandı');
  const pack = run('bash', [path.join(ROOT, 'scripts/package-wp-plugin.sh')]);
  if (pack.status !== 0) skip('npm pack / ZIP oluşmadı; Plugin Check atlandı');

  const zip = path.join(ROOT, 'build/woo-donation-popup.zip');
  if (!fs.existsSync(zip)) skip('build/woo-donation-popup.zip yok');

  const inst = wp(['plugin', 'install', zip, '--force', '--activate']);
  if (inst.status !== 0) {
    skip(`dağıtım ZIP kurulamadı: ${(inst.stderr || inst.stdout || '').slice(0, 300)}`);
  }

  const check = wp(
    [
      'plugin',
      'check',
      PLUGIN_SLUG,
      '--format=strict-json',
      '--fields=file,line,column,type,code,message',
    ],
    {
      maxBuffer: 32 * 1024 * 1024,
    }
  );
  const out = String(check.stdout || '').trim();
  if (check.status !== 0 && !out) {
    skip(`wp plugin check çalışmadı: ${(check.stderr || '').slice(0, 400)}`);
  }

  let parsed;
  try {
    const start = out.search(/[\[{]/);
    parsed = start >= 0 ? JSON.parse(out.slice(start)) : JSON.parse(out || '[]');
  } catch {
    parsed = out;
  }

  const issues = issuesFromPluginCheck(parsed);
  if (!issues.length && out && /ERROR|WARNING|FILE:/.test(out)) {
    skip(`Plugin Check ayrıştırılamadı: ${out.slice(0, 300)}`);
  }
  const summary = summarizeIssues(issues);
  writeLintPair(
    OUT,
    'plugin-check',
    { summary, issues, raw: parsed },
    summaryMarkdown('Plugin Check', summary)
  );
  console.log(`Plugin Check ${summary.total} hata. Rapor: build/lint/plugin-check.md`);
}

await main();
