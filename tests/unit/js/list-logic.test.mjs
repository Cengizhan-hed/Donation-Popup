import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BATCH_MAX,
  buildBatchUrl,
  buildExperienceUrl,
  chunk,
  hostKey,
  matchesCategory,
  parseHashSlug,
  shouldHandleClick,
  parsePrefetchHref,
  shouldPrefetchAhead,
  trustedRestRoot,
  uniqueIds,
} from '../../../assets/src/list/logic.mjs';

test('parsePrefetchHref: yalnız aynı köken + eklenti toplu ucu, ids/kind', () => {
  const page = 'https://site.test/magaza/';
  assert.deepEqual(parsePrefetchHref('https://site.test/wp-json/donation-panel/v1/experiences?ids=15,12,12&kind=side_panel', page), {
    href: 'https://site.test/wp-json/donation-panel/v1/experiences?ids=15,12,12&kind=side_panel',
    ids: ['15', '12'],
    kind: 'side_panel',
  });
  assert.equal(parsePrefetchHref('https://site.test/?rest_route=/donation-panel/v1/experiences&ids=7&kind=popup', page).kind, 'popup');
  for (const bad of [
    'https://evil.test/wp-json/donation-panel/v1/experiences?ids=1&kind=popup',
    'https://site.test/wp-json/donation-panel/v1/experience/1?kind=popup',
    'https://site.test/wp-json/donation-panel/v1/experiences?ids=1&kind=popup&x=1',
    'https://site.test/wp-json/donation-panel/v1/experiences?ids=1&kind=inline',
    'https://site.test/wp-json/donation-panel/v1/experiences?ids=abc&kind=popup',
    'https://site.test/wp-json/wp/v2/experiences?ids=1&kind=popup',
    'javascript:alert(1)',
    '',
  ]) {
    assert.equal(parsePrefetchHref(bad, page), null, bad);
  }
});

test('trustedRestRoot: yalnız aynı köken + eklenti ad alanı (yanıt HTML olarak basılır)', () => {
  const page = 'https://site.test/bagislar/?x=1';
  assert.equal(trustedRestRoot('https://site.test/wp-json/donation-panel/v1/', page), 'https://site.test/wp-json/donation-panel/v1/');
  assert.equal(trustedRestRoot('/alt/wp-json/donation-panel/v1/', page), 'https://site.test/alt/wp-json/donation-panel/v1/');
  assert.equal(trustedRestRoot('https://site.test/?rest_route=/donation-panel/v1/', page), 'https://site.test/?rest_route=/donation-panel/v1/');
  // Reddedilenler: başka köken, şema/alt alan farkı, başka ad alanı, ek sorgu, kimlik bilgisi, parça, protokol hileleri.
  for (const bad of [
    'https://evil.test/wp-json/donation-panel/v1/',
    'http://site.test/wp-json/donation-panel/v1/',
    'https://x.site.test/wp-json/donation-panel/v1/',
    '//evil.test/wp-json/donation-panel/v1/',
    'https://site.test/wp-json/wp/v2/',
    'https://site.test/wp-json/donation-panel/v1/experience/1',
    'https://site.test/wp-json/donation-panel/v1/?redirect=https://evil.test',
    'https://site.test/?rest_route=/donation-panel/v1/&x=1',
    'https://site.test/?rest_route=/other/v1/',
    'https://u:p@site.test/wp-json/donation-panel/v1/',
    'https://site.test/wp-json/donation-panel/v1/#x',
    'javascript:alert(1)//donation-panel/v1/',
    'data:text/html,donation-panel/v1/',
    '',
    null,
  ]) {
    assert.equal(trustedRestRoot(bad, page), '', String(bad));
  }
});

test('parseHashSlug yalnız geçerli bagis- adreslerini kabul eder', () => {
  assert.equal(parseHashSlug('#bagis-kurban'), 'kurban');
  assert.equal(parseHashSlug('bagis-su_kuyusu-2'), 'su_kuyusu-2');
  assert.equal(parseHashSlug('#baska'), '');
  assert.equal(parseHashSlug('#bagis-<x>'), '');
  assert.equal(parseHashSlug(''), '');
});

test('matchesCategory: all hepsini, slug yalnız eşleşeni gösterir', () => {
  assert.equal(matchesCategory('a b', 'all'), true);
  assert.equal(matchesCategory('a b', 'b'), true);
  assert.equal(matchesCategory('a b', 'c'), false);
  assert.equal(matchesCategory('', 'c'), false);
});

test('buildExperienceUrl: güzel ve düz bağlantı yapısı', () => {
  assert.equal(
    buildExperienceUrl('https://x.test/wp-json/donation-panel/v1/', '12', 'popup'),
    'https://x.test/wp-json/donation-panel/v1/experience/12?kind=popup'
  );
  assert.equal(
    buildExperienceUrl('https://x.test/?rest_route=/donation-panel/v1/', 7, 'side_panel'),
    'https://x.test/?rest_route=/donation-panel/v1/experience/7&kind=side_panel'
  );
});

test('12.3 ön alma: toplu adres, tekrarsız kimlik, parçalama, veri tasarrufu, anahtar', () => {
  assert.equal(
    buildBatchUrl('https://x.test/wp-json/donation-panel/v1/', ['12', '13', '12', 'x', '0'], 'side_panel'),
    'https://x.test/wp-json/donation-panel/v1/experiences?ids=12,13&kind=side_panel'
  );
  assert.equal(
    buildBatchUrl('https://x.test/?rest_route=/donation-panel/v1/', [7], 'popup'),
    'https://x.test/?rest_route=/donation-panel/v1/experiences&ids=7&kind=popup'
  );
  assert.equal(buildBatchUrl('https://x.test/', ['a'], 'popup'), '');
  assert.deepEqual(uniqueIds([1, '1', ' 2 ', -3, '04x']), ['1', '2']);
  const ids = Array.from({ length: 30 }, (_, i) => String(i + 1));
  assert.deepEqual(
    chunk(ids).map((p) => p.length),
    [BATCH_MAX, BATCH_MAX, 30 - 2 * BATCH_MAX]
  );
  assert.equal(shouldPrefetchAhead(undefined), true);
  assert.equal(shouldPrefetchAhead({ effectiveType: '4g' }), true);
  assert.equal(shouldPrefetchAhead({ saveData: true, effectiveType: '4g' }), false);
  assert.equal(shouldPrefetchAhead({ effectiveType: 'slow-2g' }), false);
  assert.equal(shouldPrefetchAhead({ effectiveType: '2g' }), false);
  assert.equal(shouldPrefetchAhead({ effectiveType: '3g' }), true);
  assert.equal(hostKey('r', '5', 'popup'), hostKey('r', 5, 'popup'));
  assert.notEqual(hostKey('r', '5', 'popup'), hostKey('r', '5', 'side_panel'));
});

test('shouldHandleClick: değiştirici tuşlar varsayılan davranışta kalır', () => {
  assert.equal(shouldHandleClick({ button: 0 }), true);
  assert.equal(shouldHandleClick({ button: 0, ctrlKey: true }), false);
  assert.equal(shouldHandleClick({ button: 1 }), false);
});
