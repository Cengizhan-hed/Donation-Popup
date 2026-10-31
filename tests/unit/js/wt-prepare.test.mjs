/**
 * scripts/wt-prepare.mjs: kara liste, worktree doğrulaması, üzerine yazmama, dry-run.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isDenied, validateWorktree, buildPlan, applyPlan, expandEntry, cloneTree, scrubDenied, needsInstall, ajvMajor } from '../../../scripts/wt-prepare.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.resolve(here, '../../../scripts/wt-prepare.mjs');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wtp-'));
}
function put(root, rel, body = 'x') {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

test('kara liste: .env, .auth, pem, key, .ssh, node_modules', () => {
  for (const r of ['.env', '.env.local', 'a/.env.production', 'tests/e2e/.auth/s.json', 'x/cert.pem', 'k.KEY', 'home/.ssh/id', 'node_modules/a/b.js']) {
    assert.equal(isDenied(r), true, r);
  }
  assert.equal(isDenied('vendor/autoload.php'), false);
});

test('worktree doğrulaması: ana klasör ve kayıtsız yol reddedilir', () => {
  const root = tmp();
  const wt = tmp();
  const out = `worktree ${root}\nHEAD abc\n\nworktree ${wt}\nHEAD def\n`;
  assert.equal(validateWorktree(root, root, out).ok, false);
  assert.equal(validateWorktree(root, tmp(), out).ok, false);
  assert.equal(validateWorktree(root, wt, out).ok, true);
});

test('plan: kara listedekiler kopyalanmaz, var olana dokunulmaz, --force yazar', () => {
  const root = tmp();
  const dest = tmp();
  put(root, 'vendor/a.php', 'yeni');
  put(root, 'vendor/.env', 'gizli');
  put(root, 'vendor/k.pem', 'gizli');
  put(root, 'tests/e2e/__baseline__/.auth/s.json', 'gizli');
  put(root, 'tests/e2e/__baseline__/p.png', 'png');
  put(root, 'tools/bin/phpcs.phar', 'p');
  put(root, 'tools/bin/other.txt', 'o');
  put(dest, 'vendor/a.php', 'eski');
  const entries = ['vendor', 'tests/e2e/__baseline__', 'tools/bin/*.phar'];
  const plan = buildPlan(root, dest, { entries });
  assert.deepEqual(plan.copy.map((f) => f.rel).sort(), ['tests/e2e/__baseline__/p.png', 'tools/bin/phpcs.phar']);
  assert.equal(plan.skipped.filter((s) => s.why === 'kara liste').length, 3);
  applyPlan(root, dest, plan);
  assert.equal(fs.readFileSync(path.join(dest, 'vendor/a.php'), 'utf8'), 'eski');
  assert.equal(fs.existsSync(path.join(dest, 'vendor/.env')), false);
  assert.equal(fs.existsSync(path.join(dest, 'tests/e2e/__baseline__/.auth')), false);
  const forced = buildPlan(root, dest, { entries, force: true });
  applyPlan(root, dest, forced);
  assert.equal(fs.readFileSync(path.join(dest, 'vendor/a.php'), 'utf8'), 'yeni');
  assert.equal(fs.existsSync(path.join(dest, 'vendor/.env')), false);
});

test('expandEntry: joker yoksa boş, sembolik bağ kopyalanmaz', () => {
  const root = tmp();
  assert.deepEqual(expandEntry(root, 'tools/bin/*.phar'), []);
  put(root, 'vendor/real.php');
  fs.symlinkSync(path.join(root, 'vendor/real.php'), path.join(root, 'vendor/link.php'));
  const plan = buildPlan(root, tmp(), { entries: ['vendor'] });
  assert.deepEqual(plan.copy.map((f) => f.rel), ['vendor/real.php']);
});

test('cloneTree: ağacı kopyalar; scrubDenied kara listeyi siler', () => {
  const src = tmp();
  const dst = path.join(tmp(), 'nm');
  put(src, 'a/index.js', 'yeni');
  put(src, 'a/.env', 'x');
  put(src, 'b/cert.pem', 'x');
  put(dst, 'a/index.js', 'eski');
  const r = cloneTree(src, dst);
  assert.equal(typeof r.clone, 'boolean');
  assert.equal(fs.readFileSync(path.join(dst, 'a/index.js'), 'utf8'), 'yeni');
  assert.equal(scrubDenied(dst), 2);
  assert.equal(fs.existsSync(path.join(dst, 'a/.env')), false);
  assert.equal(fs.existsSync(path.join(dst, 'b/cert.pem')), false);
  assert.equal(fs.existsSync(path.join(dst, 'a/index.js')), true);
});

test('needsInstall: özet aynıysa atlar, farklıysa ya da node_modules yoksa kurar', () => {
  const root = tmp();
  const dest = tmp();
  put(root, 'package.json', '{"a":1}');
  put(root, 'node_modules/.package-lock.json', 'L1');
  assert.equal(needsInstall(root, dest), true);
  put(dest, 'package.json', '{"a":1}');
  put(dest, 'node_modules/.package-lock.json', 'L1');
  assert.equal(needsInstall(root, dest), false);
  put(dest, 'node_modules/.package-lock.json', 'L2');
  assert.equal(needsInstall(root, dest), true);
});

test('ajvMajor: sürümü okur, yoksa 0', () => {
  const d = tmp();
  assert.equal(ajvMajor(d), 0);
  put(d, 'node_modules/ajv/package.json', '{"version":"8.17.1"}');
  assert.equal(ajvMajor(d), 8);
});

test('CLI: hedefsiz ve ana klasör hedefi reddedilir; dry-run kopyalamaz', () => {
  assert.notEqual(spawnSync('node', [script], { encoding: 'utf8' }).status, 0);
  const mainRoot = path.resolve(here, '../../..');
  const r = spawnSync('node', [script, mainRoot, '--dry-run'], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /RED/);
});
