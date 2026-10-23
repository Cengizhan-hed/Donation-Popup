/**
 * Kabuk / tam sayfa bütünlük sınıflandırması — ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyPageHeight,
  classifyShellCompleteness,
  collectPageCompletenessMetrics,
  screenKindFromName,
  screenCompletenessFailure,
  PAGE_HEIGHT_TOLERANCE_PX,
} from '../../../tests/e2e/helpers/screen-completeness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('screenKindFromName', () => {
  it('popup/panel kabuk; ürün/liste sayfa', () => {
    assert.equal(screenKindFromName('iphone-panel-fixed-open'), 'shell');
    assert.equal(screenKindFromName('iphone-panel-custom-errors'), 'shell');
    assert.equal(screenKindFromName('iphone-popup-campaign-open'), 'shell');
    assert.equal(screenKindFromName('iphone-product-fixed'), 'page');
    assert.equal(screenKindFromName('iphone-list'), 'page');
    assert.equal(screenKindFromName('desktop-shop'), 'page');
  });
});

function pageBase(over = {}) {
  return {
    readyState: 'complete',
    screenshotH: 2400,
    scrollHeight: 2400,
    fullPage: true,
    lastRegionKind: 'footer',
    lastRegionInDom: true,
    lastRegionTop: 2200,
    lastRegionBottom: 2380,
    ...over,
  };
}

describe('classifyPageHeight (yalnız tam sayfa, tema bağımsız)', () => {
  it('kesik çekim (ekran viewport, footer ekran dışında) → kırmızı', () => {
    const r = classifyPageHeight(
      pageBase({
        screenshotH: 844,
        scrollHeight: 2400,
        lastRegionTop: 2200,
        lastRegionBottom: 2380,
      })
    );
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'last-region-clipped');
    const half = classifyPageHeight(
      pageBase({
        screenshotH: 844,
        scrollHeight: 2400,
        lastRegionInShot: true,
        lastRegionTop: 10,
        lastRegionBottom: 80,
      })
    );
    assert.equal(half.ok, false);
    assert.equal(half.reason, 'half-page');
    assert.ok(844 < 2400 - PAGE_HEIGHT_TOLERANCE_PX);
  });

  it('tam çekim: complete + footer ekranda + yükseklik ≥ scrollHeight → geç', () => {
    const r = classifyPageHeight(pageBase());
    assert.equal(r.ok, true);
    assert.equal(r.reason, 'footer');
  });

  it('footer’sız tema → son görünür blok ölçütü', () => {
    const ok = classifyPageHeight(
      pageBase({
        lastRegionKind: 'last-block',
        lastRegionInDom: true,
        lastRegionTop: 2100,
        lastRegionBottom: 2390,
      })
    );
    assert.equal(ok.ok, true);
    assert.equal(ok.reason, 'last-block');
    const missing = classifyPageHeight(
      pageBase({
        lastRegionKind: '',
        lastRegionInDom: false,
        lastRegionTop: 0,
        lastRegionBottom: 0,
      })
    );
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, 'last-region-missing');
  });

  it('readyState complete değil → kırmızı', () => {
    const r = classifyPageHeight(pageBase({ readyState: 'interactive' }));
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'not-complete');
  });
});

describe('collectPageCompletenessMetrics kaynak', () => {
  it('footer / contentinfo / son görünür blok seçicileri var', () => {
    const src = collectPageCompletenessMetrics.toString();
    assert.match(src, /footer/);
    assert.match(src, /role=["']contentinfo["']/);
    assert.match(src, /last-block/);
    assert.match(src, /scrollingElement/);
    assert.match(src, /readyState/);
  });
});

function shellBase(over = {}) {
  return {
    hasShell: true,
    shellW: 390,
    shellH: 700,
    shellTop: 0,
    shellLeft: 0,
    shellRight: 390,
    shellBottom: 700,
    vw: 390,
    vh: 844,
    headerVisible: true,
    ctaVisible: true,
    lastItemVisible: true,
    canScroll: false,
    scrolledToEnd: true,
    lastItemVisibleAfterScroll: true,
    ctaVisibleAfterScroll: true,
    ...over,
  };
}

describe('classifyShellCompleteness', () => {
  it('kabuk kökü görüntü alanında tam + başlık/CTA/son öğe → geç (ürün sayfası yüksekliği yok)', () => {
    const r = classifyShellCompleteness(shellBase());
    assert.equal(r.ok, true);
    assert.equal(r.reason, 'in-viewport');
  });

  it('100dvh panel visualViewport’tan taşsa da CTA+son öğe kabukta → geç', () => {
    const r = classifyShellCompleteness(
      shellBase({
        shellBottom: 900,
        vh: 844,
        canScroll: false,
        scrolledToEnd: true,
        ctaVisible: true,
        lastItemVisible: true,
        lastItemVisibleAfterScroll: true,
        ctaVisibleAfterScroll: true,
      })
    );
    assert.equal(r.ok, true);
  });

  it('viewport dışına taşan ama kaydırınca son öğe+CTA görünür → geç', () => {
    const r = classifyShellCompleteness(
      shellBase({
        shellBottom: 1200,
        vh: 844,
        canScroll: true,
        ctaVisible: false,
        lastItemVisible: false,
        scrolledToEnd: true,
        lastItemVisibleAfterScroll: true,
        ctaVisibleAfterScroll: true,
      })
    );
    assert.equal(r.ok, true);
    assert.equal(r.reason, 'scroll-end');
  });

  it('kabuk yok / minik → kırmızı; başlık yok ama kök+CTA+son öğe var → geç', () => {
    assert.equal(classifyShellCompleteness({ hasShell: false, vw: 390, vh: 844 }).ok, false);
    assert.equal(classifyShellCompleteness({ ...shellBase(), hasShell: false }).reason, 'shell-missing');
    assert.equal(classifyShellCompleteness(shellBase({ shellH: 4, shellW: 4 })).reason, 'shell-tiny');
    const noHeader = classifyShellCompleteness(shellBase({ headerVisible: false }));
    assert.equal(noHeader.ok, true);
    assert.equal(noHeader.reason, 'in-viewport');
  });

  it('kesik kabuk (kaydırma yok, CTA/son yok) → kırmızı', () => {
    const clipped = classifyShellCompleteness(
      shellBase({
        shellBottom: 400,
        vh: 844,
        canScroll: false,
        ctaVisible: false,
        lastItemVisible: false,
        scrolledToEnd: false,
        lastItemVisibleAfterScroll: false,
        ctaVisibleAfterScroll: false,
      })
    );
    assert.equal(clipped.ok, false);
    assert.equal(clipped.reason, 'shell-cta-missing');

    const noEnd = classifyShellCompleteness(
      shellBase({
        shellBottom: 1200,
        canScroll: true,
        ctaVisible: true,
        lastItemVisible: false,
        scrolledToEnd: false,
        lastItemVisibleAfterScroll: false,
        ctaVisibleAfterScroll: true,
      })
    );
    assert.equal(noEnd.ok, false);
    assert.equal(noEnd.reason, 'shell-scroll-end');
  });
});

describe('screenCompletenessFailure', () => {
  it('kabuk ve sayfa metni ayrılır; check adı page-height kalır', () => {
    const shell = screenCompletenessFailure('iphone-panel-fixed-open', {
      ok: false,
      reason: 'shell-clipped',
      detail: 'kabuk=400px',
    });
    assert.equal(shell.check, 'iphone-panel-fixed-open-page-height');
    assert.match(shell.description, /Kabuk kesilmiş/);
    const page = screenCompletenessFailure('iphone-product-fixed', {
      ok: false,
      reason: 'half-page',
      detail: 'sayfa=800px',
    });
    assert.match(page.description, /yarım kaldı/);
  });
});

describe('capture.mjs kabukta ürün sayfası yüksekliği kıyaslamaz', () => {
  it('assertShellPageHeight yok; classifyShellCompleteness + sayfa ölçütü var', () => {
    const src = fs.readFileSync(path.join(root, 'tests/e2e/helpers/capture.mjs'), 'utf8');
    assert.match(src, /classifyShellCompleteness/);
    assert.match(src, /classifyPageHeight/);
    assert.match(src, /collectPageCompletenessMetrics/);
    assert.match(src, /productPageCache/);
    assert.match(src, /beginNavCache/);
    assert.match(src, /screenKindFromName/);
    assert.doesNotMatch(src, /function assertShellPageHeight/);
    assert.doesNotMatch(src, /Kabuk ekranı ürün sayfasından belirgin kısa/);
    assert.doesNotMatch(src, /errors: taze goto/);
    assert.doesNotMatch(src, /referencePageHeight/);
  });
});
