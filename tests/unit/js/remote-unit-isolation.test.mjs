/**
 * 1F: birim test ağa çıkmaz; uzak --path ~ açılır.
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
  buildGuardedEvalFileCommand,
  plannedRemoteCommands,
  wpPathFlag,
  shellQuoteWpPath,
  WP_PATH_FLAG_VALUE_RE,
} from '../../../scripts/lib/deploy-guards.mjs';
import { buildRemoteWpCommand } from '../../../scripts/lib/remote-discover-lib.mjs';
import { buildSnapshotRemoteCommand } from '../../../scripts/migration-snapshot.mjs';
import {
  CURSOR_AGENT_ENV_KEYS,
  UNIT_TEST_SPAWN_MESSAGE,
} from '../../../scripts/lib/remote-guard.mjs';

const CONSTRUCTOR_FILES = [
  'scripts/lib/deploy-guards.mjs',
  'scripts/lib/remote-discover-lib.mjs',
  'scripts/migration-snapshot.mjs',
  'scripts/remote-discover.mjs',
  'scripts/e2e-bootstrap.mjs',
  'scripts/staging-wp.mjs',
  'scripts/ikram-wp.mjs',
  'scripts/deploy-staging.mjs',
  'scripts/deploy-ikram.mjs',
  'tests/e2e/helpers/wp-remote.mjs',
  'tests/e2e/helpers/canary.mjs',
  'tests/e2e/helpers/safe-remote-write.mjs',
  'tests/e2e/helpers/staging-wp-meta.mjs',
  'tests/e2e/helpers/test-cleanup.mjs',
  'tests/e2e/helpers/resolve-products.mjs',
];

function expectedAbs(home, wpPath) {
  const rest = String(wpPath).replace(/^~\//, '').replace(/^\$HOME\//, '');
  return `${home.replace(/\/$/, '')}/${rest}`;
}

function extractPathFlagValues(cmd) {
  const re = new RegExp(WP_PATH_FLAG_VALUE_RE.source, 'g');
  const out = [];
  let m;
  while ((m = re.exec(String(cmd || ''))) ) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

function buildersFor(target) {
  const wp = target.wpPath;
  /** @type {Array<[string, string]>} */
  const list = [
    ['buildGuardedEvalFileCommand', buildGuardedEvalFileCommand(wp, { tmpPrefix: 'wdp-eval' })],
    ['buildGuardedEvalFileCommand:mig', buildGuardedEvalFileCommand(wp, { tmpPrefix: 'wdp-mig' })],
    ['buildGuardedEvalFileCommand:canary', buildGuardedEvalFileCommand(wp, { tmpPrefix: 'wdp-canary' })],
    ['buildGuardedEvalFileCommand:disc', buildGuardedEvalFileCommand(wp, { tmpPrefix: 'wdp-disc' })],
    ['buildGuardedEvalFileCommand:read', buildGuardedEvalFileCommand(wp, { tmpPrefix: 'wdp-read' })],
    ['buildGuardedEvalFileCommand:cleanup', buildGuardedEvalFileCommand(wp, { tmpPrefix: 'wdp-cleanup', extraArgs: 'cleanup' })],
    ['buildSnapshotRemoteCommand', buildSnapshotRemoteCommand(wp, 'YmFzZTY0')],
    ['buildRemoteWpCommand', buildRemoteWpCommand(wp, 'option get siteurl')],
    ['wpPathFlag', `wp option get siteurl ${wpPathFlag(wp)}`],
  ];
  plannedRemoteCommands(target).forEach((c, i) => {
    list.push([`plannedRemoteCommands[${i}]`, c]);
  });
  return list;
}

function claudeEnv(extra = {}) {
  const env = { ...process.env, CLAUDECODE: '1', WDP_UNIT_TEST: '1', ...extra };
  for (const k of CURSOR_AGENT_ENV_KEYS) delete env[k];
  return env;
}

