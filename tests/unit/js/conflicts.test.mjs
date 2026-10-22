import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyConflictSource,
  classifyConsoleEvent,
  consoleVerdict,
  stackMentionsPlugin,
  pluginLocFromStack,
  isPluginCssUrl,
  detectLibraryCopies,
  evaluateWdpGlobals,
  evaluateJqueryDollar,
  scriptsVerdict,
  evaluatePhoneIntegrity,
  phoneVerdict,
  phoneProbeFromSnaps,
  isOpenVisiblePhoneSnap,
  isOverflowIgnored,
  pickOverflowHit,
  formatOverflowFinding,
  shopConflictPath,
  shopSkipReason,
  evaluateCheckoutFields,
  evaluateCurcy,
  fieldsVerdict,
  diffChromeStyles,
  cssVerdict,
  cacheVerdict,
  worstVerdict,
  parseConflictsArgs,
  canonicalConflictsEnv,
  formatConflictsSummary,
  countReds,
  VERDICT,
  PLUGIN_SLUG,
  simRemoteScriptUrls,
  simRemotePhoneProbe,
  simRemoteCheckoutProbe,
  simRemoteCurcyProbe,
  simRemoteConsoleEvents,
  simRemoteHiddenShopPhoneSnaps,
  simRemoteOpenPhoneSnap,
  simRemoteFalseOverflowNodes,
  simRemoteRealOverflowHit,
} from '../../../tests/e2e/helpers/conflicts.mjs';
import { runSimRemote } from '../../../tests/e2e/run-conflicts.mjs';

describe('classifyConflictSource', () => {
  it('eklenti / tema / başka eklenti slug', () => {
    assert.deepEqual(
      classifyConflictSource(
        'https://shop.example/wp-content/plugins/woo-donation-popup/assets/js/donation-modal.js'
      ),
      { kind: 'plugin', slug: PLUGIN_SLUG }
    );
    assert.equal(
      classifyConflictSource(
        'https://shop.example/wp-content/plugins/woocommerce-multi-currency/assets/js/wmc.js'
      ).slug,
      'woocommerce-multi-currency'
    );
    assert.equal(
      classifyConflictSource(
        'https://shop.example/wp-content/plugins/woo-checkout-field-editor-pro/thwcfd.js'
      ).kind,
      'other-plugin'
    );
    assert.equal(
      classifyConflictSource('https://shop.example/wp-content/plugins/wcipi-plugin/intlTelInput.min.js')
        .slug,
      'wcipi-plugin'
    );
    assert.equal(
      classifyConflictSource('https://shop.example/wp-content/themes/Avada/assets/js/main.js').slug,
      'Avada'
    );
    assert.equal(
      classifyConflictSource('https://shop.example/wp-content/themes/blocksy/style.css').kind,
      'theme'
    );
    assert.equal(
      classifyConflictSource('https://shop.example/wp-content/plugins/elementor/assets/js/frontend.min.js')
        .slug,
      'elementor'
    );
    assert.equal(
      classifyConflictSource('https://shop.example/wp-content/plugins/seo-by-rank-math/assets/js/x.js')
        .slug,
      'seo-by-rank-math'
    );
  });
});

describe('konsol sınıflama', () => {
  it('başka eklenti hatası kırmızı değil', () => {
    const c = classifyConsoleEvent({
      text: 'GiveWP TypeError',
      url: 'https://shop.example/wp-content/plugins/give/assets/dist/js/give.js',
      stack: 'at give.js:10',
    });
    assert.equal(c.source, 'other-plugin');
    assert.equal(c.slug, 'give');
    assert.equal(c.red, false);
    assert.equal(c.warn, true);
  });

  it('yığında eklenti dosyası kırmızı', () => {
    const c = classifyConsoleEvent({
      text: 'Cannot read properties of undefined',
      url: '',
      stack: 'TypeError\n    at init (woo-donation-popup/assets/js/donation-modal.js:88:3)',
    });
    assert.equal(c.red, true);
    assert.equal(c.source, 'plugin');
    assert.equal(
      stackMentionsPlugin('at init (woo-donation-popup/assets/js/donation-modal.js:88:3)'),
      true
    );
    assert.ok(pluginLocFromStack('woo-donation-popup/assets/js/donation-modal.js:88').includes('donation-modal.js:88'));
  });

  it('tema hatası eklentiyi kırmızı yapmaz', () => {
    const c = classifyConsoleEvent({
      text: 'fusion error',
      url: 'https://shop.example/wp-content/themes/Avada/assets/min/js/general/avada-general.js',
    });
    assert.equal(c.source, 'theme');
    assert.equal(c.red, false);
  });

  it('consoleVerdict: eklenti kırmızı, Give uyarı olarak kalır', () => {
    const v = consoleVerdict(simRemoteConsoleEvents().map((e) => classifyConsoleEvent(e)));
    assert.equal(v.verdict, VERDICT.red);
    assert.ok(v.finding);
  });
});

