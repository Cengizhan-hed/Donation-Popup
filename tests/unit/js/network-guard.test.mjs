import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  isTrackerUrl,
  isRemoteOrderRequest,
  isRemoteWriteAllowed,
  isRemoteAdminWrite,
  profileReadOnlyPostActions,
  isHardDeniedRemoteAjaxAction,
  isProfileReadOnlyPostAction,
  isWdpAjaxAction,
  storeBatchAllCart,
  remotePostBlockKey,
  hostMatchesSuffix,
  isFirstPartyHost,
  pathFromMaybeUrl,
  extractAjaxAction,
  listWdpAjaxFromIncludes,
  EXPECTED_WDP_NOPRIV_AJAX,
  formatRemotePostBlockedLines,
} from '../../../tests/e2e/helpers/network-guard.mjs';
import { isRemoteProfile } from '../../../tests/e2e/helpers/profile.mjs';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';

describe('network-guard tracker eşleşmesi', () => {
  it('googletagmanager.com/gtm.js engellenir', () => {
    assert.equal(isTrackerUrl('https://www.googletagmanager.com/gtm.js?id=GTM-X'), true);
  });

  it('connect.facebook.net ve facebook.com/tr engellenir', () => {
    assert.equal(isTrackerUrl('https://connect.facebook.net/en_US/fbevents.js'), true);
    assert.equal(isTrackerUrl('https://www.facebook.com/tr?id=1'), true);
  });

  it('google analytics, doubleclick, clarity, hotjar, tiktok, linkedin engellenir', () => {
    assert.equal(isTrackerUrl('https://www.google-analytics.com/g/collect'), true);
    assert.equal(isTrackerUrl('https://analytics.google.com/g/collect'), true);
    assert.equal(isTrackerUrl('https://stats.g.doubleclick.net/g/collect'), true);
    assert.equal(isTrackerUrl('https://www.google.com/pagead/1p-user-list/123'), true);
    assert.equal(isTrackerUrl('https://www.google.com/ccm/collect'), true);
    assert.equal(isTrackerUrl('https://www.clarity.ms/tag/abc'), true);
    assert.equal(isTrackerUrl('https://static.hotjar.com/c/hotjar-1.js'), true);
    assert.equal(isTrackerUrl('https://analytics.tiktok.com/i18n/pixel/events.js'), true);
    assert.equal(isTrackerUrl('https://px.ads.linkedin.com/collect'), true);
    assert.equal(isTrackerUrl('https://pixel.wp.com/t.gif'), true);
    assert.equal(isTrackerUrl('https://cdn.matomo.cloud/x.js'), true);
  });

  it('fonts.googleapis.com ve fonts.gstatic.com engellenmez', () => {
    assert.equal(
      isTrackerUrl('https://fonts.googleapis.com/css2?family=Inter:wght@400'),
      false
    );
    assert.equal(isTrackerUrl('https://fonts.gstatic.com/s/inter/v12/x.woff2'), false);
  });

  it('google.com genel yolları ve kendi site alanı engellenmez', () => {
    assert.equal(isTrackerUrl('https://www.google.com/search?q=bagis'), false);
    assert.equal(
      isTrackerUrl('https://ornek-dernek.org/wp-content/plugins/woo-donation-popup/x.js', {
        siteHost: 'ornek-dernek.org',
      }),
      false
    );
    assert.equal(
      isTrackerUrl('https://ornek-dernek.org/matomo.php', { siteHost: 'ornek-dernek.org' }),
      false
    );
  });

  it('hostMatchesSuffix alt alanları yakalar', () => {
    assert.equal(hostMatchesSuffix('www.google-analytics.com', 'google-analytics.com'), true);
    assert.equal(hostMatchesSuffix('fonts.googleapis.com', 'google-analytics.com'), false);
    assert.equal(isFirstPartyHost('www.ornek.org', 'ornek.org'), true);
  });
});

