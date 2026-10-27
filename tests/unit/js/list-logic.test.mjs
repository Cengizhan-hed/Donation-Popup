import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHashSlug, matchesCategory, buildExperienceUrl, shouldHandleClick } from '../../../assets/src/list/logic.mjs';

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

test('shouldHandleClick: değiştirici tuşlar varsayılan davranışta kalır', () => {
  assert.equal(shouldHandleClick({ button: 0 }), true);
  assert.equal(shouldHandleClick({ button: 0, ctrlKey: true }), false);
  assert.equal(shouldHandleClick({ button: 1 }), false);
});
