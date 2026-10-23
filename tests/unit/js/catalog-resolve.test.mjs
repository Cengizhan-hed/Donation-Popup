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
  navTargetFromUrl,
  isBareHomeNav,
  assertProductNavTarget,
  pickFixtureNavTarget,
  decideScenarioProduct,
  SCENARIO_PRODUCT_POLICY,
  productNavPath,
  resolvePopupSource,
  popupPagePath,
} from '../../../tests/e2e/helpers/catalog-core.mjs';
import {
  formatCatalogExplainMarkdown,
  parseCatalogExplainArgv,
  createRemoteCatalogExplainRunner,
  CATALOG_EVAL_FILE,
  CATALOG_EXPLAIN_ARG,
  CATALOG_EXPLAIN_ENV,
} from '../../../scripts/e2e-catalog-explain.mjs';
import { overlayFixtureRoles } from '../../../tests/e2e/helpers/resolve-products.mjs';

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
      display: 'button_panel',
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

describe('senaryo ürün politikası', () => {
  it('üç grup tabloda; kinds boş değil', () => {
    assert.equal(SCENARIO_PRODUCT_POLICY['visitor-list-shop'].source, 'published-only');
    assert.equal(SCENARIO_PRODUCT_POLICY['product-form-panel-cart'].ifMissing, 'fixture-admin');
    assert.equal(SCENARIO_PRODUCT_POLICY.popup.ifMissing, 'skip');
    assert.equal(SCENARIO_PRODUCT_POLICY.popup.source, 'list-or-shop-loop');
    assert.ok(SCENARIO_PRODUCT_POLICY['visitor-list-shop'].kinds.includes('loop-donate'));
    assert.ok(SCENARIO_PRODUCT_POLICY['product-form-panel-cart'].kinds.includes('panel'));
    assert.ok(SCENARIO_PRODUCT_POLICY.popup.kinds.includes('popup'));
  });
});

