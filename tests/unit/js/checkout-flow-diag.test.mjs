/**
 * checkout-flow teşhis sınıflandırıcı + güvenli JSON (sorgu/gövde/çerez değeri yok).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCheckoutNavFailure,
  buildCheckoutFlowDebugPayload,
  urlPathnameOnly,
  extractAjaxCheckoutPathname,
  extractAjaxSuccessFlag,
  isWooSessionCookieName,
  isWooCartPath,
  isWooCheckoutPath,
  isDonationAddToCartRequest,
} from '../../../tests/e2e/helpers/checks.mjs';

function mockReq(opts) {
  return {
    method: () => opts.method || 'POST',
    url: () => opts.url || '',
    postData: () => opts.postData || '',
  };
}

describe('urlPathnameOnly / yollar', () => {
  it('sorgu ve hash düşer', () => {
    assert.equal(
      urlPathnameOnly('https://shop.test/odeme-sayfasi/?key=secret#x'),
      '/odeme-sayfasi/'
    );
    assert.equal(urlPathnameOnly('/sepet/?removed_item=1'), '/sepet/');
    assert.equal(urlPathnameOnly(''), '');
  });

  it('sepet / ödeme pathname', () => {
    assert.equal(isWooCartPath('/sepet/'), true);
    assert.equal(isWooCartPath('/cart'), true);
    assert.equal(isWooCartPath('/odeme-sayfasi/'), false);
    assert.equal(isWooCheckoutPath('/odeme-sayfasi/'), true);
    assert.equal(isWooCheckoutPath('/checkout/'), true);
    assert.equal(isWooCheckoutPath('/sepet/'), false);
  });
});

describe('AJAX checkout_url pathname (gövde saklanmaz)', () => {
  it('WP json_success data.checkout_url', () => {
    const text = JSON.stringify({
      success: true,
      data: {
        checkout_url: 'https://shop.test/odeme-sayfasi/?utm=x',
        items: [{ name: 'KİŞİSEL' }],
      },
    });
    assert.equal(extractAjaxCheckoutPathname(text), '/odeme-sayfasi/');
    assert.equal(extractAjaxSuccessFlag(text, false), true);
  });

  it('success=false ve bozuk JSON', () => {
    assert.equal(extractAjaxSuccessFlag(JSON.stringify({ success: false }), true), false);
    assert.equal(extractAjaxCheckoutPathname('not-json'), '');
    assert.equal(extractAjaxSuccessFlag('<html>', true), true);
  });
});

describe('Woo oturum çerez adı', () => {
  it('yalnız ad eşleşmesi', () => {
    assert.equal(isWooSessionCookieName('wp_woocommerce_session_abc123'), true);
    assert.equal(isWooSessionCookieName('woocommerce_items_in_cart'), true);
    assert.equal(isWooSessionCookieName('wordpress_logged_in_xx'), false);
    assert.equal(isWooSessionCookieName('woocommerce_cart_hash'), false);
  });
});

describe('isDonationAddToCartRequest', () => {
  it('wdp_ajax_add_to_cart ve wc-ajax add_to_cart', () => {
    assert.equal(
      isDonationAddToCartRequest(
        mockReq({
          url: 'https://shop.test/wp-admin/admin-ajax.php',
          postData: 'action=wdp_ajax_add_to_cart&product_id=1',
        })
      ),
      true
    );
    assert.equal(
      isDonationAddToCartRequest(
        mockReq({ url: 'https://shop.test/?wc-ajax=add_to_cart', postData: 'product_id=1' })
      ),
      true
    );
    assert.equal(
      isDonationAddToCartRequest(
        mockReq({ url: 'https://shop.test/?wc-ajax=get_refreshed_fragments', postData: '' })
      ),
      false
    );
  });
});

describe('classifyCheckoutNavFailure', () => {
  it('tıklama-gezinmedi: aynı sayfada kaldı', () => {
    assert.equal(
      classifyCheckoutNavFailure({
        items_count: 0,
        navigated: false,
        click_pathname: '/bagis-listesi/',
        final_pathname: '/bagis-listesi/',
        wdp_ajax_checkout_pathname: '/odeme-sayfasi/',
        redirects: [],
      }),
      'tıklama-gezinmedi'
    );
  });

  it('eklenti-checkout-url-yanlış: wdp_ajax veya AJAX sepet yolu', () => {
    assert.equal(
      classifyCheckoutNavFailure({
        items_count: 1,
        navigated: true,
        final_pathname: '/sepet/',
        wdp_ajax_checkout_pathname: '/sepet/',
        add_to_cart: { checkout_url_pathname: '/odeme-sayfasi/' },
      }),
      'eklenti-checkout-url-yanlış'
    );
    assert.equal(
      classifyCheckoutNavFailure({
        items_count: 1,
        navigated: true,
        final_pathname: '/cart/',
        wdp_ajax_checkout_pathname: '/checkout/',
        add_to_cart: { checkout_url_pathname: '/cart/' },
      }),
      'eklenti-checkout-url-yanlış'
    );
  });

  it('sepet-boş-yönlendirme: items_count 0', () => {
    assert.equal(
      classifyCheckoutNavFailure({
        items_count: 0,
        navigated: true,
        final_pathname: '/sepet/',
        wdp_ajax_checkout_pathname: '/odeme-sayfasi/',
        add_to_cart: { checkout_url_pathname: '/odeme-sayfasi/' },
        redirects: [{ from: '/odeme-sayfasi/', to: '/sepet/', status: 302 }],
      }),
      'sepet-boş-yönlendirme'
    );
  });

  it('tema-yönlendirmesi: 3xx ödeme→sepet ve items>0', () => {
    assert.equal(
      classifyCheckoutNavFailure({
        items_count: 1,
        navigated: true,
        final_pathname: '/sepet/',
        wdp_ajax_checkout_pathname: '/odeme-sayfasi/',
        add_to_cart: { checkout_url_pathname: '/odeme-sayfasi/' },
        redirects: [{ from: '/odeme-sayfasi/', to: '/sepet/', status: 302 }],
      }),
      'tema-yönlendirmesi'
    );
  });
});

describe('buildCheckoutFlowDebugPayload', () => {
  it('sorgu, gövde ve çerez değeri yazılmaz', () => {
    const payload = buildCheckoutFlowDebugPayload({
      device: 'iphone',
      add_to_cart: {
        action: 'wdp_ajax_add_to_cart',
        endpoint: '/wp-admin/admin-ajax.php?foo=1',
        status: 200,
        success: true,
        checkout_url_pathname: 'https://shop.test/odeme-sayfasi/?utm=leak',
        body: '{"donor":"A"}',
      },
      items_count_before_click: 0,
      items_count: 0,
      redirects: [{ from: '/odeme-sayfasi/?x=1', to: '/sepet/?removed=1', status: 302 }],
      final_pathname: '/sepet/?foo=bar',
      expected_checkout_pathname: '/odeme-sayfasi/',
      cookies: {
        wp_woocommerce_session: true,
        woocommerce_items_in_cart: false,
        value: 'SECRET',
      },
      wdp_ajax_checkout_pathname: 'https://shop.test/odeme-sayfasi/?sid=9',
      navigated: true,
      class: 'sepet-boş-yönlendirme',
      query: '?email=a@b.c',
      body: '<html>kişi</html>',
    });
    const json = JSON.stringify(payload);
    assert.equal(payload.add_to_cart.endpoint, '/wp-admin/admin-ajax.php');
    assert.equal(payload.add_to_cart.checkout_url_pathname, '/odeme-sayfasi/');
    assert.equal(payload.redirects[0].from, '/odeme-sayfasi/');
    assert.equal(payload.redirects[0].to, '/sepet/');
    assert.equal(payload.final_pathname, '/sepet/');
    assert.equal(payload.wdp_ajax_checkout_pathname, '/odeme-sayfasi/');
    assert.equal(payload.cookies.wp_woocommerce_session, true);
    assert.equal(payload.cookies.woocommerce_items_in_cart, false);
    assert.equal(payload.class, 'sepet-boş-yönlendirme');
    assert.equal('body' in payload, false);
    assert.equal('query' in payload, false);
    assert.equal('value' in payload.cookies, false);
    assert.equal('body' in payload.add_to_cart, false);
    assert.doesNotMatch(json, /SECRET|donor|email=|utm=leak|sid=9|foo=bar|\?x=1/);
  });

  it('cta_ready / script / tıklama / ağ / konsol genişletmesi; sorgu yok', () => {
    const payload = buildCheckoutFlowDebugPayload({
      device: 'android',
      class: 'sepet-boş-yönlendirme',
      cta_ready: { form_ready: false, await_js: '1', disabled: true, has_gate: true, queued: false },
      plugin: {
        scripts: [
          {
            id: 'wdp-form-cta-ready-js',
            src: 'https://shop.test/wp-content/plugins/woo-donation-popup/assets/js/src/form/cta-ready.js?ver=10.34.12&foo=1',
          },
        ],
        cta_ready_script: true,
        main_bundle: false,
        possibly_combined: false,
        has_wdp_app: true,
        has_submit_handler: false,
      },
      click_target: {
        tag: 'BUTTON',
        role: 'button',
        name: 'donation_go_checkout',
        visible: true,
        disabled: true,
        loading: true,
        is_go_checkout: true,
        overlay: { tag: 'DIV', className: 'fusion-tb-header', is_self: false },
      },
      network_after_click: [
        {
          method: 'POST',
          url: 'https://shop.test/wp-admin/admin-ajax.php?secret=1',
          action: 'wdp_get_product_info',
          status: 200,
        },
      ],
      console_errors: ['Failed to load https://shop.test/x.js?token=abc'],
      png_before: '/tmp/checkout-flow-android-before.png',
      png_after: '/tmp/checkout-flow-android-after.png',
    });
    const json = JSON.stringify(payload);
    assert.equal(payload.cta_ready.form_ready, false);
    assert.equal(payload.cta_ready.await_js, '1');
    assert.equal(payload.plugin.cta_ready_script, true);
    assert.equal(payload.plugin.scripts[0].pathname.endsWith('/cta-ready.js'), true);
    assert.equal(payload.plugin.scripts[0].ver, '10.34.12');
    assert.equal(payload.click_target.is_go_checkout, true);
    assert.equal(payload.click_target.overlay.is_self, false);
    assert.equal(payload.network_after_click[0].pathname, '/wp-admin/admin-ajax.php');
    assert.equal(payload.network_after_click[0].action, 'wdp_get_product_info');
    assert.equal(payload.png_before, 'checkout-flow-android-before.png');
    assert.match(payload.console_errors[0], /\/x\.js/);
    assert.doesNotMatch(json, /secret=1|token=abc|foo=1|\?ver=/);
  });
});
