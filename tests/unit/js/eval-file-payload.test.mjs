/**
 * 1H: eval-file aktarımı. Ağ yok; sh -c + gerçek base64/gzip + sahte wp.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';
import {
  ALLOWED_DEPLOY_TARGETS,
  EVAL_FILE_EMPTY_EXIT,
  buildGuardedEvalFileCommand,
  checkRemoteTarget,
  gzipBase64Payload,
} from '../../../scripts/lib/deploy-guards.mjs';
import {
  buildRemoteSnapshotEvalCommand,
  extractSnapshotJson,
} from '../../../scripts/migration-snapshot.mjs';

const STAGING_WP = '~/www/staging30.hedefdernegi.org/public_html';
const SNAPSHOT_PHP = path.join(ROOT, 'tests/e2e/helpers/migration-snapshot.php');

function runSh(cmd, extraEnv = {}) {
  return spawnSync('sh', ['-c', cmd], {
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
  });
}

function writeFakeWp(binDir, capturedPhp, capturedKey) {
  fs.mkdirSync(binDir, { recursive: true });
  const phpLit = JSON.stringify(capturedPhp);
  const keyLit = JSON.stringify(capturedKey);
  const body = `#!/bin/sh
file=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "eval-file" ]; then
    file="$2"
    break
  fi
  shift
done
if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "fake-wp: eval-file yok" >&2
  exit 2
fi
cp "$file" ${phpLit}
if [ -n "$WDP_MIG_KEYS_FILE" ] && [ -f "$WDP_MIG_KEYS_FILE" ]; then
  cp "$WDP_MIG_KEYS_FILE" ${keyLit}
fi
php_bytes=$(wc -c < "$file" | tr -d ' ')
key_bytes=0
if [ -f ${keyLit} ]; then
  key_bytes=$(wc -c < ${keyLit} | tr -d ' ')
fi
printf '{"schema":1,"ok":1,"php_bytes":%s,"key_bytes":%s}\\n' "$php_bytes" "$key_bytes"
`;
  fs.writeFileSync(path.join(binDir, 'wp'), body, { mode: 0o755 });
}

describe('eval-file payload aktarımı', () => {
  it('kök neden: openssl base64 -d uzun satırda sessiz 0 bayt (çıkış 0)', () => {
    const openssl = spawnSync('openssl', ['version'], { encoding: 'utf8' });
    if (openssl.status !== 0) return;
    const b64 = Buffer.alloc(8000, 65).toString('base64');
    const r = runSh(`echo '${b64}' | openssl base64 -d | wc -c`);
    assert.equal(r.status, 0);
    assert.equal(Number(String(r.stdout || '').trim()), 0, r.stderr);
  });

  it('boş payload → çıkış 97; wp çağrılmaz', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-1h-empty-'));
    const binDir = path.join(dir, 'bin');
    const marker = path.join(dir, 'wp-called');
    fs.mkdirSync(binDir);
    fs.writeFileSync(
      path.join(binDir, 'wp'),
      `#!/bin/sh\necho called > ${JSON.stringify(marker)}\nexit 0\n`,
      { mode: 0o755 }
    );
    try {
      const cmd = buildGuardedEvalFileCommand(STAGING_WP, { tmpPrefix: 'wdp-eval', b64: '' });
      assert.match(cmd, /exit 97/);
      const r = runSh(cmd, { PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}` });
      assert.equal(r.status, EVAL_FILE_EMPTY_EXIT, `${r.stderr || ''}\n${r.stdout || ''}`);
      assert.equal(fs.existsSync(marker), false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('sh -c + gerçek base64 + sahte wp: 11 KB+ anahtar kümesi uçtan uca', () => {
    const phpText = fs.readFileSync(SNAPSHOT_PHP, 'utf8');
    const keyset = {
      options: Array.from({ length: 420 }, (_, i) => `wdp_opt_${String(i).padStart(3, '0')}_${'k'.repeat(18)}`),
      meta: Array.from({ length: 80 }, (_, i) => `_wdp_meta_${i}`),
      optionPrefixes: ['wdp_'],
      metaPrefixes: ['wdp_', '_wdp_'],
    };
    const keyJson = JSON.stringify(keyset);
    assert.ok(Buffer.byteLength(keyJson) >= 11 * 1024, `keyset ${Buffer.byteLength(keyJson)}`);

    const cmd = buildRemoteSnapshotEvalCommand(STAGING_WP, phpText, keyset);
    assert.match(cmd, /WDP_MIG_KEYS_FILE=/);
    assert.match(cmd, /fold -w 76/);
    assert.match(cmd, /gzip -dc/);
    assert.doesNotMatch(cmd, /WDP_MIG_KEYSET_JSON/);
    assert.doesNotMatch(cmd, /echo '/);

    const staging = ALLOWED_DEPLOY_TARGETS.find((t) => t.id === 'staging-hedef');
    const locked = checkRemoteTarget({
      alias: staging.sshAlias,
      wpPath: staging.wpPath,
      siteUrl: staging.siteUrl,
      remoteCommand: cmd,
    });
    assert.equal(locked.ok, true, locked.reason);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-1h-e2e-'));
    const capturedPhp = path.join(dir, 'got.php');
    const capturedKey = path.join(dir, 'got.json');
    const binDir = path.join(dir, 'bin');
    writeFakeWp(binDir, capturedPhp, capturedKey);
    try {
      const r = runSh(cmd, { PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}` });
      assert.equal(r.status, 0, `${r.stderr || ''}\n${r.stdout || ''}`);
      const snap = extractSnapshotJson(r.stdout || '');
      assert.equal(snap.ok, 1);
      assert.ok(snap.php_bytes > 1000);
      assert.ok(snap.key_bytes >= 11 * 1024, `key_bytes ${snap.key_bytes}`);
      const gotPhp = fs.readFileSync(capturedPhp, 'utf8');
      assert.equal(gotPhp, phpText);
      assert.equal(gotPhp.includes("define('WDP_MIG_KEYSET_JSON'"), false);
      const gotKey = JSON.parse(fs.readFileSync(capturedKey, 'utf8'));
      assert.equal(gotKey.options.length, keyset.options.length);
      assert.equal(gotKey.options[0], keyset.options[0]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('stdout boş JSON hatası stderr 300 + çıkış kodu (temiz)', () => {
    assert.throws(
      () =>
        extractSnapshotJson('', {
          status: 0,
          stderr: 'admin@example.com https://evil.example/x sk_live_abc123XYZ',
        }),
      (err) => {
        const msg = String(err && err.message ? err.message : err);
        assert.match(msg, /anlık görüntü JSON yok \(çıkış 0\)/);
        assert.match(msg, /redacted-email/);
        assert.match(msg, /redacted-url/);
        assert.match(msg, /redacted-key/);
        assert.equal(msg.includes('admin@example.com'), false);
        assert.equal(/https?:\/\//.test(msg), false);
        assert.equal(msg.includes('sk_live_'), false);
        return true;
      }
    );
  });

  it('gzipBase64Payload boş girdi → uzak gunzip boş → 97', () => {
    const gz = gzipBase64Payload('');
    assert.ok(gz.length > 0);
    assert.match(gz, /^[A-Za-z0-9+/=]+$/);
  });
});
