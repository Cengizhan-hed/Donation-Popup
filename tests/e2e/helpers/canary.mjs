/**
 * Ortam kanaryası: salt okunur anlık görüntü + karşılaştırma.
 * Yazma yok. Beklenmeyen fark koşuyu kırmızı yapar ve durdurur.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './env-root.mjs';
import { loadDeployEnvSilent, remote } from './wp-remote.mjs';
import { loadRegistry } from './run-registry.mjs';
import { loadFixtures, verifiedFixtureIds } from './fixtures.mjs';
import { peekActiveProfile, isRemoteProfile, resolveAllowedRemoteTarget } from './profile.mjs';
import { buildGuardedEvalFileCommand } from '../../../scripts/lib/deploy-guards.mjs';
import { spawnGuarded } from '../../../scripts/lib/remote-guard.mjs';
import { runGuardedSsh, canonicalEnv } from '../../../scripts/lib/remote-discover-lib.mjs';

export const CANARY_SNAPSHOT_FILE = 'tests/e2e/helpers/canary-snapshot.php';
export const CANARY_ALERT_PATH = path.join(ROOT, 'build/e2e/CANARY-ALERT.txt');

/** Ayarlı (id>0) iken var/yayında olmalı; id 0 = ayarlı değil, sorun değil. */
export const CORE_OPTIONAL_PAGE_IDS = [
  'page_for_posts',
  'page_on_front',
  'woocommerce_myaccount_page_id',
  'woocommerce_shop_page_id',
  'woocommerce_terms_page_id',
];

/** id 0 ise UYARI (engel değil: blok sepet/ödeme şablon da olabilir). */
export const CORE_WARN_IF_UNSET_IDS = [
  'woocommerce_cart_page_id',
  'woocommerce_checkout_page_id',
];

export const CORE_OPTION_IDS = [
  'page_on_front',
  'page_for_posts',
  'woocommerce_cart_page_id',
  'woocommerce_checkout_page_id',
  'woocommerce_myaccount_page_id',
  'woocommerce_shop_page_id',
  'woocommerce_terms_page_id',
];

/**
 * @param {object} options
 * @param {string} key
 * @returns {number}
 */
export function optionPageId(options, key) {
  const raw = options?.[key];
  if (raw === undefined || raw === null || raw === '') return 0;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

/** @type {null | (() => object)} */
let snapshotOverride = null;

export function setCanarySnapshotFn(fn) {
  snapshotOverride = fn;
}

export function writeSnapshot(snap, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(snap, null, 2) + '\n', 'utf8');
}

export function readSnapshot(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const i = raw.indexOf('{');
  if (i < 0) throw new Error(`kanarya JSON yok: ${file}`);
  return JSON.parse(raw.slice(i));
}

export function parseSnapshotOutput(raw) {
  const text = String(raw || '');
  const i = text.indexOf('{');
  if (i < 0) throw new Error(`kanarya JSON yok: ${text.slice(0, 120)}`);
  try {
    return JSON.parse(text.slice(i));
  } catch (e) {
    throw new Error(`kanarya JSON ayrıştırılamadı: ${e.message}`);
  }
}

/**
 * Yerel WP kanarya (SSH yok).
 */
export function snapshotCanaryLocal() {
  const bridge = path.join(ROOT, 'tests/local-wp/eval-file.php');
  const r = spawnSync('php', [bridge, CANARY_SNAPSHOT_FILE], {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 120000,
  });
  if (r.status !== 0) {
    throw new Error(`canary local: ${(r.stderr || r.stdout || '').slice(0, 400)}`);
  }
  const snap = parseSnapshotOutput(r.stdout);
  if (!snap || !Array.isArray(snap.posts) || !snap.options) {
    throw new Error('canary local: anlık görüntü eksik (posts/options)');
  }
  return snap;
}

export function canaryBaselinePath(envId) {
  const env = canonicalEnv(String(envId || 'local'));
  return path.join(ROOT, 'build/e2e/canary', `${env}-baseline.json`);
}

export function readBaseline(envId) {
  const file = canaryBaselinePath(envId);
  if (!fs.existsSync(file)) return null;
  return readSnapshot(file);
}

/**
 * Baseline vs current; kayıt defteri dışındaki fark KIRMIZI.
 * @param {object|null} baseline
 * @param {object} current
 * @param {object} [registry]
 * @param {{ updateBaseline?: boolean }} [opts]
 */
