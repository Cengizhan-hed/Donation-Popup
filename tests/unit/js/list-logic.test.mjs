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
  shouldPrefetchAhead,
  uniqueIds,
} from '../../../assets/src/list/logic.mjs';

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
