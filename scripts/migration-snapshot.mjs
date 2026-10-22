#!/usr/bin/env node
/**
 * Eklenti ayar + ürün bağış meta anlık görüntüsü.
 *
 *   node scripts/migration-snapshot.mjs --env local --label before
 *   node scripts/migration-snapshot.mjs --env staging --label live   (yalnız Claude; spawnGuarded)
 *
 * Değerler JSON dosyasına yazılır; konsola yalnız ad / tür / hash.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from '../tests/e2e/helpers/env-root.mjs';
import { formatSnapshotConsole } from './lib/migration-util.mjs';
import {
  extractKeysFromTrees,
  buildKeyset,
  findWriteFunctions,
} from './lib/migration-keys.mjs';
import { phpEvalFile, ensureLocalWp, LOCAL_WP_ROOT } from './local-wp.mjs';
import { spawnGuarded } from './lib/remote-guard.mjs';
import { buildGuardedEvalFileCommand } from './lib/deploy-guards.mjs';
import { loadProfile, resolveAllowedRemoteTarget, setActiveProfile } from '../tests/e2e/helpers/profile.mjs';
import { runGuardedSsh, formatGuardedSshFailure } from './lib/remote-discover-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SNAPSHOT_PHP = 'tests/e2e/helpers/migration-snapshot.php';
export const MIGRATION_DIR = path.join(ROOT, 'build/migration');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

/**
 * @param {string[]} argv
 */
export function parseSnapshotArgs(argv) {
  const a = argv.filter((x) => x !== '--');
  /** @type {Record<string, string>} */
  const out = { env: 'local', label: 'snap', sources: '', out: '', wpDir: '' };
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--env') out.env = String(a[++i] || out.env);
    else if (x === '--label') out.label = String(a[++i] || out.label);
    else if (x === '--sources') out.sources = String(a[++i] || '');
    else if (x === '--out') out.out = String(a[++i] || '');
    else if (x === '--wp-dir') out.wpDir = String(a[++i] || '');
  }
  return out;
}

/**
 * @param {string} envId
 * @param {string} label
 */
export function defaultOutPath(envId, label) {
  const safeEnv = String(envId || 'local').replace(/[^a-z0-9_-]/gi, '');
  const safeLabel = String(label || 'snap').replace(/[^a-z0-9._-]/gi, '');
  return path.join(MIGRATION_DIR, `${safeEnv}-${safeLabel}.json`);
}

/**
 * @param {string} sourcesArg
 * @returns {string[]}
 */
export function resolveSourceTrees(sourcesArg) {
  if (sourcesArg && sourcesArg.trim()) {
    return sourcesArg
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => path.resolve(s));
  }
  const trees = [ROOT];
  const old1031 = path.join(ROOT, 'build/migration/source/10.3.1/woo-donation-popup');
  if (fs.existsSync(old1031)) trees.push(old1031);
  const extracted = path.join(MIGRATION_DIR, 'extracted-old');
  if (fs.existsSync(extracted)) trees.push(extracted);
  return trees;
}

/**
 * @param {string} phpText
 */
export function assertSnapshotPhpReadOnly(phpText) {
  const hits = findWriteFunctions(phpText);
  if (hits.length) {
    throw new Error(`migration-snapshot.php yazma çağrısı içeriyor: ${hits.join(', ')}`);
  }
}

/**
 * @param {string} text
 * @param {{ status?: number|null, stderr?: string }|null} [sshRes]
 */
export function extractSnapshotJson(text, sshRes) {
  const raw = String(text || '');
  const i = raw.indexOf('{');
  const j = raw.lastIndexOf('}');
  if (i < 0 || j < i) {
    if (sshRes) {
      throw new Error(formatGuardedSshFailure(sshRes, 'anlık görüntü JSON yok'));
    }
    throw new Error(`anlık görüntü JSON yok: ${raw.slice(0, 240)}`);
  }
  return JSON.parse(raw.slice(i, j + 1));
}

function writeKeysetFile(keyset) {
  fs.mkdirSync(MIGRATION_DIR, { recursive: true });
  const file = path.join(MIGRATION_DIR, 'keyset-current.json');
  fs.writeFileSync(file, JSON.stringify(keyset, null, 2) + '\n', 'utf8');
  return file;
}

/**
 * @param {{ env: string, label: string, sources: string, out: string, wpDir: string }} args
 */
