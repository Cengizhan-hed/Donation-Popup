/**
 * Uzak sayfa/ürün çözümü: WP katalog JSON; env slug/mağaza yolu yok sayılır.
 * Ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadProfile, setActiveProfile } from '../../../tests/e2e/helpers/profile.mjs';
import { loadE2EEnv } from '../../../tests/e2e/helpers/env.mjs';
import { fillMissingProductSlugs } from '../../../tests/e2e/helpers/resolve-products.mjs';
import {
  applyRemoteCatalog,
  contentHasPluginMarker,
  inferDonationType,
  inspectEnvPageProductKeys,
  parseCatalogJson,
  pathFromMaybeUrl,
  pickListPage,
  pickRoleProducts,
} from '../../../tests/e2e/helpers/catalog-core.mjs';

function captureWarn(fn) {
  const lines = [];
  const orig = console.warn;
  const origLog = console.log;
  console.warn = (msg) => lines.push(String(msg));
  console.log = () => {};
  try {
    return { result: fn(), lines };
  } finally {
    console.warn = orig;
    console.log = origLog;
  }
}

const FAKE_CATALOG = {
  shop: { id: 12, url: 'https://staging30.hedefdernegi.org/magaza/', path: '/magaza/' },
  cart: { id: 13, url: 'https://staging30.hedefdernegi.org/sepet/', path: '/sepet/' },
  checkout: { id: 14, url: 'https://staging30.hedefdernegi.org/odeme/', path: '/odeme/' },
  list: { id: 88, url: 'https://staging30.hedefdernegi.org/bagislar/', path: '/bagislar/' },
  products: [
    {
      id: 101,
      slug: 'nafile-kurbani',
      title: 'Nafile',
      url: 'https://staging30.hedefdernegi.org/bagis/nafile-kurbani/',
      path: '/bagis/nafile-kurbani/',
      type: 'custom',
      visibility: 'visible',
      status: 'publish',
      fixture: false,
      meta: { _allow_custom_price: 'yes' },
    },
    {
      id: 102,
      slug: 'adak-kurbani',
      title: 'Adak',
      url: 'https://staging30.hedefdernegi.org/bagis/adak-kurbani/',
      path: '/bagis/adak-kurbani/',
      type: 'fixed',
      visibility: 'visible',
      status: 'publish',
      fixture: false,
    },
    {
      id: 103,
      slug: 'vacip-kurbani',
      title: 'Vacip',
      url: 'https://staging30.hedefdernegi.org/bagis/vacip-kurbani/',
      path: '/bagis/vacip-kurbani/',
      type: 'shares',
      visibility: 'visible',
      status: 'publish',
      fixture: false,
      meta: { _allow_multiple_shares: 'yes' },
    },
    {
      id: 104,
      slug: 'akika-kurbani',
      title: 'Akika',
      url: 'https://staging30.hedefdernegi.org/bagis/akika-kurbani/',
      path: '/bagis/akika-kurbani/',
      type: 'campaign',
      visibility: 'catalog',
      status: 'publish',
      fixture: false,
      meta: { _enable_progress_bar: 'yes' },
    },
    {
      id: 999,
      slug: 'gizli-fixture',
      path: '/product/gizli/',
      type: 'custom',
      visibility: 'hidden',
      status: 'private',
      fixture: true,
    },
  ],
};

describe('tip çıkarımı = eklenti kuralı', () => {
  it('shares > campaign > custom > fixed; yalnız yes', () => {
    assert.equal(inferDonationType({ _allow_multiple_shares: 'yes', _enable_progress_bar: 'yes' }), 'shares');
    assert.equal(inferDonationType({ _enable_progress_bar: 'yes', _allow_custom_price: 'yes' }), 'campaign');
    assert.equal(inferDonationType({ _allow_custom_price: 'yes' }), 'custom');
    assert.equal(inferDonationType({}), 'fixed');
    assert.equal(inferDonationType({ _allow_custom_price: 'YES' }), 'fixed');
  });
});

describe('liste sayfası işaretleri', () => {
  it('kısa kod / blok / Elementor widget', () => {
    assert.equal(contentHasPluginMarker('[wdp_donations]'), true);
    assert.equal(contentHasPluginMarker('<!-- wp:wdp/donations -->'), true);
    assert.equal(contentHasPluginMarker('widgetType":"wdp-donations"'), true);
    assert.equal(contentHasPluginMarker('hello world'), false);
  });

  it('ilk yayımlanmış sayfa; taslak yok', () => {
    const hit = pickListPage([
      { status: 'draft', content: '[wdp_donations]', path: '/eski/' },
      { status: 'publish', content: '[wdp_donations limit="6"]', path: '/bagislar/' },
    ]);
    assert.equal(hit.path, '/bagislar/');
    assert.equal(pickListPage([{ status: 'publish', content: 'yok' }]), null);
  });
});

describe('permalink yolu', () => {
  it('/product/slug tahmini yok; gerçek yol', () => {
    assert.equal(pathFromMaybeUrl('https://ornek.test/bagis/vacip-kurbani'), '/bagis/vacip-kurbani/');
    assert.equal(pathFromMaybeUrl('/magaza'), '/magaza/');
    assert.equal(pathFromMaybeUrl('vacip-kurbani'), '');
  });
});

describe('env sayfa/ürün anahtarları uzak profilde yok sayılır', () => {
  it('uyarı değer içermez', () => {
    const r = inspectEnvPageProductKeys(
      {
        E2E_SHOP_PAGE: '/woocommerce-bagis-sayfasi/',
        E2E_PRODUCT_SHARES: 'vacip-kurbani',
      },
      '.env.e2e'
    );
    assert.equal(r.present, true);
    assert.match(r.warning, /sayfa\/ürün anahtarları kullanılmıyor \(WP tek kaynak\)/);
    assert.equal(/woocommerce-bagis|vacip-kurbani/.test(r.warning), false);
  });

  it('loadE2EEnv staging: env mağaza/ürün kullanılmaz', () => {
    const { result, lines } = captureWarn(() =>
      loadE2EEnv({
        envId: 'staging',
        parsed: {
          E2E_SHOP_PAGE: '/woocommerce-bagis-sayfasi/',
          E2E_LIST_PAGE: '/eski-liste/',
          E2E_PRODUCT_SHARES: 'vacip-kurbani',
          E2E_PRODUCT_FIXED: 'adak-kurbani',
        },
      })
    );
    assert.equal(result.E2E_SHOP_PAGE, '');
    assert.equal(result.E2E_LIST_PAGE, '');
    assert.equal(result.E2E_PRODUCT_SHARES, '');
    assert.ok(lines.some((l) => /WP tek kaynak/.test(l)));
    for (const l of lines) {
      assert.equal(/woocommerce-bagis|vacip-kurbani|adak-kurbani/.test(l), false);
    }
    setActiveProfile(null);
  });
});

describe('yerel uzak-benzetim katalog', () => {
  it('env slug + eski mağaza yolu yerine WP permalink', async () => {
    const env = loadE2EEnv({
      envId: 'staging',
      parsed: {
        E2E_SHOP_PAGE: '/woocommerce-bagis-sayfasi/',
        E2E_PRODUCT_SHARES: 'vacip-kurbani',
      },
    });
    const origLog = console.log;
    console.log = () => {};
    try {
      await fillMissingProductSlugs(env, { catalog: FAKE_CATALOG });
    } finally {
      console.log = origLog;
    }
    assert.equal(env.E2E_SHOP_PAGE, '/magaza/');
    assert.equal(env.E2E_LIST_PAGE, '/bagislar/');
    assert.equal(env.E2E_CART_PAGE, '/sepet/');
    assert.equal(env.E2E_PRODUCT_SHARES, '/bagis/vacip-kurbani/');
    assert.equal(env.E2E_PRODUCT_CUSTOM, '/bagis/nafile-kurbani/');
    assert.equal(env._resolvedProducts.shares.id, 103);
    assert.equal(String(env.E2E_SHOP_PAGE).includes('woocommerce-bagis'), false);
    assert.equal(env.E2E_PRODUCT_SHARES.includes('/product/'), false);
    setActiveProfile(null);
  });

  it('liste yoksa atla (hata değil); gizli/fixture rol seçilmez', () => {
    const env = { _profile: loadProfile('staging'), _roleSkips: [], _resolvedProducts: {} };
    applyRemoteCatalog(env, {
      shop: { path: '/shop/' },
      cart: { path: '/cart/' },
      checkout: { path: '/checkout/' },
      list: null,
      products: FAKE_CATALOG.products.filter((p) => p.fixture),
    });
    assert.equal(env.E2E_LIST_PAGE, '');
    assert.ok(env._roleSkips.some((s) => s.check === 'list-page'));
    assert.equal(env.E2E_PRODUCT_CUSTOM, '');
    assert.ok(env._roleSkips.some((s) => s.check === 'role-custom'));
  });

  it('parseCatalogJson gürültülü stdout', () => {
    const cat = parseCatalogJson("Notice: x\n{\"shop\":{\"path\":\"/magaza/\"}}\n");
    assert.equal(cat.shop.path, '/magaza/');
  });

  it('pickRoleProducts catalog visibility', () => {
    const picked = pickRoleProducts(FAKE_CATALOG.products);
    assert.equal(picked.shares.path, '/bagis/vacip-kurbani/');
    assert.equal(picked.custom.id, 101);
    assert.equal(picked.campaign.type, 'campaign');
    assert.equal(Object.prototype.hasOwnProperty.call(picked, 'hidden'), false);
  });
});
