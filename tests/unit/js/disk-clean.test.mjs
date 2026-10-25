import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildPlan, applyPlan, summarize, olderThanNewest } from '../../../scripts/lib/disk-clean.mjs';
import { classify } from '../../../scripts/lib/disk-check.mjs';
import { cleanPlaywrightOutputs } from '../../../scripts/e2e-prep.mjs';

function touch(p, ageMs, bytes = 10) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, 'x'.repeat(bytes));
  const t = new Date(Date.now() - ageMs);
  fs.utimesSync(p, t, t);
  fs.utimesSync(path.dirname(p), t, t);
}
const DAY = 86400000;

test('classify: 20/10 GB eşikleri', () => {
  assert.equal(classify(50), 0);
  assert.equal(classify(15), 10);
  assert.equal(classify(5), 20);
});

test('olderThanNewest en yeniyi korur', () => {
  const r = olderThanNewest([{ p: 'a', mtime: 1 }, { p: 'b', mtime: 3 }, { p: 'c', mtime: 2 }], 1);
  assert.deepEqual(r.map((x) => x.p), ['c', 'a']);
});

test('plan: eski çıktılar silinir, sınır dışı ve yeni olanlar kalır', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-disk-'));
  try {
    touch(path.join(root, 'build/a.zip'), 5 * DAY);
    touch(path.join(root, 'build/b.zip'), 1 * DAY);
    for (let i = 0; i < 4; i++) touch(path.join(root, `build/e2e/traces/p/t${i}.zip`), i * DAY);
    touch(path.join(root, 'build/e2e/matrix/_workers/w-8950/f'), 3 * 3600000);
    touch(path.join(root, 'build/e2e/matrix/_workers/w-8951/f'), 3 * 3600000);
    touch(path.join(root, 'build/e2e/matrix/_workers/w-8952/f'), 60000);
    touch(path.join(root, 'build/e2e/matrix/_snapshots/_base.sqlite'), 30 * DAY);
    touch(path.join(root, 'test-results/r1/f'), 0);
    const plan = buildPlan(root, { isPortBusy: (p) => p === 8951, includeWorktrees: false });
    const names = plan.map((i) => path.relative(root, i.p)).sort();
    assert.deepEqual(names, [
      'build/a.zip',
      'build/e2e/matrix/_workers/w-8950',
      'build/e2e/traces/p/t2.zip',
      'build/e2e/traces/p/t3.zip',
    ].sort());
    assert.ok(summarize(plan)['matrix-workers'].count === 1);
    // dry-run silmez
    applyPlan(root, plan, { dryRun: true });
    assert.ok(fs.existsSync(path.join(root, 'build/a.zip')));
    const { freed } = applyPlan(root, plan, { dryRun: false });
    assert.ok(freed > 0);
    assert.ok(!fs.existsSync(path.join(root, 'build/a.zip')));
    assert.ok(fs.existsSync(path.join(root, 'build/b.zip')));
    assert.ok(fs.existsSync(path.join(root, 'build/e2e/matrix/_snapshots/_base.sqlite')));
    cleanPlaywrightOutputs(root);
    assert.ok(!fs.existsSync(path.join(root, 'test-results')));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('worktree: yalnız merge edilmiş, temiz, korumasız wt-* silinir', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-wt-'));
  const root = path.join(base, 'main-repo');
  const g = (cwd, ...a) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd, stdio: 'ignore' });
  try {
    fs.mkdirSync(root);
    g(root, 'init', '-b', 'main');
    fs.writeFileSync(path.join(root, 'f'), '1');
    g(root, 'add', 'f'); g(root, 'commit', '-m', 'i');
    g(root, 'worktree', 'add', '-b', 'done', path.join(base, 'wt-done'));
    g(root, 'worktree', 'add', '-b', 'dirty', path.join(base, 'wt-dirty'));
    fs.writeFileSync(path.join(base, 'wt-dirty/new'), 'x');
    g(root, 'worktree', 'add', '-b', 'k8', path.join(base, 'wt-k8'));
    g(root, 'worktree', 'add', '-b', 'ahead', path.join(base, 'wt-ahead'));
    fs.writeFileSync(path.join(base, 'wt-ahead/a'), 'a');
    g(path.join(base, 'wt-ahead'), 'add', 'a'); g(path.join(base, 'wt-ahead'), 'commit', '-m', 'a');
    const plan = buildPlan(root, { includeWorktrees: true });
    assert.deepEqual(plan.filter((i) => i.kind === 'worktree').map((i) => path.basename(i.p)), ['wt-done']);
    applyPlan(root, plan, { dryRun: false });
    assert.ok(!fs.existsSync(path.join(base, 'wt-done')));
    assert.ok(fs.existsSync(path.join(base, 'wt-dirty')));
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
