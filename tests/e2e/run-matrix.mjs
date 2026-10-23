#!/usr/bin/env node
/**
 * Yerel tema + WooCommerce uyum matrisi.
 *
 *   npm run e2e:matrix
 *   npm run e2e:matrix -- --only tt5-try-blocks-hpos --device iphone
 *
 * Uzak profil yok. Sipariş yalnız yerel WP + SQLite.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadMatrix,
  assertCovering,
  resolveConfig,
  parseMatrixArgs,
  resolveWorkerCount,
  MATRIX_OUT_DIR,
} from './helpers/matrix-cover.mjs';
import {
  prepareConfigSnapshot,
  materializeWorker,
  startPhpServer,
  restoreSqlite,
} from './helpers/matrix-setup.mjs';
import { runDeviceScenarios } from './helpers/matrix-scenarios.mjs';
import { setActiveProfile } from './helpers/profile.mjs';
import { ROOT } from './helpers/env-root.mjs';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function pad(s, n) {
  const t = String(s ?? '');
  if (t.length >= n) return t.slice(0, n);
  return t + ' '.repeat(n - t.length);
}

function formatTable(rows) {
  const header = [
    pad('Yapılandırma', 26),
    pad('Cihaz', 10),
    pad('Geçen', 6),
    pad('Kalan', 6),
    pad('Hata', 5),
    pad('Süre', 8),
    'İlk hata',
  ].join(' ');
  const lines = [header, '-'.repeat(Math.min(120, header.length + 40))];
  for (const r of rows) {
    lines.push(
      [
        pad(r.configId, 26),
        pad(r.device, 10),
        pad(r.passed, 6),
        pad(r.skipped, 6),
        pad(r.failed, 5),
        pad(r.secs, 8),
        r.firstError || '',
      ].join(' ')
    );
  }
  return lines.join('\n');
}

function writeSummaryMd(outFile, { matrix, rows, startedAt, durationMs, workers }) {
  const lines = [
    '# e2e:matrix özet',
    '',
    `Başlangıç: ${startedAt}`,
    `Süre: ${(durationMs / 1000).toFixed(1)}s`,
    `İşçi: ${workers}`,
    '',
    '## Kapsayan küme',
    '',
    '| id | tema | mağaza | ödeme | HPOS |',
    '|----|------|--------|-------|------|',
  ];
  for (const c of matrix.configs) {
    const store = matrix.stores[c.store] || {};
    lines.push(
      `| ${c.id} | ${c.theme} | ${store.currency || c.store} ${store.symbolPosition || ''} | ${c.checkout} | ${c.hpos ? 'açık' : 'kapalı'} |`
    );
  }
  lines.push('', '## Sonuçlar', '');
  lines.push('| yapılandırma | cihaz | geçen | kalan | hata | süre | ilk hata | ekran |');
  lines.push('|--------------|-------|-------|-------|------|------|----------|-------|');
  for (const r of rows) {
    const shot = r.shot ? `\`${r.shot}\`` : '';
    const err = r.firstError ? r.firstError.replace(/\|/g, '\\|') : '';
    lines.push(
      `| ${r.configId} | ${r.device} | ${r.passed} | ${r.skipped} | ${r.failed} | ${r.secs} | ${err} | ${shot} |`
    );
  }
  lines.push('');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, lines.join('\n') + '\n', 'utf8');
}

async function runPool(items, limit, fn) {
  const queue = items.map((item, i) => ({ item, i }));
  const results = new Array(items.length);
  async function worker() {
    while (queue.length) {
      const next = queue.shift();
      if (!next) return;
      results[next.i] = await fn(next.item, next.i);
    }
  }
  const n = Math.min(Math.max(1, limit), Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

/**
 * @param {object} resolved
 * @param {string[]} devices
 * @param {number} port
 */
