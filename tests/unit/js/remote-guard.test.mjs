/**
 * Uzak erişim kilidi — ağ yok. Operatör kapısı + FREEZE + ham ssh yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertRemoteAllowed,
  assertOperatorGate,
  isRemoteFrozen,
  isRemoteRsync,
  redactSpawnArgs,
  parseRemoteInvocation,
  spawnGuarded,
  isUnitTestProcess,
  REMOTE_FREEZE_PATH,
  FREEZE_MESSAGE,
  OPERATOR_GATE_MESSAGE,
  UNIT_TEST_SPAWN_MESSAGE,
  CURSOR_AGENT_ENV_KEYS,
} from '../../../scripts/lib/remote-guard.mjs';
import { scanDirectRemoteSpawns } from '../../../scripts/lib/live-target-scan.mjs';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';

const CLAUDE_ONLY = { CLAUDECODE: '1' };

describe('remote-guard', () => {
  it('isRemoteFrozen dosya varlığına göre', () => {
    assert.equal(isRemoteFrozen(), fs.existsSync(REMOTE_FREEZE_PATH));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-freeze-'));
    const freeze = path.join(dir, 'REMOTE_FREEZE');
    fs.writeFileSync(freeze, 'lock');
    try {
      assert.equal(isRemoteFrozen(freeze), true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('CLAUDECODE yokken RED', () => {
    assert.throws(() => assertOperatorGate({}), (e) => {
      assert.equal(e.message, OPERATOR_GATE_MESSAGE);
      return true;
    });
    assert.throws(() => assertRemoteAllowed({ bin: 'ssh', env: {} }), (e) => {
      assert.equal(e.message, OPERATOR_GATE_MESSAGE);
      return true;
    });
  });

  it('Cursor işareti varken RED', () => {
    const env = { CLAUDECODE: '1', CURSOR_AGENT: '1' };
    assert.throws(() => assertOperatorGate(env), (e) => {
      assert.equal(e.message, OPERATOR_GATE_MESSAGE);
      return true;
    });
    assert.ok(CURSOR_AGENT_ENV_KEYS.includes('CURSOR_AGENT'));
    assert.throws(() =>
      assertRemoteAllowed({
        bin: 'ssh',
        args: ['hedef-staging', 'true'],
        env: { CLAUDECODE: '1', CURSOR_CONVERSATION_ID: 'x' },
      })
    );
  });

  it('REMOTE_FREEZE varken RED', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-freeze-'));
    const freeze = path.join(dir, 'REMOTE_FREEZE');
    fs.writeFileSync(freeze, 'lock');
    try {
      assert.throws(
        () =>
          assertRemoteAllowed({
            bin: 'ssh',
            args: ['hedef-staging', 'true'],
            env: CLAUDE_ONLY,
            freezePath: freeze,
          }),
        (e) => {
          assert.equal(e.message, FREEZE_MESSAGE);
          return true;
        }
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('freeze varken scp ve uzak rsync reddedilir', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-freeze-'));
    const freeze = path.join(dir, 'REMOTE_FREEZE');
    fs.writeFileSync(freeze, 'lock');
    try {
      assert.throws(() =>
        assertRemoteAllowed({
          bin: 'scp',
          args: ['a', 'ikramaid:~/www/ikramaid.uk/public_html/x'],
          env: CLAUDE_ONLY,
          freezePath: freeze,
        })
      );
      assert.throws(() =>
        assertRemoteAllowed({
          bin: 'rsync',
          args: ['-az', '-e', 'ssh', 'src/', 'ikramaid:~/www/ikramaid.uk/public_html/'],
          env: CLAUDE_ONLY,
          freezePath: freeze,
        })
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('yerel paket rsync freeze altında izinli', () => {
    const r = assertRemoteAllowed({
      bin: 'rsync',
      args: ['-a', '/tmp/src/', '/tmp/dest/'],
      localPack: true,
      env: {},
    });
    assert.equal(r.ok, true);
    assert.equal(r.localPack, true);
  });

  it('isRemoteRsync: host:path ve -e ssh', () => {
    assert.equal(isRemoteRsync(['-az', 'src/', 'ikramaid:/var/www/']), true);
    assert.equal(isRemoteRsync(['-az', '-e', 'ssh', 'src/', 'dest/']), true);
    assert.equal(isRemoteRsync(['-a', '/tmp/a/', '/tmp/b/']), false);
  });

  it('-i anahtar yolu logdan çıkarılır', () => {
    const red = redactSpawnArgs(['-i', '/Users/me/.ssh/id_ed25519', 'host']);
    assert.equal(red.includes('/Users/me/.ssh/id_ed25519'), false);
    assert.equal(red.includes('[redacted-key-path]'), true);
  });

  it('parseRemoteInvocation ssh alias + komut', () => {
    const p = parseRemoteInvocation('ssh', [
      '-o',
      'BatchMode=yes',
      'hedef-staging',
      'wp option get siteurl --path=~/www/staging30.hedefdernegi.org/public_html',
    ]);
    assert.equal(p.alias, 'hedef-staging');
    assert.match(p.remoteCommand, /wp option get/);
  });

  it('spawnGuarded birim testte gerçek ssh atmaz (CLAUDECODE=1, freeze yok)', () => {
    assert.equal(isUnitTestProcess(process.env), true);
    const missingFreeze = path.join(os.tmpdir(), 'wdp-no-freeze-missing');
    assert.throws(
      () =>
        spawnGuarded(
          'ssh',
          ['-o', 'BatchMode=yes', 'hedef-staging', 'true'],
          {},
          {
            env: CLAUDE_ONLY,
            freezePath: missingFreeze,
            alias: 'hedef-staging',
            wpPath: '~/www/staging30.hedefdernegi.org/public_html',
            siteUrl: 'https://staging30.hedefdernegi.org',
          }
        ),
      (e) => {
        assert.equal(e.message, UNIT_TEST_SPAWN_MESSAGE);
        return true;
      }
    );
  });

  it('freeze dosyası testte verilir; spawnGuarded freeze ile RED (ssh yok)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-freeze-'));
    const freeze = path.join(dir, 'REMOTE_FREEZE');
    fs.writeFileSync(freeze, 'lock');
    try {
      assert.throws(
        () =>
          spawnGuarded(
            'ssh',
            ['hedef-staging', 'true'],
            {},
            {
              env: CLAUDE_ONLY,
              freezePath: freeze,
              alias: 'hedef-staging',
              wpPath: '~/www/staging30.hedefdernegi.org/public_html',
              siteUrl: 'https://staging30.hedefdernegi.org',
            }
          ),
        (e) => {
          assert.equal(e.message, FREEZE_MESSAGE);
          return true;
        }
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('spawnGuarded izin listesiyle eşleşmeyen wpPath RED (ssh yok)', () => {
    const missingFreeze = path.join(os.tmpdir(), 'wdp-no-freeze-missing');
    let n = 0;
    assert.throws(
      () =>
        spawnGuarded(
          'ssh',
          ['-o', 'BatchMode=yes', 'hedef-staging', 'true'],
          {},
          {
            env: CLAUDE_ONLY,
            freezePath: missingFreeze,
            spawnImpl: () => {
              n += 1;
              return { status: 0, stdout: '', stderr: '' };
            },
            alias: 'hedef-staging',
            wpPath: '/var/www/other/public_html',
            siteUrl: 'https://staging30.hedefdernegi.org',
          }
        ),
      (e) => {
        assert.match(String(e.message), /eşleşmiyor|izin|kök/i);
        return true;
      }
    );
    assert.equal(n, 0);
  });

  it('spawnImpl enjeksiyonu birim testte sahte ssh çalıştırır', () => {
    let n = 0;
    const fake = () => {
      n += 1;
      return { status: 0, stdout: 'ok', stderr: '' };
    };
    const res = spawnGuarded(
      'ssh',
      ['-o', 'BatchMode=yes', 'ikramaid', 'true'],
      {},
      {
        env: CLAUDE_ONLY,
        freezePath: path.join(os.tmpdir(), 'wdp-no-freeze-missing'),
        spawnImpl: fake,
        alias: 'ikramaid',
        wpPath: '~/www/ikramaid.uk/public_html',
        siteUrl: 'https://ikramaid.uk',
      }
    );
    assert.equal(n, 1);
    assert.equal(res.stdout, 'ok');
  });
});

describe('ham ssh/scp/sftp/rsync spawn yok', () => {
  it('scripts/ ve tests/e2e/ altında doğrudan spawn(ssh) yok', () => {
    const hits = scanDirectRemoteSpawns(ROOT);
    assert.deepEqual(hits, [], hits.map((h) => `${h.file}:${h.line}`).join('\n'));
  });

  it('spawnGuarded çağıranlar alias’sız assertRemoteAllowed({bin:ssh}) kullanmaz', () => {
    const files = [
      'scripts/migration-snapshot.mjs',
      'scripts/remote-discover.mjs',
      'scripts/e2e-catalog-explain.mjs',
      'scripts/e2e-bootstrap.mjs',
      'scripts/ikram-wp.mjs',
      'scripts/staging-wp.mjs',
      'scripts/lib/ship-core.mjs',
      'tests/e2e/helpers/wp-remote.mjs',
      'tests/e2e/helpers/canary.mjs',
      'tests/e2e/run-canary.mjs',
      'tests/e2e/helpers/test-cleanup.mjs',
    ];
    const bare = /assertRemoteAllowed\(\s*\{\s*bin:\s*['"]ssh['"]\s*\}\s*\)/;
    for (const rel of files) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      assert.equal(bare.test(src), false, rel);
      assert.ok(
        /findTargetByAlias|findTargetById|resolveAllowedRemoteTarget|loadProfile|loadDeployEnvSilent/.test(src),
        rel
      );
    }
  });
});