describe('network-guard sipariş yasağı eşleşmesi', () => {
  it('POST ?wc-ajax=checkout RED', () => {
    assert.equal(
      isRemoteOrderRequest({
        method: 'POST',
        url: 'https://ornek.test/?wc-ajax=checkout',
        postData: 'a=1',
      }),
      true
    );
  });

  it('GET checkout sayfası serbest', () => {
    assert.equal(
      isRemoteOrderRequest({
        method: 'GET',
        url: 'https://ornek.test/checkout/',
      }),
      false
    );
  });

  it('POST cart/add-item serbest', () => {
    assert.equal(
      isRemoteOrderRequest({
        method: 'POST',
        url: 'https://ornek.test/wp-json/wc/store/v1/cart/add-item',
        postData: '{"id":1}',
      }),
      false
    );
  });

  it('Store API checkout POST/PUT RED; cart DELETE serbest', () => {
    assert.equal(
      isRemoteOrderRequest({
        method: 'POST',
        url: 'https://ornek.test/wp-json/wc/store/v1/checkout',
      }),
      true
    );
    assert.equal(
      isRemoteOrderRequest({
        method: 'PUT',
        url: 'https://ornek.test/wc/store/checkout',
      }),
      true
    );
    assert.equal(
      isRemoteOrderRequest({
        method: 'DELETE',
        url: 'https://ornek.test/wp-json/wc/store/v1/cart/items',
      }),
      false
    );
  });

  it('admin-ajax woocommerce_checkout ve yeni sipariş ekranı RED', () => {
    assert.equal(
      isRemoteOrderRequest({
        method: 'POST',
        url: 'https://ornek.test/wp-admin/admin-ajax.php',
        postData: 'action=woocommerce_checkout&billing_first_name=A',
      }),
      true
    );
    assert.equal(
      isRemoteOrderRequest({
        method: 'GET',
        url: 'https://ornek.test/wp-admin/post-new.php?post_type=shop_order',
      }),
      true
    );
    assert.equal(
      isRemoteOrderRequest({
        method: 'GET',
        url: 'https://ornek.test/wp-admin/admin.php?page=wc-orders&action=new',
      }),
      true
    );
  });

  it('POST /checkout/ form gönderimi RED', () => {
    assert.equal(
      isRemoteOrderRequest({
        method: 'POST',
        url: 'https://ornek.test/checkout/',
        postData: 'woocommerce_checkout_place_order=1',
        checkoutPath: '/checkout/',
      }),
      true
    );
  });
});

describe('isRemoteProfile türetme', () => {
  it('local.json kimliği yerel kalır', () => {
    assert.equal(isRemoteProfile({ id: 'local', allowedHosts: ['127.0.0.1'] }), false);
  });

  it('ssh.alias doluysa uzak', () => {
    assert.equal(isRemoteProfile({ id: 'ikram-aid', ssh: { alias: 'ikramaid' } }), true);
  });

  it('profile.remote boolean öncelikli', () => {
    assert.equal(isRemoteProfile({ id: 'local', remote: true }), true);
    assert.equal(isRemoteProfile({ id: 'staging-hedef', remote: false, ssh: { alias: 'x' } }), false);
  });

  it('allowedHosts yalnız 127.0.0.1/localhost ise yerel', () => {
    assert.equal(isRemoteProfile({ id: 'dev', allowedHosts: ['127.0.0.1', 'localhost'] }), false);
    assert.equal(isRemoteProfile({ id: 'dev', allowedHosts: ['staging30.hedefdernegi.org'] }), true);
  });
});