async function runConfig(resolved, devices, port) {
  const { snap, meta } = prepareConfigSnapshot(resolved);
  const probe = meta.probe || meta;
  const wpDir = materializeWorker(resolved.id, port, snap, { hpos: !!resolved.hpos });
  const rows = [];
  for (const deviceId of devices) {
    restoreSqlite(wpDir, snap);
    const server = await startPhpServer({ wpDir, port });
    const shotDir = path.join(MATRIX_OUT_DIR, resolved.id, deviceId);
    fs.mkdirSync(shotDir, { recursive: true });
    const t0 = Date.now();
    let scenarios = [];
    let error = '';
    try {
      scenarios = await runDeviceScenarios({
        deviceId,
        baseUrl: server.url.replace(/\/$/, ''),
        wpDir,
        probe,
        store: resolved.storeSpec,
        checkoutKind: resolved.checkout,
        shotDir,
      });
    } catch (e) {
      error = String(e && e.message ? e.message : e).slice(0, 300);
      scenarios = [
        {
          id: 'runner',
          ok: false,
          ms: Date.now() - t0,
          error,
          loc: '',
          shot: '',
        },
      ];
    } finally {
      await server.stop();
    }
    const passed = scenarios.filter((s) => s.ok).length;
    const failed = scenarios.filter((s) => !s.ok).length;
    const firstFail = scenarios.find((s) => !s.ok);
    const firstError = firstFail
      ? `${firstFail.id}: ${firstFail.error}${firstFail.loc ? ` (${firstFail.loc})` : ''}`
      : error;
    rows.push({
      configId: resolved.id,
      device: deviceId,
      passed,
      skipped: 0,
      failed,
      secs: `${((Date.now() - t0) / 1000).toFixed(1)}s`,
      firstError,
      shot: firstFail?.shot ? path.relative(ROOT, firstFail.shot) : '',
      scenarios,
    });
  }
  return rows;
}

async function main() {
  const flags = parseMatrixArgs(process.argv.slice(2));
  if (flags.help) {
    console.log('npm run e2e:matrix -- [--only <id,id>] [--device iphone|android|desktop|all]');
    process.exit(0);
  }
  setActiveProfile({ id: 'local', allowedHosts: ['127.0.0.1', 'localhost'] });
  const matrix = loadMatrix();
  assertCovering(matrix);
  const want = flags.only.length
    ? matrix.configs.filter((c) => flags.only.includes(c.id))
    : matrix.configs;
  if (!want.length) {
    fail(`--only eşleşmedi. Var: ${matrix.configs.map((c) => c.id).join(', ')}`);
  }
  const workers = resolveWorkerCount(flags.workers, matrix.defaultWorkers || 3);
  const basePort = Number(process.env.WDP_MATRIX_BASE_PORT || matrix.basePort) || 8899;
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  const resolved = want.map((c) => resolveConfig(matrix, c.id));
  // Anlık görüntüler sırayla (tek şablon WP); koşular paralel.
  for (const cfg of resolved) {
    prepareConfigSnapshot(cfg);
  }

  const allRows = [];
  const nested = await runPool(resolved, workers, async (cfg, idx) => {
    const port = basePort + idx;
    return runConfig(cfg, flags.devices, port);
  });
  for (const group of nested) {
    if (Array.isArray(group)) allRows.push(...group);
  }

  const durationMs = Date.now() - t0;
  const summaryFile = path.join(MATRIX_OUT_DIR, 'summary.md');
  writeSummaryMd(summaryFile, { matrix: { ...matrix, configs: want }, rows: allRows, startedAt, durationMs, workers });
  const table = formatTable(allRows);
  console.log(table);
  console.log(`özet: ${path.relative(ROOT, summaryFile)}`);
  const failed = allRows.reduce((n, r) => n + r.failed, 0);
  if (failed > 0) process.exit(1);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((e) => fail(e.message || String(e)));
}

export { parseMatrixArgs } from './helpers/matrix-cover.mjs';
