#!/usr/bin/env node
/**
 * Salt okunur katalog --explain. Claude uzak; Cursor yalnız --env local.
 *
 *   npm run e2e:catalog-explain -- --env staging|ikram
 *   npm run e2e:catalog-explain -- --env local
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadProfile, resolveAllowedRemoteTarget } from '../tests/e2e/helpers/profile.mjs';
import { spawnGuarded } from './lib/remote-guard.mjs';
import { buildGuardedEvalFileCommand } from './lib/deploy-guards.mjs';
import { parseCatalogJson } from '../tests/e2e/helpers/catalog-core.mjs';
import { ensureLocalWp } from './local-wp.mjs';
import { canonicalEnv, profileKeyForEnv, runGuardedSsh } from './lib/remote-discover-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const CATALOG_EVAL_FILE = 'tests/e2e/helpers/catalog-resolve.php';
/** WP-CLI eval-file `--explain` komut parametresi sanır; konumsal + env. */
export const CATALOG_EXPLAIN_ARG = 'explain';
export const CATALOG_EXPLAIN_ENV = 'WDP_E2E_CATALOG_EXPLAIN';
const WRITE_EVAL_RE =
  /\b(wp_delete_|wp_trash_|wp_untrash_|wp_update_post|wp_insert_post|update_option|delete_option|update_post_meta|delete_post_meta)\b/i;

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

/**
 * @param {string[]} [argv]
 * @returns {{ envName: string }}
 */
export function parseCatalogExplainArgv(argv = process.argv.slice(2)) {
  const a = argv.filter((x) => x !== '--');
  let envRaw = '';
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--env' || x === '--profile') envRaw = String(a[++i] || '');
    else if (x.startsWith('--env=')) envRaw = x.slice('--env='.length);
  }
  if (!envRaw) fail('Kullanım: npm run e2e:catalog-explain -- --env staging|ikram');
  return { envName: canonicalEnv(envRaw) };
}

/**
 * @param {string} abs
 */
export function assertCatalogEvalReadOnly(abs) {
  const src = fs.readFileSync(abs, 'utf8');
  if (WRITE_EVAL_RE.test(src)) {
    throw new Error(`katalog eval-file yazma çağrısı içeriyor: ${path.relative(ROOT, abs)}`);
  }
}

/**
 * @param {object} data
 * @returns {string}
 */
export function formatCatalogExplainMarkdown(data) {
  const d = data && typeof data === 'object' ? data : {};
  const published = Array.isArray(d.published) ? d.published : [];
  const picked = Array.isArray(d.picked) ? d.picked : [];
  const shop = d.shop && typeof d.shop === 'object' ? d.shop : {};
  const list = d.list && typeof d.list === 'object' ? d.list : null;
  const counts = { fixed: 0, custom: 0, shares: 0, campaign: 0, other: 0 };
  for (const row of published) {
    const t = String(row?.type || '');
    if (Object.prototype.hasOwnProperty.call(counts, t)) counts[t] += 1;
    else counts.other += 1;
  }
  const shopPath = String(shop.path || '(yok)');
  const listPath = list ? String(list.path || '(yok)') : '(yok)';
  const lines = [
    `# Katalog explain — ${String(d.profileId || d.envName || '')}`,
    '',
    `- Çözümleyici: \`${String(d.resolver || 'WDP_Donation_Type::for_product')}\``,
    `- Eklenti yüklü: ${d.plugin_loaded === false ? 'hayır' : 'evet'}`,
    `- Mağaza: \`${shopPath}\``,
    `- Liste: \`${listPath}\``,
    `- Yayımlanmış ürün: ${Number(d.publishedCount) || published.length}`,
    `- Katalog seçilen (bağış + görünür): ${Number(d.pickedCount) || picked.length}`,
    '',
    '## Tip özeti (yayımlanmış)',
    '',
    '| Tip | Adet |',
    '|-----|------|',
    `| fixed | ${counts.fixed} |`,
    `| custom | ${counts.custom} |`,
    `| shares | ${counts.shares} |`,
    `| campaign | ${counts.campaign} |`,
    `| diğer | ${counts.other} |`,
    '',
    '## Seçilen roller',
    '',
    '| Tip | ID | Ad | Yol |',
    '|-----|----|----|-----|',
  ];
  const byType = {};
  for (const p of picked) {
    const t = String(p?.type || '');
    if (!byType[t]) byType[t] = p;
  }
  for (const role of ['fixed', 'custom', 'shares', 'campaign']) {
    const hit = byType[role];
    if (!hit) {
      lines.push(`| ${role} | — | (yok) | (yok) |`);
      continue;
    }
    lines.push(
      `| ${role} | ${Number(hit.id) || 0} | ${mdCell(hit.title)} | \`${mdCell(hit.path || '')}\` |`
    );
  }
  lines.push('', '## Yayımlanmış ürünler', '');
  lines.push(
    '| ID | Ad | Durum | Görünürlük | Satın alınabilir | WC tipi | Bağış | Fixture | Tip | Neden |'
  );
  lines.push('|----|----|-------|------------|------------------|---------|-------|---------|-----|-------|');
  for (const row of published) {
    const flags = row?.flags && typeof row.flags === 'object' ? row.flags : {};
    const why = String(row?.why || '').trim() || flagWhy(row?.type, flags, row?.resolver);
    lines.push(
      `| ${Number(row?.id) || 0} | ${mdCell(row?.title)} | ${mdCell(row?.status)} | ${mdCell(row?.visibility)} | ${row?.purchasable ? 'evet' : 'hayır'} | ${mdCell(row?.wc_type)} | ${row?.donation ? 'evet' : 'hayır'} | ${row?.fixture ? 'evet' : 'hayır'} | ${mdCell(row?.type)} | ${mdCell(why)} |`
    );
  }
  lines.push('', 'Müşteri/sipariş verisi yok. Meta değerleri yok (bayrak açık/kapalı).', '');
  return lines.join('\n');
}

