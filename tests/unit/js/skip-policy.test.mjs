/**
 * Atlama politikası: bilinmeyen / altyapı gerekçe → hata.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySkipReason,
  promoteIllegalSkips,
} from '../../../tests/e2e/helpers/skip-policy.mjs';

describe('classifySkipReason', () => {
  it('bilinçli uzak sipariş / local-only atlanır', () => {
    assert.equal(
      classifySkipReason('Sipariş tamamlama atlandı (checkout-view-only; uzakta sipariş yok)'),
      'skip'
    );
    assert.equal(classifySkipReason('yalnız yerel: kısa kod liste sayfası (uzakta sayfa oluşturulmaz)'), 'skip');
  });

  it('sadaka ayar kapalı / WC id yok atlanır', () => {
    assert.equal(classifySkipReason('Atlandı — Alt bağış ekle işaretli değil'), 'skip');
    assert.equal(classifySkipReason('Atlandı — ürün ID boş ve genel varsayılan yok'), 'skip');
  });

  it('Benzer Bağışlar boş atlanır', () => {
    assert.equal(classifySkipReason('Benzer Bağışlar kartı yok (tema gizleyebilir)'), 'skip');
  });

  it('eksik sayfa yolu atlanır, açılamadı hata kalır', () => {
    assert.equal(classifySkipReason('atlandı: shop yolu yok'), 'skip');
    assert.equal(classifySkipReason('Atlandı — ürün düzenleme sayfası açılamadı (#12)'), 'fail');
  });

  it('yönetici sayfası açılamadı → hata', () => {
    assert.equal(
      classifySkipReason('Atlandı — ürün düzenleme sayfası açılamadı (#13)'),
      'fail'
    );
    assert.equal(classifySkipReason('admin okuma hata: Timeout 20000ms exceeded'), 'fail');
    assert.equal(classifySkipReason('yönetici oturumu yok path=/wp-login.php'), 'fail');
  });

  it('bilinmeyen atlama gerekçesi → hata', () => {
    assert.equal(classifySkipReason('bir şey ters gitti'), 'fail');
    assert.equal(classifySkipReason(''), 'fail');
  });
});

describe('promoteIllegalSkips', () => {
  it('altyapı atlamasını failures listesine taşır', () => {
    const skips = [
      { check: 'sadaka-fixed-popup', description: 'Atlandı — ürün düzenleme sayfası açılamadı (#13)' },
      { check: 'ok', description: 'yalnız yerel: kısa kod liste sayfası' },
    ];
    const failures = [];
    const stats = { skipped: 2, failed: 0 };
    const n = promoteIllegalSkips({
      skips,
      failures,
      stats,
      makeFailure: (row) => row,
    });
    assert.equal(n, 1);
    assert.equal(skips.length, 1);
    assert.equal(skips[0].check, 'ok');
    assert.equal(failures.length, 1);
    assert.match(failures[0].description, /Altyapı atlaması hata/);
    assert.equal(stats.skipped, 1);
    assert.equal(stats.failed, 1);
  });
});
