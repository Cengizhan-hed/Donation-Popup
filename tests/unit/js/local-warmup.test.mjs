/**
 * Yerel kanarya ısınması (v122-fouc2): Woo'nun ilk istek yazımları kanarya "önce" görüntüsünden önce biter.
 * Uzak adreste asla çalışmaz (ağ isteği atılmadan reddedilir).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WOO_WARMUP_ADMIN, WOO_WARMUP_FRONT, warmUpWooFirstRequests } from '../../e2e/helpers/matrix-setup.mjs';

describe('warmUpWooFirstRequests', () => {
  it('yalnız yerel adres: uzak/canlı/https adresler istek atılmadan reddedilir', async () => {
    for (const base of ['https://example.org', 'http://staging.example.org', 'http://10.0.0.5:8080', 'http://127.0.0.1.evil.test:80', 'http://127.0.0.1:8899/alt']) {
      await assert.rejects(() => warmUpWooFirstRequests(base), /yalnız yerel/);
    }
  });
  it('ilk istek listeleri: ön yüz (ödeme alanları) + ilk yönetici yüklemesi ve Woo ayar ekranı', () => {
    assert.ok(WOO_WARMUP_FRONT.includes('/checkout/'));
    assert.ok(WOO_WARMUP_ADMIN.includes('index.php'));
    assert.ok(WOO_WARMUP_ADMIN.includes('admin.php?page=wc-settings'));
  });
});
