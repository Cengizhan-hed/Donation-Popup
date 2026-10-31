/**
 * FIXC: ship betikleri run-quick'i açık --env ile çağırır (E2E_ENV'e dayanmaz). Ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseE2ECli } from '../../../tests/e2e/helpers/env.mjs';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';

const CASES = [
  ['scripts/ship-staging.mjs', 'staging-hedef'],
  ['scripts/ship-ikram.mjs', 'ikram-aid'],
];

describe('ship run-quick açık --env', () => {
  for (const [file, env] of CASES) {
    it(`${file} → --env ${env}`, () => {
      const src = fs.readFileSync(`${ROOT}/${file}`, 'utf8');
      const m = src.match(/run\('node', (\[[^\]]*run-quick\.mjs[^\]]*\])\)/);
      assert.ok(m, 'run-quick çağrısı bulunamadı');
      const argv = JSON.parse(m[1].replace(/'/g, '"'));
      assert.equal(argv[argv.indexOf('--env') + 1], env);
      const cli = parseE2ECli(argv.slice(1));
      assert.equal(cli.envId, env);
      assert.equal(cli.envExplicit, true);
    });
  }
});