describe('betik kopyaları ve globaller', () => {
  it('intl-tel-input / select2 / jquery / swiper kopyalarını bulur', () => {
    const det = detectLibraryCopies(simRemoteScriptUrls());
    const ids = det.copies.map((c) => c.id).sort();
    assert.deepEqual(ids, ['jquery', 'select2', 'swiper']);
    assert.equal(det.oursInCopies, false);
  });

  it('eklenti kopyası kırmızı', () => {
    const det = detectLibraryCopies([
      'https://x.test/wp-content/plugins/wcipi-plugin/intlTelInput.min.js',
      'https://x.test/wp-content/plugins/woo-donation-popup/vendor/intlTelInput.js',
    ]);
    const v = scriptsVerdict(det, evaluateWdpGlobals(['wdp_ajax']), evaluateJqueryDollar({}));
    assert.equal(v.verdict, VERDICT.red);
  });

  it('window.wdp_ajax bozuksa kırmızı; ekstra wdp* uyarı', () => {
    assert.equal(
      evaluateWdpGlobals(['wdp_ajax'], { wdpAjaxType: 'string', wdpAjaxHasUrl: false }).ajaxBroken,
      true
    );
    const extra = evaluateWdpGlobals(['wdp_ajax', 'wdpForeign'], {
      wdpAjaxType: 'object',
      wdpAjaxHasUrl: true,
    });
    assert.deepEqual(extra.extra, ['wdpForeign']);
    const ours = evaluateWdpGlobals(['wdp_ajax', 'WDPApp', 'WDP', 'WDPMetaTracking'], {
      wdpAjaxType: 'object',
      wdpAjaxHasUrl: true,
    });
    assert.deepEqual(ours.extra, []);
  });

  it('jQuery $ çakışması uyarı', () => {
    const d = evaluateJqueryDollar({
      hasJQuery: true,
      dollarType: 'function',
      dollarIsJQuery: false,
    });
    assert.equal(d.conflict, true);
  });
});

describe('alan bütünlüğü', () => {
  it('wcipi ikinci bağlanma kırmızı', () => {
    const v = phoneVerdict(evaluatePhoneIntegrity(simRemotePhoneProbe()));
    assert.equal(v.verdict, VERDICT.red);
  });

  it('kart içi gizli 15 telefon alanı sayılmaz; açık formda tek seçici geçer', () => {
    const hidden = phoneProbeFromSnaps(simRemoteHiddenShopPhoneSnaps());
    assert.equal(hidden.wdpPhoneCount, 0);
    assert.equal(phoneVerdict(evaluatePhoneIntegrity(hidden)).verdict, VERDICT.pass);
    const mixed = phoneProbeFromSnaps([...simRemoteHiddenShopPhoneSnaps(), simRemoteOpenPhoneSnap()]);
    assert.equal(mixed.wdpPhoneCount, 1);
    assert.equal(mixed.flagCount, 1);
    assert.equal(mixed.countryBtnCount, 1);
    assert.equal(phoneVerdict(evaluatePhoneIntegrity(mixed)).verdict, VERDICT.pass);
    assert.equal(isOpenVisiblePhoneSnap(simRemoteHiddenShopPhoneSnaps()[0]), false);
    assert.equal(isOpenVisiblePhoneSnap(simRemoteOpenPhoneSnap()), true);
  });

  it('tek ülke seçici geçer', () => {
    const v = phoneVerdict(
      evaluatePhoneIntegrity({
        wdpPhoneCount: 1,
        flagCount: 0,
        countryBtnCount: 1,
        itiOnWdp: 0,
        wcipiOnWdp: 0,
      })
    );
    assert.equal(v.verdict, VERDICT.pass);
  });

  it('ödeme telefonu çift kopya kırmızı', () => {
    const c = evaluateCheckoutFields(simRemoteCheckoutProbe());
    assert.equal(c.ok, false);
    const f = fieldsVerdict(
      phoneVerdict(evaluatePhoneIntegrity({ wdpPhoneCount: 0 })),
      c,
      evaluateCurcy({}),
      { pageId: 'checkout' }
    );
    assert.equal(f.verdict, VERDICT.red);
  });

  it('Curcy formu örtünce kırmızı', () => {
    const c = evaluateCurcy(simRemoteCurcyProbe());
    assert.equal(c.ok, false);
  });
});