export async function runSnapshot(args) {
  const phpPath = path.join(ROOT, SNAPSHOT_PHP);
  const phpText = fs.readFileSync(phpPath, 'utf8');
  assertSnapshotPhpReadOnly(phpText);

  const trees = resolveSourceTrees(args.sources);
  const extracted = extractKeysFromTrees(trees);
  const keyset = buildKeyset(extracted);
  const keyFile = writeKeysetFile(keyset);
  const outFile = args.out || defaultOutPath(args.env, args.label);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  let raw = '';
  if (args.env === 'local') {
    const resolvedWp = args.wpDir || path.join(LOCAL_WP_ROOT, 'wordpress');
    ensureLocalWp(path.dirname(resolvedWp));
    raw = phpEvalFile(SNAPSHOT_PHP, {
      WDP_LOCAL_WP_DIR: resolvedWp,
      WDP_MIG_KEYS_FILE: keyFile,
    });
  } else if (args.env === 'staging' || args.env === 'ikram') {
    return runRemoteSnapshot(args.env, phpText, keyset, outFile, args.label);
  } else {
    throw new Error(`--env local|staging|ikram (gelen: ${args.env})`);
  }

  const snap = extractSnapshotJson(raw);
  snap.env = args.env;
  snap.label = args.label;
  fs.writeFileSync(outFile, JSON.stringify(snap, null, 2) + '\n', 'utf8');
  console.log(`yazıldı: ${path.relative(ROOT, outFile)}`);
  console.log(formatSnapshotConsole(snap));
  return { outFile, snap, keyset };
}

/**
 * 1A: profil ssh.alias/wpPath/siteUrl → izin listesi.
 * @param {string} envId
 */
export function resolveSnapshotRemoteTarget(envId) {
  const profile = loadProfile(envId);
  const resolved = resolveAllowedRemoteTarget(profile);
  setActiveProfile(profile);
  return resolved;
}

/**
 * @param {string} wpPath
 * @param {string} b64 PHP dosyasının base64'ü
 * @param {string} [keysetB64] anahtar kümesi JSON base64 (ayrı uzak geçici dosya)
 */
export function buildSnapshotRemoteCommand(wpPath, b64, keysetB64) {
  /** @type {{ tmpPrefix: string, b64: string, envFile?: { envName: string, b64: string, suffix: string } }} */
  const opts = { tmpPrefix: 'wdp-mig', b64 };
  if (keysetB64) {
    opts.envFile = { envName: 'WDP_MIG_KEYS_FILE', b64: String(keysetB64), suffix: '.json' };
  }
  return buildGuardedEvalFileCommand(wpPath, opts);
}

/**
 * Enjeksiyonsuz: orijinal PHP + anahtar kümesi ayrı dosya (`WDP_MIG_KEYS_FILE`).
 * @param {string} wpPath
 * @param {string} phpText
 * @param {object} keyset
 */
export function buildRemoteSnapshotEvalCommand(wpPath, phpText, keyset) {
  const phpB64 = Buffer.from(String(phpText || ''), 'utf8').toString('base64');
  const keyB64 = Buffer.from(JSON.stringify(keyset || {}), 'utf8').toString('base64');
  return buildSnapshotRemoteCommand(wpPath, phpB64, keyB64);
}

/**
 * Uzak: freeze / izin listesi spawnGuarded üzerinden. Bu süreçte Claude çalıştırır.
 * @param {string} envId
 * @param {string} phpText
 * @param {object} keyset
 * @param {string} outFile
 * @param {string} [label]
 */
function runRemoteSnapshot(envId, phpText, keyset, outFile, label = '') {
  const resolved = resolveSnapshotRemoteTarget(envId);
  const remoteCmd = buildRemoteSnapshotEvalCommand(resolved.wpPath, phpText, keyset);
  const res = runGuardedSsh(
    spawnGuarded,
    resolved.alias,
    remoteCmd,
    { encoding: 'utf8', cwd: ROOT, timeout: 120000 },
    {
      alias: resolved.alias,
      wpPath: resolved.wpPath,
      siteUrl: resolved.siteUrl,
      requireStdout: true,
    }
  );
  const snap = extractSnapshotJson(res.stdout || '', res);
  snap.env = envId;
  snap.label = label || snap.label || 'snap';
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(snap, null, 2) + '\n', 'utf8');
  console.log(`yazıldı: ${path.relative(ROOT, outFile)}`);
  console.log(formatSnapshotConsole(snap));
  return { outFile, snap, target: resolved };
}

function main() {
  try {
    const args = parseSnapshotArgs(process.argv.slice(2));
    runSnapshot(args).catch((e) => fail(e && e.message ? e.message : String(e)));
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