describe('birim test uzak spawn yok', () => {
  it('CLAUDECODE=1 + freeze yok: snapshot --env staging shim ssh=0', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-ssh-shim-'));
    const countFile = path.join(dir, 'count');
    fs.writeFileSync(countFile, '0');
    for (const name of ['ssh', 'scp', 'sftp', 'rsync']) {
      const bin = path.join(dir, name);
      fs.writeFileSync(
        bin,
        `#!/bin/sh\necho x >> '${countFile}'\necho "shim-${name} called" >&2\nexit 1\n`,
        { mode: 0o755 }
      );
    }
    try {
      const env = claudeEnv({ PATH: `${dir}${path.delimiter}${process.env.PATH || ''}` });
      const r = spawnSync(
        'node',
        [path.join(ROOT, 'scripts/migration-snapshot.mjs'), '--env', 'staging', '--label', 'x'],
        { encoding: 'utf8', cwd: ROOT, env, timeout: 20000 }
      );
      assert.notEqual(r.status, 0);
      const msg = `${r.stderr || ''}\n${r.stdout || ''}`;
      assert.match(msg, new RegExp(`${UNIT_TEST_SPAWN_MESSAGE}|yalnız Claude|merkezi koruma|REMOTE_FREEZE|Birim testte gerçek ssh`));
      assert.doesNotMatch(msg, /This does not seem to be a WordPress/i);
      const n = fs.existsSync(countFile)
        ? String(fs.readFileSync(countFile, 'utf8')).split('\n').filter((l) => l.trim() === 'x').length
        : 0;
      assert.equal(n, 0, `ssh shim çağrıldı: ${n}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('tests/unit/js içinde --env staging|ikram spawn yalnız dry-run veya reddetme', () => {
    const files = fs.readdirSync(path.join(ROOT, 'tests/unit/js')).filter((f) => f.endsWith('.test.mjs'));
    const leak = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, 'tests/unit/js', f), 'utf8');
      if (!/spawnSync\s*\(/.test(src)) continue;
      if (/--env['"\s,]+(?:staging|ikram)/.test(src) && !/--dry-run/.test(src) && !/envNoClaude|WDP_UNIT_TEST|operatör/.test(src) && f !== 'remote-unit-isolation.test.mjs') {
        leak.push(f);
      }
    }
    assert.deepEqual(leak, []);
  });
});

describe('uzak --path ~ açılımı', () => {
  it('kurucular wpPathFlag / shellQuoteWpPath kullanır; tırnaklı ~/ yok', () => {
    for (const rel of CONSTRUCTOR_FILES) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      assert.equal(
        /--path='\$\{/.test(src),
        false,
        `${rel}: --path='\${…}' (tırnak ~'yi yutar)`
      );
    }
  });

  it('her kurucu, staging+ikram: sh -c + sahte wp --path HOME altında açılır', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-home-'));
    const binDir = path.join(home, 'bin');
    fs.mkdirSync(binDir);
    const record = path.join(home, 'wp-path.txt');
    fs.writeFileSync(
      path.join(binDir, 'wp'),
      `#!/bin/sh
: > "${record}"
for a in "$@"; do
  case "$a" in
    --path=*) printf '%s\\n' "\${a#--path=}" >> "${record}" ;;
  esac
done
exit 0
`,
      { mode: 0o755 }
    );
    const env = {
      ...process.env,
      HOME: home,
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
    };
    try {
      for (const target of ALLOWED_DEPLOY_TARGETS) {
        const want = expectedAbs(home, target.wpPath);
        const quoted = shellQuoteWpPath(target.wpPath);
        const printed = spawnSync('sh', ['-c', `printf '%s' ${quoted}`], { encoding: 'utf8', env });
        assert.equal(printed.status, 0, printed.stderr);
        assert.equal(printed.stdout, want, `${target.id} printf`);

        let checked = 0;
        for (const [name, cmd] of buildersFor(target)) {
          const flags = extractPathFlagValues(cmd);
          if (!flags.length) {
            assert.equal(/^plannedRemoteCommands/.test(name), true, `${name}: --path yok`);
            continue;
          }
          checked += flags.length;
          for (const flagVal of flags) {
            const exp = spawnSync('sh', ['-c', `printf '%s' ${flagVal}`], { encoding: 'utf8', env });
            assert.equal(exp.status, 0, `${name} printf: ${exp.stderr}`);
            assert.equal(exp.stdout, want, `${target.id} ${name} path=${flagVal}`);
          }
          const wpLine = String(cmd)
            .split('\n')
            .find((l) => /\bwp\s/.test(l));
          if (wpLine) {
            if (fs.existsSync(record)) fs.writeFileSync(record, '');
            const run = spawnSync('sh', ['-c', wpLine], { encoding: 'utf8', env });
            assert.equal(run.status, 0, `${name} sh: ${run.stderr || run.stdout}`);
            const got = fs.existsSync(record) ? fs.readFileSync(record, 'utf8').trim().split('\n').filter(Boolean) : [];
            assert.ok(got.length > 0, `${target.id} ${name}: sahte wp --path yazmadı`);
            for (const g of got) {
              assert.equal(g, want, `${target.id} ${name} wp --path=${g}`);
            }
          }
        }
        assert.ok(checked >= 10, `${target.id} az --path doğrulaması: ${checked}`);
      }
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
