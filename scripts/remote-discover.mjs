#!/usr/bin/env node
/**
 * Uzak ortam keşfi (yalnız okur). Kullanıcıdan serbest komut almaz.
 *
 *   npm run remote:discover -- --env staging|ikram
 *   npm run remote:discover -- --env local   # ssh yok; yerel WP
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadProfile } from '../tests/e2e/helpers/profile.mjs';
import { spawnGuarded } from './lib/remote-guard.mjs';
import { buildGuardedEvalFileCommand } from './lib/deploy-guards.mjs';
import { ensureLocalWp } from './local-wp.mjs';
import {
  DISCOVER_STEPS,
  WRITE_PHP_RE,
  assembleReport,
  blockedExitCode,
  buildRemoteWpCommand,
  canonicalEnv,
  compactPhp,
  formatSummary,
  parseJsonBlob,
  profileKeyForEnv,
  renderMarkdown,
  runGuardedSsh,
  sanitizeCanarySnapshot,
  stepToWpTail,
} from './lib/remote-discover-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

export function parseDiscoverArgv(argv = process.argv.slice(2)) {
  const a = argv.filter((x) => x !== '--');
  let envRaw = '';
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    if (x === '--env' || x === '--profile') envRaw = String(a[++i] || '');
    else if (x.startsWith('--env=')) envRaw = x.slice('--env='.length);
  }
  if (!envRaw) fail('Kullanım: npm run remote:discover -- --env staging|ikram');
  return { envName: canonicalEnv(envRaw) };
}

function assertEvalFileReadOnly(abs) {
  const src = fs.readFileSync(abs, 'utf8');
  if (/\b(wp_delete_|wp_trash_|wp_untrash_|wp_update_post|wp_insert_post|update_option|delete_option)\b/i.test(src)) {
    throw new Error(`keşif eval-file yazma çağrısı içeriyor: ${path.relative(ROOT, abs)}`);
  }
}

export function createLocalRunner() {
  ensureLocalWp({ quiet: true });
  const evalFileBridge = path.join(ROOT, 'tests/local-wp/eval-file.php');
  return function runLocal(step) {
    if (step.kind === 'eval-file') {
      const rel = step.file;
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) throw new Error(`eval-file yok: ${rel}`);
      assertEvalFileReadOnly(abs);
      const r = spawnSync('php', [evalFileBridge, rel], {
        encoding: 'utf8',
        cwd: ROOT,
        timeout: 120000,
      });
      if (r.status !== 0) {
        throw new Error(`yerel eval-file ${rel}: ${(r.stderr || r.stdout || '').slice(0, 400)}`);
      }
      return r.stdout || '';
    }
    if (step.kind === 'eval') {
      const php = compactPhp(step.php);
      if (php.includes("'")) throw new Error(`eval tek tırnak içeremez: ${step.id}`);
      if (WRITE_PHP_RE.test(php)) throw new Error(`eval yazma içeriyor: ${step.id}`);
      const tmp = path.join(os.tmpdir(), `wdp-disc-${process.pid}-${step.id}.php`);
      fs.writeFileSync(tmp, `<?php\n${step.php}\n`, 'utf8');
      try {
        const r = spawnSync('php', [evalFileBridge, tmp], {
          encoding: 'utf8',
          cwd: ROOT,
          timeout: 120000,
        });
        if (r.status !== 0) {
          throw new Error(`yerel eval ${step.id}: ${(r.stderr || r.stdout || '').slice(0, 400)}`);
        }
        return r.stdout || '';
      } finally {
        try {
          fs.unlinkSync(tmp);
        } catch (e) {
          if (e && e.code !== 'ENOENT') throw e;
        }
      }
    }
    throw new Error(`yerel adım desteklenmiyor: ${step.kind}`);
  };
}

export function createRemoteRunner({ spawn, alias, wpPath, siteUrl }) {
  if (!alias) throw new Error('Profil ssh.alias boş.');
  if (!wpPath) throw new Error('Profil ssh.wpPath boş.');
  const guardOpts = { siteUrl: siteUrl || '', wpPath };
  const spawnOpts = { encoding: 'utf8', cwd: ROOT, timeout: 120000 };
  const runnerSpawn = spawn || spawnGuarded;

  const p = String(wpPath).trim();

  return function runRemote(step) {
    if (step.kind === 'eval-file') {
      const abs = path.join(ROOT, step.file);
      if (!fs.existsSync(abs)) throw new Error(`eval-file yok: ${step.file}`);
      assertEvalFileReadOnly(abs);
      const b64 = fs.readFileSync(abs).toString('base64');
      const remoteCmd = buildGuardedEvalFileCommand(p, { tmpPrefix: 'wdp-disc', b64 });
      if (!/--path=/.test(remoteCmd) || /--skip-themes|--skip-plugins/.test(remoteCmd)) {
        throw new Error('eval-file uzak komut --path eksik veya skip-themes');
      }
      const res = runGuardedSsh(runnerSpawn, alias, remoteCmd, spawnOpts, guardOpts);
      return res.stdout || '';
    }
    if (step.kind === 'eval') {
      const php = compactPhp(step.php);
      if (php.includes("'")) throw new Error(`eval tek tırnak içeremez: ${step.id}`);
      if (WRITE_PHP_RE.test(php)) throw new Error(`eval yazma içeriyor: ${step.id}`);
      const tail = stepToWpTail(step);
      const remoteCmd = buildRemoteWpCommand(p, tail);
      if (!/--path=/.test(remoteCmd)) throw new Error('wp komutunda --path yok');
      if (/--skip-themes|--skip-plugins/.test(remoteCmd)) {
        throw new Error('wp komutunda skip-themes/plugins yasak (tema/eklenti yüklü gelmeli)');
      }
      const res = runGuardedSsh(runnerSpawn, alias, remoteCmd, spawnOpts, guardOpts);
      return res.stdout || '';
    }
    throw new Error(`uzak adım desteklenmiyor: ${step.kind}`);
  };
}

export function runDiscover({ envName, runner, outRoot = ROOT, writeFiles = true }) {
  const env = canonicalEnv(envName);
  const profile = loadProfile(profileKeyForEnv(env));
  const stepData = {};
  for (const step of DISCOVER_STEPS) {
    const raw = runner(step);
    stepData[step.id] = parseJsonBlob(raw);
  }

  const canaryRel = path.join('build', 'e2e', 'canary', `${env}-baseline.json`).replace(/\\/g, '/');
  const canaryAbs = path.join(outRoot, canaryRel);
  const canary = sanitizeCanarySnapshot(stepData.canary || {});
  stepData.canary = canary;

  const report = assembleReport({
    envName: env,
    profileId: profile.id,
    stepData,
    canaryRel,
  });
  const md = renderMarkdown(report);
  const summary = formatSummary(report);

  if (writeFiles) {
    const discDir = path.join(outRoot, 'build', 'discovery');
    fs.mkdirSync(discDir, { recursive: true });
    fs.mkdirSync(path.dirname(canaryAbs), { recursive: true });
    fs.writeFileSync(path.join(discDir, `${env}.json`), JSON.stringify(report, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(discDir, `${env}.md`), md.endsWith('\n') ? md : `${md}\n`, 'utf8');
    fs.writeFileSync(canaryAbs, JSON.stringify(canary, null, 2) + '\n', 'utf8');
  }

  const exitCode = blockedExitCode(report.plugins);
  return { report, md, summary, exitCode, canary };
}

function main() {
  const { envName } = parseDiscoverArgv();
  let runner;
  if (envName === 'local') {
    runner = createLocalRunner();
  } else {
    const profile = loadProfile(profileKeyForEnv(envName));
    runner = createRemoteRunner({
      spawn: spawnGuarded,
      alias: String(profile.ssh?.alias || '').trim(),
      wpPath: String(profile.ssh?.wpPath || '').trim(),
      siteUrl: String(profile.baseUrl || '').trim(),
    });
  }
  const { summary, exitCode } = runDiscover({ envName, runner, outRoot: ROOT, writeFiles: true });
  console.log(summary);
  process.exit(exitCode);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }
}