describe('uzak POST varsayılan-red', () => {
  const site = 'https://ornek.test';

  it('heartbeat, cartflows, wp-login, update_order_review iptal', () => {
    const blocked = [
      { method: 'POST', url: `${site}/wp-admin/admin-ajax.php`, postData: 'action=heartbeat' },
      {
        method: 'POST',
        url: `${site}/wp-admin/admin-ajax.php`,
        postData: 'action=cartflows_save_cart_abandonment_data',
      },
      { method: 'POST', url: `${site}/wp-login.php`, postData: 'log=a&pwd=b' },
      { method: 'POST', url: `${site}/?wc-ajax=update_order_review`, postData: 'post_data=x' },
      { method: 'POST', url: `${site}/?wc-ajax=apply_coupon`, postData: 'coupon_code=x' },
    ];
    for (const req of blocked) {
      assert.equal(isRemoteWriteAllowed(req), false, req.url + (req.postData || ''));
    }
  });

  it('add_to_cart, store cart, ziyaretçi wdp_nopriv geçer', () => {
    assert.equal(
      isRemoteWriteAllowed({
        method: 'POST',
        url: `${site}/?wc-ajax=add_to_cart`,
        postData: 'product_id=1',
      }),
      true
    );
    assert.equal(
      isRemoteWriteAllowed({
        method: 'POST',
        url: `${site}/wp-json/wc/store/v1/cart/add-item`,
        postData: '{"id":1}',
      }),
      true
    );
    assert.equal(
      isRemoteWriteAllowed({
        method: 'POST',
        url: `${site}/wp-admin/admin-ajax.php`,
        postData: 'action=wdp_ajax_add_to_cart&product_id=1',
      }),
      true
    );
    assert.equal(
      isRemoteWriteAllowed({
        method: 'POST',
        url: `${site}/wp-admin/admin-ajax.php`,
        postData: 'action=woocommerce_add_to_cart',
      }),
      true
    );
    assert.equal(
      isRemoteWriteAllowed({
        method: 'DELETE',
        url: `${site}/wp-json/wc/store/v1/cart/items`,
      }),
      true
    );
  });

  it('batch yalnız tüm istekler cart ise geçer', () => {
    assert.equal(
      storeBatchAllCart(
        JSON.stringify({
          requests: [{ path: '/wc/store/v1/cart/add-item', method: 'POST' }],
        })
      ),
      true
    );
    assert.equal(
      isRemoteWriteAllowed({
        method: 'POST',
        url: `${site}/wp-json/wc/store/v1/batch`,
        postData: JSON.stringify({
          requests: [
            { path: '/wc/store/v1/cart/add-item' },
            { path: '/wc/store/v1/checkout' },
          ],
        }),
      }),
      false
    );
  });

  it('sepet formu update_cart/remove_item; checkoutPath tam URL', () => {
    assert.equal(
      isRemoteWriteAllowed({
        method: 'POST',
        url: `${site}/cart/`,
        postData: 'update_cart=1&cart[abc][qty]=0',
        cartPath: '/cart/',
      }),
      true
    );
    assert.equal(
      isRemoteWriteAllowed({
        method: 'POST',
        url: `${site}/sepet/`,
        postData: 'remove_item=abc',
        cartPath: 'https://ornek.test/sepet/',
      }),
      true
    );
    assert.equal(pathFromMaybeUrl('https://ornek.test/odeme/', '/checkout/'), '/odeme');
    assert.equal(
      isRemoteOrderRequest({
        method: 'POST',
        url: `${site}/odeme/`,
        postData: 'woocommerce_checkout_place_order=1',
        checkoutPath: 'https://ornek.test/odeme/',
      }),
      true
    );
  });

  it('remote_post_blocked anahtarı sorgu dizesi yazmaz, action serbest', () => {
    const key = remotePostBlockKey(
      `${site}/wp-admin/admin-ajax.php?action=heartbeat&uid=9`,
      'action=heartbeat'
    );
    assert.equal(key.includes('uid='), false);
    assert.match(key, /action=heartbeat/);
    assert.equal(key.includes('?'), false);
  });

  it('includes/ nopriv listesi tam ve yönetici uçları uzakta RED', () => {
    const { nopriv, adminOnly } = listWdpAjaxFromIncludes(path.join(ROOT, 'includes'));
    assert.deepEqual(nopriv, [...EXPECTED_WDP_NOPRIV_AJAX]);
    for (const n of EXPECTED_WDP_NOPRIV_AJAX) {
      assert.equal(isWdpAjaxAction(n), true, n);
      assert.equal(
        isRemoteWriteAllowed({
          method: 'POST',
          url: `${site}/wp-admin/admin-ajax.php`,
          postData: `action=${n}`,
        }),
        true,
        n
      );
      assert.equal(
        isRemoteAdminWrite({
          method: 'POST',
          url: `${site}/wp-admin/admin-ajax.php`,
          postData: `action=${n}`,
        }),
        false,
        n
      );
    }
    const mustBlock = [
      'wdp_save_placement_settings',
      'wdp_apply_style_preset',
      'wdp_import_style_preset',
      'wdp_export_style_preset',
      'wdp_recalculate_product_total',
      'wdp_elementor_search_products',
    ];
    for (const n of mustBlock) {
      assert.ok(adminOnly.includes(n), n);
      assert.equal(
        isRemoteWriteAllowed({
          method: 'POST',
          url: `${site}/wp-admin/admin-ajax.php`,
          postData: `action=${n}`,
        }),
        false,
        n
      );
      assert.equal(
        isRemoteAdminWrite({
          method: 'POST',
          url: `${site}/wp-admin/admin-ajax.php`,
          postData: `action=${n}`,
        }),
        true,
        n
      );
    }
    for (const n of adminOnly) {
      assert.equal(
        isRemoteWriteAllowed({
          method: 'POST',
          url: `${site}/wp-admin/admin-ajax.php`,
          postData: `action=${n}`,
        }),
        false,
        `admin ${n}`
      );
    }
  });
});

