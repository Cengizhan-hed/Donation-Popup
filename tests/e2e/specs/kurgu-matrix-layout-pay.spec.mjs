/**
 * 12.3 kurgu ayrımı e2e (YALNIZ yerel WP): her düzen (popup, sağ panel, alttan panel, sayfa içi form, compact kart) ×
 * her ödeme davranışı (sepetli, doğrudan). Doğrudan = ödeme davranışı, popup/panel/alttan/sayfa içi düzenlerde aynı uç nokta:
 *  - sepetli: `POST cart/add` → ödeme sayfası, sepette 1 kalem; `direct` isteği 0.
 *  - doğrudan: `POST direct` → order-pay, sepet boş; `cart/add` isteği 0.
 * Compact kart (12.4) doğrudan ayarını UYGULAMAZ: ayar açıkken de sepetli (cart/add → ödeme sayfası, direct isteği 0).
 * (Yükseklikler: kurgu-matrix-height.spec.mjs.) Ortak yardımcılar: helpers/kurgu-matrix.mjs.
 * Eski: (sepetli = doğrudan ayarlı, en kalabalık haller dahil) yönetici tablosuyla
 * (Compact_Tools::HEIGHTS) ve serbest tutarlı kartla aynı.
 * Çalıştırma (`--spec kurgu-matrix` tüm parçaları koşar): `npm run e2e:queue -- npm run e2e:experiences -- --spec kurgu-matrix --env local`.
 */
import { test, expect } from '@playwright/test';
import { PRODUCT, LAYOUTS, BEHAVIORS, setBehavior, cart, watch, formFlow, compactFlow } from '../helpers/kurgu-matrix.mjs';

test.describe('kurgu: düzen × ödeme davranışı', () => {
  test.beforeEach(() => {
    test.skip(!Number(PRODUCT), 'test ürünü yok');
    test.setTimeout(120000);
  });

  for (const layout of LAYOUTS) {
    for (const behavior of BEHAVIORS) {
      // Compact kart doğrudan bağış ayarını yok sayar: ayar açıkken de sepetli akış (cart/add, direct isteği yok).
      const effective = layout === 'compact' ? 'cart' : behavior;
      const title = layout === 'compact' && behavior === 'direct' ? 'doğrudan açık, yine sepetli' : behavior === 'direct' ? 'doğrudan' : 'sepetli';
      test(`${layout} × ${title}`, async ({ page, baseURL }) => {
        await setBehavior(page, baseURL, behavior);
        const seen = watch(page);
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        if (layout === 'compact') {
          await compactFlow(page);
        } else {
          await formFlow(page, layout, behavior);
        }
        if (effective === 'direct') {
          expect(seen.direct).toEqual([200]);
          expect(seen.cart).toEqual([]);
          expect((await cart(page)).items).toHaveLength(0);
        } else {
          expect(seen.cart).toEqual([200]);
          expect(seen.direct).toEqual([]);
          const items = (await cart(page)).items;
          expect(items).toHaveLength(1);
          expect(items[0].id).toBe(Number(PRODUCT));
        }
        expect(errors).toEqual([]);
      });
    }
  }
});
