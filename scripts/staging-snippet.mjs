#!/usr/bin/env node
/**
 * staging30 Code Snippets: yalnız `WDP-K8-curcy-bridge (test)` adlı kaydı ekler/siler/okur.
 *
 *   node scripts/staging-snippet.mjs install|remove|status
 *
 * Yalnız Claude çalıştırır (operatör kapısı). Başka snippet'e dokunmaz.
 */
import { loadDeployEnvSilent, remote, resolveWpPath, setActiveDeployEnvFile } from '../tests/e2e/helpers/wp-remote.mjs';
import { loadProfile, setActiveProfile } from '../tests/e2e/helpers/profile.mjs';
import { assertStagingTarget, runSnippetOp, SNIPPET_NAME, SNIPPET_OPS } from './lib/staging-tools.mjs';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function main() {
  const op = process.argv.slice(2).filter((a) => a !== '--')[0];
  if (!SNIPPET_OPS.includes(op)) fail('Kullanım: node scripts/staging-snippet.mjs install|remove|status');
  const profile = loadProfile('staging');
  setActiveProfile(profile);
  setActiveDeployEnvFile(profile.deployEnvFile || '.env.deploy');
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) fail(`staging-snippet: ${loaded.reason}`);
  const env = { ...loaded.env };
  env.DEPLOY_WP_PATH = String(env.DEPLOY_WP_PATH || resolveWpPath(env)).trim();
  const g = assertStagingTarget(env, loaded.target);
  if (!g.ok) fail(`staging-snippet: ${g.reason}`);
  try {
    const res = runSnippetOp(env, op, { remoteFn: (cmd) => remote(env, cmd) });
    console.log(JSON.stringify({ name: SNIPPET_NAME, ...res }));
    if (res.id) console.log(`snippet_id=${res.id}`);
    else if (res.snippet && res.snippet.id) console.log(`snippet_id=${res.snippet.id}`);
    if (res.ok === false) process.exit(1);
  } catch (e) {
    fail(`staging-snippet: ${e && e.message ? e.message : e}`);
  }
}

main();
