#!/usr/bin/env node
/**
 * Fixture ürün bootstrap.
 *
 *   npm run e2e:bootstrap -- --env local [--dry-run]
 *   npm run e2e:bootstrap -- --env staging --dry-run
 *   npm run e2e:bootstrap -- --env ikram --dry-run
 *   npm run e2e:bootstrap -- --env local --remove-fixtures
 *   npm run e2e:bootstrap -- --env local --repair [--dry-run]
 *
 * Dry-run uzak yazmaz (REMOTE_FREEZE olsa da listeler).
 * Gerçek uzak kurulum yalnız Claude (spawnGuarded); Cursor çalıştırmaz.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT } from '../tests/e2e/helpers/env-root.mjs';
import {
  fixturesPathFor,
  describeBootstrapPlan,
  loadFixtures,
  fixtureProductRecords,
  verifiedFixtureIds,
  assertRepairTargetMarked,
} from '../tests/e2e/helpers/fixtures.mjs';
import { isRemoteFrozen, FREEZE_MESSAGE } from './lib/remote-guard.mjs';
import { ensureLocalWp } from './local-wp.mjs';
import {
  resetRegistry,
  registerCreated,
  isRunIdOk,
  loadRegistry,
  setRegistryFixtures,
} from '../tests/e2e/helpers/run-registry.mjs';
import { loadProfile, isRemoteProfile, setActiveProfile } from '../tests/e2e/helpers/profile.mjs';
import { acquireEnvLock, releaseEnvLock } from '../tests/e2e/helpers/env-lock.mjs';
import { setActiveDeployEnvFile, runEvalFile } from '../tests/e2e/helpers/wp-remote.mjs';
import {
  snapshotCanary,
  snapshotCanaryLocal,
  compareCanary,
  compareWithRegistry,
  formatCanaryDiff,
  writeCanaryAlert,
  formatCanaryStatusLine,
  evaluateCanaryHealth,
  updateCanaryBaselineIfClean,
} from '../tests/e2e/helpers/canary.mjs';

export const REMOTE_BOOTSTRAP_PHP = 'tests/e2e/helpers/bootstrap-e2e-products.php';

export function parseArgs(argv) {
  const a = argv.filter((x) => x !== '--');
  let envId = 'local';
  let dry = false;
  let remove = false;
  let repair = false;
  const extraIds = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--env') envId = String(a[++i] || envId);
    else if (a[i] === '--dry-run') dry = true;
    else if (a[i] === '--remove' || a[i] === '--remove-fixtures') remove = true;
    else if (a[i] === '--repair') repair = true;
    else if (a[i] === '--id') extraIds.push(String(a[++i] || ''));
  }
  return { envId, dry, remove, repair, extraIds };
}

/**
 * Onarım hedefleri: defter + fixture dosyasındaki işaretli ürünler.
 * İşaretsiz id → RED.
 * @param {object|null} fixturesData
 * @param {object} [registry]
 * @param {Array<number|string>} [extraIds]
 */
export function collectRepairTargets(fixturesData, registry = {}, extraIds = []) {
  const fromFile = fixtureProductRecords(fixturesData);
  const fileIds = new Set(fromFile.map((r) => r.id));
  const fromReg = Array.isArray(registry?.fixtures) ? registry.fixtures : [];
  const seen = new Set();
  const rows = [];
  const add = (rec, label) => {
    const id = Math.abs(Number.parseInt(String(rec?.id), 10) || 0);
    if (id <= 0 || seen.has(id)) return;
    assertRepairTargetMarked(id, fixturesData, label || rec.role || '');
    seen.add(id);
    const fileRec = fromFile.find((r) => r.id === id);
    rows.push({
      id,
      role: String(rec.role || fileRec?.role || ''),
      mark: String(rec.mark || fileRec?.mark || ''),
    });
  };
  for (const rec of fromFile) add(rec, rec.role);
  for (const rec of fromReg) {
    const id = Math.abs(Number.parseInt(String(rec?.id), 10) || 0);
    if (!fileIds.has(id)) continue;
    add(rec, rec.role);
  }
  for (const raw of extraIds) {
    add({ id: raw }, 'extra');
  }
  return rows;
}

