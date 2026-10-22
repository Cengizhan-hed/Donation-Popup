#!/usr/bin/env node
/**
 * Fixture ürün bootstrap.
 *
 *   npm run e2e:bootstrap -- --env local [--dry-run]
 *   npm run e2e:bootstrap -- --env staging --dry-run
 *   npm run e2e:bootstrap -- --env ikram --dry-run
 *
 * Dry-run uzak yazmaz (REMOTE_FREEZE olsa da listeler).
 * Gerçek uzak kurulum yalnız Claude (spawnGuarded); Cursor çalıştırmaz.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT } from '../tests/e2e/helpers/env-root.mjs';
import { fixturesPathFor, describeBootstrapPlan } from '../tests/e2e/helpers/fixtures.mjs';
import { isRemoteFrozen, FREEZE_MESSAGE } from './lib/remote-guard.mjs';
import { ensureLocalWp } from './local-wp.mjs';
import { resetRegistry, registerCreated, isRunIdOk, loadRegistry } from '../tests/e2e/helpers/run-registry.mjs';
import { loadProfile, isRemoteProfile, setActiveProfile } from '../tests/e2e/helpers/profile.mjs';
import { setActiveDeployEnvFile, runEvalFile } from '../tests/e2e/helpers/wp-remote.mjs';
import {
  snapshotCanary,
  snapshotCanaryLocal,
  compareWithRegistry,
  formatCanaryDiff,
  writeCanaryAlert,
  formatCanaryStatusLine,
  evaluateCanaryHealth,
} from '../tests/e2e/helpers/canary.mjs';

export const REMOTE_BOOTSTRAP_PHP = 'tests/e2e/helpers/bootstrap-e2e-products.php';

export function parseArgs(argv) {
  const a = argv.filter((x) => x !== '--');
  let envId = 'local';
  let dry = false;
  let remove = false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--env') envId = String(a[++i] || envId);
    else if (a[i] === '--dry-run') dry = true;
    else if (a[i] === '--remove') remove = true;
  }
  return { envId, dry, remove };
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function parsePhpJson(stdout) {
  const line = String(stdout || '')
    .split(/\n/)
    .filter((l) => l.trim().startsWith('{'))
    .pop();
  return JSON.parse(line || '{}');
}

function writeFixtures(envId, data) {
  const outFile = fixturesPathFor(envId);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return outFile;
}

function registerCreatedRows(data) {
  if (!Array.isArray(data.created)) return;
  for (const row of data.created) {
    const type = String(row.type || 'product');
    registerCreated({ id: row.id, type, mark: `_wdp_e2e_test=${data.runId || ''}` });
  }
}

function runLocalPhp(action, envId, runId) {
  const phpFile = path.join(ROOT, 'tests/local-wp/bootstrap-fixtures.php');
  const r = spawnSync('php', [phpFile, action, envId, runId], {
    encoding: 'utf8',
    cwd: ROOT,
  });
  if (r.status !== 0) {
    fail(`bootstrap php: ${(r.stderr || r.stdout || '').slice(0, 600)}`);
  }
  return parsePhpJson(r.stdout);
}

function createdProductCount(data) {
  if (!Array.isArray(data?.created)) return 0;
  return data.created.filter((row) => !row.type || String(row.type) === 'product').length;
}

/**
 * Bootstrap ön kanarya: baseline yoksa yalnız ön kontrol.
 * KIRMIZI olunca CANARY-ALERT gerçek option/id/durum maddelerini alır.
 * @param {string} envId
 * @param {object} snap
 * @param {object} [registry]
 */
export function evaluateBootstrapCanary(envId, snap, registry, opts = {}) {
  return evaluateCanaryHealth(snap, envId, registry || loadRegistry(), {
    allowMissingBaseline: true,
    ...opts,
  });
}

async function main() {
  const { envId, dry, remove } = parseArgs(process.argv.slice(2));
  const profile = loadProfile(envId);
  const remote = isRemoteProfile(profile);
  const runId = dry ? 'boot-dry' : remote ? `boot-${Date.now()}` : 'fixture';
  if (!dry && !isRunIdOk(runId)) {
    fail('geçersiz runId');
  }

  if (dry) {
    const plan = describeBootstrapPlan(profile.id || envId, runId, { remove, dryRun: true });
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  if (remote && isRemoteFrozen()) {
    fail(FREEZE_MESSAGE);
  }

  if (!remove) resetRegistry(runId);
  if (remote) setActiveProfile(profile);
  if (profile.deployEnvFile) setActiveDeployEnvFile(profile.deployEnvFile);

  const takeSnap = () => (remote ? snapshotCanary() : snapshotCanaryLocal());

  if (!remote) ensureLocalWp();

  const before = remove ? null : takeSnap();
  const beforeState = before ? evaluateBootstrapCanary(envId, before) : { ok: true, diffs: [], warnings: [] };
  const beforeOk = beforeState.ok;
  if (before && remote && !beforeOk) {
    writeCanaryAlert(
      { ok: false, diffs: beforeState.diffs, warnings: beforeState.warnings },
      'e2e:bootstrap önce kanarya'
    );
    fail(`Kanarya önce KIRMIZI — bootstrap durdu.\n${formatCanaryDiff({ ok: false, diffs: beforeState.diffs, warnings: beforeState.warnings })}`);
  }

  let data;
  if (!remote) {
    data = runLocalPhp(remove ? 'remove' : 'upsert', profile.id || envId, runId);
  } else {
    const raw = runEvalFile(
      REMOTE_BOOTSTRAP_PHP,
      { WDP_E2E_RUN_ID: runId },
      remove ? 'remove' : 'upsert'
    );
    data = parsePhpJson(raw);
  }
  const outFile = writeFixtures(profile.id || envId, data);
  if (!remove) registerCreatedRows({ ...data, runId });

  let afterOk = true;
  if (before) {
    const after = takeSnap();
    const cmp = compareWithRegistry(before, after);
    afterOk = cmp.ok;
    console.log(formatCanaryStatusLine(beforeOk, afterOk, createdProductCount(data)));
    if (!cmp.ok) {
      writeCanaryAlert(cmp, 'e2e:bootstrap kanarya');
      fail(formatCanaryDiff(cmp));
    }
  }

  console.log(`fixtures: ${outFile}`);
  console.log(JSON.stringify({ roles: data.roles, skipped: data.skipped, removed: data.removed }, null, 2));
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((e) => fail(e.message || String(e)));
}