describe('CSS sızıntısı ve form', () => {
  it('fark yalnız eklenti öğesinde geçer; başlık farkı kırmızı', () => {
    const onlyPlugin = diffChromeStyles(
      { heading: { color: 'rgb(0, 0, 0)' }, '.wdp-modal': { color: 'rgb(1,1,1)' } },
      { heading: { color: 'rgb(0, 0, 0)' }, '.wdp-modal': { color: 'rgb(9,9,9)' } }
    );
    assert.deepEqual(onlyPlugin.leaked, []);
    const leak = diffChromeStyles(
      { heading: { color: 'rgb(0, 0, 0)' } },
      { heading: { color: 'rgb(255, 0, 0)' } }
    );
    assert.deepEqual(leak.leaked, ['heading']);
    assert.equal(cssVerdict(leak, { formVisible: true }).verdict, VERDICT.red);
  });

  it('dokunma <24px kırmızı; belge kaydırması tek başına kırmızı değil', () => {
    assert.equal(cssVerdict({ leaked: [] }, { overflow: true, formVisible: true }).verdict, VERDICT.pass);
    assert.equal(
      cssVerdict(
        { leaked: [] },
        { formVisible: true, badTouch: [{ name: 'donation_add_to_cart', w: 20, h: 20 }] }
      ).verdict,
      VERDICT.red
    );
  });

  it('gizli / sr-text / kapalı ülke listesi taşma sayılmaz', () => {
    const hit = pickOverflowHit(simRemoteFalseOverflowNodes(), { vw: 390 });
    assert.equal(hit, null);
    assert.equal(isOverflowIgnored({ srText: true, width: 1, height: 1, left: -9999, right: -9998 }), true);
    assert.equal(isOverflowIgnored({ closedCountry: true, width: 420, height: 320 }), true);
    assert.equal(isOverflowIgnored({ display: 'none', width: 100, height: 40 }), true);
    assert.equal(isOverflowIgnored({ ariaHidden: true, width: 100, height: 40 }), true);
  });

  it('görünür öğe taşmasını seçici+genişlik+kural ile yazar', () => {
    const hit = pickOverflowHit([simRemoteRealOverflowHit()], { vw: 390 });
    assert.ok(hit);
    assert.equal(hit.selector, '.wdp-amount-preset');
    assert.equal(hit.rule, 'kapsayıcı');
    const v = cssVerdict({ leaked: [] }, { formVisible: true, clipped: true, hit });
    assert.equal(v.verdict, VERDICT.red);
    assert.match(v.finding, /form taşıyor/);
    assert.match(v.finding, /kural=kapsayıcı/);
    assert.ok(formatOverflowFinding(hit).includes('312>264'));
  });

  it('açık kabuk viewport dışındaysa kural=viewport', () => {
    const hit = pickOverflowHit(
      [
        {
          selector: '.wdp-modal-content',
          role: 'content',
          left: 200,
          right: 590,
          width: 390,
          height: 700,
          display: 'flex',
          visibility: 'visible',
        },
      ],
      { vw: 390 }
    );
    assert.ok(hit);
    assert.equal(hit.rule, 'viewport');
    assert.match(formatOverflowFinding(hit), /kural=viewport/);
  });

  it('eklenti CSS URL tanır', () => {
    assert.equal(
      isPluginCssUrl(
        'https://shop.example/wp-content/plugins/woo-donation-popup/assets/css/donation-modal.css?ver=1'
      ),
      true
    );
    assert.equal(
      isPluginCssUrl('https://shop.example/wp-content/plugins/woocommerce/assets/css/woocommerce.css'),
      false
    );
  });
});