/**
 * Dry-run listesi (uzak yazma yok).
 * @param {string} envId
 * @param {object|null} fixturesData
 * @param {object} [registry]
 * @param {Array<number|string>} [extraIds]
 */
export function describeRepairPlan(envId, fixturesData, registry = {}, extraIds = []) {
  const targets = collectRepairTargets(fixturesData, registry, extraIds);
  return {
    dryRun: true,
    action: 'repair',
    env: envId,
    remoteWrite: false,
    would: 'restore-fixture-meta',
    changesSiteSettings: false,
    createsPages: false,
    products: targets.map((t) => ({
      id: t.id,
      role: t.role,
      mark: t.mark,
      restore: 'bootstrap-defaults',
    })),
  };
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
  const rows = fixtureProductRecords(data);
  const createdIds = new Set((data.created || []).map((row) => Number(row.id)));
  for (const rec of rows) {
    if (createdIds.size && !createdIds.has(rec.id)) continue;
    registerCreated({
      id: rec.id,
      type: rec.type || 'product',
      mark: rec.mark,
      role: rec.role,
      source: 'fixture',
    });
  }
  setRegistryFixtures(rows);
}

function runLocalPhp(action, envId, runId, extra = {}) {
  const phpFile = path.join(ROOT, 'tests/local-wp/bootstrap-fixtures.php');
  const env = { ...process.env };
  if (Array.isArray(extra.removeIds) && extra.removeIds.length) {
    env.WDP_E2E_REMOVE_IDS = extra.removeIds.join(',');
  }
  if (Array.isArray(extra.repairIds) && extra.repairIds.length) {
    env.WDP_E2E_REPAIR_IDS = extra.repairIds.join(',');
  }
  const r = spawnSync('php', [phpFile, action, envId, runId], {
    encoding: 'utf8',
    cwd: ROOT,
    env,
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

/**
 * İşaretli fixture metasını bootstrap varsayılanına döner (kilit yok — çağıran kilitler).
 * @param {object} profile
 * @param {{ extraIds?: Array<number|string>, skipCanary?: boolean }} [opts]
 */
export async function runRepairForProfile(profile, opts = {}) {
  const profileId = profile.id;
  const remote = isRemoteProfile(profile);
  const existingFx = loadFixtures(profileId);
  const targets = collectRepairTargets(existingFx, loadRegistry(profileId), opts.extraIds || []);
  const runId = String(existingFx?.runId || targets[0]?.mark || '');
  if (!isRunIdOk(runId)) {
    throw new Error('fixture runId yok; --repair için önce e2e:bootstrap');
  }
  if (profile.deployEnvFile) setActiveDeployEnvFile(profile.deployEnvFile);
  const takeSnap = () => (remote ? snapshotCanary() : snapshotCanaryLocal());
  if (!remote) ensureLocalWp();
  const before = opts.skipCanary ? null : takeSnap();
  const ids = targets.map((t) => t.id);
  let data;
  if (!remote) {
    data = runLocalPhp('repair', profileId, runId, { repairIds: ids });
  } else {
    const extraEnv = { WDP_E2E_RUN_ID: runId };
    if (ids.length) extraEnv.WDP_E2E_REPAIR_IDS = ids.join(',');
    const raw = runEvalFile(REMOTE_BOOTSTRAP_PHP, extraEnv, 'repair');
    data = parsePhpJson(raw);
  }
  const after = opts.skipCanary ? null : takeSnap();
  const cmp = before && after ? compareCanary(before, after, {}) : { ok: true, diffs: [] };
  return { ok: cmp.ok, data, targets, cmp, before, after };
}

async function main() {
  const { envId, dry, remove, repair, extraIds } = parseArgs(process.argv.slice(2));
  const profile = loadProfile(envId);
  const profileId = profile.id || envId;
  const remote = isRemoteProfile(profile);
  const existingFx = loadFixtures(profileId);
  const runId = dry
    ? 'boot-dry'
    : remove || repair
      ? String(existingFx?.runId || '')
      : remote
        ? `boot-${Date.now()}`
        : 'fixture';
  if (!dry && !isRunIdOk(runId)) {
    fail(
      remove || repair
        ? 'fixture runId yok; --remove-fixtures / --repair için önce e2e:bootstrap'
        : 'geçersiz runId'
    );
  }

  if (dry) {
    if (repair) {
      const plan = describeRepairPlan(profileId, existingFx, loadRegistry(profileId), extraIds);
      console.log(JSON.stringify(plan, null, 2));
      return;
    }
    const plan = describeBootstrapPlan(profileId, runId, { remove, dryRun: true });
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  if (remote && isRemoteFrozen()) {
    fail(FREEZE_MESSAGE);
  }

  setActiveProfile(profile);
  const lock = acquireEnvLock(profileId, { command: repair ? 'e2e:bootstrap --repair' : 'e2e:bootstrap', runId });
  try {
  if (repair) {
    const repaired = await runRepairForProfile(profile, { extraIds });
    console.log(
      formatCanaryStatusLine(true, repaired.ok, 0)
    );
    if (!repaired.ok) {
      writeCanaryAlert(repaired.cmp, 'e2e:bootstrap --repair kanarya');
      fail(formatCanaryDiff(repaired.cmp));
    }
    console.log(JSON.stringify({ repaired: repaired.targets, skipped: repaired.data?.skipped || [] }, null, 2));
    return;
  }
  if (!remove) {
    resetRegistry(runId, {
      envId: profileId,
      siteUrl: profile.baseUrl,
      fixtureRecords: fixtureProductRecords(existingFx),
    });
  }
  if (profile.deployEnvFile) setActiveDeployEnvFile(profile.deployEnvFile);

  const takeSnap = () => (remote ? snapshotCanary() : snapshotCanaryLocal());

  if (!remote) ensureLocalWp();

  const before = takeSnap();
  const beforeState = evaluateBootstrapCanary(envId, before, loadRegistry(), {
    envId: profileId,
    fixtures: existingFx,
  });
  const beforeOk = beforeState.ok;
  if (remote && !beforeOk) {
    writeCanaryAlert(
      { ok: false, diffs: beforeState.diffs, warnings: beforeState.warnings },
      'e2e:bootstrap önce kanarya'
    );
    fail(`Kanarya önce KIRMIZI — bootstrap durdu.\n${formatCanaryDiff({ ok: false, diffs: beforeState.diffs, warnings: beforeState.warnings })}`);
  }

  let removeIds = [];
  if (remove) {
    removeIds = verifiedFixtureIds(before, existingFx);
    if (fixtureProductRecords(existingFx).length && !removeIds.length) {
      fail('fixture ürünleri doğrulanamadı (id/işaret/private); silinmedi');
    }
  }

  let data;
  if (!remote) {
    data = runLocalPhp(remove ? 'remove' : 'upsert', profileId, runId, { removeIds });
  } else {
    const extraEnv = { WDP_E2E_RUN_ID: runId };
    if (remove && removeIds.length) extraEnv.WDP_E2E_REMOVE_IDS = removeIds.join(',');
    const raw = runEvalFile(REMOTE_BOOTSTRAP_PHP, extraEnv, remove ? 'remove' : 'upsert');
    data = parsePhpJson(raw);
  }
  const outFile = writeFixtures(profileId, data);
  if (remove) {
    resetRegistry(runId, { clearFixtures: true, envId: profileId, siteUrl: profile.baseUrl });
  } else {
    registerCreatedRows({ ...data, runId });
  }

  const after = takeSnap();
  const cmp = remove
    ? compareCanary(before, after, { allowedDeletedIds: removeIds })
    : compareWithRegistry(before, after, loadRegistry(), { envId: profileId, fixtures: data });
  const afterOk = cmp.ok;
  console.log(formatCanaryStatusLine(beforeOk, afterOk, remove ? 0 : createdProductCount(data)));
  if (!cmp.ok) {
    writeCanaryAlert(cmp, 'e2e:bootstrap kanarya');
    fail(formatCanaryDiff(cmp));
  }
  const baseline = updateCanaryBaselineIfClean(envId, after, cmp);
  if (baseline.updated) console.log(`baseline yazıldı: ${baseline.file}`);

  console.log(`fixtures: ${outFile}`);
  console.log(JSON.stringify({ roles: data.roles, skipped: data.skipped, removed: data.removed }, null, 2));
  } finally {
    releaseEnvLock(lock);
  }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((e) => fail(e.message || String(e)));
}