export function evaluateCanaryAgainstBaseline(baseline, current, registry, opts = {}) {
  if (!baseline) {
    const updating = !!opts.updateBaseline;
    return {
      ok: updating,
      missingBaseline: true,
      canUpdate: updating,
      status: updating ? 'TEMİZ' : 'KIRMIZI',
      diffs: updating ? [] : [{ change: 'missing-baseline' }],
    };
  }
  const cmp = compareWithRegistry(baseline, current, registry, opts);
  return {
    ok: cmp.ok,
    missingBaseline: false,
    canUpdate: cmp.ok,
    status: cmp.ok ? 'TEMİZ' : 'KIRMIZI',
    diffs: cmp.diffs || [],
  };
}

/**
 * Bootstrap sonrası / fixture silinince: yalnız beklenen farklar varken baseline yaz.
 * @param {string} envId
 * @param {object} current
 * @param {{ ok?: boolean }} cmp
 */
export function updateCanaryBaselineIfClean(envId, current, cmp) {
  if (!cmp || !cmp.ok) return { updated: false, file: null };
  const file = canaryBaselinePath(envId);
  writeSnapshot(current, file);
  return { updated: true, file };
}

export function formatCanaryStatusLine(beforeOk, afterOk, expectedNew = 0) {
  const b = beforeOk ? 'TEMİZ' : 'KIRMIZI';
  const a = afterOk ? 'TEMİZ' : 'KIRMIZI';
  return `Kanarya: önce ${b}, sonra ${a} (beklenen yeni: ${Number(expectedNew) || 0} ürün)`;
}

export function snapshotCanary() {
  if (snapshotOverride) return snapshotOverride();
  const local = path.join(ROOT, CANARY_SNAPSHOT_FILE);
  if (!fs.existsSync(local)) throw new Error(`canary: ${CANARY_SNAPSHOT_FILE} yok`);
  const src = fs.readFileSync(local, 'utf8');
  if (/\b(wp_delete_|wp_trash_|wp_untrash_|wp_update_post|wp_insert_post|update_option|delete_option)\b/i.test(src)) {
    throw new Error('canary-snapshot.php yazma çağrısı içeriyor');
  }
  const b64 = fs.readFileSync(local).toString('base64');
  const profile = peekActiveProfile();
  let raw = '';
  if (profile && isRemoteProfile(profile)) {
    const resolved = resolveAllowedRemoteTarget(profile);
    const remoteCmd = buildGuardedEvalFileCommand(resolved.wpPath, { tmpPrefix: 'wdp-canary', b64 });
    const res = runGuardedSsh(
      spawnGuarded,
      resolved.alias,
      remoteCmd,
      { encoding: 'utf8', cwd: ROOT, timeout: 120000 },
      { alias: resolved.alias, wpPath: resolved.wpPath, siteUrl: resolved.siteUrl }
    );
    raw = res.stdout || '';
  } else {
    const loaded = loadDeployEnvSilent();
    if (!loaded.ok) throw new Error(`canary: ${loaded.reason}`);
    const wpPath = String(loaded.env.DEPLOY_WP_PATH || '').trim();
    raw = remote(loaded.env, buildGuardedEvalFileCommand(wpPath, { tmpPrefix: 'wdp-canary', b64 }));
  }
  const snap = parseSnapshotOutput(raw);
  if (!snap || !Array.isArray(snap.posts) || !snap.options) {
    throw new Error('canary: anlık görüntü eksik (posts/options)');
  }
  return snap;
}

