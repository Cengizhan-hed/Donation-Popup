import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isTrackerUrl,
  isRemoteOrderRequest,
  isRemoteWriteAllowed,
  isWdpAjaxAction,
  storeBatchAllCart,
  remotePostBlockKey,
  hostMatchesSuffix,
  isFirstPartyHost,
  pathFromMaybeUrl,
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

  it('add_to_cart, store cart, wdp_* geçer', () => {
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

  it('includes/ içindeki wdp_ ajax adları izinli önekle eşleşir', () => {
    const inc = path.join(ROOT, 'includes');
    const files = fs.readdirSync(inc).filter((f) => f.endsWith('.php'));
    const names = new Set();
    for (const f of files) {
      const src = fs.readFileSync(path.join(inc, f), 'utf8');
      const re = /wp_ajax(?:_nopriv)?_(wdp_[a-z0-9_]+)/gi;
      let m;
      while ((m = re.exec(src))) names.add(m[1]);
    }
    assert.ok(names.has('wdp_ajax_add_to_cart'));
    assert.ok(names.has('wdp_render_modal'));
    for (const n of names) {
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
    }
  });
});