/**
 * @param {unknown} v
 */
function mdCell(v) {
  return String(v ?? '')
    .replace(/\|/g, '/')
    .replace(/\r?\n/g, ' ')
    .trim();
}

/**
 * @param {unknown} type
 * @param {Record<string,string>} flags
 * @param {unknown} resolver
 */
function flagWhy(type, flags, resolver) {
  const parts = [];
  for (const k of ['_allow_multiple_shares', '_enable_progress_bar', '_allow_custom_price']) {
    parts.push(`${k}=${flags[k] === 'açık' ? 'açık' : 'kapalı'}`);
  }
  return `${resolver || 'WDP_Donation_Type::for_product'}; öncelik shares→campaign→custom→fixed; ${parts.join(', ')}; sonuç=${type || ''}`;
}

/**
 * @returns {(step: { file: string }) => string}
 */
export function createLocalCatalogExplainRunner() {
  ensureLocalWp({ quiet: true });
  const evalFileBridge = path.join(ROOT, 'tests/local-wp/eval-file.php');
  return function runLocal() {
    const abs = path.join(ROOT, CATALOG_EVAL_FILE);
    if (!fs.existsSync(abs)) throw new Error(`eval-file yok: ${CATALOG_EVAL_FILE}`);
    assertCatalogEvalReadOnly(abs);
    const r = spawnSync('php', [evalFileBridge, CATALOG_EVAL_FILE, CATALOG_EXPLAIN_ARG], {
      encoding: 'utf8',
      cwd: ROOT,
      timeout: 120000,
      env: { ...process.env, [CATALOG_EXPLAIN_ENV]: '1' },
    });
    if (r.status !== 0) {
      throw new Error(`yerel eval-file: ${(r.stderr || r.stdout || '').slice(0, 400)}`);
    }
    return r.stdout || '';
  };
}

/**
 * @param {{ spawn?: typeof spawnGuarded, alias: string, wpPath: string, siteUrl: string }} opts
 */
export function createRemoteCatalogExplainRunner(opts) {
  const { alias, wpPath, siteUrl } = opts;
  if (!alias) throw new Error('Profil ssh.alias boş.');
  if (!wpPath) throw new Error('Profil ssh.wpPath boş.');
  const guardOpts = { siteUrl: siteUrl || '', wpPath };
  const spawnOpts = { encoding: 'utf8', cwd: ROOT, timeout: 120000 };
  const runnerSpawn = opts.spawn || spawnGuarded;
  const p = String(wpPath).trim();
  return function runRemote() {
    const abs = path.join(ROOT, CATALOG_EVAL_FILE);
    if (!fs.existsSync(abs)) throw new Error(`eval-file yok: ${CATALOG_EVAL_FILE}`);
    assertCatalogEvalReadOnly(abs);
    const b64 = fs.readFileSync(abs).toString('base64');
    const remoteCmd = buildGuardedEvalFileCommand(p, {
      tmpPrefix: 'wdp-catx',
      extraArgs: CATALOG_EXPLAIN_ARG,
      extraEnv: { [CATALOG_EXPLAIN_ENV]: '1' },
      b64,
    });
    if (!/--path=/.test(remoteCmd) || /--skip-themes|--skip-plugins/.test(remoteCmd)) {
      throw new Error('eval-file uzak komut --path eksik veya skip-themes');
    }
    const res = runGuardedSsh(runnerSpawn, alias, remoteCmd, spawnOpts, guardOpts);
    return res.stdout || '';
  };
}

/**
 * @param {{ envName: string, runner: () => string, outRoot?: string, writeFiles?: boolean, profileId?: string }} opts
 */
export function runCatalogExplain(opts) {
  const envName = canonicalEnv(opts.envName);
  const profile = loadProfile(profileKeyForEnv(envName));
  const raw = opts.runner();
  const parsed = parseCatalogJson(raw);
  if (!parsed || parsed.explain !== true) {
    throw new Error('katalog explain JSON okunamadı');
  }
  const data = {
    ...parsed,
    envName,
    profileId: opts.profileId || profile.id,
  };
  const md = formatCatalogExplainMarkdown(data);
  const rel = path.join('build', 'e2e', `catalog-explain-${envName}.md`).replace(/\\/g, '/');
  if (opts.writeFiles !== false) {
    const abs = path.join(opts.outRoot || ROOT, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, md.endsWith('\n') ? md : `${md}\n`, 'utf8');
  }
  const shares = (data.published || []).filter((p) => p && p.type === 'shares').length;
  const campaign = (data.published || []).filter((p) => p && p.type === 'campaign').length;
  const summary = `katalog-explain ${envName}: yayımlanmış ${data.publishedCount || 0}, seçilen ${data.pickedCount || 0}, shares ${shares}, campaign ${campaign}, liste ${data.list?.path || '(yok)'}, mağaza ${data.shop?.path || '(yok)'}`;
  return { data, md, summary, rel };
}

function main() {
  const { envName } = parseCatalogExplainArgv();
  let runner;
  const profile = loadProfile(profileKeyForEnv(envName));
  if (envName === 'local') {
    runner = createLocalCatalogExplainRunner();
  } else {
    const resolved = resolveAllowedRemoteTarget(profile);
    runner = createRemoteCatalogExplainRunner({
      spawn: spawnGuarded,
      alias: resolved.alias,
      wpPath: resolved.wpPath,
      siteUrl: resolved.siteUrl,
    });
  }
  const { summary } = runCatalogExplain({ envName, runner, profileId: profile.id, writeFiles: true });
  console.log(summary);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }
}