export function compareCanary(before, after, opts = {}) {
  const allowedCreated = new Set((opts.allowedCreatedIds || []).map((n) => Number(n)).filter((n) => n > 0));
  const allowedDeleted = new Set((opts.allowedDeletedIds || []).map((n) => Number(n)).filter((n) => n > 0));
  const mutated = new Set((opts.mutatedIds || []).map((n) => Number(n)).filter((n) => n > 0));
  const diffs = [];
  const allowedNewProducts = [...(after.posts || [])].filter(
    (a) =>
      allowedCreated.has(Number(a.id)) &&
      !(before.posts || []).some((b) => Number(b.id) === Number(a.id)) &&
      String(a.type) === 'product'
  ).length;
  const allowedDeletedProducts = [...(before.posts || [])].filter(
    (b) =>
      allowedDeleted.has(Number(b.id)) &&
      !(after.posts || []).some((a) => Number(a.id) === Number(b.id)) &&
      String(b.type) === 'product'
  ).length;
  const beforeMap = new Map((before.posts || []).map((p) => [Number(p.id), p]));
  const afterMap = new Map((after.posts || []).map((p) => [Number(p.id), p]));
  const ids = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  for (const id of ids) {
    const b = beforeMap.get(id);
    const a = afterMap.get(id);
    if (b && !a) {
      if (allowedDeleted.has(id)) continue;
      if (allowedCreated.has(id) && String(b.mark || '') && String(b.mark) !== '1') continue;
      diffs.push({ id, change: 'deleted', type: b.type, status: b.status, titleHint: b.type });
      continue;
    }
    if (!b && a) {
      if (allowedCreated.has(id)) continue;
      diffs.push({ id, change: 'created', type: a.type, status: a.status });
      continue;
    }
    if (b && a) {
      if (String(b.status) !== String(a.status)) {
        diffs.push({ id, change: 'status', type: a.type, from: b.status, to: a.status });
      }
      const ignoreModified = mutated.has(id) || allowedCreated.has(id);
      if (!ignoreModified && String(b.modified) !== String(a.modified)) {
        diffs.push({ id, change: 'modified', type: a.type, from: b.modified, to: a.modified });
      }
    }
  }
  const optKeys = new Set([
    ...Object.keys(before.options || {}),
    ...Object.keys(after.options || {}),
  ]);
  for (const key of optKeys) {
    if (key.startsWith('wdp_') && key !== 'wdp_success_numeric_ids') continue;
    const left = String((before.options || {})[key] ?? '');
    const right = String((after.options || {})[key] ?? '');
    if (left !== right) {
      diffs.push({ option: key, change: 'option', from: left, to: right });
    }
  }
  for (const countKey of ['user_count', 'attachment_count', 'page_count', 'product_count']) {
    const left = Number(before[countKey] ?? 0);
    const right = Number(after[countKey] ?? 0);
    if (left === right) continue;
    if (countKey === 'product_count' && right - left === allowedNewProducts) continue;
    if (countKey === 'product_count' && left - right === allowedDeletedProducts) continue;
    diffs.push({ option: countKey, change: 'count', from: String(left), to: String(right) });
  }
  return { ok: diffs.length === 0, diffs };
}

function formatDiffLine(d) {
  if (d.change === 'core-bad-status') {
    return `çekirdek sayfa id=${d.id} (${d.option}) çöpte/taslakta: ${d.status} — elle düzeltin`;
  }
  if (d.change === 'core-missing') return `çekirdek sayfa yok: ${d.option} id=${d.id}`;
  if (d.change === 'core-unset') return `uyarı: ${d.option} ayarlı değil (id=0)`;
  if (d.change === 'missing-baseline') return 'baseline yok';
  if (d.option) return `${d.change === 'count' ? 'sayı' : 'option'} ${d.option}: ${d.from} → ${d.to}`;
  if (d.change === 'deleted') return `silindi id=${d.id} type=${d.type} status=${d.status}`;
  if (d.change === 'created') return `yeni id=${d.id} type=${d.type} status=${d.status}`;
  if (d.change === 'status') return `durum id=${d.id} type=${d.type}: ${d.from} → ${d.to}`;
  if (d.change === 'modified') return `modified id=${d.id} type=${d.type}: ${d.from} → ${d.to}`;
  if (d.change) return `${d.change}${d.option ? ` ${d.option}` : ''}${d.id != null ? ` id=${d.id}` : ''}${d.status ? ` status=${d.status}` : ''}`;
  return JSON.stringify(d);
}

export function formatCanaryDiff(diff) {
  const diffs = diff.diffs || [];
  const warnings = diff.warnings || [];
  if (diff.ok && warnings.length === 0) return 'kanarya: fark yok';
  const lines = diffs.map(formatDiffLine);
  const warnLines = warnings.map(formatDiffLine);
  const parts = [];
  if (!diff.ok && lines.length) parts.push(`kanarya farkları (${lines.length}):\n${lines.join('\n')}`);
  if (warnLines.length) parts.push(`kanarya uyarıları (${warnLines.length}):\n${warnLines.join('\n')}`);
  if (diff.ok) {
    return parts.length ? `kanarya: fark yok\n${parts.join('\n')}` : 'kanarya: fark yok';
  }
  return parts.join('\n') || 'kanarya farkları (0):';
}

/**
 * Beklenen kayıtlar = koşu defteri ∪ doğrulanmış fixture ürünleri.
 * Fixture: id dosyada + uzakta `_wdp_e2e_test` işaretle eşit + durum private.
 * @param {object} before
 * @param {object} after
 * @param {object} [registry]
 * @param {{ fixtures?: object|null, envId?: string, allowedDeletedIds?: number[] }} [opts]
 */
