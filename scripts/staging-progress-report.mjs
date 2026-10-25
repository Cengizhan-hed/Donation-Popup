#!/usr/bin/env node
/**
 * staging30 SALT OKUNUR kampanya/ilerleme raporu (yalnız sayılar; JSON stdout).
 * Snippet kapalı/açık iki koşuyu karşılaştırmak için:
 *   node scripts/staging-progress-report.mjs > kapali.json
 *   node scripts/staging-snippet.mjs install
 *   node scripts/staging-progress-report.mjs > acik.json
 *   node scripts/staging-progress-report.mjs --diff kapali.json acik.json
 */
import fs from 'node:fs';
import { loadDeployEnvSilent, remote, resolveWpPath, setActiveDeployEnvFile } from '../tests/e2e/helpers/wp-remote.mjs';
import { loadProfile, setActiveProfile } from '../tests/e2e/helpers/profile.mjs';
import { assertStagingTarget, runProgressReport } from './lib/staging-tools.mjs';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function main() {
  const argv = process.argv.slice(2).filter((a) => a !== '--');
  if (argv[0] === '--diff') {
    const [a, b] = [argv[1], argv[2]].map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
    console.log(JSON.stringify({ closed: a.converted_total_base, open: b.converted_total_base, missing_closed: a.missing_rate_total, missing_open: b.missing_rate_total }));
    return;
  }
  const profile = loadProfile('staging');
  setActiveProfile(profile);
  setActiveDeployEnvFile(profile.deployEnvFile || '.env.deploy');
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) fail(`staging-progress-report: ${loaded.reason}`);
  const env = { ...loaded.env };
  env.DEPLOY_WP_PATH = String(env.DEPLOY_WP_PATH || resolveWpPath(env)).trim();
  const g = assertStagingTarget(env, loaded.target);
  if (!g.ok) fail(`staging-progress-report: ${g.reason}`);
  try {
    console.log(JSON.stringify(runProgressReport(env, { remoteFn: (cmd) => remote(env, cmd) })));
  } catch (e) {
    fail(`staging-progress-report: ${e && e.message ? e.message : e}`);
  }
}

main();