function webkitMultipart(action, extra = {}) {
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const fields = { action, ...extra };
  const parts = Object.entries(fields).map(
    ([k, v]) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
  );
  return {
    body: `${parts.join('')}--${boundary}--\r\n`,
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

describe('extractAjaxAction dört gövde türü', () => {
  const ajax = 'https://ornek.test/wp-admin/admin-ajax.php';

  it('kök neden: URLSearchParams multipart action okuyamaz', () => {
    const { body, headers } = webkitMultipart('wdp_get_product_info', { product_id: '9' });
    assert.equal(new URLSearchParams(body).get('action'), null);
    assert.equal(
      extractAjaxAction({ url: ajax, postData: body, headers }),
      'wdp_get_product_info'
    );
    assert.equal(
      isRemoteWriteAllowed({ method: 'POST', url: ajax, postData: body, headers }),
      true
    );
  });

  it('application/x-www-form-urlencoded', () => {
    assert.equal(
      extractAjaxAction({
        url: ajax,
        postData: 'action=wdp_render_modal&product_id=1',
        headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      }),
      'wdp_render_modal'
    );
  });

  it('application/json', () => {
    assert.equal(
      extractAjaxAction({
        url: ajax,
        postData: JSON.stringify({ action: 'wdp_get_cart_count', product_id: 3 }),
        headers: { 'content-type': 'application/json' },
      }),
      'wdp_get_cart_count'
    );
  });

  it('query string action', () => {
    assert.equal(
      extractAjaxAction({
        url: `${ajax}?action=wdp_get_fresh_nonces`,
        postData: '',
      }),
      'wdp_get_fresh_nonces'
    );
  });

  it('multipart yönetici uç RED + remote_post_blocked anahtarı action yazar', () => {
    const { body, headers } = webkitMultipart('wdp_save_placement_settings');
    assert.equal(
      isRemoteWriteAllowed({ method: 'POST', url: ajax, postData: body, headers }),
      false
    );
    assert.equal(
      isRemoteAdminWrite({ method: 'POST', url: ajax, postData: body, headers }),
      true
    );
    const key = remotePostBlockKey(ajax, body, headers);
    assert.match(key, /action=wdp_save_placement_settings/);
    assert.equal(key.includes('?'), false);
  });

  it('formatRemotePostBlockedLines 0 iken de yazar', () => {
    assert.equal(formatRemotePostBlockedLines({ total: 0, byPath: {} }), 'remote_post_blocked: 0');
    assert.match(
      formatRemotePostBlockedLines({
        total: 2,
        byPath: { '/wp-admin/admin-ajax.php action=heartbeat': 2 },
      }),
      /remote_post_blocked: 2/
    );
  });
});

describe('profil remoteReadOnlyPostActions', () => {
  const site = 'https://ornek.test';
  const stagingExtra = profileReadOnlyPostActions({
    remoteReadOnlyPostActions: [
      'wmc_get_products_price',
      'hdf_side_cart_v8_get',
      'fusion_get_webfonts_ajax',
    ],
  });

  it('staging okuma uçları geçer; sayaç yazan RED', () => {
    for (const action of stagingExtra) {
      assert.equal(
        isRemoteWriteAllowed({
          method: 'POST',
          url: `${site}/wp-admin/admin-ajax.php`,
          postData: `action=${action}`,
          readOnlyActions: stagingExtra,
        }),
        true,
        action
      );
    }
    assert.equal(
      isRemoteWriteAllowed({
        method: 'POST',
        url: `${site}/wp-admin/admin-ajax.php`,
        postData: 'action=fusion_form_update_view',
        readOnlyActions: stagingExtra,
      }),
      false
    );
  });

  it('yönetici wdp ve sipariş profil listesinde olsa RED', () => {
    const poisoned = [
      ...stagingExtra,
      'wdp_save_placement_settings',
      'woocommerce_checkout',
    ];
    assert.equal(isHardDeniedRemoteAjaxAction('wdp_save_placement_settings'), true);
    assert.equal(isProfileReadOnlyPostAction('wdp_save_placement_settings', poisoned), false);
    assert.equal(
      isRemoteWriteAllowed({
        method: 'POST',
        url: `${site}/wp-admin/admin-ajax.php`,
        postData: 'action=wdp_save_placement_settings',
        readOnlyActions: poisoned,
      }),
      false
    );
    assert.equal(
      isRemoteWriteAllowed({
        method: 'POST',
        url: `${site}/wp-admin/admin-ajax.php`,
        postData: 'action=woocommerce_checkout',
        readOnlyActions: poisoned,
      }),
      false
    );
    assert.equal(
      formatRemotePostBlockedLines({ total: 0, byPath: {} }, { total: 3, byAction: { wmc_get_products_price: 3 } }),
      'remote_post_blocked: 0\nizinli-okuma: 3\n  • wmc_get_products_price  3'
    );
  });
});
