/**
 * Ortam kanaryası: salt okunur anlık görüntü + karşılaştırma.
 * Yazma yok. Beklenmeyen fark koşuyu kırmızı yapar ve durdurur.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env-root.mjs';
import { loadDeployEnvSilent, remote, resolveWpPath } from './wp-remote.mjs';
import { loadRegistry } from './run-registry.mjs';

export const CANARY_SNAPSHOT_FILE = 'tests/e2e/helpers/canary-snapshot.php';
export const CANARY_ALERT_PATH = path.join(ROOT, 'build/e2e/CANARY-ALERT.txt');

const CORE_OPTION_IDS = [
  'page_on_front',
  'page_for_posts',
  'woocommerce_cart_page_id',
  'woocommerce_checkout_page_id',
  'woocommerce_myaccount_page_id',
  'woocommerce_shop_page_id',
  'woocommerce_terms_page_id',
];

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

export function snapshotCanary() {
  if (snapshotOverride) return snapshotOverride();
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) throw new Error(`canary: ${loaded.reason}`);
  const local = path.join(ROOT, CANARY_SNAPSHOT_FILE);
  if (!fs.existsSync(local)) throw new Error(`canary: ${CANARY_SNAPSHOT_FILE} yok`);
  const src = fs.readFileSync(local, 'utf8');
  if (/\b(wp_delete_|wp_trash_|wp_untrash_|wp_update_post|wp_insert_post|update_option|delete_option)\b/i.test(src)) {
    throw new Error('canary-snapshot.php yazma çağrısı içeriyor');
  }
  const wpPath = resolveWpPath(loaded.env).replace(/'/g, `'\\''`);
  const b64 = fs.readFileSync(local).toString('base64');
  const raw = remote(
    loaded.env,
    [
      `TMP=$(mktemp /tmp/wdp-canary-XXXX.php)`,
      `echo '${b64}' | base64 -d > "$TMP"`,
      `wp eval-file "$TMP" --path='${wpPath}'`,
      `EC=$?`,
      `rm -f "$TMP"`,
      `exit $EC`,
    ].join('\n')
  );
  const snap = parseSnapshotOutput(raw);
  if (!snap || !Array.isArray(snap.posts) || !snap.options) {
    throw new Error('canary: anlık görüntü eksik (posts/options)');
  }
  return snap;
}

export function compareCanary(before, after, opts = {}) {
  const allowedCreated = new Set((opts.allowedCreatedIds || []).map((n) => Number(n)).filter((n) => n > 0));
  const mutated = new Set((opts.mutatedIds || []).map((n) => Number(n)).filter((n) => n > 0));
  const diffs = [];
  const beforeMap = new Map((before.posts || []).map((p) => [Number(p.id), p]));
  const afterMap = new Map((after.posts || []).map((p) => [Number(p.id), p]));
  const ids = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  for (const id of ids) {
    const b = beforeMap.get(id);
    const a = afterMap.get(id);
    if (b && !a) {
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
    if (left !== right) {
      diffs.push({ option: countKey, change: 'count', from: String(left), to: String(right) });
    }
  }
  return { ok: diffs.length === 0, diffs };
}

export function formatCanaryDiff(diff) {
  if (diff.ok) return 'kanarya: fark yok';
  const lines = (diff.diffs || []).map((d) => {
    if (d.change === 'core-bad-status') {
      return `çekirdek sayfa id=${d.id} (${d.option}) çöpte/taslakta: ${d.status} — elle düzeltin`;
    }
    if (d.change === 'core-missing') return `çekirdek sayfa yok: ${d.option} id=${d.id}`;
    if (d.option) return `${d.change === 'count' ? 'sayı' : 'option'} ${d.option}: ${d.from} → ${d.to}`;
    if (d.change === 'deleted') return `silindi id=${d.id} type=${d.type} status=${d.status}`;
    if (d.change === 'created') return `yeni id=${d.id} type=${d.type} status=${d.status}`;
    if (d.change === 'status') return `durum id=${d.id} type=${d.type}: ${d.from} → ${d.to}`;
    if (d.change === 'modified') return `modified id=${d.id} type=${d.type}: ${d.from} → ${d.to}`;
    return JSON.stringify(d);
  });
  return `kanarya farkları (${lines.length}):\n${lines.join('\n')}`;
}

export function compareWithRegistry(before, after, registry) {
  const r = registry || loadRegistry();
  return compareCanary(before, after, {
    allowedCreatedIds: (r.created || []).map((x) => x.id),
    mutatedIds: (r.mutated || []).map((x) => x.id),
  });
}

/**
 * Koşu başlamadan: sepet/ödeme/ana sayfa çöpte mi, ayarlar bozuk mu?
 */
export function preflightCanary(snap) {
  const diffs = [];
  const posts = Array.isArray(snap?.posts) ? snap.posts : [];
  const options = snap?.options || {};
  for (const key of CORE_OPTION_IDS) {
    const id = Math.abs(Number.parseInt(String(options[key] || '0'), 10) || 0);
    if (!id) {
      diffs.push({ option: key, change: 'core-missing', id: 0 });
      continue;
    }
    const post = posts.find((p) => Number(p.id) === id);
    if (!post) {
      diffs.push({ option: key, change: 'core-missing', id });
      continue;
    }
    if (post.status === 'trash' || post.status === 'draft') {
      diffs.push({
        option: key,
        change: 'core-bad-status',
        id,
        status: post.status,
      });
    }
  }
  const front = String(options.show_on_front || '');
  const pageOnFront = Math.abs(Number.parseInt(String(options.page_on_front || '0'), 10) || 0);
  if (front === 'posts' && pageOnFront === 0) {
    diffs.push({
      option: 'show_on_front',
      change: 'option',
      from: 'page',
      to: 'posts',
    });
  }
  return { ok: diffs.length === 0, diffs };
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
