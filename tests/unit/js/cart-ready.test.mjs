/**
 * Sepet hazır: body.woocommerce-cart + isteğe bağlı standart işaret. Dil yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';
import {
  assessWooCartReadyFromHtml,
  CART_READY_SEL,
} from '../../../tests/e2e/helpers/checks.mjs';

describe('sepet sayfası hazır (3N)', () => {
  it('Avada benzeri sahte sayfa (yalnız body sınıfı) → hazır', () => {
    const html = `<!doctype html><html><body class="woocommerce-cart woocommerce-page">
      <div class="fusion-builder-row"><div class="fusion-text">oluşturucu sepeti</div></div>
    </body></html>`;
    const r = assessWooCartReadyFromHtml(html);
    assert.equal(r.ready, true, r.error);
  });

  it('blok sepet gizli sarmalayıcı + görünür filled block → hazır', () => {
    const html = `<!doctype html><html><body class="woocommerce-cart woocommerce-page">
      <div class="wp-block-woocommerce-cart" hidden></div>
      <div class="wp-block-woocommerce-filled-cart-block"><div class="cart_item">x</div></div>
    </body></html>`;
    const r = assessWooCartReadyFromHtml(html);
    assert.equal(r.ready, true, r.error);
  });

  it('body.woocommerce-cart yok (yanlış sayfa/404) → hata', () => {
    const html = `<!doctype html><html><body class="error404 wp-singular">
      <h1>Sayfa bulunamadı</h1>
    </body></html>`;
    const r = assessWooCartReadyFromHtml(html);
    assert.equal(r.ready, false);
    assert.match(r.error, /body\.woocommerce-cart yok/);
  });

  it('dil bazlı sepet metni hazır sayılmaz', () => {
    const html = `<!doctype html><html><body class="home"><p>Your cart is currently empty</p><p>Sepetiniz</p></body></html>`;
    const r = assessWooCartReadyFromHtml(html);
    assert.equal(r.ready, false);
  });

  it('CART_READY_SEL gizli sarmalayıcıyı zorunlu tutmaz', () => {
    assert.match(CART_READY_SEL, /woocommerce-cart-form/);
    assert.match(CART_READY_SEL, /wp-block-woocommerce-filled-cart-block/);
    assert.match(CART_READY_SEL, /wp-block-woocommerce-cart:not\(\[hidden\]\)/);
  });
});

describe('yerel Woo sayfa içeriği (3N, çöp yok)', () => {
  it('matrix-ops yalnız içerik günceller; trash/delete/yeni ID yok', () => {
    const src = fs.readFileSync(path.join(ROOT, 'tests/local-wp/matrix-ops.php'), 'utf8');
    assert.match(src, /function wdp_matrix_update_woo_page_content\b/);
    assert.match(src, /function wdp_matrix_ensure_woo_core_pages\b/);
    assert.match(src, /wdp_matrix_update_woo_page_content\(\s*\$cart_id/);
    assert.match(src, /wdp_matrix_ensure_woo_core_pages\(/);
    assert.equal(/\bwp_trash_post\s*\(/.test(src), false);
    assert.equal(/\bwp_delete_post\s*\(/.test(src), false);
    assert.match(src, /wp_untrash_post/);
  });
});
