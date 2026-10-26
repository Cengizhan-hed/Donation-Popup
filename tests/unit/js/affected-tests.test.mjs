/**
 * E8Z: test:affected — örnek diff'ler için beklenen test kümeleri (gerçek ağaç, ağ yok).
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { computeAffected, loadMap, listSources, buildDependents, globToRegExp, reverseWalk } from '../../../scripts/affected-tests.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../..');
let ctx;

before(() => {
  const allFiles = listSources(ROOT);
  ctx = { map: loadMap(), dependents: buildDependents(ROOT, allFiles, { useGraph: false }), allFiles };
});

describe('glob', () => {
  it('** derin, * tek düzey', () => {
    assert.ok(globToRegExp('src/Admin/**').test('src/Admin/assets/x.php'));
    assert.ok(!globToRegExp('*.md').test('docs/a.md'));
    assert.ok(globToRegExp('*.md').test('CHANGELOG.md'));
  });
});

describe('test:affected örnek diff', () => {
  it('CSS değişikliği -> görsel kalite + axe koşucuları, PHPUnit yok', () => {
    const r = computeAffected(['assets/css/donation-modal.css'], ctx);
    assert.ok(r.e2e.has('e2e:quick') && r.e2e.has('e2e:quality'));
    assert.equal(r.phpunit.all, false);
    assert.equal(r.phpunit.files.size, 0);
  });

  it('Admin PHP -> e2e:admin-e7 + Admin PHPUnit', () => {
    const r = computeAffected(['src/Admin/class-settings-page.php'], ctx);
    assert.ok(r.e2e.has('e2e:admin-e7'));
    assert.ok(r.phpunit.files.has('tests/unit/Admin/E7AdminTest.php'));
    assert.equal(r.phpunit.all, false);
  });

  it('Privacy PHP -> Privacy PHPUnit + e2e:experiences', () => {
    const r = computeAffected(['src/Privacy/class-privacy-tools.php'], ctx);
    assert.ok(r.e2e.has('e2e:experiences'));
    assert.ok(r.phpunit.files.has('tests/unit/Privacy/PrivacyToolsTest.php'));
    assert.equal(r.phpunit.all, false);
  });

  it('haritada olmayan dosya -> güvenli varsayılan (tümü + e2e:quick)', () => {
    const r = computeAffected(['package.json'], ctx);
    assert.equal(r.phpunit.all, true);
    assert.equal(r.js.all, true);
    assert.ok(r.e2e.has('e2e:quick'));
    assert.deepEqual(r.unmapped, ['package.json']);
  });

  it('yalnız belge -> hiç test yok', () => {
    const r = computeAffected(['docs/MIMARI.md', 'CHANGELOG.md'], ctx);
    assert.equal(r.phpunit.files.size + r.js.files.size + r.e2e.size, 0);
    assert.equal(r.phpunit.all, false);
  });

  it('değişen birim testin kendisi seçilir', () => {
    const r = computeAffected(['tests/unit/Privacy/PrivacyToolsTest.php', 'tests/unit/js/e2e-queue.test.mjs'], ctx);
    assert.ok(r.phpunit.files.has('tests/unit/Privacy/PrivacyToolsTest.php'));
    assert.ok(r.js.files.has('tests/unit/js/e2e-queue.test.mjs'));
  });

  it('betik değişikliği -> yalnız bağımlı JS birim testleri', () => {
    const r = computeAffected(['scripts/e2e-queue.mjs'], ctx);
    assert.ok(r.js.files.has('tests/unit/js/e2e-queue.test.mjs'));
    assert.equal(r.phpunit.all, false);
  });

  it('ters yürüyüş derinlik sınırı kendini içerir', () => {
    const w = reverseWalk(['a'], new Map([['a', new Set(['b'])], ['b', new Set(['c'])]]), 1);
    assert.deepEqual([...w.keys()].sort(), ['a', 'b']);
  });
});