describe('fixture nav hedefi (private permalink)', () => {
  const privateUrl = 'https://ikramaid.uk/?post_type=product&p=915';

  it('sorgu dizesi korunur; path "/" ana sayfa sayılmaz', () => {
    assert.equal(navTargetFromUrl(privateUrl), '/?post_type=product&p=915');
    assert.equal(isBareHomeNav(privateUrl), false);
    assert.equal(isBareHomeNav('/'), true);
    assert.equal(isBareHomeNav('https://ikramaid.uk/'), true);
    assert.equal(isBareHomeNav('/?post_type=product&p=915'), false);
    assert.equal(productNavPath(privateUrl), '/?post_type=product&p=915');
    assert.notEqual(productNavPath(privateUrl), '/');
  });

  it('path "/" ise tam URL veya ?p=; ana sayfa hata', () => {
    assert.equal(
      pickFixtureNavTarget({ id: 915, path: '/', url: privateUrl }),
      privateUrl
    );
    assert.equal(
      pickFixtureNavTarget({ id: 916, path: '/', url: 'https://ikramaid.uk/' }),
      '/?post_type=product&p=916'
    );
    assert.equal(pickFixtureNavTarget({ id: 915, path: '/' }), '/?post_type=product&p=915');
    assert.throws(() => assertProductNavTarget('/'), /ana sayfa/);
    assert.throws(() => assertProductNavTarget('https://ikramaid.uk/'), /ana sayfa/);
    assert.equal(assertProductNavTarget(privateUrl), privateUrl);
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
      await fillMissingProductSlugs(env, { catalog: FAKE_CATALOG, fixtures: null });
    } finally {
      console.log = origLog;
    }
    assert.equal(env.E2E_SHOP_PAGE, '/magaza/');
    assert.equal(env.E2E_LIST_PAGE, '/bagislar/');
    assert.equal(env.E2E_CART_PAGE, '/sepet/');
    assert.equal(env.E2E_PRODUCT_SHARES, '/bagis/vacip-kurbani/');
    assert.equal(env.E2E_PRODUCT_CUSTOM, '/bagis/nafile-kurbani/');
    assert.equal(env._resolvedProducts.custom.display, 'button_panel');
    assert.equal(env._resolvedProducts.shares.id, 103);
    assert.equal(String(env.E2E_SHOP_PAGE).includes('woocommerce-bagis'), false);
    assert.equal(env.E2E_PRODUCT_SHARES.includes('/product/'), false);
    setActiveProfile(null);
  });

  it('liste yok + mağaza var → popup mağaza döngüsü; ikisi yok → atla', () => {
    const env = { _profile: loadProfile('staging'), _roleSkips: [], _resolvedProducts: {} };
    applyRemoteCatalog(env, {
      shop: { path: '/bagislar/' },
      cart: { path: '/sepet/' },
      checkout: { path: '/odeme/' },
      list: null,
      products: FAKE_CATALOG.products.filter((p) => !p.fixture),
    });
    assert.equal(env.E2E_LIST_PAGE, '');
    assert.ok(env._roleSkips.some((s) => s.check === 'list-page'));
    const src = resolvePopupSource(env);
    assert.equal(src.action, 'run');
    assert.equal(src.source, 'shop');
    assert.equal(src.path, '/bagislar/');
    const d = decideScenarioProduct(env, 'fixed', 'popup');
    assert.equal(d.action, 'run-visitor');
    assert.equal(d.popupSource, 'shop');
    assert.equal(d.pagePath, '/bagislar/');
    assert.equal(popupPagePath(env), '/bagislar/');
    assert.equal(env._roleSkips.some((s) => s.check === 'popup-source'), false);

    const empty = { _profile: loadProfile('staging'), _roleSkips: [], _resolvedProducts: {} };
    applyRemoteCatalog(empty, {
      shop: { path: '' },
      cart: { path: '/cart/' },
      checkout: { path: '/checkout/' },
      list: null,
      products: FAKE_CATALOG.products.filter((p) => !p.fixture),
    });
    const skip = decideScenarioProduct(empty, 'custom', 'popup');
    assert.equal(skip.action, 'skip');
    assert.match(skip.reason, /mağaza|liste/);
    assert.ok(empty._roleSkips.some((s) => s.check === 'popup-source'));
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

  it('Ikram: private fixture path "/" → tam URL; liste atlanır, panel yönetici', async () => {
    const env = loadE2EEnv({ envId: 'ikram', parsed: {} });
    const catalog = {
      shop: { path: '/shop/' },
      cart: { path: '/cart/' },
      checkout: { path: '/checkout/' },
      list: { path: '/donations/' },
      products: FAKE_CATALOG.products.filter((p) => p.type === 'custom' || p.type === 'fixed'),
    };
    const fixtures = {
      roles: {
        shares: {
          id: 915,
          name: 'WDP E2E Shares',
          slug: 'wdp-e2e-shares',
          path: '/',
          url: 'https://ikramaid.uk/?post_type=product&p=915',
        },
        campaign: {
          id: 916,
          name: 'WDP E2E Campaign',
          slug: 'wdp-e2e-campaign',
          path: '/',
          url: 'https://ikramaid.uk/?post_type=product&p=916',
        },
      },
    };
    const origLog = console.log;
    console.log = () => {};
    try {
      await fillMissingProductSlugs(env, { catalog, fixtures });
    } finally {
      console.log = origLog;
    }
    assert.equal(env.E2E_PRODUCT_SHARES, 'https://ikramaid.uk/?post_type=product&p=915');
    assert.equal(env.E2E_PRODUCT_CAMPAIGN, 'https://ikramaid.uk/?post_type=product&p=916');
    assert.notEqual(env.E2E_PRODUCT_SHARES, '/');
    assert.equal(env._resolvedProducts.shares.fromFixture, true);
    assert.equal(env._resolvedProducts.shares.id, 915);
    assert.equal(env._fixtureRoles.includes('shares'), true);
    assert.equal(env._roleSkips.some((s) => s.check === 'role-shares'), false);
    assert.ok(env._roleSkips.some((s) => s.check === 'loop-donate-shop-shares'));
    assert.ok(env._roleSkips.some((s) => s.check === 'loop-donate-list-shares'));
    assert.ok(env._roleSkips.some((s) => s.check === 'popup-shares'));
    assert.ok(env._roleSkips.some((s) => s.check === 'popup-campaign'));
    assert.equal(decideScenarioProduct(env, 'shares', 'loop-donate').action, 'skip');
    assert.equal(decideScenarioProduct(env, 'shares', 'popup').action, 'skip');
    assert.equal(decideScenarioProduct(env, 'shares', 'panel').action, 'run-admin');
    assert.equal(decideScenarioProduct(env, 'shares', 'product-page').admin, true);
    assert.equal(decideScenarioProduct(env, 'custom', 'loop-donate').action, 'run-visitor');
    assert.equal(decideScenarioProduct(env, 'custom', 'popup').action, 'run-visitor');
    overlayFixtureRoles(env, fixtures);
    assert.equal(env._roleSkips.filter((s) => s.check === 'popup-shares').length, 1);
    setActiveProfile(null);
  });

  it('yerel yayımlanmış fixture loop/popup koşar (private skip yok)', () => {
    const env = {
      _profile: { id: 'local', allowedHosts: ['127.0.0.1'] },
      _resolvedProducts: {},
      _roleSkips: [],
      _fixtureRoles: [],
      E2E_LIST_PAGE: '/wdp-e2e-list/',
    };
    overlayFixtureRoles(env, {
      roles: {
        shares: {
          id: 17,
          name: 'WDP E2E Shares',
          slug: 'wdp-e2e-shares',
          path: '/?post_type=product&p=17',
          url: 'http://127.0.0.1:8899/?post_type=product&p=17',
          published: true,
          catalogVisible: true,
          status: 'publish',
        },
      },
    });
    assert.equal(env._resolvedProducts.shares.fromFixture, true);
    assert.equal(env._resolvedProducts.shares.fromCatalog, true);
    assert.equal(decideScenarioProduct(env, 'shares', 'loop-donate').action, 'run-visitor');
    assert.equal(decideScenarioProduct(env, 'shares', 'popup').action, 'run-visitor');
    assert.equal(decideScenarioProduct(env, 'shares', 'panel').action, 'run-visitor');
    assert.equal(env._roleSkips.some((s) => /popup-shares|loop-donate/.test(s.check)), false);
  });
});

describe('katalog --explain raporu', () => {
  it('ürün adı var; müşteri/sipariş ve meta değeri yok', () => {
    const md = formatCatalogExplainMarkdown({
      profileId: 'staging-hedef',
      resolver: 'WDP_Donation_Type::for_product',
      plugin_loaded: true,
      shop: { path: '/bagislar/' },
      list: null,
      publishedCount: 2,
      pickedCount: 1,
      picked: [{ id: 101, type: 'fixed', title: 'Adak Kurbanı', path: '/bagislar/adak-kurbani/' }],
      published: [
        {
          id: 101,
          title: 'Adak Kurbanı',
          status: 'publish',
          visibility: 'visible',
          purchasable: true,
          wc_type: 'simple',
          donation: true,
          fixture: false,
          type: 'fixed',
          flags: {
            _allow_multiple_shares: 'kapalı',
            _enable_progress_bar: 'kapalı',
            _allow_custom_price: 'kapalı',
          },
          why: 'WDP_Donation_Type::for_product; öncelik shares→campaign→custom→fixed; _allow_multiple_shares=kapalı; sonuç=fixed',
        },
        {
          id: 103,
          title: 'Vacip Kurbanı',
          status: 'publish',
          visibility: 'visible',
          purchasable: true,
          wc_type: 'simple',
          donation: true,
          fixture: false,
          type: 'shares',
          flags: { _allow_multiple_shares: 'açık' },
        },
      ],
    });
    assert.match(md, /Adak Kurbanı/);
    assert.match(md, /Vacip Kurbanı/);
    assert.match(md, /WDP_Donation_Type::for_product/);
    assert.match(md, /_allow_multiple_shares=açık/);
    assert.equal(/@/.test(md), false);
    assert.equal(/\byes\b/.test(md), false);
    assert.equal(/order_id|customer_email|billing_/i.test(md), false);
  });

  it('argv --env staging; sahte spawn ssh atmaz', () => {
    assert.equal(parseCatalogExplainArgv(['--env', 'staging']).envName, 'staging');
    assert.equal(parseCatalogExplainArgv(['--env=ikram']).envName, 'ikram');
    let n = 0;
    const runner = createRemoteCatalogExplainRunner({
      spawn: (bin, args) => {
        n += 1;
        assert.equal(bin, 'ssh');
        const cmd = String(args[args.length - 1] || '');
        assert.doesNotMatch(cmd, /eval-file "\$TMP" --explain(\s|$)/);
        assert.match(cmd, new RegExp(`eval-file "\\$TMP" ${CATALOG_EXPLAIN_ARG}`));
        assert.match(cmd, new RegExp(`${CATALOG_EXPLAIN_ENV}='1'`));
        return {
          status: 0,
          stdout: JSON.stringify({ explain: true, published: [], picked: [], shop: { path: '/shop/' } }),
          stderr: '',
        };
      },
      alias: 'ikramaid',
      wpPath: '~/www/ikramaid.uk/public_html',
      siteUrl: 'https://ikramaid.uk',
    });
    const raw = runner();
    assert.equal(n, 1);
    assert.match(raw, /"explain":true/);
    assert.equal(CATALOG_EVAL_FILE.includes('catalog-resolve.php'), true);
  });
});