describe('önbellek nonce', () => {
  it('nonce yok veya AJAX başarısız kırmızı', () => {
    assert.equal(cacheVerdict({ noncePresent: false }).verdict, VERDICT.red);
    assert.equal(cacheVerdict({ noncePresent: true, ok: false, status: 403 }).verdict, VERDICT.red);
    assert.equal(cacheVerdict({ noncePresent: true, ok: true, addToCart: { nonceFail: true } }).verdict, VERDICT.red);
    assert.equal(cacheVerdict({ noncePresent: true, ok: true }).verdict, VERDICT.pass);
    assert.equal(cacheVerdict({ skipped: true, reason: 'checkout-view-only' }).verdict, VERDICT.skip);
  });
});

describe('CLI ve özet', () => {
  it('parseConflictsArgs --env --device', () => {
    const a = parseConflictsArgs(['--env', 'staging', '--device', 'iphone']);
    assert.equal(canonicalConflictsEnv(a.envRaw), 'staging');
    assert.deepEqual(a.devices, ['iphone']);
    const b = parseConflictsArgs(['--env=ikram', '--device=all']);
    assert.equal(canonicalConflictsEnv(b.envRaw), 'ikram');
    assert.equal(b.devices.length, 3);
    assert.equal(canonicalConflictsEnv('local'), 'local');
  });

  it('summary.md tablo ve kırmızı sayımı', () => {
    const rows = [
      {
        page: 'product',
        device: 'iphone',
        theme: 'twentytwentyfive',
        console: VERDICT.pass,
        scripts: VERDICT.warn,
        fields: VERDICT.pass,
        css: VERDICT.pass,
        cache: VERDICT.pass,
        finding: 'jquery×2',
        shot: '',
      },
      {
        page: 'checkout',
        device: 'desktop',
        theme: 'storefront',
        console: VERDICT.red,
        scripts: VERDICT.pass,
        fields: VERDICT.pass,
        css: VERDICT.pass,
        cache: VERDICT.pass,
        finding: `${PLUGIN_SLUG}/assets/js/donation-modal.js:88`,
        shot: 'build/e2e/conflicts/local/x.png',
      },
    ];
    const md = formatConflictsSummary({
      envName: 'local',
      devices: ['iphone', 'desktop'],
      rows,
      startedAt: '2026-10-22T00:00:00.000Z',
      durationMs: 1200,
      sim: [],
    });
    assert.ok(md.includes('| product | iphone |'));
    assert.ok(md.includes('jquery×2'));
    assert.equal(countReds(rows), 1);
  });

  it('worstVerdict kırmızı > uyarı > geçti', () => {
    assert.equal(
      worstVerdict([
        { verdict: VERDICT.pass },
        { verdict: VERDICT.warn, finding: 'x' },
        { verdict: VERDICT.red, finding: 'y' },
      ]).verdict,
      VERDICT.red
    );
  });
});

describe('uzak benzetim (yerel, ağ yok)', () => {
  it('tüm beklenen bulguları yakalar', () => {
    const sim = runSimRemote();
    assert.ok(sim.length >= 11);
    const missed = sim.filter((s) => !s.ok);
    assert.deepEqual(missed, []);
  });
});

describe('mağaza hedefi', () => {
  it('shop yolu yalnız Woo shop; yoksa atlanır', () => {
    assert.equal(shopConflictPath({ listPath: '/liste/', shopPath: '/magaza/' }, {}), '/magaza/');
    assert.equal(shopConflictPath({ listPath: '/liste/' }, {}), '');
    assert.ok(shopSkipReason({ shopPath: '' }).startsWith('atlandı:'));
    assert.ok(shopSkipReason({ shopPath: '/magaza/', triggerVisible: false }).includes('düğmesi yok'));
    assert.equal(shopSkipReason({ shopPath: '/magaza/', triggerVisible: true }), '');
  });
});
