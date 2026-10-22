#!/usr/bin/env node
/**
 * Fixture ürün bootstrap. Uzak ortamda REMOTE_FREEZE reddeder.
 *
 *   npm run e2e:bootstrap -- --env local [--dry-run]
 *   npm run e2e:bootstrap -- --env local --remove
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../tests/e2e/helpers/env-root.mjs';
import { FIXTURE_CATALOG, fixturesPathFor } from '../tests/e2e/helpers/fixtures.mjs';
import { isRemoteFrozen, FREEZE_MESSAGE } from './lib/remote-guard.mjs';
import { ensureLocalWp } from './local-wp.mjs';
import { resetRegistry, registerCreated } from '../tests/e2e/helpers/run-registry.mjs';

function parseArgs(argv) {
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

async function main() {
  const { envId, dry, remove } = parseArgs(process.argv.slice(2));
  if (envId !== 'local' && isRemoteFrozen()) {
    fail(FREEZE_MESSAGE);
  }
  if (envId !== 'local') {
    fail('e2e:bootstrap bu görevde yalnız --env local (REMOTE_FREEZE).');
  }
  ensureLocalWp();
  const runId = 'fixture';
  if (!dry) resetRegistry(runId);

  if (dry) {
    console.log(
      JSON.stringify(
        { dryRun: true, env: envId, would: remove ? 'remove' : 'create', catalog: FIXTURE_CATALOG.map((c) => c.role) },
        null,
        2
      )
    );
    return;
  }

  const phpFile = path.join(ROOT, 'tests/local-wp/bootstrap-fixtures.php');
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('php', [phpFile, remove ? 'remove' : 'upsert', envId, runId], {
    encoding: 'utf8',
    cwd: ROOT,
  });
  if (r.status !== 0) {
    fail(`bootstrap php: ${(r.stderr || r.stdout || '').slice(0, 600)}`);
  }
  const line = String(r.stdout || '')
    .split(/\n/)
    .filter((l) => l.trim().startsWith('{'))
    .pop();
  const data = JSON.parse(line || '{}');
  const outFile = fixturesPathFor(envId);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
  if (!remove && Array.isArray(data.created)) {
    for (const row of data.created) {
      try {
        registerCreated({ id: row.id, type: 'product' });
      } catch {
        /* zaten var */
      }
    }
  }
  console.log(`fixtures: ${outFile}`);
  console.log(JSON.stringify({ roles: data.roles, skipped: data.skipped, removed: data.removed }, null, 2));
}

main().catch((e) => fail(e.message || String(e)));
