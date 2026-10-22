/**
 * 3F: WP-CLI eval-file `--explain` tuzak. Ağ yok; sahte wp argüman biçimi.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';
import {
  evalFileScriptArgs,
  evalFileEnvPrefix,
  buildGuardedEvalFileCommand,
} from '../../../scripts/lib/deploy-guards.mjs';
import {
  createRemoteCatalogExplainRunner,
  CATALOG_EXPLAIN_ARG,
  CATALOG_EXPLAIN_ENV,
} from '../../../scripts/e2e-catalog-explain.mjs';

const STAGING_WP = '~/www/staging30.hedefdernegi.org/public_html';

function writeFakeWpCli(binDir) {
  fs.mkdirSync(binDir, { recursive: true });
  const body = `#!/bin/sh
endopts=0
want_file=0
for a in "$@"; do
  if [ "$want_file" = "1" ]; then
    want_file=2
    continue
  fi
  if [ "$a" = "eval-file" ]; then
    want_file=1
    continue
  fi
  if [ "$want_file" = "2" ]; then
    if [ "$a" = "--" ]; then
      endopts=1
      continue
    fi
    case "$a" in
      --*)
        if [ "$endopts" = "0" ]; then
          echo "Error: Parameter errors: unknown $a parameter" >&2
          exit 1
        fi
        ;;
    esac
  fi
done
echo '{"explain":true,"published":[],"picked":[],"shop":{"path":"/shop/"}}'
`;
  fs.writeFileSync(path.join(binDir, 'wp'), body, { mode: 0o755 });
}

describe('eval-file konumsal argüman', () => {
  it('--explain WP-CLI bayrağı olmasın; explain konumsal', () => {
    assert.equal(evalFileScriptArgs('explain'), ' explain');
    assert.equal(evalFileScriptArgs('cleanup'), ' cleanup');
    assert.equal(evalFileScriptArgs('--explain'), ' -- --explain');
    assert.equal(evalFileScriptArgs(''), '');
    assert.equal(evalFileEnvPrefix({ WDP_E2E_CATALOG_EXPLAIN: '1' }), "WDP_E2E_CATALOG_EXPLAIN='1' ");
    assert.throws(() => evalFileEnvPrefix({ PATH: 'x' }), /izinli olmayan/);
  });

  it('sahte wp: --explain bayrak → çıkış 1; explain konumsal → JSON', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-3f-eval-'));
    const binDir = path.join(dir, 'bin');
    writeFakeWpCli(binDir);
    const env = { PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}` };
    try {
      const trap = spawnSync(
        'sh',
        ['-c', 'wp --path=/tmp eval-file /dev/null --explain'],
        { encoding: 'utf8', env }
      );
      assert.equal(trap.status, 1, trap.stderr);
      assert.match(trap.stderr || '', /unknown --explain parameter/);

      const okPos = spawnSync(
        'sh',
        ['-c', 'wp --path=/tmp eval-file /dev/null explain'],
        { encoding: 'utf8', env }
      );
      assert.equal(okPos.status, 0, okPos.stderr);
      assert.match(okPos.stdout || '', /"explain":true/);

      const okDash = spawnSync(
        'sh',
        ['-c', 'wp --path=/tmp eval-file /dev/null -- --explain'],
        { encoding: 'utf8', env }
      );
      assert.equal(okDash.status, 0, okDash.stderr);

      const php = fs.readFileSync(path.join(ROOT, 'tests/e2e/helpers/catalog-resolve.php'));
      const guarded = buildGuardedEvalFileCommand(STAGING_WP, {
        tmpPrefix: 'wdp-catx',
        extraArgs: CATALOG_EXPLAIN_ARG,
        extraEnv: { [CATALOG_EXPLAIN_ENV]: '1' },
        b64: php.toString('base64'),
      });
      assert.doesNotMatch(guarded, /eval-file "\$TMP" --explain(\s|$)/);
      assert.match(guarded, /eval-file "\$TMP" explain/);
      assert.match(guarded, /WDP_E2E_CATALOG_EXPLAIN='1'/);
      const r = spawnSync('sh', ['-c', guarded], { encoding: 'utf8', env });
      assert.equal(r.status, 0, `${r.stderr || ''}\n${r.stdout || ''}`);
      assert.match(r.stdout || '', /"explain":true/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('catalog-explain runner uzak komut aynı biçim', () => {
    let remoteCmd = '';
    const runner = createRemoteCatalogExplainRunner({
      spawn: (bin, args) => {
        assert.equal(bin, 'ssh');
        remoteCmd = String(args[args.length - 1] || '');
        return { status: 0, stdout: '{"explain":true,"published":[],"picked":[],"shop":{"path":"/"}}', stderr: '' };
      },
      alias: 'hedef-staging',
      wpPath: STAGING_WP,
      siteUrl: 'https://staging30.hedefdernegi.org',
    });
    runner();
    assert.doesNotMatch(remoteCmd, /eval-file "\$TMP" --explain(\s|$)/);
    assert.match(remoteCmd, /eval-file "\$TMP" explain/);
    assert.match(remoteCmd, /WDP_E2E_CATALOG_EXPLAIN='1'/);
  });
});
