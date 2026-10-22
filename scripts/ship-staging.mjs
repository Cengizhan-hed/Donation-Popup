#!/usr/bin/env node
/**
 * Tek komut: staging deploy + e2e:quick + raporu aç.
 * Exit kodu e2e sonucunu yansıtır; rapor yine de açılır.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertRemoteAllowed } from './lib/remote-guard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });
  return r.status ?? 1;
}

try {
  assertRemoteAllowed();
} catch (e) {
  console.error(e && e.message ? e.message : String(e));
  process.exit(1);
}

const deployCode = run('npm', ['run', 'deploy:staging']);
if (deployCode !== 0) {
  process.exit(deployCode);
}

const e2eCode = run('node', ['tests/e2e/run-quick.mjs', '--open-report']);
process.exit(e2eCode);
