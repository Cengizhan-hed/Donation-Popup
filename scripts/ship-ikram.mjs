#!/usr/bin/env node
/**
 * Ikram: deploy + e2e:quick --env ikram.
 * KAYIT: ikramaid.uk izni Ikram Aid yayına alınmadan önce KALDIRILACAK.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IKRAM_ALLOW_REMOVAL_NOTE } from './lib/deploy-guards.mjs';

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

console.log(IKRAM_ALLOW_REMOVAL_NOTE);
const deployCode = run('node', ['scripts/deploy-ikram.mjs']);
if (deployCode !== 0) {
  process.exit(deployCode);
}

const e2eCode = run('node', ['tests/e2e/run-quick.mjs', '--env', 'ikram', '--open-report']);
process.exit(e2eCode);
