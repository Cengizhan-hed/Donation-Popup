#!/usr/bin/env node
/**
 * Ikram: güvenli ship zinciri + e2e:quick --env ikram.
 * KAYIT: ikramaid.uk izni Ikram Aid yayına alınmadan önce KALDIRILACAK.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseShipArgs, runShip } from './lib/ship-core.mjs';
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

const args = parseShipArgs(process.argv.slice(2));
try {
  assertRemoteAllowed();
} catch (e) {
  console.error(e && e.message ? e.message : String(e));
  process.exit(1);
}

let result;
try {
  result = await runShip({ envName: 'ikram', argv: process.argv.slice(2) });
} catch (e) {
  console.error(e && e.message ? e.message : String(e));
  process.exit(e && e.exitCode ? e.exitCode : 1);
}
if (result.summary) console.log(result.summary);
if (result.reportFile) console.log(`özet: ${result.reportFile}`);
if (result.exitCode !== 0 || result.dryRun || args.rollback) {
  process.exit(result.exitCode);
}

const e2eCode = run('node', ['tests/e2e/run-quick.mjs', '--env', 'ikram', '--open-report']);
process.exit(e2eCode);