export function compareWithRegistry(before, after, registry, opts = {}) {
  const r = registry || loadRegistry();
  let fixturesData = opts.fixtures;
  if (fixturesData === undefined && opts.envId) {
    fixturesData = loadFixtures(opts.envId);
  }
  const fixtureIds = fixturesData ? verifiedFixtureIds(after, fixturesData) : [];
  const createdIds = (r.created || []).map((x) => x.id);
  const allowedCreatedIds = [...new Set([...createdIds, ...fixtureIds].map(Number).filter((n) => n > 0))];
  return compareCanary(before, after, {
    allowedCreatedIds,
    mutatedIds: (r.mutated || []).map((x) => x.id),
    allowedDeletedIds: opts.allowedDeletedIds,
  });
}

function findPostById(posts, id) {
  return posts.find((p) => Number(p.id) === id);
}

function pushConfiguredPageIssue(diffs, key, id, post, { requirePublish = false } = {}) {
  if (!post) {
    diffs.push({ option: key, change: 'core-missing', id });
    return;
  }
  const status = String(post.status || '');
  const bad = requirePublish
    ? status !== 'publish'
    : status === 'trash' || status === 'draft';
  if (bad) {
    diffs.push({
      option: key,
      change: 'core-bad-status',
      id,
      status,
    });
  }
}

/**
 * Koşu başlamadan: ayarlı çekirdek sayfa yok/çöp/taslak mı?
 * id 0 = ayarlı değil → sorun değil (yazılar sayfası, vitrin, hesap, şartlar, ana sayfa).
 * page_on_front yalnız show_on_front=page ve id>0 iken var/publish olmalı.
 * sepet/ödeme id 0 → UYARI (engel değil; blok şablon da olabilir).
 */
export function preflightCanary(snap) {
  const diffs = [];
  const warnings = [];
  const posts = Array.isArray(snap?.posts) ? snap.posts : [];
  const options = snap?.options || {};
  const showOnFront = String(options.show_on_front || 'posts');

  for (const key of CORE_OPTION_IDS) {
    const id = optionPageId(options, key);
    if (key === 'page_on_front') {
      if (showOnFront !== 'page' || !id) continue;
      pushConfiguredPageIssue(diffs, key, id, findPostById(posts, id), { requirePublish: true });
      continue;
    }
    if (!id) {
      if (CORE_WARN_IF_UNSET_IDS.includes(key)) {
        warnings.push({ option: key, change: 'core-unset', id: 0 });
      }
      continue;
    }
    pushConfiguredPageIssue(diffs, key, id, findPostById(posts, id));
  }
  return { ok: diffs.length === 0, diffs, warnings };
}

/**
 * Ön kontrol + baseline. Bootstrap için allowMissingBaseline: baseline yoksa yalnız ön kontrol.
 * @param {object} snap
 * @param {string} envId
 * @param {object} [registry]
 * @param {{ updateBaseline?: boolean, allowMissingBaseline?: boolean, baseline?: object|null }} [opts]
 */
export function evaluateCanaryHealth(snap, envId, registry, opts = {}) {
  const pre = preflightCanary(snap);
  let baseline = opts.baseline;
  if (baseline === undefined) {
    try {
      baseline = readBaseline(envId);
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      if (!/Kullanım:/.test(msg)) throw e;
      baseline = null;
    }
  }
  if (!baseline && opts.allowMissingBaseline) {
    return {
      ok: pre.ok,
      diffs: [...(pre.diffs || [])],
      warnings: [...(pre.warnings || [])],
      pre,
      evald: {
        ok: true,
        missingBaseline: true,
        canUpdate: false,
        status: pre.ok ? 'TEMİZ' : 'KIRMIZI',
        diffs: [],
      },
    };
  }
  const evald = evaluateCanaryAgainstBaseline(
    baseline,
    snap,
    registry || { created: [], mutated: [] },
    opts
  );
  return {
    ok: evald.ok && pre.ok,
    diffs: [...(evald.diffs || []), ...(pre.diffs || [])],
    warnings: [...(pre.warnings || [])],
    pre,
    evald,
  };
}

export function writeCanaryAlert(diff, extra = '') {
  const text =
    `KANARYA KIRMIZI — 2026-10-22 koruması\n` +
    `Koşu durdu. Kayıt defteri dışındaki farklar:\n\n` +
    formatCanaryDiff(diff) +
    (extra ? `\n\n${extra}` : '') +
    '\n';
  fs.mkdirSync(path.dirname(CANARY_ALERT_PATH), { recursive: true });
  fs.writeFileSync(CANARY_ALERT_PATH, text, 'utf8');
  console.error(text);
  return CANARY_ALERT_PATH;
}
