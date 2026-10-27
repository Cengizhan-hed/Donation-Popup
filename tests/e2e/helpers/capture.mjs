/**
 * Capture staging screens for baseline / compare runs.
 */
import { quarantineFor } from './quarantine.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { withCacheBust, productPaths, ROOT, beginNavCache, endNavCache } from './env.mjs';
import { getActiveProfile, isRemoteProfile, matchesProfilePattern, getActiveTimeouts } from './profile.mjs';
import {
  productNavPath,
  decideScenarioProduct,
  assertProductNavTarget,
  popupPagePath,
  loopProductSlug,
  classifyStorefrontProductPage,
} from './catalog-core.mjs';
import { currencySwitchFromProfile, runCurrencySwitchChecks } from './currency-switch.mjs';
import { getDevicePreset } from './devices.mjs';
import { areaIncludes } from './area-filter.mjs';
import { wantAnyMutationArea } from './full-slices.mjs';
import {
  collectClickTarget,
  collectPluginRuntime,
  collectShellDomState,
  collectStorefrontPageState,
  shotDebugPng,
  writePanelOpenDebug,
} from './flow-diag.mjs';
import { applyComingSoonBypass, comingSoonQuery } from './coming-soon.mjs';
import { STABILIZE_SHOT_CSS, hideComingSoonNoticeForShot } from './stabilize-shot-css.mjs';
import { ensureAuth, getAuthFile, getInMemoryAdminCookies, waitForWpAdminPage } from './auth.mjs';
import { SKIP_EVIDENCE, SKIP_REASONS, classifySkip, makeSkip, promoteIllegalSkips } from './skip-policy.mjs';
import {
  installBrowserGuard,
  applyNetworkGuard,
  guardOptionsFromEnv,
  resetBlockedTrackers,
  resetRemotePostBlocked,
  snapshotBlockedTrackers,
  snapshotRemotePostBlocked,
  snapshotAllowedReads,
  consumeOrderBlocks,
  consumeAdminWriteBlocks,
  consumeForeignWriteBlocks,
  consumeRetiredHostBlocks,
  snapshotBlockedLive,
  snapshotPluginAjaxFails,
  pausePluginAjaxWatch,
  resumePluginAjaxWatch,
  formatRemotePostBlockedLines,
  extractAjaxActionFromRequest,
} from './network-guard.mjs';
import { runMobileA11yChecks } from './mobile-a11y.mjs';
import { runDonationFlowChecks, resolveDonationFillAmount } from './donation-flow.mjs';
import { advanceToDetails, fillAmountStep, fillDonorDetails, formOf, setChecked } from './dp-form.mjs';
import { prepareCheckoutEnv } from './checkout-setup.mjs';
import {
  probeSimilarDonations,
  writeSimilarDonationsProbe,
  classifySimilarDonations,
} from './similar-donations-probe.mjs';
import {
  resolveDisplayFromSources,
  classifyVisiblePluginEntry,
  collectVisiblePluginEntry,
  classifyNativeCartVisibility,
  displayMismatchWarning,
  nativeCartProbeBrowser,
  LOOP_EXCLUDE_SEL,
  NATIVE_CART_FORM_SEL,
  NATIVE_ATC_BTN_SEL,
  STICKY_ATC_SEL,
} from './product-page-ui.mjs';
import {
  classifyLoopCardsResult,
  formatLoopCardFail,
  readRelatedProductIds,
  RELATED_ROOT_SEL,
  SHOP_CARD_SEL,
  shopCardsHiddenFailure,
} from './loop-cards.mjs';
import {
  PLUGIN_STYLE_PATH,
  diagnoseRelatedHideBrowser,
  decideRelatedHideOutcome,
  writeRelatedHideDebug,
} from './css-hide-source.mjs';
import { snapshotGuardOrder, cleanupE2EData } from './test-cleanup.mjs';
import { resetRegistry } from './run-registry.mjs';
import { fixtureProductRecords, loadFixtures, assertRunMutationTargetsAreFixtures } from './fixtures.mjs';
import { installRunSignalHandlers } from './run-signals.mjs';
import { abortMutationLockWait, resetMutationLockAbort } from './mutation-lock.mjs';
import { readAddonConfigViaEval } from './addon-admin-read.mjs';
import {
  snapshotCanary,
  preflightCanary,
  compareWithRegistry,
  formatCanaryDiff,
  writeCanaryAlert,
} from './canary.mjs';
import {
  assertNoConsoleErrors,
  assertNoCriticalError,
  assertNoHorizontalOverflow,
  attachConsoleErrorCollector,
  cartItemCount,
  cartItemsDetail,
  CHECK_MS,
  clickAddToCartWithRetry,
  isDonationAddToCartRequest,
  emptyCart,
  makeFailure,
  openShellLocator,
  resolveAllProductPaths,
  resolveProductIdBySlug,
  clickShellTrigger,
  revealListProductTrigger,
  shellTriggerLocator,
  visibleValidationErrors,
  waitForShellClosed,
  waitOpenShellSettled,
  assertNoUnexpectedPluginErrors,
  assertNoPluginAjaxFailures,
} from './checks.mjs';
import { DP_SEL, FREEZE_MOTION_CSS, SEL, maskSelectors } from './selectors.mjs';
import { currentSrcMatchesExpected } from './image-url.mjs';
import {
  collectAddToCartDiagnostics,
  collectTriggerClickDiagnostics,
  startDomMutationProbe,
  stopDomMutationProbe,
} from './click-diagnostics.mjs';
import {
  waitAndAssertShellOverlap,
  waitShellAnimationsDone,
  assertPanelCtaPinnedWhenShort,
  PANEL_CTA_BOTTOM_CODE,
} from './shell-overlap.mjs';
import {
  attachNativeSubmitReloadGuard,
  NATIVE_SUBMIT_RELOAD_CODE,
} from './native-submit-guard.mjs';
import {
  classifyPageHeight,
  classifyShellCompleteness,
  collectPageCompletenessMetrics,
  collectShellCompletenessMetrics,
  screenCompletenessFailure,
  screenKindFromName,
} from './screen-completeness.mjs';
import {
  attachDocumentCacheProbe,
  createTimeline,
  listActiveScenarios,
  tracePaths,
  writeDebugJson,
} from './scenario-debug.mjs';
import { collectPageProbeLogs, installPageProbe, snapshotAddonAndButton } from './page-probe.mjs';
import { attachAjaxErrorKindLoggerOnContext } from './ajax-error-kind.mjs';
import {
  markBrowserContextKind,
  pageContextKind,
  collectAndWriteCartState,
  e2eDeviceLabel,
} from './cart-state-diag.mjs';

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {object} opts
 * @param {Record<string,string>} [env]
 */
async function contextWithBypass(browser, opts, env, kind = 'visitor') {
  const ctx = await browser.newContext(opts);
  markBrowserContextKind(ctx, kind);
  attachAjaxErrorKindLoggerOnContext(ctx);
  await applyNetworkGuard(ctx, guardOptionsFromEnv(env));
  try {
    const profile = getActiveProfile();
    if (profile?.comingSoon && env) {
      await applyComingSoonBypass(ctx, profile, env);
    }
  } catch {
    /* profil yok */
  }
  return ctx;
}

/**
 * Ziyaretçi bağlamı: share çerezi (Coming soon), oturum yok (storageState yok).
 * @param {import('@playwright/test').Browser} browser
 * @param {Record<string,string>} env
 * @param {object} [extra]
 */
async function asVisitor(browser, env, extra = {}) {
  return contextWithBypass(browser, extra, env, 'visitor');
}

/**
 * Yönetici bağlamı: wpCliAuth bellek çerezi veya storageState. Çerez dosyaya yazılmaz (wpCliAuth).
 * @param {import('@playwright/test').Browser} browser
 * @param {Record<string,string>} env
 * @param {object} [extra]
 */
async function asAdmin(browser, env, extra = {}) {
  await ensureAuth(env);
  const mem = getInMemoryAdminCookies();
  const opts = { ...extra };
  if (!mem && getAuthFile()) {
    opts.storageState = getAuthFile();
  }
  const ctx = await contextWithBypass(browser, opts, env, 'admin');
  if (mem && mem.length) {
    await ctx.addCookies(mem);
  }
  return ctx;
}

/** Ürün düzenleme / ayar: cihaz isMobile yok (klasik wp-admin). */
async function asAdminDesktop(browser, env) {
  return asAdmin(browser, env, { viewport: { width: 1440, height: 900 } });
}

/** @type {Array<{label:string,secs:number}>} */
const sectionTimings = [];

/**
 * @param {string} label
 * @param {number} startedAt
 */
function logSection(label, startedAt) {
  const secs = (Date.now() - startedAt) / 1000;
  sectionTimings.push({ label, secs });
  console.log(`[e2e] ${label}: ${secs.toFixed(1)}s`);
}

function printSectionTable() {
  if (!sectionTimings.length) return;
  console.log('');
  console.log('Bölüm süreleri');
  console.log('──────────────────────────────┬────────');
  let total = 0;
  for (const s of sectionTimings) {
    total += s.secs;
    const label = s.label.slice(0, 28).padEnd(28);
    console.log(`${label} │ ${s.secs.toFixed(1).padStart(6)}s`);
  }
  console.log('──────────────────────────────┼────────');
  console.log(`${'TOPLAM'.padEnd(28)} │ ${total.toFixed(1).padStart(6)}s`);
  const slow = [...sectionTimings].sort((a, b) => b.secs - a.secs).slice(0, 5);
  if (slow.length) {
    console.log('En yavaş 5 bölüm:');
    for (const s of slow) console.log(`  ${s.label}: ${s.secs.toFixed(1)}s`);
  }
}

/**
 * Açık kabukta adet/hisse girişinin 1 olduğunu oku.
 * @param {import('@playwright/test').Page} page
 * @param {string} productKey
 * @returns {Promise<{ ok: boolean, value: string, field: string }>}
 */
async function readShellInitialQty(page, productKey) {
  const shell = openShellLocator(page);
  const scope = (await shell.count()) > 0 ? shell : page.locator(SEL.inlineDonationForm).first();
  const field = productKey === 'shares' ? 'share_count' : 'quantity';
  const input = scope.locator(`input[name="${field}"]`).first();
  if ((await input.count()) === 0) {
    // Adet/hisse alanı olmayan türde (serbest tutar, kampanya) 1 varsayılır.
    return { ok: productKey !== 'shares', value: productKey === 'shares' ? '(yok)' : '1(varsayılan)', field };
  }
  const value = String((await input.inputValue()) || '').trim();
  return { ok: value === '1', value: value || '(boş)', field };
}

/** Hata ekran görüntüsü için odak halkasını da kes (shares-errors kararlılığı). */
const FREEZE_ERROR_SHOT_CSS = `
${FREEZE_MOTION_CSS}
*:focus, *:focus-visible {
  outline: none !important;
  box-shadow: none !important;
}
.dp-error,
[data-dp-summary] {
  animation: none !important;
  transition: none !important;
  opacity: 1 !important;
  transform: none !important;
}
`;

/**
 * Yalnızca ekran alınırken enjekte edilir (işlevsel kontrollerde kullanılmaz).
 * Kaynak: tests/e2e/helpers/stabilize-shot-css.mjs
 */

/**
 * Kabuk PNG köşe sızıntısı: element.screenshot dikdörtgeni border-radius dışında
 * arka sayfa piksellerini alır → %0.1 eşikte gürültü. Yalnız capture anında sayfa +
 * backdrop’u düz renge boyar; modal radius/görünümü aynı kalır (maske yerine seçildi:
 * radius temaya göre değişir, maske gerçek köşe regresyonunu gizler).
 */
const SHELL_CAPTURE_FLAT_BACKDROP_CSS = `
html, body {
  background: #9aa0a6 !important;
  background-image: none !important;
}
[data-dp-overlay].is-open {
  background-color: #9aa0a6 !important;
  background-image: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
`;

/** Boş catch yerine: temizlik dışı yutulursa log + fırlat. */
function catchFail(label, err) {
  const msg = err && err.message ? err.message : String(err || 'unknown');
  console.error(`[e2e:catch-fail] ${label}: ${msg}`);
  throw err instanceof Error ? err : new Error(`${label}: ${msg}`);
}

/** Bilinçli temizlik / isteğe bağlı stabilize — yine loglanır. */
function catchSoft(label, err) {
  const msg = err && err.message ? err.message : String(err || 'unknown');
  console.warn(`[e2e:soft-catch] ${label}: ${msg}`);
}

/**
 * @param {import('@playwright/test').Page} page
 */
async function freezeMotion(page) {
  await page.addStyleTag({ content: FREEZE_MOTION_CSS }).catch((e) => catchSoft('freezeMotion', e));
}

/**
 * @param {import('@playwright/test').Page} page
 */
async function waitTwoFrames(page) {
  await page
    .evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        })
    )
    .catch(() => {});
}

/** Görsel bekleme: ≤10 sn, 100 ms yoklama. */
const IMAGE_WAIT_MS = 10000;
const IMAGE_POLL_MS = 100;

/**
 * Lazy görselleri zorla çöz (Avada / lazysizes yer tutucuları dahil).
 * @param {import('@playwright/test').Page} page
 */
async function forceEagerImages(page) {
  await page
    .evaluate(async () => {
      const isRealUrl = (s) => {
        if (!s) return false;
        const t = String(s).trim();
        return t.length > 0 && !t.toLowerCase().startsWith('data:');
      };

      // lazysizes unveil (gerçek kaynak atanmadan önce)
      try {
        const loader = window.lazySizes && window.lazySizes.loader;
        if (loader && typeof loader.unveil === 'function') {
          for (const el of document.querySelectorAll('.lazyload')) {
            try {
              loader.unveil(el);
            } catch (e) {
              /* ignore */
            }
          }
        }
      } catch (e) {
        /* ignore */
      }

      for (const img of document.querySelectorAll('img')) {
        const dataSrc =
          img.getAttribute('data-orig-src') ||
          img.getAttribute('data-src') ||
          img.getAttribute('data-lazy-src');
        const dataSrcset =
          img.getAttribute('data-orig-srcset') ||
          img.getAttribute('data-srcset') ||
          img.getAttribute('data-lazy-srcset');
        if (isRealUrl(dataSrc)) {
          img.setAttribute('src', dataSrc);
        }
        if (isRealUrl(dataSrcset)) {
          img.setAttribute('srcset', dataSrcset);
        }
        if (img.getAttribute('sizes') === 'auto') {
          img.removeAttribute('sizes');
        }
        if (img.classList.contains('lazyload') || img.classList.contains('lazyloading')) {
          img.classList.remove('lazyload', 'lazyloading');
          img.classList.add('lazyloaded');
        }
        img.setAttribute('loading', 'eager');
      }

      for (const el of document.querySelectorAll('[data-bg], [data-bg-url], [data-back]')) {
        const bg =
          el.getAttribute('data-bg') ||
          el.getAttribute('data-bg-url') ||
          el.getAttribute('data-back');
        if (isRealUrl(bg)) {
          const escaped = String(bg).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          el.style.backgroundImage = `url("${escaped}")`;
        }
        if (el.classList.contains('lazyload') || el.classList.contains('lazyloading')) {
          el.classList.remove('lazyload', 'lazyloading');
          el.classList.add('lazyloaded');
        }
      }

      document.querySelectorAll('.lazyload, .lazyloading').forEach((el) => {
        el.classList.remove('lazyload', 'lazyloading');
        el.classList.add('lazyloaded');
      });

      await Promise.all(
        Array.from(document.querySelectorAll('img')).map((img) => {
          if (typeof img.decode === 'function') {
            return img.decode().catch(() => {});
          }
          return Promise.resolve();
        })
      );
    })
    .catch(() => {});
}

/**
 * Görünür boyutlu img snapshot (DOM) — eşleşme Node tarafında normalize edilir.
 * @param {import('@playwright/test').Page} page
 * @param {{ checkOpacity?: boolean }} [opts] opacity yalnızca ekran CSS sonrası
 * @returns {Promise<Array<object>>}
 */
async function readVisibleImageSnapshots(page, opts = {}) {
  const checkOpacity = !!opts.checkOpacity;
  const shellOnly = !!opts.shellOnly;
  return page
    .evaluate(
      ({ wantOpacity, shellOnly: onlyShell }) => {
        const out = [];
        const root = onlyShell
          ? document.querySelector('[data-dp-overlay].is-open') || null
          : document;
        if (!root) return out;
        for (const img of root.querySelectorAll('img')) {
          const rect = img.getBoundingClientRect();
          if (rect.width < 40 || rect.height < 40) continue;
          const style = window.getComputedStyle(img);
          if (style.display === 'none') continue;
          // Kasıtlı gizli / lazy'siz tema logoları (Avada fusion-standard-logo vb.)
          if (style.visibility === 'hidden') continue;
          const cls = String(img.className || '');
          const hasLazyMarker = !!(
            img.getAttribute('data-orig-src') ||
            img.getAttribute('data-src') ||
            img.getAttribute('data-lazy-src') ||
            img.getAttribute('data-orig-srcset') ||
            /lazyload|lazyloading|lazyloaded/i.test(cls)
          );
          if (/disable-lazyload/i.test(cls) && !hasLazyMarker) continue;

          /** @type {string[]} */
          const parentOpacities = [];
          if (wantOpacity) {
            let p = img.parentElement;
            for (let i = 0; i < 3 && p; i++) {
              parentOpacities.push(window.getComputedStyle(p).opacity);
              p = p.parentElement;
            }
          }

          out.push({
            complete: !!img.complete,
            naturalWidth: img.naturalWidth || 0,
            currentSrc: String(img.currentSrc || img.src || ''),
            dataOrigSrc: String(
              img.getAttribute('data-orig-src') ||
                img.getAttribute('data-src') ||
                img.getAttribute('data-lazy-src') ||
                ''
            ),
            srcset: String(img.getAttribute('srcset') || ''),
            dataOrigSrcset: String(img.getAttribute('data-orig-srcset') || ''),
            dataSrcset: String(img.getAttribute('data-srcset') || ''),
            dataLazySrcset: String(img.getAttribute('data-lazy-srcset') || ''),
            className: cls,
            opacity: style.opacity,
            visibility: style.visibility,
            parentOpacities,
          });
        }
        return out;
      },
      { wantOpacity: checkOpacity, shellOnly }
    )
    .catch(() => []);
}

/**
 * Görünür boyutlu img için "gerçekten yüklendi" — Avada data: yer tutucusu sayılmaz.
 * wait + assert aynı fonksiyonu kullanır (opacity bayrağı hariç).
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ checkOpacity?: boolean }} [opts]
 * @returns {Promise<Array<{ currentSrc: string, dataOrigSrc: string, className: string, reasons: string[] }>>}
 */
async function collectBadVisibleImages(page, opts = {}) {
  const checkOpacity = !!opts.checkOpacity;
  const shellOnly = !!opts.shellOnly;
  const snaps = await readVisibleImageSnapshots(page, { checkOpacity, shellOnly });
  /** @type {Array<{ currentSrc: string, dataOrigSrc: string, className: string, reasons: string[] }>} */
  const out = [];

  for (const img of snaps) {
    /** @type {string[]} */
    const reasons = [];
    if (!img.complete) reasons.push('incomplete');
    if (!(img.naturalWidth > 0)) reasons.push('naturalWidth0');
    if (String(img.currentSrc || '').startsWith('data:')) reasons.push('dataPlaceholder');

    if (checkOpacity) {
      const opacityZero =
        img.opacity === '0' ||
        (Array.isArray(img.parentOpacities) && img.parentOpacities.some((o) => o === '0'));
      if (opacityZero) reasons.push('opacity0');
      // visibility:hidden snapshot'ta zaten elendi
    }

    const nameOk = currentSrcMatchesExpected(img.currentSrc, img.dataOrigSrc, [
      img.dataOrigSrcset,
      img.dataSrcset,
      img.dataLazySrcset,
      img.srcset,
    ]);
    if (!nameOk) reasons.push('nameMismatch');

    if (!reasons.length) continue;
    const src = String(img.currentSrc || '');
    const pluginAsset = /woo-donation-popup|donation-modal/i.test(src);
    const mediaOrTheme =
      /woocommerce-placeholder|\/wp-content\/uploads\/|\/wp-content\/themes\/|\/favicon/i.test(src);
    if (!pluginAsset && mediaOrTheme) {
      continue;
    }
    out.push({
      currentSrc: img.currentSrc,
      dataOrigSrc: img.dataOrigSrc,
      className: img.className,
      reasons,
    });
  }
  return out;
}

/**
 * Tüm görünür görseller gerçekten yüklenene kadar yokla (≤10 sn / 100 ms).
 * 2 ardışık aynı sonuçta erken çıkar. Opacity kontrolü yok (CSS öncesi).
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ ok: boolean, bad: Array<{ currentSrc: string, dataOrigSrc: string, className: string, reasons: string[] }> }>}
 */
async function waitUntilImagesReallyLoaded(page) {
  const deadline = Date.now() + IMAGE_WAIT_MS;
  let bad = await collectBadVisibleImages(page, { checkOpacity: false });
  if (bad.length === 0) return { ok: true, bad };

  let prevKey = null;
  while (Date.now() < deadline) {
    const key = JSON.stringify(
      bad.map((b) => `${b.currentSrc}\0${(b.reasons || []).join(',')}`)
    );
    if (prevKey !== null && key === prevKey) {
      // 2 ardışık yoklama aynı → değişim durdu, erken çık
      break;
    }
    prevKey = key;
    await new Promise((r) => setTimeout(r, IMAGE_POLL_MS));
    bad = await collectBadVisibleImages(page, { checkOpacity: false });
    if (bad.length === 0) return { ok: true, bad };
  }
  return { ok: bad.length === 0, bad };
}

/**
 * Ekran öncesi sayfa yerleşimi: font, lazy-load kaydırması, img eager, header üstte.
 * Stabilize CSS enjekte ETMEZ (yalnızca shot içinde).
 * scrollPage:false iken kaydırma yok; lazy çözümü + tüm img beklemesi yine uygulanır.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ fullPage?: boolean, scrollPage?: boolean }} [opts]
 */
async function settleForScreenshot(page, opts = {}) {
  const fullPage = opts.fullPage !== false;
  const scrollPage = opts.scrollPage !== false;

  await page
    .evaluate(() => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()))
    .catch(() => {});

  if (scrollPage && fullPage) {
    await page
      .evaluate(async () => {
        const vh = Math.max(200, window.innerHeight || 600);
        const maxY = Math.max(
          document.body?.scrollHeight || 0,
          document.documentElement?.scrollHeight || 0,
          vh
        );
        for (let y = 0; y < maxY; y += vh) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 150));
        }
        window.scrollTo(0, maxY);
        await new Promise((r) => setTimeout(r, 80));
      })
      .catch(() => {});
  }

  await forceEagerImages(page);
  // Aşılırsa ekran yine alınır; assertVisibleImagesLoaded images-loaded hatası yazar
  await waitUntilImagesReallyLoaded(page);

  // Avada Post Cards: .fusion-animated başlangıçta visibility:hidden.
  // Woo .related.products kartları (tema seçicisi yok) kaydırılıp boyut/opacity beklenir.
  if (scrollPage && fullPage) {
    await page
      .evaluate(async () => {
        const deadline = Date.now() + 5000;
        const animSel =
          '.fusion-post-cards.fusion-animated, .fusion-animated.fusion-grid-archive, .fusion-blog-shortcode.fusion-animated';
        const related = document.querySelector(
          '.related.products, .upsells.products, section.related, .wp-block-woocommerce-related-products, .wp-block-woocommerce-product-collection'
        );
        const isVis = (el) => {
          if (!el) return false;
          const st = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return (
            st.display !== 'none' &&
            st.visibility !== 'hidden' &&
            Number.parseFloat(st.opacity || '1') > 0.05 &&
            r.width > 4 &&
            r.height > 4
          );
        };
        while (Date.now() < deadline) {
          const animBlocked = Array.from(document.querySelectorAll(animSel)).filter((el) => {
            const st = window.getComputedStyle(el);
            if (st.display === 'none' || st.visibility !== 'hidden') return false;
            const r = el.getBoundingClientRect();
            return r.height > 8 && r.width > 8;
          });
          const relatedCards = related
            ? Array.from(related.querySelectorAll('li.product, li.wc-block-product'))
            : [];
          const relatedHidden = relatedCards.filter((el) => !isVis(el));
          if (!animBlocked.length && (relatedCards.length === 0 || relatedHidden.length < relatedCards.length)) {
            break;
          }
          const toShow = animBlocked.length ? animBlocked : relatedHidden;
          for (const el of toShow.slice(0, 4)) {
            try {
              el.scrollIntoView({ block: 'center', inline: 'nearest' });
            } catch (e) {
              /* ignore */
            }
          }
          await new Promise((r) => setTimeout(r, 120));
        }
      })
      .catch((e) => catchSoft('waitRelatedCards', e));
  }

  await page
    .evaluate(async () => {
      window.scrollTo(0, 0);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((resolve) => {
        let last = window.scrollY;
        let stable = 0;
        const started = Date.now();
        const tick = () => {
          if (window.scrollY === last) {
            stable += 1;
            if (stable >= 2) {
              resolve();
              return;
            }
          } else {
            stable = 0;
            last = window.scrollY;
          }
          if (Date.now() - started > 400) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const header = document.querySelector('header, .fusion-header-wrapper, .fusion-header');
      if (header) {
        const rect = header.getBoundingClientRect();
        if (rect.top < 0) {
          window.scrollTo(0, 0);
        }
      }
    })
    .catch(() => {});
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
async function readPageScrollHeight(page) {
  return page
    .evaluate(() => Math.max(document.documentElement?.scrollHeight || 0, document.body?.scrollHeight || 0))
    .catch(() => 0);
}

/**
 * PNG IHDR yükseklik (bayt 20–23). Dosya yok/bozuk → 0.
 * @param {string} file
 * @returns {number}
 */
function readPngHeight(file) {
  try {
    if (!file || !fs.existsSync(file)) return 0;
    const buf = Buffer.alloc(24);
    const fd = fs.openSync(file, 'r');
    try {
      fs.readSync(fd, buf, 0, 24, 0);
    } finally {
      fs.closeSync(fd);
    }
    if (buf.toString('ascii', 1, 4) !== 'PNG') return 0;
    return buf.readUInt32BE(20);
  } catch (e) {
    catchSoft('readPngHeight', e);
    return 0;
  }
}

/**
 * Tam sayfa: readyState complete + son içerik bölgesi çekimde + ekran ≥ scrollHeight.
 * Kabuk ekranında çağrılmaz.
 * @param {import('@playwright/test').Page} page
 * @param {string} screenName
 * @param {ReturnType<typeof makeFailure>[]} failures
 * @param {string} [screenshotFile]
 */
async function assertFullPageHeight(page, screenName, failures, screenshotFile) {
  if (screenKindFromName(screenName) !== 'page') return;
  const metrics = await page.evaluate(collectPageCompletenessMetrics).catch((e) => {
    catchSoft('collectPageCompletenessMetrics', e);
    return { readyState: '', lastRegionInDom: false, scrollHeight: 0 };
  });
  metrics.screenshotH = screenshotFile ? readPngHeight(screenshotFile) : 0;
  metrics.fullPage = true;
  const result = classifyPageHeight(metrics);
  if (!result.ok) {
    failures.push(makeFailure(screenCompletenessFailure(screenName, result)));
  }
}

/**
 * Kabuk: kök görüntü alanında tam veya kaydırınca son öğe + eylem çubuğu.
 * Kesik/eksik kabuk kırmızı.
 * @param {import('@playwright/test').Page} page
 * @param {string} screenName
 * @param {ReturnType<typeof makeFailure>[]} failures
 */
async function assertShellCompleteness(page, screenName, failures) {
  const metrics = await page.evaluate(collectShellCompletenessMetrics);
  const result = classifyShellCompleteness(metrics);
  if (!result.ok) {
    failures.push(makeFailure(screenCompletenessFailure(screenName, result)));
  }
}

/**
 * Görünür ama gerçekten yüklenmemiş img kontrolü (data: yer tutucu sayılmaz).
 * Opacity: yalnızca ekran CSS enjekte edildikten sonra (shot sonrası).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} screenName örn. desktop-list
 * @param {ReturnType<typeof makeFailure>[]} failures
 */
async function assertVisibleImagesLoaded(page, screenName, failures, opts = {}) {
  const shellOnly = !!opts.shellOnly || /-(popup|panel)-/i.test(String(screenName || ''));
  const bad = await collectBadVisibleImages(page, { checkOpacity: true, shellOnly });

  if (bad.length > 0) {
    /** @type {Record<string, number>} */
    const reasonCounts = {};
    for (const b of bad) {
      for (const r of b.reasons || []) {
        reasonCounts[r] = (reasonCounts[r] || 0) + 1;
      }
    }
    const reasonSummary = Object.entries(reasonCounts)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');

    failures.push(
      makeFailure({
        check: `${screenName}-images-loaded`,
        description: 'Görünür görseller yüklenmedi (data: yer tutucu veya eksik kaynak)',
        detail: [
          `sayı=${bad.length}`,
          `reasons: ${reasonSummary || '(yok)'}`,
          ...bad.slice(0, 5).map(
            (b, i) =>
              `[${i + 1}] reasons=${(b.reasons || []).join('|') || '-'} currentSrc=${b.currentSrc || '-'} data-orig-src=${b.dataOrigSrc || '-'} class=${b.className || '-'}`
          ),
        ].join('\n'),
        screenshot: `${screenName}.png`,
      })
    );
  }
}

/**
 * Animasyon/geçişlerin bitmesini bekle.
 * @param {import('@playwright/test').Page} page
 */
async function waitForAnimationsSettled(page) {
  await page
    .waitForFunction(
      () => {
        const els = Array.from(document.querySelectorAll('*'));
        const anims = els.flatMap((el) => {
          try {
            return typeof el.getAnimations === 'function' ? el.getAnimations({ subtree: false }) : [];
          } catch (e) {
            return [];
          }
        });
        return anims.every((a) => a.playState === 'finished' || a.playState === 'idle');
      },
      { timeout: 3000 }
    )
    .catch(() => {});
}

/**
 * Hisseli hata ekranı: açık kabuk içinde ilk kart açık, diğerleri kapalı.
 * Önemli: document.querySelectorAll tüm gömülü/lazy modalları da alır; listede
 * gizli modal formları index 0 olunca açık kabuktaki kart yanlışlıkla collapsed olur
 * (popup-shares-errors teşhisi).
 * @param {import('@playwright/test').Page} page
 * @param {'popup'|'panel'|''} [mode]
 */
async function stabilizeShareholderErrorState(page, mode = '') {
  const shell = openShellLocator(page, mode);
  const root = (await shell.count()) > 0 ? shell : page.locator('body');
  await root.evaluate((scope) => {
    scope.querySelectorAll('[data-dp-surface], .dp-form').forEach((el) => {
      el.scrollTop = 0;
    });
    window.scrollTo(0, 0);
  });
}

/**
 * Errors ekranı öncesi: açık kabukta goCheckout ile doğrulama tetikle.
 * Sayfa genelindeki ilk buton gizli/yanlış modalda olabilir (diag: popup’ta inShell=false).
 * @param {import('@playwright/test').Page} page
 * @param {'popup'|'panel'} mode
 */
async function triggerShellValidationErrors(page, mode) {
  const shell = openShellLocator(page, mode);
  await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
  const form = formOf(shell);
  await form.waitFor({ state: 'visible', timeout: CHECK_MS });
  // Zengin hata ekranı: geçerli tutarla bilgi adımına geç, alanlar boşken gönder.
  const amountStep = form.locator('[data-dp-step="amount"]').first();
  if ((await amountStep.count()) > 0 && (await amountStep.isVisible())) {
    const hasCustom = (await form.locator(DP_SEL.amount).count()) > 0;
    const picked = hasCustom ? await resolveDonationFillAmount(shell, getActiveProfile()?.currency) : { fill: '' };
    await fillAmountStep(form, picked.fill);
    await advanceToDetails(form);
  }
  await form.locator(DP_SEL.submit).first().click({ timeout: CHECK_MS, noWaitAfter: true });
  await form
    .locator('[data-dp-error]')
    .filter({ hasText: /\S/ })
    .first()
    .waitFor({ state: 'visible', timeout: CHECK_MS })
    .catch(() => {
      throw new Error('boş gönderim sonrası görünür alan hatası oluşmadı');
    });
}

/**
 * Errors screenshot öncesi zorunlu iddia:
 * lastValidation.ok===false ve failures’taki HER alan için o alana ait görünür
 * .wdp-input-error mesajı. Başlık/özet (.wdp-header-status-invalid) tek başına yetmez.
 * @param {import('@playwright/test').Page} page
 * @param {'popup'|'panel'|''} mode
 * @returns {Promise<{ ok: boolean, detail: string, lastValidation: object|null, visibleErrors: string[], missingFieldMessages: string[] }>}
 */
async function readShellValidationErrorState(page, mode) {
  const shell = openShellLocator(page, mode);
  return shell.evaluate((root) => {
    const isShown = (el) => {
      if (!el) return false;
      const st = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    const step = root.querySelector('[data-dp-step]:not([hidden])') || root;
    // Görünür adımdaki boş zorunlu alanların her biri için görünür, metinli bir `data-dp-error` olmalı.
    const emptyRequired = Array.from(step.querySelectorAll('input[required]:not(:disabled), textarea[required]:not(:disabled)'))
      .filter((el) => isShown(el.closest('[data-dp-field]') || el) && String(el.value || '').trim() === '')
      .map((el) => el.getAttribute('name'))
      .filter(Boolean);
    const missingFieldMessages = [];
    const visibleErrors = [];
    for (const name of emptyRequired) {
      const err = root.querySelector('[data-dp-error="' + name + '"]');
      const text = err && isShown(err) ? String(err.textContent || '').trim() : '';
      if (!text) missingFieldMessages.push(name);
      else visibleErrors.push(name + ':' + text.slice(0, 80));
    }
    const ok = emptyRequired.length > 0 && missingFieldMessages.length === 0;
    return {
      ok,
      detail: [
        'boşZorunlu=' + (emptyRequired.join(',') || '(yok)'),
        'eksikAlanMesajı=' + (missingFieldMessages.join(',') || '(yok)'),
        'görünürHata=' + visibleErrors.length,
      ].join(' · '),
      lastValidation: null,
      visibleErrors,
      missingFieldMessages,
    };
  });
}

/**
 * Hata durumu ekranı: animasyon bitsin, odak/imleç gizlensin, scroll sabit.
 * @param {import('@playwright/test').Page} page
 * @param {{ shares?: boolean, shellMode?: 'popup'|'panel'|'' }} [opts]
 */
async function prepareErrorShot(page, opts = {}) {
  const shellMode = opts.shellMode || '';
  await page
    .evaluate(() => {
      const ae = document.activeElement;
      if (ae && typeof ae.blur === 'function') {
        ae.blur();
      }
      window.getSelection()?.removeAllRanges?.();
    })
    .catch((e) => catchSoft('prepareErrorShot:blur', e));

  if (opts.shares) {
    await stabilizeShareholderErrorState(page, shellMode);
  }

  await waitForAnimationsSettled(page);
  await page.addStyleTag({ content: FREEZE_ERROR_SHOT_CSS }).catch((e) => catchSoft('FREEZE_ERROR_SHOT_CSS', e));
  if (opts.shares) {
    await stabilizeShareholderErrorState(page, shellMode);
  }
  await page
    .evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelectorAll('[data-dp-surface], .dp-form').forEach((el) => {
        if (el && 'scrollTop' in el) el.scrollTop = 0;
      });
    })
    .catch((e) => catchSoft('prepareErrorShot:scroll', e));
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} dir
 * @param {string} name
 * @param {string[]} maskList
 * @param {{ fullPage?: boolean, scrollPage?: boolean }} [opts]
 */
/**
 * Sayfa ekranı: scrollbar gizle + scrollHeight 3×150 ms sabit (≤3 sn).
 * @param {import('@playwright/test').Page} page
 */
async function preparePageShotChrome(page) {
  await page
    .addStyleTag({
      content: `html{scrollbar-width:none!important;scroll-behavior:auto!important}
html::-webkit-scrollbar,body::-webkit-scrollbar,*::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}`,
    })
    .catch(() => {});
  const deadline = Date.now() + 3000;
  /** @type {number[]} */
  const heights = [];
  while (Date.now() < deadline) {
    const h = await readPageScrollHeight(page);
    heights.push(h);
    if (heights.length >= 3) {
      const a = heights[heights.length - 3];
      const b = heights[heights.length - 2];
      const c = heights[heights.length - 1];
      if (a === b && b === c) break;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} dir
 * @param {string} name
 * @param {string[]} maskList
 * @param {{ fullPage?: boolean, scrollPage?: boolean, shellOnly?: boolean, shellMode?: 'popup'|'panel'|'' }} [opts]
 */
async function shot(page, dir, name, maskList, opts = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const fullPage = opts.fullPage !== false;
  const scrollPage = opts.scrollPage !== false;
  const shellOnly = !!opts.shellOnly;
  const shellMode = opts.shellMode || '';
  const shellOpen = (await page.locator(SEL.openModalShell).count().catch(() => 0)) > 0;
  if (shellOpen || shellOnly) {
    await waitAndAssertShellOverlap(page, CHECK_MS);
  }
  await settleForScreenshot(page, { fullPage: shellOnly ? false : fullPage, scrollPage: shellOnly ? false : scrollPage });
  if (!shellOnly) {
    await preparePageShotChrome(page);
  }
  /** @type {import('@playwright/test').ElementHandle[]} */
  const shotStyles = [];
  const addShotStyle = async (content, label) => {
    try {
      const handle = await page.addStyleTag({ content });
      if (handle) shotStyles.push(handle);
    } catch (e) {
      catchSoft(label, e);
    }
  };
  // Stabilize / freeze yalnız ekran anında; işlevsel kontroller gerçek CSS görür.
  await addShotStyle(STABILIZE_SHOT_CSS, 'STABILIZE_SHOT_CSS');
  if (!shellOnly) {
    await hideComingSoonNoticeForShot(page).catch((e) => catchSoft('hideComingSoonNoticeForShot', e));
  }
  await addShotStyle(FREEZE_MOTION_CSS, 'freezeMotion');
  const file = path.join(dir, `${name}.png`);
  const removeShotStyles = async () => {
    for (const handle of shotStyles) {
      try {
        await handle.evaluate((el) => el.remove());
      } catch (e) {
        catchSoft('shotStyleRemove', e);
      }
    }
  };
  try {
    if (shellOnly) {
      await addShotStyle(SHELL_CAPTURE_FLAT_BACKDROP_CSS, 'SHELL_CAPTURE_FLAT_BACKDROP_CSS');
      // Overlay tam viewport + backdrop — kutu değil; ekran kutusu `[data-dp-surface]` (popup / sağ panel / alt sayfa).
      const shell = openShellLocator(page, shellMode);
      const content =
        shellMode === 'panel'
          ? shell.locator(SEL.sidePanelContent).first()
          : shell.locator(SEL.modalContent).first();
      const box = (await content.count().catch(() => 0)) > 0 ? content : shell;
      const visible = (await box.count().catch(() => 0)) > 0 && (await box.isVisible().catch(() => false));
      if (visible) {
        await box.screenshot({
          path: file,
          animations: 'disabled',
        });
        return file;
      }
      // Kabuk yoksa tam sayfaya düşme — boş/yanlış viewport baseline üretmesin
      throw new Error(
        `shellOnly screenshot: açık kabuk içeriği yok (mode=${shellMode || 'any'} sel=${shellMode === 'panel' ? SEL.sidePanelContent : SEL.modalContent})`
      );
    }
    const masks = [];
    for (const sel of maskList) {
      const loc = page.locator(sel);
      const n = await loc.count().catch(() => 0);
      for (let i = 0; i < n; i++) {
        const el = loc.nth(i);
        if (await el.isVisible().catch(() => false)) {
          masks.push(el);
        }
      }
    }
    await page.screenshot({
      path: file,
      fullPage,
      animations: 'disabled',
      caret: 'hide',
      mask: masks.length ? masks : undefined,
      maskColor: '#D0D0D0',
    });
    return file;
  } finally {
    await removeShotStyles();
  }
}

/**
 * @param {import('@playwright/test').Page} page
 */
async function openDonate(page) {
  const btn = page.locator(SEL.donateTrigger).filter({ visible: true }).first();
  const n = await btn.count();
  if (!n) {
    throw new Error('Bağış butonu bulunamadı');
  }
  await btn.click({ timeout: CHECK_MS });
  await openShellLocator(page).waitFor({ state: 'visible', timeout: CHECK_MS });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {'close'|'esc'|'backdrop'} how
 */
async function closeOpenShell(page, how) {
  const shell = openShellLocator(page);
  await shell.waitFor({ state: 'visible', timeout: CHECK_MS });

  if (how === 'esc') {
    await page.keyboard.press('Escape');
    await waitForShellClosed(page);
    return;
  }

  if (how === 'backdrop') {
    // layer.mjs: yüzey dışındaki overlay tıklaması katmanı kapatır.
    const box = await shell.boundingBox();
    if (!box) {
      throw new Error('Açık kabuk bounding box yok');
    }
    const cbox = await shell.locator(SEL.modalContent).first().boundingBox();
    let x = box.x + 4;
    let y = box.y + 4;
    if (cbox) {
      if (cbox.x - box.x > 20) {
        x = box.x + 8;
        y = box.y + Math.min(40, box.height / 2);
      } else if (cbox.y - box.y > 20) {
        x = box.x + Math.min(40, box.width / 2);
        y = box.y + 8;
      }
    }
    await page.mouse.click(x, y);
    await waitForShellClosed(page);
    return;
  }

  // Yalnızca açık katman içindeki kapatma düğmesi
  const closeBtn = shell.locator(SEL.modalClose).first();
  await closeBtn.waitFor({ state: 'visible', timeout: CHECK_MS });
  await closeBtn.click({ timeout: CHECK_MS });
  await waitForShellClosed(page);
}

/**
 * @param {import('@playwright/test').Locator} root
 */
/**
 * @param {import('@playwright/test').Locator} root
 * @returns {Promise<{ name: string, phone: string, email: string }>}
 */
/**
 * Gönderim hatası kilidi: sepete ekleme isteği sunucu hatası / ağ kesintisi / hız sınırı verince form
 * kilitli kalmamalı: görünür uyarı çıkar, ana düğme yeniden basılabilir olur, alanlar yazılabilir kalır.
 * Katman kapat → yeniden aç yolunda da alanlar yazılabilir olmalı.
 *
 * @param {object} opts
 */
async function runSubmitFaultChecks({ browser, contextOpts, env, productPath, guestExtra, failures, stats }) {
  const UNLOCK_MS = 11000;
  const CART_ADD_RE = /donation-panel(?:\/|%2F)v1(?:\/|%2F)cart(?:\/|%2F)add/i;
  pausePluginAjaxWatch();
  try {
    const openFreshForm = async (page) => {
      await page.goto(withCacheBust(env.E2E_BASE_URL, productPath, guestExtra), { waitUntil: 'domcontentloaded' });
      const trigger = page.locator(SEL.donateTrigger).filter({ visible: true }).first();
      if ((await trigger.count()) > 0) {
        await trigger.click({ timeout: CHECK_MS });
        await openShellLocator(page).waitFor({ state: 'visible', timeout: CHECK_MS });
      }
      const root = (await openShellLocator(page).count()) > 0 ? openShellLocator(page) : page.locator('[data-dp-exp]').first();
      await formOf(root).waitFor({ state: 'visible', timeout: CHECK_MS });
      return root;
    };

    /** @param {'status500'|'abort'|'status429'} mode */
    async function oneFault(mode) {
      const profile = getActiveProfile();
      const ctx =
        profile?.comingSoon || decideScenarioProduct(env, 'fixed', 'product-page').admin
          ? await asAdmin(browser, env, contextOpts)
          : await contextWithBypass(browser, contextOpts, env);
      const page = await ctx.newPage();
      try {
        await page.route(CART_ADD_RE, async (route) => {
          if (route.request().method() !== 'POST') return route.continue();
          if (mode === 'abort') return route.abort('failed');
          const status = mode === 'status429' ? 429 : 500;
          return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: false }) });
        });
        const root = await openFreshForm(page);
        await fillDonorFields(root, { amountFill: '25' });
        const form = formOf(root);
        const t0 = Date.now();
        await form.locator(DP_SEL.submit).first().click({ timeout: CHECK_MS, noWaitAfter: true });
        const summary = form.locator('[data-dp-summary].is-visible').first();
        await summary.waitFor({ state: 'visible', timeout: UNLOCK_MS });
        const text = String((await summary.textContent()) || '').trim();
        const busy = await form.locator(DP_SEL.submit).first().getAttribute('aria-disabled');
        const elapsed = Date.now() - t0;
        if (!text || busy === 'true' || elapsed > UNLOCK_MS) {
          failures.push(
            makeFailure({
              check: 'submit-fault',
              description: `Gönderim hatasında (${mode}) uyarı yok ya da düğme kilitli kaldı`,
              detail: `ms=${elapsed} limit=${UNLOCK_MS} metin=${text ? 'var' : 'boş'} aria-disabled=${busy}`,
            })
          );
          stats.failed += 1;
          return;
        }
        const name = form.locator(SEL.donorName).first();
        await name.fill('Fault Unlock');
        if ((await name.inputValue()) !== 'Fault Unlock') {
          failures.push(makeFailure({ check: 'submit-fault', description: `Hata sonrası ad alanı yazılamadı (${mode})` }));
          stats.failed += 1;
          return;
        }
        stats.passed += 1;
      } finally {
        await page.close().catch((e) => catchSoft('submit-fault:page.close', e));
        await ctx.close().catch((e) => catchSoft('submit-fault:ctx.close', e));
      }
    }

    await oneFault('status500');
    await oneFault('abort');
    await oneFault('status429');

    // Kapat → yeniden aç → yazılabilir
    const reopenProfile = getActiveProfile();
    const ctx = reopenProfile?.comingSoon
      ? await asAdmin(browser, env, contextOpts)
      : await contextWithBypass(browser, contextOpts, env);
    const page = await ctx.newPage();
    try {
      await openFreshForm(page);
      if ((await page.locator(SEL.openModalShell).count()) > 0) {
        await page.keyboard.press('Escape');
        await waitForShellClosed(page, CHECK_MS);
        await page.locator(SEL.donateTrigger).filter({ visible: true }).first().click({ timeout: CHECK_MS });
        await openShellLocator(page).waitFor({ state: 'visible', timeout: CHECK_MS });
      }
      const root = (await openShellLocator(page).count()) > 0 ? openShellLocator(page) : page.locator('[data-dp-exp]').first();
      const form = formOf(root);
      const custom = form.locator(DP_SEL.amount).first();
      const probeInput =
        (await custom.count()) > 0
          ? custom
          : form
              .locator('input[type="text"]:not([disabled]), input[type="tel"]:not([disabled])')
              .filter({ visible: true })
              .first();
      await probeInput.fill('7');
      const val = await probeInput.inputValue();
      if (val !== '7') {
        failures.push(
          makeFailure({ check: 'submit-fault', description: 'Kapat→yeniden aç sonrası alan yazılamadı', detail: `değer="${val}"` })
        );
        stats.failed += 1;
      } else {
        stats.passed += 1;
      }
    } finally {
      await page.close().catch((e) => catchSoft('submit-fault:reopen page.close', e));
      await ctx.close().catch((e) => catchSoft('submit-fault:reopen ctx.close', e));
    }
  } finally {
    resumePluginAjaxWatch();
  }
}

async function fillDonorFields(root, opts = {}) {
  const nameVal = 'E2E Test';
  let phoneVal = '5551234567';
  try {
    phoneVal = getActiveProfile()?.phone?.nationalExample || phoneVal;
  } catch {
    /* profil yoksa varsayılan */
  }
  const form = formOf(root);
  await form.waitFor({ state: 'visible', timeout: CHECK_MS });
  const amountStep = form.locator('[data-dp-step="amount"]').first();
  if (!opts.skipAmount && (await amountStep.count()) > 0 && (await amountStep.isVisible())) {
    await fillAmountStep(form, opts.amountFill);
  }
  await advanceToDetails(form);
  const emailVal = (await form.locator(SEL.donorEmail).count()) > 0 ? 'e2e@example.com' : '';
  await fillDonorDetails(form, { name: nameVal, phone: phoneVal, email: emailVal || undefined });
  return { name: nameVal, phone: phoneVal, email: emailVal };
}

/**
 * Doldurulan bağışçı alanları tıklamadan hemen önce hâlâ duruyor mu?
 * @param {import('@playwright/test').Locator} shell
 * @param {{ name?: string, phone?: string, customPrice?: string, addonPrice?: string }} expected
 * @param {ReturnType<typeof makeFailure>[]} failures
 * @param {string} check
 */
async function assertDonorFieldsPersist(shell, expected, failures, check) {
  const actual = await shell
    .evaluate((el) => {
      const root = el.closest('[data-dp-exp]') || el;
      const val = (sel) => {
        const node = root.querySelector(sel);
        return node ? String(node.value || '') : null;
      };
      return {
        name: val('input[name="donation_full_name"]'),
        phone: val('input[name="donation_phone"]'),
        custom: val('input.dp-custom__in[name="amount"]'),
        addon: val('input[name="addon_amount"]'),
      };
    })
    .catch(() => null);

  if (!actual) {
    failures.push(
      makeFailure({
        check: 'donor-fields-persist',
        description: 'Bağışçı alanları okunamadı (açık kabuk yok)',
        detail: `senaryo=${check}`,
      })
    );
    return;
  }

  /** @type {string[]} */
  const mismatches = [];
  if (expected.name != null && actual.name !== expected.name) {
    mismatches.push(
      `donation_full_name beklenen="${expected.name}" gerçek="${actual.name}"`
    );
  }
  if (expected.phone != null && actual.phone !== expected.phone) {
    mismatches.push(
      `donation_phone beklenen="${expected.phone}" gerçek="${actual.phone}"`
    );
  }
  if (expected.customPrice != null && actual.custom != null && actual.custom !== expected.customPrice) {
    mismatches.push(
      `amount beklenen="${expected.customPrice}" gerçek="${actual.custom}"`
    );
  }
  if (expected.addonPrice != null && actual.addon != null && actual.addon !== expected.addonPrice) {
    mismatches.push(
      `addon_amount beklenen="${expected.addonPrice}" gerçek="${actual.addon}"`
    );
  }
  if (mismatches.length) {
    failures.push(
      makeFailure({
        check: 'donor-fields-persist',
        description: 'Doldurulan bağışçı alanları tıklamadan önce kayboldu',
        detail: [`senaryo=${check}`, ...mismatches].join('\n'),
      })
    );
  }
}

/**
 * Admin oturumu: ürün Bağış sekmesi + Başarı (genel varsayılan) alt bağış ayarı.
 * Ziyaretçi sayfası düzenleme linkine bağlı değil.
 *
 * @param {import('@playwright/test').BrowserContext} authed
 * @param {Record<string,string>} env
 * @param {string} productSlug
 * @returns {Promise<{
 *   enabled: boolean,
 *   productWcId: number,
 *   globalWcId: number,
 *   resolvedWcId: number,
 *   expected: boolean,
 *   status: 'beklenir'|'atlandı',
 *   reason: string,
 *   detail: string
 * }>}
 */
/**
 * Başarı sekmesindeki genel alt bağış varsayılanı (bir kez okunur).
 * @param {import('@playwright/test').BrowserContext} authed
 * @param {Record<string,string>} env
 * @returns {Promise<number>}
 */
export async function readGlobalAddonWcId(authed, env) {
  const page = await authed.newPage();
  try {
    await page.goto(
      withCacheBust(env.E2E_BASE_URL, '/wp-admin/admin.php?page=donation-panel'),
      { waitUntil: 'domcontentloaded' }
    );
    const admin = await waitForWpAdminPage(page, 20000);
    if (!admin.ok) {
      return 0;
    }
    const successTab = page.locator('[data-tab="success-screen"]').first();
    if (await successTab.count()) {
      await successTab.click().catch(() => {});
      await page
        .locator('#sadaka_wc_product_id')
        .waitFor({ state: 'attached', timeout: CHECK_MS })
        .catch(() => {});
    }
    const globalSelect = page.locator('#sadaka_wc_product_id');
    if (await globalSelect.count()) {
      const g = await globalSelect.inputValue().catch(() => '');
      return Number.parseInt(String(g || ''), 10) || 0;
    }
    return 0;
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * @param {import('@playwright/test').BrowserContext} authed
 * @param {Record<string,string>} env
 * @param {string} productSlug
 * @param {{ globalWcId?: number, productId?: number }} [opts]
 */
export async function readProductAddonAdminConfig(authed, env, productSlug, opts = {}) {
  const empty = (reason, status = /** @type {'atlandı'|'hata'} */ ('atlandı')) => ({
    enabled: false,
    productWcId: 0,
    globalWcId: 0,
    resolvedWcId: 0,
    expected: false,
    status,
    reason,
    detail: reason,
  });
  let productId = Number(opts.productId) > 0 ? Number(opts.productId) : 0;
  if (productId > 0) {
    try {
      const viaEval = readAddonConfigViaEval(productId);
      if (viaEval && viaEval.status) {
        return viaEval;
      }
    } catch (evalErr) {
      console.error(
        `[e2e:catch-fail] addon eval: ${evalErr && evalErr.message ? evalErr.message : evalErr}`
      );
    }
  }
  const page = await authed.newPage();
  try {
    // Mağaza yöneticisi: ürün listesi araması yerine doğrudan post.php (Store API ID).
    if (!productId) {
      await page.goto(withCacheBust(env.E2E_BASE_URL, '/'), { waitUntil: 'domcontentloaded' }).catch((e) => {
        console.error(`[e2e:catch-fail] addon home: ${e && e.message ? e.message : e}`);
      });
      productId = await resolveProductIdBySlug(page, env.E2E_BASE_URL, productSlug);
    }
    if (!productId) {
      return empty('Store API’den ürün ID bulunamadı', 'hata');
    }
    try {
      const viaEval = readAddonConfigViaEval(productId);
      if (viaEval && viaEval.status) {
        return viaEval;
      }
    } catch (evalErr) {
      console.error(
        `[e2e:catch-fail] addon eval: ${evalErr && evalErr.message ? evalErr.message : evalErr}`
      );
    }
    async function gotoAdminEdit() {
      await page.goto(
        withCacheBust(env.E2E_BASE_URL, `/wp-admin/post.php?post=${productId}&action=edit`),
        { waitUntil: 'domcontentloaded', timeout: getActiveTimeouts().navigation }
      );
    }
    try {
      await gotoAdminEdit();
    } catch (navErr) {
      console.error(
        `[e2e:catch-fail] addon admin goto deneme 1: ${navErr && navErr.message ? navErr.message : navErr}`
      );
      await gotoAdminEdit();
    }
    const opened = await waitForWpAdminPage(page, getActiveTimeouts().navigation);
    if (!opened.ok) {
      console.error(
        `[e2e:catch-fail] addon admin: kind=${opened.kind} path=${opened.path} id=${productId}`
      );
      return empty(
        `ürün düzenleme sayfası açılamadı (#${productId}) kind=${opened.kind} path=${opened.path}`,
        'hata'
      );
    }
    await page.locator(SEL.productDonationTab).first().click().catch(() => {});
    await page
      .locator('#wdp_enable_addon_donation, #wdp_addon_wc_product_id')
      .first()
      .waitFor({ state: 'attached', timeout: getActiveTimeouts().expect })
      .catch(() => {});

    const enabled = await page
      .locator('#wdp_enable_addon_donation')
      .isChecked()
      .catch(() => false);

    let productWcId = 0;
    const productSelect = page.locator('#wdp_addon_wc_product_id');
    if ((await productSelect.count()) > 0) {
      const val = await productSelect.inputValue().catch(() => '');
      productWcId = Number.parseInt(String(val || ''), 10) || 0;
    }

    // Genel varsayılan — önbellekten veya bir kez oku
    let globalWcId =
      opts.globalWcId !== undefined && opts.globalWcId !== null
        ? Number(opts.globalWcId) || 0
        : 0;
    if (opts.globalWcId === undefined) {
      await page.goto(
        withCacheBust(env.E2E_BASE_URL, '/wp-admin/admin.php?page=donation-panel'),
        { waitUntil: 'domcontentloaded' }
      );
      const successTab = page.locator('[data-tab="success-screen"]').first();
      if (await successTab.count()) {
        await successTab.click().catch(() => {});
        await page
          .locator('#sadaka_wc_product_id')
          .waitFor({ state: 'attached', timeout: CHECK_MS })
          .catch(() => {});
      }
      const globalSelect = page.locator('#sadaka_wc_product_id');
      if (await globalSelect.count()) {
        const g = await globalSelect.inputValue().catch(() => '');
        globalWcId = Number.parseInt(String(g || ''), 10) || 0;
      }
    }

    const resolvedWcId = productWcId > 0 ? productWcId : globalWcId;
    let reason = '';
    let status = /** @type {'beklenir'|'atlandı'} */ ('beklenir');
    if (!enabled) {
      status = 'atlandı';
      reason = SKIP_REASONS.SETTING_OFF;
    } else if (resolvedWcId <= 0) {
      status = 'atlandı';
      reason = SKIP_REASONS.NO_WC_PRODUCT_ID;
    } else {
      reason = `beklenir — WC ürün #${resolvedWcId}`;
    }

    return {
      enabled: !!enabled,
      productWcId,
      globalWcId,
      resolvedWcId,
      expected: status === 'beklenir',
      status,
      reason,
      evidence: status === 'atlandı' ? SKIP_EVIDENCE.WP_DATA : '',
      detail: `enable=${enabled} ürün_id=${productWcId} genel_id=${globalWcId} → ${reason}`,
    };
  } catch (e) {
    return empty(`admin okuma hata: ${String(e.message || e)}`, 'hata');
  } finally {
    await page.close();
  }
}

/**
 * Liste/mağaza sayfasında ürün düğümlerini DOM ile bul (slug href / product id; metin son çare).
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ slug: string, id?: number, name?: string }} product
 * @returns {Promise<{
 *   found: boolean,
 *   hrefMatches: number,
 *   dataIdMatches: number,
 *   cardCount: number,
 *   containers: string[],
 *   hasDonate: boolean,
 *   donateCardClass: string,
 *   donateCardText: string
 * }>}
 */
async function findProductNodes(page, { slug, id = 0, name = '' }) {
  return page.evaluate(
    ({ productSlug, productId, productName }) => {
      const CARD_SEL =
        'li.product, .product, .wdp-card, article, .products > *';

      function normalizePath(href) {
        try {
          const u = new URL(href, location.origin);
          let p = u.pathname || '';
          if (p.length > 1 && p.endsWith('/')) {
            /* keep trailing slash for consistent /slug/ matching */
          } else if (p && !p.endsWith('/')) {
            p += '/';
          }
          return p;
        } catch (e) {
          return '';
        }
      }

      function pathMatchesSlug(pathname, s) {
        if (!s) return false;
        const clean = String(s).replace(/^\/+|\/+$/g, '');
        if (!clean) return false;
        const needle = `/${clean}/`;
        return pathname.endsWith(needle) || pathname.includes(needle);
      }

      function cardFor(el) {
        const via = el.closest(CARD_SEL);
        if (via) return via;
        let n = el;
        for (let i = 0; i < 4 && n && n.parentElement; i++) {
          n = n.parentElement;
        }
        return n || el;
      }

      function classSnippet(el) {
        if (!el) return '';
        const c = el.getAttribute && el.getAttribute('class');
        return c ? String(c).replace(/\s+/g, ' ').trim().slice(0, 160) : el.tagName || '';
      }

      /** @type {Set<Element>} */
      const hitEls = new Set();
      let hrefMatches = 0;
      let dataIdMatches = 0;

      for (const a of document.querySelectorAll('a[href]')) {
        const path = normalizePath(a.getAttribute('href') || '');
        if (pathMatchesSlug(path, productSlug)) {
          hrefMatches += 1;
          hitEls.add(cardFor(a));
        }
      }

      if (productId > 0) {
        const idStr = String(productId);
        const selectors = [
          `[data-product-id="${idStr}"]`,
          `[data-wdp-form="${idStr}"]`,
          `[data-dp-product="${idStr}"]`,
          `[data-product_id="${idStr}"]`,
          `.post-${idStr}`,
          `button[value="${idStr}"]`,
          `a[href*="add-to-cart=${idStr}"]`,
        ];
        for (const sel of selectors) {
          for (const el of document.querySelectorAll(sel)) {
            dataIdMatches += 1;
            hitEls.add(cardFor(el));
          }
        }
      }

      // Son çare: textContent + tr-TR (innerText / text-transform yok)
      if (hitEls.size === 0 && productName) {
        const needle = String(productName).toLocaleLowerCase('tr-TR');
        for (const node of document.querySelectorAll(CARD_SEL)) {
          const t = (node.textContent || '').toLocaleLowerCase('tr-TR');
          if (needle && t.includes(needle)) {
            hitEls.add(node);
          }
        }
      }

      const cards = Array.from(hitEls);
      const containers = cards.slice(0, 3).map((el) => classSnippet(el));

      let hasDonate = false;
      let donateCardClass = '';
      let donateCardText = '';
      for (const card of cards) {
        const text = card.textContent || '';
        const btn =
          /bağış\s*yap/i.test(text) ||
          !!card.querySelector(
            '.wdp-loop-donate, .wdp-card__cta, [data-dp-open], [data-dp-exp]'
          );
        if (btn) {
          hasDonate = true;
          donateCardClass = classSnippet(card);
          donateCardText = text.replace(/\s+/g, ' ').trim().slice(0, 120);
          break;
        }
      }

      if (!hasDonate && cards.length) {
        const first = cards[0];
        donateCardClass = classSnippet(first);
        donateCardText = (first.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      }

      return {
        found: cards.length > 0,
        hrefMatches,
        dataIdMatches,
        cardCount: cards.length,
        containers,
        hasDonate,
        donateCardClass,
        donateCardText,
      };
    },
    { productSlug: slug, productId: Number(id) || 0, productName: name || '' }
  );
}

/**
 * Liste/mağaza işlevsel kontrollerinden önce lazy içerik.
 * @param {import('@playwright/test').Page} page
 */
async function settleLoopPage(page) {
  const shopVisible = page.locator(SHOP_CARD_SEL).locator('visible=true');
  const listVisible = page
    .locator('.wdp-card, .wdp-list .wdp-card, .wdp-donations')
    .locator('visible=true');
  const shopN = await shopVisible.count();
  const listN = await listVisible.count();
  if (shopN === 0 && listN === 0) {
    try {
      await Promise.race([
        shopVisible.first().waitFor({ state: 'visible', timeout: 5000 }),
        listVisible.first().waitFor({ state: 'visible', timeout: 5000 }),
      ]);
    } catch (e) {
      console.error(`[e2e:catch-fail] settleLoopPage kart: ${e && e.message ? e.message : e}`);
    }
  }
  await settleForScreenshot(page, { fullPage: true, scrollPage: true });
}

/**
 * Ürün sayfası "Benzer Bağışlar" (Avada post-cards) + mağaza döngüsü:
 * her kartta görünür başlık ve görünür "Bağış Yap".
 *
 * @param {import('@playwright/test').Page} page
 * @param {'product'|'shop'} surface
 * @param {string} screenName
 * @param {ReturnType<typeof makeFailure>[]} failures
 * @param {{ passed?: number, failed?: number, skipped?: number }} [stats]
 * @param {{ productId?: number, role?: string, env?: object }} [ctx]
 */
async function assertLoopCardsTitleAndDonate(page, surface, screenName, failures, stats, skips, ctx = {}) {
  if (surface === 'shop') {
    const shopCards = page.locator(SHOP_CARD_SEL);
    const visibleCard = shopCards.locator('visible=true');
    try {
      await visibleCard.first().waitFor({ state: 'visible', timeout: 10000 });
    } catch (e) {
      const attached = await shopCards.count();
      const fail = shopCardsHiddenFailure(
        attached,
        e && e.message ? e.message : String(e)
      );
      failures.push(
        makeFailure({
          check: fail.check,
          description: fail.description,
          detail: `${fail.detail} screen=${screenName}`,
          screenshot: `${screenName}.png`,
        })
      );
      if (stats) stats.failed = (stats.failed || 0) + 1;
      return;
    }
  }
  let similarPat = 'benzer\\s*bağış';
  let donatePat = 'bağış\\s*yap';
  let cardSel = 'li.post-card, li.fusion-grid-column, .post-card, li.product, li.wc-block-product';
  let titleSel = '.fusion-title, .woocommerce-loop-product__title, .product-title, .wp-block-post-title, h2, h3';
  try {
    const p = getActiveProfile();
    similarPat = p.strings?.similarDonationsPattern || similarPat;
    donatePat = p.strings?.donateButtonPattern || donatePat;
    cardSel = p.selectors?.loopCards || cardSel;
    titleSel = p.selectors?.loopTitle || titleSel;
  } catch {
    /* profil yok */
  }
  const result = await page.evaluate(
    ({ surfaceKind, similarPat, donatePat, cardSel, titleSel, shopCardSel }) => {
    function visible(el) {
      if (!el) return false;
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return (
        st.display !== 'none' &&
        st.visibility !== 'hidden' &&
        Number.parseFloat(st.opacity || '1') > 0.05 &&
        r.width > 4 &&
        r.height > 4
      );
    }
    const benzerRe = new RegExp(similarPat, 'i');
    const donateRe = new RegExp(donatePat, 'i');
    /** @type {Element[]} */
    let cards = [];
    if (surfaceKind === 'product') {
      const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,.fusion-title,.fusion-title-heading'));
      const benzer = headings.find((h) => benzerRe.test(h.textContent || ''));
      const root =
        (benzer &&
          (benzer.closest(
            '.fusion-fullwidth, .fusion-builder-row, .related, section, .fusion-post-cards, .wp-block-woocommerce-product-collection, .wp-block-woocommerce-related-products'
          ) ||
            benzer.parentElement)) ||
        document.querySelector(
          '.fusion-post-cards, .related.products, .wp-block-woocommerce-product-collection, .wp-block-woocommerce-related-products'
        );
      if (root) {
        cards = Array.from(root.querySelectorAll(cardSel));
      }
    } else {
      cards = Array.from(document.querySelectorAll(shopCardSel)).slice(0, 12);
    }

    const rows = cards.map((card, i) => {
      const title = card.querySelector(titleSel) || null;
      const btn =
        Array.from(card.querySelectorAll('a, button')).find((el) =>
          donateRe.test((el.textContent || '').trim())
        ) || null;
      return {
        i,
        titleText: (title && (title.textContent || '').trim().slice(0, 80)) || '',
        titleVisible: visible(title),
        btnText: (btn && (btn.textContent || '').trim().slice(0, 40)) || '',
        btnVisible: visible(btn),
        cardVisible: visible(card),
      };
    });
    return { cardCount: cards.length, rows };
  },
    { surfaceKind: surface, similarPat, donatePat, cardSel, titleSel, shopCardSel: SHOP_CARD_SEL }
  );

  const rec = ctx.env?._resolvedProducts?.[ctx.role] || {};
  const related =
    surface === 'product'
      ? readRelatedProductIds(Number(ctx.productId || rec.id || 0), {
          relatedIds: rec.relatedIds,
          upsellIds: rec.upsellIds,
        })
      : { ok: false, ids: [], evidence: '' };
  const noRelatedFromWp = surface === 'product' && related.ok && related.ids.length === 0;

  if (result.cardCount < 1) {
    if (noRelatedFromWp) {
      const row = makeSkip({
        check: 'loop-cards-product',
        reason: SKIP_REASONS.NO_RELATED_PRODUCTS,
        evidence: SKIP_EVIDENCE.WP_DATA,
        detail: `product=${ctx.productId || rec.id || 0}`,
      });
      if (skips && classifySkip(row) === 'skip') {
        skips.push(row);
        if (stats) stats.skipped = (stats.skipped || 0) + 1;
        return;
      }
    }
    failures.push(
      makeFailure({
        check: `loop-cards-${surface}`,
        description:
          surface === 'product'
            ? 'Benzer Bağışlar kartı yok (WooCommerce related/upsell ID dolu veya okunamadı)'
            : 'Mağaza döngüsünde ürün kartı yok',
        detail: `screen=${screenName} relatedOk=${related.ok} relatedN=${related.ids.length}`,
        screenshot: `${screenName}.png`,
      })
    );
    if (stats) stats.failed = (stats.failed || 0) + 1;
    return;
  }

  const classified = classifyLoopCardsResult(result.rows, {
    requireVisible: surface === 'shop' || !noRelatedFromWp,
  });
  const hiddenProductSection =
    surface === 'product' &&
    result.cardCount >= 1 &&
    classified.reason === 'hidden-section';
  if (hiddenProductSection) {
    const hide = await page.evaluate(diagnoseRelatedHideBrowser, {
      rootSel: RELATED_ROOT_SEL,
      similarPat,
      cardSel,
      pluginPath: PLUGIN_STYLE_PATH,
    });
    const outcome = decideRelatedHideOutcome(hide);
    writeRelatedHideDebug({ ...hide, verdict: outcome.action === 'fail' ? 'plugin' : outcome.action === 'skip' ? 'theme' : hide.verdict });
    if (outcome.action === 'fail') {
      failures.push(
        makeFailure({
          check: 'plugin-hides-related',
          description: outcome.description,
          detail: outcome.detail,
          screenshot: `${screenName}.png`,
        })
      );
      if (stats) stats.failed = (stats.failed || 0) + 1;
      return;
    }
    if (outcome.action === 'skip') {
      const row = makeSkip({
        check: 'theme-hides-related',
        reason: outcome.reason,
        evidence: outcome.evidence,
        source: outcome.source,
        detail: outcome.detail,
      });
      if (skips && classifySkip(row) === 'skip') {
        skips.push(row);
        if (stats) stats.skipped = (stats.skipped || 0) + 1;
        return;
      }
      failures.push(
        makeFailure({
          check: 'plugin-hides-related',
          description: 'İlgili ürün gizleme kaynağı eklenti yolu (css-source reddedildi)',
          detail: outcome.detail,
          screenshot: `${screenName}.png`,
        })
      );
      if (stats) stats.failed = (stats.failed || 0) + 1;
      return;
    }
  }
  if (classified.status === 'skip') {
    if (noRelatedFromWp) {
      const row = makeSkip({
        check: 'loop-cards-product',
        reason: SKIP_REASONS.NO_RELATED_PRODUCTS,
        evidence: SKIP_EVIDENCE.WP_DATA,
        detail: `product=${ctx.productId || rec.id || 0}`,
      });
      if (skips && classifySkip(row) === 'skip') {
        skips.push(row);
        if (stats) stats.skipped = (stats.skipped || 0) + 1;
        return;
      }
    }
    failures.push(
      makeFailure({
        check: `loop-cards-${surface}`,
        description:
          surface === 'product'
            ? 'Benzer Bağışlar kartı görünür değil (WooCommerce related/upsell ID dolu)'
            : 'Mağaza döngüsü kartı yok',
        detail: `${classified.reason} screen=${screenName}`,
        screenshot: `${screenName}.png`,
      })
    );
    if (stats) stats.failed = (stats.failed || 0) + 1;
    return;
  }
  if (classified.status === 'fail') {
    failures.push(
      makeFailure({
        check: `loop-cards-${surface}`,
        description:
          surface === 'product'
            ? 'Benzer Bağışlar: her görünür kartta başlık + "Bağış Yap" olmalı'
            : 'Mağaza: her kartta görünür başlık + "Bağış Yap" olmalı',
        detail:
          classified.reason +
          ' ' +
          (classified.bad.length ? classified.bad.slice(0, 6).map(formatLoopCardFail).join(' | ') : ''),
        screenshot: `${screenName}.png`,
      })
    );
    if (stats) stats.failed = (stats.failed || 0) + 1;
  } else if (stats) {
    stats.passed = (stats.passed || 0) + 1;
  }
}

/**
 * Ürün sayfası: görünür tam olarak BİR eklenti girişi (form veya eklenti düğmesi).
 * Tema düğmesi sayılmaz. Çözümleyici farklıysa UYARI. Düğmeyse kabuk açılır.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} display
 * @param {string} productKey
 * @param {string} screenName
 * @param {ReturnType<typeof makeFailure>[]} failures
 * @param {{ passed?: number, failed?: number, skipped?: number, warned?: number }} [stats]
 * @param {Array<{check:string,description:string,detail?:string}>} [warnings]
 */
async function assertProductPageDisplay(page, display, productKey, screenName, failures, stats, warnings) {
  const native = await page.evaluate(nativeCartProbeBrowser, {
    excludeSel: LOOP_EXCLUDE_SEL,
    formSel: NATIVE_CART_FORM_SEL,
    btnSel: NATIVE_ATC_BTN_SEL,
    stickySel: STICKY_ATC_SEL,
  });
  const ui = await collectVisiblePluginEntry(page);

  const nativeClassified = classifyNativeCartVisibility(native);
  if (!nativeClassified.ok) {
    failures.push(
      makeFailure({
        check: `product-${productKey}`,
        description: 'Ürün sayfasında hâlâ yerel WooCommerce sepete ekle var',
        detail: nativeClassified.reason,
        screenshot: `${screenName}.png`,
      })
    );
    if (stats) stats.failed = (stats.failed || 0) + 1;
    return;
  }

  const resolved = resolveDisplayFromSources({ display, displayAttr: ui.displayAttr });
  const classified = classifyVisiblePluginEntry({
    inlineVisible: ui.inlineVisible,
    panelVisible: ui.panelVisible,
    popupVisible: ui.popupVisible,
  });
  if (!classified.ok) {
    failures.push(
      makeFailure({
        check: `product-${productKey}`,
        description:
          classified.total === 0
            ? 'Görünür eklenti giriş noktası yok'
            : 'Birden fazla eklenti giriş noktası',
        detail: `display=${resolved || '(boş)'} inline=${ui.inlineVisible} panel=${ui.panelVisible} popup=${ui.popupVisible} ${classified.reason}`,
        screenshot: `${screenName}.png`,
      })
    );
    if (stats) stats.failed = (stats.failed || 0) + 1;
    return;
  }

  const warn = displayMismatchWarning(resolved, classified.kind);
  if (warn) {
    const row = {
      check: `product-${productKey}`,
      description: warn,
      detail: `display=${resolved || '(boş)'} kind=${classified.kind}`,
    };
    if (Array.isArray(warnings)) warnings.push(row);
    if (stats) stats.warned = (stats.warned || 0) + 1;
    console.warn(`[${row.check}] ${warn} ${row.detail}`);
  }

  if (classified.kind === 'form') {
    if (stats) stats.passed = (stats.passed || 0) + 1;
    return;
  }

  const mode = classified.kind === 'panel' ? 'panel' : 'popup';
  const triggerSel = classified.kind === 'panel' ? SEL.sidePanelTrigger : SEL.centeredPopupTrigger;
  const n = await page.locator(triggerSel).count();
  let clicked = false;
  for (let i = 0; i < n; i += 1) {
    const btn = page.locator(triggerSel).nth(i);
    const inLoop = await btn.evaluate(
      (el, excludeSel) =>
        !!(el.classList.contains('wdp-loop-donate') || (el.closest && el.closest(excludeSel))),
      LOOP_EXCLUDE_SEL
    );
    if (inLoop) continue;
    if (!(await btn.isVisible())) continue;
    await clickShellTrigger(btn, CHECK_MS);
    clicked = true;
    break;
  }
  if (!clicked) {
    failures.push(
      makeFailure({
        check: `product-${productKey}-open`,
        description: 'Birincil bağış düğmesi tıklanamadı',
        detail: `display=${resolved} mode=${mode}`,
        screenshot: `${screenName}.png`,
      })
    );
    if (stats) stats.failed = (stats.failed || 0) + 1;
    return;
  }
  const shell = openShellLocator(page, mode);
  try {
    await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
  } catch (e) {
    failures.push(
      makeFailure({
        check: `product-${productKey}-open`,
        description: classified.kind === 'panel' ? 'Panel açılmadı' : 'Popup açılmadı',
        error: e,
        screenshot: `${screenName}.png`,
      })
    );
    if (stats) stats.failed = (stats.failed || 0) + 1;
    return;
  }
  const closer = shell.locator(SEL.modalClose).first();
  if ((await closer.count()) > 0) {
    try {
      await closer.click({ timeout: CHECK_MS });
    } catch (clickErr) {
      const msg = String(clickErr && clickErr.message ? clickErr.message : clickErr);
      if (/intercepts pointer events|not stable|Timeout/i.test(msg)) {
        await closer.click({ timeout: CHECK_MS, force: true });
      } else {
        throw clickErr;
      }
    }
    await waitForShellClosed(page, CHECK_MS);
  }
  if (stats) stats.passed = (stats.passed || 0) + 1;
}

/**
 * Mağaza + bağış listesinde her bağış ürününde "Bağış Yap".
 * @param {object} opts
 */
async function assertDonationLoopButtons({
  guest,
  env,
  products,
  productUrls,
  failures,
  stats,
  guestExtra = {},
}) {
  const page = await guest.newPage();
  try {
    try {
      await page.goto(withCacheBust(env.E2E_BASE_URL, '/', guestExtra), {
        waitUntil: 'domcontentloaded',
      });
    } catch (e) {
      console.error(`[e2e:catch-fail] loop-donate ana sayfa: ${e && e.message ? e.message : e}`);
    }
    /** @type {Array<{key:string,slug:string,id:number,name:string}>} */
    const donationProducts = [];
    for (const [key, slug] of Object.entries(products)) {
      const loopDecision = decideScenarioProduct(env, key, 'loop-donate');
      if (loopDecision.action === 'skip') continue;
      const rec = env._resolvedProducts?.[key];
      const pathSlug = loopProductSlug(rec, slug);
      const recId = Number(rec?.id || 0) || 0;
      const id = recId || (await resolveProductIdBySlug(page, env.E2E_BASE_URL, pathSlug, recId));
      let name = rec?.title || pathSlug || slug;
      if (id) {
        const info = await page.evaluate(
          async ({ base, pid }) => {
            try {
              const res = await fetch(`${base}/wp-json/wc/store/v1/products/${pid}`, {
                credentials: 'same-origin',
              });
              if (!res.ok) return null;
              const data = await res.json();
              return { name: String(data.name || ''), id: Number(data.id) || pid };
            } catch (e) {
              return null;
            }
          },
          { base: env.E2E_BASE_URL.replace(/\/$/, ''), pid: id }
        );
        if (info && info.name) name = info.name;
      }
      donationProducts.push({ key, slug: pathSlug, id: id || 0, name });
    }

    for (const [label, rel] of [
      ['shop', env.E2E_SHOP_PAGE],
      ['list', env.E2E_LIST_PAGE],
    ]) {
      await page.goto(withCacheBust(env.E2E_BASE_URL, rel, guestExtra), {
        waitUntil: 'domcontentloaded',
      });
      await settleLoopPage(page);

      for (const prod of donationProducts) {
        const hit = await findProductNodes(page, {
          slug: prod.slug,
          id: prod.id,
          name: prod.name,
        });

        if (!hit.found) {
          failures.push(
            makeFailure({
              check: `loop-donate-${label}-${prod.key}`,
              description: `Bağış ürünü listede/mağazada görünmeli: ${prod.name || prod.slug}`,
              detail: [
                `sayfa=${label}`,
                `slug=${prod.slug}`,
                `id=#${prod.id}`,
                `hrefEşleşme=${hit.hrefMatches}`,
                `dataProductIdEşleşme=${hit.dataIdMatches}`,
                `kapsayıcılar=${hit.containers.join(' | ') || '(yok)'}`,
              ].join(' '),
              screenshot: `desktop-${label === 'shop' ? 'shop' : 'list'}.png`,
            })
          );
          stats.failed += 1;
          continue;
        }

        if (!hit.hasDonate) {
          failures.push(
            makeFailure({
              check: `loop-donate-${label}-${prod.key}`,
              description: `"Bağış Yap" eksik: ${prod.name || prod.slug}`,
              detail: [
                `sayfa=${label}`,
                `slug=${prod.slug}`,
                `id=#${prod.id}`,
                `hrefEşleşme=${hit.hrefMatches}`,
                `dataProductIdEşleşme=${hit.dataIdMatches}`,
                `kartlar=${hit.cardCount}`,
                `kapsayıcı.class=${hit.donateCardClass || '(yok)'}`,
                `metin="${hit.donateCardText || ''}"`,
              ].join(' '),
              screenshot: `desktop-${label === 'shop' ? 'shop' : 'list'}.png`,
            })
          );
          stats.failed += 1;
        } else {
          stats.passed += 1;
        }
      }
    }
  } catch (e) {
    failures.push(
      makeFailure({
        check: 'loop-donate',
        description: 'Mağaza/liste Bağış Yap kontrolü hata verdi',
        error: e,
      })
    );
    stats.failed += 1;
  } finally {
    await page.close();
  }
  void productUrls;
}

/**
 * Alt bağış (addon) senaryosu — popup veya panel.
 * popup → liste kısa kodu (ortadaki modal); panel → ürün sayfası (sağ panel).
 * Yapılandırma yoksa atlanır (hata sayılmaz); ayar var ama buton yoksa hata.
 * @param {object} opts
 * @param {import('@playwright/test').BrowserContext} opts.context
 * @param {import('@playwright/test').BrowserContext} opts.authed
 * @param {Record<string,string>} opts.env
 * @param {string} opts.productPath
 * @param {string} opts.productSlug
 * @param {'fixed'|'custom'} opts.productKey
 * @param {'popup'|'panel'} opts.mode
 * @param {string} [opts.listPagePath] popup için liste yolu (varsayılan env.E2E_LIST_PAGE)
 * @param {number} [opts.productId] data-product-id eşlemesi
 * @param {ReturnType<typeof makeFailure>[]} opts.failures
 * @param {Array<{check:string,description:string,detail?:string}>} opts.skips
 * @param {{ passed: number, skipped: number, failed: number }} opts.stats
 * @param {string} opts.addonAmount
 */
export async function runAddonScenario({
  context,
  authed,
  env,
  productPath,
  productSlug,
  productKey,
  mode,
  listPagePath,
  productId = 0,
  failures,
  skips,
  stats,
  flaky,
  addonAmount,
  addonProductIds,
  adminConfigCache,
  /** @type {{ enabled?: boolean, onCollected?: (d: object) => void, runLabel?: string }|undefined} */
  failDiagnostics,
  noSideCart = false,
}) {
  const check = `addon-${productKey}-${mode}`;
  const runLabel = (failDiagnostics && failDiagnostics.runLabel) || 'run';
  const wantDiag = !!(failDiagnostics && failDiagnostics.enabled !== false);
  const paths = tracePaths(runLabel, check);
  const timeline = createTimeline(check);
  const guestExtra = {
    ...comingSoonQuery(env, getActiveProfile()),
  };
  if (wantDiag) {
    await installPageProbe(context).catch((e) => catchFail('installPageProbe:addon', e));
  }
  const page = await context.newPage();
  const cacheProbe = wantDiag ? attachDocumentCacheProbe(page) : { get: () => ({}), dispose: () => {} };
  const postedAddon = { fields: {} };
  /** @type {object|null} */
  let firstAttemptBundle = null;

  page.on('request', (req) => {
    if (!isDonationAddToCartRequest(req)) return;
    try {
      const body = JSON.parse(req.postData() || '{}');
      for (const [k, v] of Object.entries(body)) {
        if (k.startsWith('addon_')) postedAddon.fields[k] = String(v);
      }
    } catch (e) {
      catchSoft('addon:post-json', e);
    }
  });

  try {
    // Önce admin yapılandırması (atlandı / beklenir)
    timeline.mark('admin-config');
    let cfg = adminConfigCache.get(productSlug);
    if (!cfg || cfg.status === 'hata') {
      cfg = await readProductAddonAdminConfig(authed, env, productSlug, {
        productId: Number(productId) || 0,
      });
      if (cfg.status !== 'hata') adminConfigCache.set(productSlug, cfg);
    }
    if (cfg.resolvedWcId > 0 && Array.isArray(addonProductIds)) {
      addonProductIds.push(cfg.resolvedWcId);
    }

    if (!cfg.expected) {
      const row = makeSkip({
        check,
        reason: cfg.reason,
        evidence: cfg.evidence || SKIP_EVIDENCE.WP_DATA,
        detail: cfg.detail,
      });
      if (cfg.status === 'hata' || classifySkip(row) === 'fail') {
        failures.push(
          makeFailure({
            check,
            description: `Altyapı atlaması hata: ${cfg.reason}`,
            detail: cfg.detail || cfg.reason,
          })
        );
        stats.failed += 1;
        return { ok: false, check, skipped: false };
      }
      skips.push(row);
      stats.skipped += 1;
      return { ok: true, check, skipped: true };
    }

    timeline.mark('empty-cart');
    await emptyCart(page, env.E2E_BASE_URL);
    // popup: liste sayfasından ortadaki modal; panel: ürün sayfasından sağ panel
    const openPath =
      mode === 'popup'
        ? popupPagePath(env, listPagePath)
        : productPath;
    timeline.mark('goto-product');
    await page.goto(withCacheBust(env.E2E_BASE_URL, openPath, guestExtra), {
      waitUntil: 'domcontentloaded',
    });

    timeline.mark('open-shell');
    if (mode === 'popup') {
      await revealListProductTrigger(page, productId);
    }
    let trigger = shellTriggerLocator(page, mode, { productId });
    if ((await trigger.count()) === 0) {
      trigger =
        mode === 'panel'
          ? page.locator(SEL.sidePanelTrigger).first()
          : page.locator(SEL.centeredPopupTrigger).first();
    }
    await clickShellTrigger(trigger, CHECK_MS);
    const shell = openShellLocator(page, '');
    await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
    const openedKind = await shell.evaluate((el) => {
      const root = el.closest('[data-dp-exp]');
      return root ? String(root.getAttribute('data-dp-kind') || '') : '';
    });
    if (mode === 'panel' && openedKind !== 'side_panel') {
      failures.push(
        makeFailure({
          check,
          description: 'Addon panel senaryosu sağ panel açmadı — sağ panel bekleniyordu',
          detail: `sayfa=${openPath} productId=${productId} kind=${openedKind}`,
          screenshot: `desktop-${mode}-${productKey}-open.png`,
        })
      );
      stats.failed += 1;
      return { ok: false, check, skipped: false };
    }
    const form = formOf(shell);
    await form.waitFor({ state: 'visible', timeout: CHECK_MS });

    const toggle = form.locator(SEL.addonToggle).first();
    if ((await toggle.count()) === 0) {
      failures.push(
        makeFailure({
          check,
          description: 'Alt bağış ayarı var (beklenir) ama ek bağış onay kutusu formda yok',
          detail: `[data-dp-addon] / addon_active yok — ${cfg.detail}`,
          screenshot: `desktop-${mode}-${productKey}-open.png`,
        })
      );
      stats.failed += 1;
      return { ok: false, check, skipped: false };
    }
    // Ek bağışın WooCommerce ürün kimliği sunucu tarafından çözülür (yönetici ayarı / ürün meta).
    const altWcFromDom = '';
    const expectedWcId = cfg.resolvedWcId || 0;
    if (expectedWcId > 0 && Array.isArray(addonProductIds)) {
      addonProductIds.push(expectedWcId);
    }

    timeline.mark('fill-amount');
    const amountStep = form.locator('[data-dp-step="amount"]').first();
    if ((await amountStep.count()) > 0 && (await amountStep.isVisible())) {
      let fill;
      if (productKey === 'custom') fill = '250';
      else if ((await form.locator(DP_SEL.amount).count()) > 0) {
        fill = (await resolveDonationFillAmount(shell, getActiveProfile()?.currency)).fill;
      }
      await fillAmountStep(form, fill);
    }

    timeline.mark('open-addon');
    await setChecked(toggle, true);
    const fixedAddon = Number(await form.getAttribute('data-addon-fixed')) || 0;
    const isFixedAddon = fixedAddon > 0;
    const price = form.locator(SEL.addonPrice).first();
    if (!isFixedAddon) {
      await form.locator(SEL.addonPanel).first().waitFor({ state: 'visible', timeout: CHECK_MS });
      await price.fill(String(addonAmount));
    }
    const errsBefore = await visibleValidationErrors(page);
    const addonAttrs = isFixedAddon
      ? { name: 'addon_active', required: false, min: null, readonly: true, value: String(fixedAddon), type: 'checkbox' }
      : await price.evaluate((el) => ({
          name: el.getAttribute('name'),
          required: el.required || el.hasAttribute('required'),
          min: el.getAttribute('min'),
          readonly: !!el.readOnly,
          value: el.value,
          type: el.getAttribute('type'),
        }));
    const sameNameCount = await page.locator('input[name="addon_amount"]').count();

    timeline.mark('fill-donor');
    const donorFilled = await fillDonorFields(shell, { skipAmount: true });
    const expectedAddonVal = isFixedAddon ? undefined : String(addonAmount);
    await assertDonorFieldsPersist(
      shell,
      {
        name: donorFilled.name,
        phone: donorFilled.phone,
        addonPrice: expectedAddonVal,
      },
      failures,
      check
    );

    const addBtn = form.locator(SEL.addToCart).first();
    const tClick = Date.now();
    if (wantDiag) {
      await startDomMutationProbe(page).catch((e) => catchFail('startDomMutationProbe', e));
    }
    // Akış aralığını bozma: yalnızca anlık okuma (ek bekleme yok)
    const snapBeforeClick = wantDiag
      ? await snapshotAddonAndButton(page).catch(() => null)
      : null;
    /** @type {Promise<object|null>|null} */
    let snapAfter50Promise = null;
    if (wantDiag) {
      snapAfter50Promise = (async () => {
        await new Promise((r) => setTimeout(r, 50));
        return snapshotAddonAndButton(page).catch(() => null);
      })();
    }
    timeline.mark('click-add-to-cart');
    const ajax = await clickAddToCartWithRetry(page, addBtn, {
      checkId: check,
      onAttemptFail: async (info) => {
        const snapAfter50 = snapAfter50Promise
          ? await snapAfter50Promise.catch(() => null)
          : null;
        const probe = await collectPageProbeLogs(page);
        const clickDiag = await collectAddToCartDiagnostics(page, addBtn, {
          networkTail: info.networkRaw || [],
        }).catch((e) => ({ error: String(e.message || e) }));
        const bundle = {
          phase: 'attempt1-before-retry',
          check,
          attempt: info.attempt,
          ajax: info.ajax,
          buttonState: info.buttonState,
          networkRaw: info.networkRaw,
          consoleErrors: info.consoleErrors,
          clickDiag,
          lastValidation: clickDiag && clickDiag.lastValidation ? clickDiag.lastValidation : null,
          visibleErrors: clickDiag && clickDiag.visibleErrors ? clickDiag.visibleErrors : [],
          fields: clickDiag && clickDiag.fields ? clickDiag.fields : [],
          cacheHeaders: cacheProbe.get(),
          activeScenarios: listActiveScenarios(),
          timeline: timeline.toJSON(),
          postedAddon: postedAddon.fields,
          snapBeforeClick,
          snapAfter50ms: snapAfter50,
          pageEvents: probe.pageEvents,
          listeners: probe.listeners,
          xhrLog: probe.xhrLog,
          validation: probe.validation,
        };
        firstAttemptBundle = bundle;
        writeDebugJson(paths.firstAttemptJson, bundle);
        return bundle;
      },
    });
    timeline.mark('verify-cart');
    await page
      .waitForFunction(async () => {
        try {
          const res = await fetch('/wp-json/wc/store/v1/cart', { credentials: 'same-origin' });
          if (!res.ok) return false;
          const data = await res.json();
          return Array.isArray(data.items) && data.items.length >= 1;
        } catch (e) {
          return false;
        }
      }, { timeout: CHECK_MS })
      .catch(() => {});
    const errsAfter = await visibleValidationErrors(page);
    const items = await cartItemsDetail(page, env.E2E_BASE_URL);
    const expectedAddon = isFixedAddon
      ? fixedAddon
      : Number.parseFloat(String(addonAmount));

    const hasMain = items.length >= 1;
    // Birincil: alt bağış WC ürün ID eşlemesi
    const addonByProduct =
      expectedWcId > 0 ? items.find((it) => Number(it.id) === expectedWcId) : null;
    // İkincil: tutar (±0,01)
    const amountOk =
      addonByProduct &&
      Number.isFinite(Number.parseFloat(addonByProduct.totals)) &&
      Math.abs(Number.parseFloat(addonByProduct.totals) - expectedAddon) < 0.01;

    const ok =
      ajax.ok &&
      !ajax.timedOut &&
      items.length >= 2 &&
      hasMain &&
      !!addonByProduct &&
      !!amountOk &&
      !errsAfter.some((t) => /zorunlu|geçerli bir alt bağış/i.test(t));

    // Mutation beklemesi yalnızca hata yolunda (başarıda 2 sn israf etme)
    let mutationSummary = null;
    if (wantDiag) {
      const waitMs = ok ? 0 : Math.max(0, 2000 - (Date.now() - tClick));
      mutationSummary = await stopDomMutationProbe(page, waitMs).catch(() => null);
    }

    if (!ok) {
      let clickDiag = null;
      if (wantDiag) {
        clickDiag = await collectAddToCartDiagnostics(page, addBtn, {
          networkTail: ajax.networkRaw || [],
        }).catch((e) => ({ error: String(e.message || e) }));
        const debugBundle = {
          phase: 'final-fail',
          check,
          runLabel,
          ajax,
          postedAddon: postedAddon.fields,
          errsBefore,
          errsAfter,
          items,
          clickDiag,
          mutationSummary,
          addonAttrs,
          cacheHeaders: cacheProbe.get(),
          activeScenarios: listActiveScenarios(),
          timeline: timeline.toJSON(),
          firstAttempt: firstAttemptBundle || ajax.firstAttemptDiag || null,
          debugFiles: {
            json: path.relative(ROOT, paths.json),
            firstAttempt: path.relative(ROOT, paths.firstAttemptJson),
            trace: path.relative(ROOT, paths.zip),
          },
        };
        writeDebugJson(paths.json, debugBundle);
        if (failDiagnostics && typeof failDiagnostics.onCollected === 'function') {
          failDiagnostics.onCollected(debugBundle);
        }
      }
      failures.push(
        makeFailure({
          check,
          description: 'Alt bağış (addon) sepete ana bağışla birlikte eklenmeli',
          detail: [
            `HTTP ${ajax.status} ok=${ajax.ok} timedOut=${ajax.timedOut}`,
            `yanıt (ilk 300): ${ajax.bodyPreview}`,
            `buton: visible=${ajax.buttonState?.visible} disabled=${ajax.buttonState?.disabled}`,
            `denemeler: ${JSON.stringify(ajax.attempts || [])}`,
            `son 15 network: ${(ajax.networkTail || []).join(' | ') || '(yok)'}`,
            `konsol hataları: ${(ajax.consoleErrors || []).join(' | ') || '(yok)'}`,
            wantDiag ? `debug: ${path.relative(ROOT, paths.json)}` : '',
            wantDiag ? `trace: ${path.relative(ROOT, paths.zip)}` : '',
            clickDiag
              ? `teşhis: ${JSON.stringify({
                  formFlags: clickDiag.formFlags,
                  addonFlags: clickDiag.addonFlags,
                  modules: clickDiag.modules,
                  topAtPoint: clickDiag.topAtPoint,
                  jqEvents: clickDiag.jqEvents,
                  nonce: clickDiag.nonce,
                  nonces: clickDiag.nonces,
                  buttonOuterHTML: clickDiag.buttonOuterHTML,
                  cacheHeaders: cacheProbe.get(),
                  activeScenarios: listActiveScenarios(),
                  mutations: mutationSummary,
                })}`
              : '',
            `beklenen WC ürün id: ${expectedWcId} (dom=${altWcFromDom || '-'} admin=${cfg.resolvedWcId})`,
            `beklenen tutar: ${expectedAddon}`,
            `ürün eşleşmesi: ${addonByProduct ? 'evet' : 'hayır'}`,
            `tutar eşleşmesi (±0,01): ${amountOk ? 'evet' : 'hayır'}`,
            `görünen hatalar (önce): ${errsBefore.join(' | ') || '(yok)'}`,
            `görünen hatalar (sonra): ${errsAfter.join(' | ') || '(yok)'}`,
            `addon input: ${JSON.stringify(addonAttrs)}`,
            `aynı name input sayısı: ${sameNameCount}`,
            `POST addon_* : ${JSON.stringify(postedAddon.fields)}`,
            `sepet: ${JSON.stringify(items)}`,
            `yapılandırma: ${cfg.detail}`,
          ]
            .filter(Boolean)
            .join('\n'),
          screenshot: `desktop-${mode}-${productKey}-open.png`,
          debugFile: wantDiag ? path.relative(ROOT, paths.json) : undefined,
        })
      );
      stats.failed += 1;
      return { ok: false, check, skipped: false, debugFile: paths.json, traceFile: paths.zip };
    }
    if (ajax.flaky && Array.isArray(flaky)) {
      const first = (ajax.attempts || []).find((a) => a.attempt === 1);
      flaky.push({
        check,
        firstError: first?.error || 'waitForResponse timeout',
        attemptMs: (ajax.attempts || []).map((a) => a.ms),
      });
    }
    stats.passed += 1;
    return { ok: true, check, skipped: false, flaky: !!ajax.flaky };
  } catch (e) {
    const errs = await visibleValidationErrors(page).catch(() => []);
    if (wantDiag) {
      writeDebugJson(paths.json, {
        phase: 'exception',
        check,
        error: String(e.message || e),
        activeScenarios: listActiveScenarios(),
        timeline: timeline.toJSON(),
        cacheHeaders: cacheProbe.get(),
      });
    }
    failures.push(
      makeFailure({
        check,
        description: 'Addon senaryosu hata verdi',
        detail: [String(e.message || e), errs.length ? `form hataları: ${errs.join(' | ')}` : '']
          .filter(Boolean)
          .join('\n'),
        screenshot: `desktop-${mode}-${productKey}-open.png`,
        debugFile: wantDiag ? path.relative(ROOT, paths.json) : undefined,
      })
    );
    stats.failed += 1;
    return { ok: false, check, skipped: false, error: String(e.message || e) };
  } finally {
    cacheProbe.dispose();
    timeline.end();
    await emptyCart(page, env.E2E_BASE_URL).catch((e) => catchFail('emptyCart', e));
    await page.close();
  }
}

/**
 * En fazla `limit` eşzamanlı görev.
 * @template T
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<void>} fn
 */
async function mapPool(items, limit, fn) {
  const n = Math.max(1, Math.min(limit || 1, items.length || 1));
  let i = 0;
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

/**
 * @param {object} opts
 * @param {Record<string,string>} opts.env
 * @param {string} opts.outDir
 * @param {boolean} opts.runFunctional
 * @param {'full'|'quick'} [opts.mode]
 * @param {number} [opts.workers]
 * @param {'iphone'|'android'|'desktop'} [opts.device]
 * @param {string[]|null} [opts.areas]
 */
export async function captureAll({
  env,
  outDir,
  runFunctional,
  mode = 'full',
  workers = 3,
  runLabel = 'run',
  noSideCart = false,
  device: deviceId = 'desktop',
  areas = null,
}) {
  sectionTimings.length = 0;
  beginNavCache();
  fs.mkdirSync(outDir, { recursive: true });
  const profile = env._profile || getActiveProfile();
  const device = getDevicePreset(deviceId);
  const pfx = device.id === 'desktop' ? 'desktop' : device.id;
  const want = (id) => areaIncludes(areas, id);
  /** @type {object[]} */
  const a11yFindings = [];
  const sharedRunId = String(process.env.WDP_E2E_RUN_ID || '').trim();
  resetRegistry(sharedRunId || `run-${Date.now()}`, {
    fixtureRecords: fixtureProductRecords(loadFixtures(profile.id)),
    envId: profile.id,
    siteUrl: env.E2E_BASE_URL || profile.baseUrl,
    reuseExisting: !!sharedRunId,
  });
  /** @type {object|null} */
  let canaryBefore = null;
  try {
    canaryBefore = snapshotCanary();
    const health = preflightCanary(canaryBefore);
    if (!health.ok) {
      writeCanaryAlert(health, 'Ön kontrol: ortam bozuk, hiçbir test başlamadı.');
      throw new Error(
        `Kanarya ön kontrol kırmızı — testler başlamadı. ${formatCanaryDiff(health)}`
      );
    }
  } catch (e) {
    endNavCache();
    const msg = e && e.message ? e.message : String(e);
    return {
      shots: [],
      screens: [],
      failures: [
        {
          check: 'canary-preflight',
          description: String(msg || 'Kanarya ön kontrol').slice(0, 280),
          error: msg,
        },
      ],
      skips: [],
      flaky: [],
      debugFiles: [],
      stats: { passed: 0, failed: 1, skipped: 0 },
      outDir,
      sections: [],
      mode,
      runLabel,
      noSideCart: !!noSideCart,
      device: device.id,
      profileId: profile.id,
      a11yFindings: [],
      blocked_trackers: { total: 0, byHost: {} },
      remote_post_blocked: { total: 0, byPath: {} },
      izinli_okuma: { total: 0, byAction: {} },
    };
  }
  let guardOrder = null;
  try {
    guardOrder = await snapshotGuardOrder();
  } catch {
    guardOrder = null;
  }
  const tAuth = Date.now();
  await ensureAuth(env);
  logSection('auth', tAuth);

  /** @type {{ checkoutUrl: string, offline: {id:string,title:string}|null, mutated: boolean, restore: () => void, skipOrderReason: string } | null} */
  let checkoutEnv = null;
  if (runFunctional && want('checkout-flow')) {
    try {
      checkoutEnv = await prepareCheckoutEnv();
    } catch (e) {
      console.error(`[e2e:catch-fail] prepareCheckoutEnv: ${e && e.message ? e.message : e}`);
      checkoutEnv = {
        checkoutUrl: '/checkout/',
        offline: null,
        mutated: false,
        restore: () => {},
        skipOrderReason: `checkout-setup hata: ${e && e.message ? e.message : e}`,
      };
    }
  }

  const products = productPaths(env);
  const maskList = maskSelectors(env.E2E_MASK_SELECTORS || '');
  const quick = mode === 'quick';
  // Quick: 4 worker (shell + addon dalgaları daha kısa)
  const maxWorkers = Math.max(1, Math.min(quick ? 4 : 3, Number(workers) || (quick ? 4 : 3)));
  const guestExtra = {
    ...comingSoonQuery(env, profile),
  };
  /** @type {ReturnType<typeof makeFailure>[]} */
  const failures = [];
  /** @type {Array<{check:string,description:string,detail?:string}>} */
  const skips = [];
  /** @type {Array<{check:string,description:string,detail?:string}>} */
  const warnings = [];
  /** @type {Array<{check:string,firstError:string,attemptMs:number[]}>} */
  const flaky = [];
  /** @type {Array<{check:string,device:string,env:string,reason:string,ref:string,detail:string}>} */
  const quarantined = [];
  /** @type {string[]} */
  const debugFiles = [];
  const functionalStats = { passed: 0, skipped: 0, failed: 0, warned: 0 };
  const shots = [];
  if (Array.isArray(env._roleSkips)) {
    for (const s of env._roleSkips) skips.push(s);
    functionalStats.skipped += env._roleSkips.length;
  }

  const contextOpts = { ...device.context };
  resetBlockedTrackers();
  resetRemotePostBlocked();
  const browser = await device.browserType.launch();
  installBrowserGuard(browser, env, {
    checkoutPath: checkoutEnv?.checkoutUrl || env.E2E_CHECKOUT_PAGE || '/checkout/',
    cartPath: checkoutEnv?.cartUrl || env.E2E_CART_PAGE || '/cart/',
  });
  const guest = await asVisitor(browser, env, contextOpts);
  const authed = await asAdmin(browser, env, contextOpts);
  resetMutationLockAbort();
  const removeSignals = installRunSignalHandlers([guest, authed, browser], () => {
    abortMutationLockWait();
  });
  const catalogCtx = profile.comingSoon ? authed : guest;

  // Ürün kalıcı bağlantıları + ID’ler — uzak: WP katalog permalink; yerel: Store API
  const tProbe = Date.now();
  /** @type {Record<string, string>} */
  const productUrls = {};
  /** @type {Record<string, number>} */
  const productIds = {};
  const remote = isRemoteProfile(profile);
  for (const [key, val] of Object.entries(products)) {
    const rec = env._resolvedProducts?.[key];
    const raw = rec?.nav || rec?.url || rec?.path || val;
    if (raw) {
      try {
        if (rec?.fromFixture) {
          productUrls[key] = assertProductNavTarget(raw, key);
        } else {
          const p = productNavPath(raw);
          if (p) productUrls[key] = p;
        }
      } catch (e) {
        failures.push(
          makeFailure({
            check: `product-${key}-url`,
            description: String(e && e.message ? e.message : e),
          })
        );
      }
    }
    if (rec?.id) productIds[key] = Number(rec.id) || 0;
  }
  if (!remote) {
    const probe = await catalogCtx.newPage();
    try {
      await probe.goto(withCacheBust(env.E2E_BASE_URL, '/'), { waitUntil: 'domcontentloaded' });
    } catch (e) {
      console.error(`[e2e:catch-fail] ürün probe ana sayfa: ${e && e.message ? e.message : e}`);
    }
    const pending = Object.fromEntries(
      Object.entries(products).filter(([k, slug]) => slug && !productUrls[k])
    );
    if (Object.keys(pending).length) {
      const probed = await resolveAllProductPaths(probe, env.E2E_BASE_URL, pending);
      Object.assign(productUrls, probed);
    }
    for (const [key, slug] of Object.entries(products)) {
      if (productIds[key]) continue;
      const wpId = Number(env._resolvedProducts?.[key]?.id || profile.products?.[key]?.id || 0);
      productIds[key] = await resolveProductIdBySlug(probe, env.E2E_BASE_URL, slug, wpId);
    }
    await probe.close();
  }
  for (const [role, rec] of Object.entries(env._resolvedProducts || {})) {
    if (!rec) continue;
    const raw = rec.nav || rec.url || rec.path || productUrls[role];
    if (raw) {
      try {
        productUrls[role] = rec.fromFixture
          ? assertProductNavTarget(raw, role)
          : productNavPath(raw) || productUrls[role] || raw;
      } catch (e) {
        failures.push(
          makeFailure({
            check: `product-${role}-url`,
            description: String(e && e.message ? e.message : e),
          })
        );
      }
    }
    if (rec.id) productIds[role] = Number(rec.id) || productIds[role] || 0;
  }
  logSection('ürün URL/ID çözümü', tProbe);

  // Alt bağış admin — ürün/shell’den önce (yerel PHP tek iş parçacığı; örtüşünce post.php zaman aşımı)
  /** @type {Map<string, Awaited<ReturnType<typeof readProductAddonAdminConfig>>>} */
  const adminConfigCache = new Map();
  const adminConfigPromise =
    runFunctional && want('sadaka')
      ? (async () => {
          const tAddonAdmin = Date.now();
          const adminRead = await asAdminDesktop(browser, env);
          try {
            const globalWcId = await readGlobalAddonWcId(adminRead, env);
            await mapPool(
              /** @type {const} */ (['fixed', 'custom']),
              1,
              async (productKey) => {
                const slug = products[productKey];
                const cfg = await readProductAddonAdminConfig(adminRead, env, slug, {
                  globalWcId,
                  productId: productIds[productKey] || 0,
                });
                if (cfg.status !== 'hata') adminConfigCache.set(slug, cfg);
              }
            );
          } finally {
            await adminRead.close().catch(() => {});
          }
          logSection('alt bağış admin config', tAddonAdmin);
        })()
      : Promise.resolve();

  /**
   * @param {import('@playwright/test').BrowserContext} context
   * @param {string} rel
   * @param {string} name
   * @param {{ checkImages?: boolean }} [visitOpts]
   */
  async function visit(context, rel, name, visitOpts = {}) {
    const page = await context.newPage();
    const errors = attachConsoleErrorCollector(page);
    const url = withCacheBust(env.E2E_BASE_URL, rel, guestExtra);
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch((e) => catchSoft('visit:goto', e));
    await page
      .waitForFunction(() => document.readyState === 'complete', { timeout: 8000 })
      .catch((e) => catchSoft('visit:readyState', e));
    if (runFunctional && device.isMobile && /^[^-]+-product-/.test(name) && name.endsWith(`-${Object.keys(productUrls)[0]}`)) {
      try {
        const probeBefore = await probeSimilarDonations(page);
        const kindBefore = classifySimilarDonations(probeBefore);
        const probeFile = writeSimilarDonationsProbe(
          { kind: kindBefore, phase: 'before-shot', device: device.id, env: profile.id, ...probeBefore },
          `${profile.id}-${device.id}-before`
        );
        debugFiles.push(path.relative(ROOT, probeFile));
        a11yFindings.push({
          check: 'similar-donations-probe-before',
          env: profile.id,
          device: device.id,
          control: 'Benzer Bağışlar (ekran CSS öncesi)',
          result: kindBefore,
          detail: probeFile,
        });
      } catch (e) {
        debugFiles.push(`similar-donations-before-error:${String(e.message || e)}`);
      }
    }
    try {
      await assertNoCriticalError(page);
      await assertNoHorizontalOverflow(page);
      if (runFunctional) {
        assertNoConsoleErrors(errors);
      }
    } catch (e) {
      failures.push(
        makeFailure({
          check: name,
          description: 'Sayfa yükleme / konsol kontrolü başarısız',
          error: e,
          screenshot: `${name}.png`,
        })
      );
    }
    try {
      shots.push(await shot(page, outDir, name, maskList));
      if (runFunctional) {
        await assertFullPageHeight(page, name, failures, path.join(outDir, `${name}.png`));
        if (visitOpts.checkImages) {
          await assertVisibleImagesLoaded(page, name, failures);
        }
      }
    } catch (e) {
      failures.push(
        makeFailure({
          check: name,
          description: 'Ekran görüntüsü alınamadı',
          error: e,
          screenshot: `${name}.png`,
        })
      );
    }
    return page;
  }

  await adminConfigPromise;

  // a) product pages desktop (paralel) — sayfa kapatılmaz; panel aynı sekmeyi kullanır
  const tProducts = Date.now();
  /** @type {Map<string, { page: import('@playwright/test').Page, admin: boolean }>} */
  const productPageCache = new Map();
  const productEntries = want('core') ? Object.entries(productUrls) : [];
  const productsPromise = mapPool(productEntries, maxWorkers, async ([key, rel]) => {
    const name = `${pfx}-product-${key}`;
    const productDecision = decideScenarioProduct(env, key, 'product-page');
    const visitCtx = productDecision.admin ? authed : catalogCtx;
    const page = await visit(visitCtx, rel, name, { checkImages: true });
    if (runFunctional) {
      try {
        // Benzer Bağışlar: görünür başlık + Bağış Yap (Avada post-card animasyonu)
        await assertLoopCardsTitleAndDonate(page, 'product', name, failures, functionalStats, skips, {
          productId: productIds[key] || 0,
          role: key,
          env,
        });
        if (device.isMobile && key === Object.keys(productUrls)[0]) {
          try {
            const probeSim = await probeSimilarDonations(page);
            const kind = classifySimilarDonations(probeSim);
            const probeFile = writeSimilarDonationsProbe(
              { kind, device: device.id, env: profile.id, ...probeSim },
              `${profile.id}-${device.id}-${key}`
            );
            debugFiles.push(path.relative(ROOT, probeFile));
            if (kind !== 'ok') {
              a11yFindings.push({
                check: 'similar-donations-probe',
                env: profile.id,
                device: device.id,
                control: 'Benzer Bağışlar',
                result: kind,
                detail: probeFile,
              });
            }
          } catch (e) {
            debugFiles.push(`similar-donations-probe-error:${String(e.message || e)}`);
          }
        }
        const display =
          env._resolvedProducts?.[key]?.display || env._catalog?.placement?.display || '';
        await assertProductPageDisplay(page, display, key, name, failures, functionalStats, warnings);
      } catch (e) {
        failures.push(
          makeFailure({
            check: `product-${key}-ui`,
            description: 'Ürün sayfası UI kontrolü hata verdi',
            error: e,
            screenshot: `${name}.png`,
          })
        );
      }
    }
    productPageCache.set(key, { page, admin: !!productDecision.admin });
  }).finally(() => {
    logSection('ürün sayfaları', tProducts);
  });

  // b/c/d) gerçek popup (liste) + panel (ürün sayfası) open/errors
  // Karar: ürün sayfasında display=button_panel iken donateTrigger de paneli açar;
  // desktop-popup-* adları korunur ama içerik ortadaki modal olur (liste kısa kodu).
  const shellJobs = [];
  for (const [key, rel] of Object.entries(productUrls)) {
    const panelDecision = decideScenarioProduct(env, key, 'panel');
    if (panelDecision.action === 'skip') {
      skips.push(
        makeSkip({
          check: `panel-${key}`,
          reason: panelDecision.reason,
          evidence: panelDecision.evidence || SKIP_EVIDENCE.WP_DATA,
          detail: panelDecision.detail,
        })
      );
      functionalStats.skipped += 1;
    } else {
      shellJobs.push({
        key,
        mode: /** @type {'panel'} */ ('panel'),
        pagePath: rel,
        productId: productIds[key] || 0,
        asAdmin: panelDecision.admin,
      });
    }
    const popupDecision = decideScenarioProduct(env, key, 'popup');
    if (popupDecision.action === 'skip') {
      const check = `popup-${key}`;
      if (!skips.some((s) => s.check === check)) {
        skips.push(
          makeSkip({
            check,
            reason: popupDecision.reason,
            evidence: popupDecision.evidence || SKIP_EVIDENCE.WP_DATA,
            detail: popupDecision.detail,
          })
        );
        functionalStats.skipped += 1;
      }
      continue;
    }
    const popupPath = popupDecision.pagePath || popupPagePath(env);
    if (!popupPath) {
      const check = `popup-${key}`;
      if (!skips.some((s) => s.check === check)) {
        skips.push(
          makeSkip({
            check,
            reason: SKIP_REASONS.NO_POPUP_SOURCE,
            evidence: SKIP_EVIDENCE.WP_DATA,
            detail: key,
          })
        );
        functionalStats.skipped += 1;
      }
      continue;
    }
    shellJobs.push({
      key,
      mode: /** @type {'popup'} */ ('popup'),
      pagePath: popupPath,
      productId: productIds[key] || 0,
    });
  }
  if (!want('shell')) shellJobs.length = 0;
  const tShells = Date.now();
  /**
   * Kabuk ekranı: shot + images-loaded + kabuk bütünlüğü (viewport / kaydırma sonu).
   * @param {import('@playwright/test').Page} page
   * @param {string} screenName
   * @param {string} productKey
   * @param {'popup'|'panel'} shellMode
   */
  async function shotShellAndCheck(page, screenName, productKey, shellMode) {
    if (runFunctional) {
      try {
        await waitAndAssertShellOverlap(page);
      } catch (eOverlap) {
        failures.push(
          makeFailure({
            check: 'POPUP-OVERLAP',
            description: 'Açık popup/panel form alanının üstünde başka katman veya opaklık < 0.99',
            error: eOverlap,
            screenshot: `${screenName}.png`,
          })
        );
      }
      if (shellMode === 'panel') {
        try {
          await assertPanelCtaPinnedWhenShort(page);
        } catch (eCta) {
          failures.push(
            makeFailure({
              check: PANEL_CTA_BOTTOM_CODE,
              description: 'Kısa içerikli yan panelde alt eylem çubuğu panelin dibine sabit olmalı',
              error: eCta,
              screenshot: `${screenName}.png`,
            })
          );
        }
      }
      try {
        const guard = attachNativeSubmitReloadGuard(page);
        guard.assertClear(screenName);
      } catch (eReload) {
        failures.push(
          makeFailure({
            check: NATIVE_SUBMIT_RELOAD_CODE,
            description: 'Kabuk açıkken ürün sayfası belge yeniden yüklendi (yerel form / reload)',
            error: eReload,
            screenshot: `${screenName}.png`,
          })
        );
      }
    }
    shots.push(
      await shot(page, outDir, screenName, maskList, {
        scrollPage: false,
        fullPage: false,
        shellOnly: true,
        shellMode,
      })
    );
    if (runFunctional) {
      await assertVisibleImagesLoaded(page, screenName, failures, { shellOnly: true });
      await assertShellCompleteness(page, screenName, failures);
    }
  }

  /**
   * @param {import('@playwright/test').Page} page
   * @param {'popup'|'panel'} mode
   * @param {number} productId
   */
  async function openShellForMode(page, mode, productId) {
    const kindOf = (loc) =>
      loc
        .evaluate((el) => {
          const root = el.closest('[data-dp-exp]');
          return root ? String(root.getAttribute('data-dp-kind') || '') : '';
        })
        .catch((e) => {
          catchSoft('openShellForMode:kind', e);
          return '';
        });
    const asMode = (kind) => (kind === 'side_panel' ? 'panel' : 'popup');
    // Katman zaten açıksa onu kullan
    const already = page.locator(SEL.openModalShell).first();
    if ((await already.count()) > 0) {
      const guard = attachNativeSubmitReloadGuard(page);
      guard.clearHits();
      guard.arm();
      return { ok: true, shell: already, openedAs: asMode(await kindOf(already)) };
    }
    // Satır içi (gömülü) görünüm: form sayfada görünür
    const inlineForm = page.locator(SEL.inlineDonationForm).filter({ visible: true }).first();
    if ((await inlineForm.count()) > 0) {
      const guard = attachNativeSubmitReloadGuard(page);
      guard.clearHits();
      guard.arm();
      return { ok: true, shell: page.locator('[data-dp-exp][data-dp-kind="inline"]').first(), openedAs: mode };
    }
    await revealListProductTrigger(page, productId);
    let trigger = shellTriggerLocator(page, mode, { productId });
    if ((await trigger.count()) === 0) {
      trigger =
        mode === 'panel'
          ? page.locator(SEL.sidePanelTrigger).first()
          : page.locator(SEL.centeredPopupTrigger).first();
    }
    if ((await trigger.count()) === 0) {
      const ids = await page
        .locator('[data-dp-exp][data-dp-product], .wdp-card__cta[data-wdp-form]')
        .evaluateAll((els) =>
          els.map((el) => el.getAttribute('data-dp-product') || el.getAttribute('data-wdp-form')).filter(Boolean).slice(0, 12)
        );
      return {
        ok: false,
        detail: `selector=${mode === 'panel' ? 'sidePanel' : 'centeredPopup'} resolvedId=${productId || 0} visibleIds=${(ids || []).join(',') || '(yok)'}`,
      };
    }
    try {
      await trigger.first().scrollIntoViewIfNeeded();
      await clickShellTrigger(trigger, CHECK_MS);
    } catch (clickErr) {
      catchSoft('openShellForMode:trigger.click', clickErr);
      let diag = null;
      try {
        diag = await collectTriggerClickDiagnostics(page, trigger);
        const diagPath = path.join(ROOT, 'build/e2e/debug', `trigger-${mode}-${productId || 0}.json`);
        fs.mkdirSync(path.dirname(diagPath), { recursive: true });
        fs.writeFileSync(diagPath, JSON.stringify({ err: String(clickErr && clickErr.message), diag }, null, 2));
      } catch (diagErr) {
        catchSoft('openShellForMode:diag', diagErr);
      }
      return {
        ok: false,
        detail: `click-timeout overlay=${diag && diag.topAtPoint ? diag.topAtPoint.className : '?'}`,
      };
    }
    const shell = openShellLocator(page, '');
    await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
    const guard = attachNativeSubmitReloadGuard(page);
    guard.clearHits();
    guard.arm();
    try {
      await waitShellAnimationsDone(page, 8000);
    } catch (eWait) {
      catchSoft('openShellForMode:waitShell', eWait);
    }
    const openedAs = asMode(await kindOf(shell));
    if (mode === 'panel' && openedAs !== 'panel') {
      return { ok: false, detail: 'sağ panel beklenirken ortadaki popup açıldı' };
    }
    // Liste kısa kodu panel ise (button=panel) ürüne tanımlı form panelde açılır.
    return { ok: true, shell, openedAs };
  }

  /**
   * Yeni nesil form sunucuda çizilir (ürün bilgisi isteği yok): katman açılış animasyonu bitsin.
   * @param {import('@playwright/test').Page} page
   */
  async function waitForShellProductReady(page) {
    await waitOpenShellSettled(page, 8000);
  }

  const runShellJob = async ({ key, pagePath, mode, productId, asAdmin: useAdmin }) => {
    // Aynı koşu context’i (çoklu sekme). Yeni context yok — HTTP önbelleği paylaşılır.
    // Panel = ürün sayfası önbelleği; popup = ziyaretçi/catalog sekmesi.
    const cached = productPageCache.get(key);
    const reuseProduct =
      mode === 'panel' &&
      cached &&
      cached.page &&
      !cached.page.isClosed() &&
      !!cached.admin === !!useAdmin;
    const ctx = useAdmin ? authed : catalogCtx;
    /** @type {import('@playwright/test').Page} */
    let page;
    if (reuseProduct) {
      page = cached.page;
      productPageCache.delete(key);
    } else {
      page = await ctx.newPage();
    }
    const errors = attachConsoleErrorCollector(page);
    const url = withCacheBust(env.E2E_BASE_URL, pagePath, guestExtra);
    const openName = `${pfx}-${mode}-${key}-open`;
    const errorsName = `${pfx}-${mode}-${key}-errors`;
    try {
      if (!reuseProduct) {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await settleForScreenshot(page, { fullPage: false, scrollPage: false });
      }

      if (mode === 'panel') {
        let pageState = await collectStorefrontPageState(page, productId);
        let verdict = classifyStorefrontProductPage(pageState);
        if (!verdict.ok && reuseProduct && pagePath) {
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          await settleForScreenshot(page, { fullPage: false, scrollPage: false });
          pageState = await collectStorefrontPageState(page, productId);
          verdict = classifyStorefrontProductPage(pageState);
        }
        if (!verdict.ok) {
          try {
            const plugin = await collectPluginRuntime(page);
            const png = await shotDebugPng(page, `panel-${key}-open-${device.id}`);
            writePanelOpenDebug(device.id, key, {
              class: 'yanlış-sayfa',
              detail: `yanlış-sayfa reason=${verdict.reason} path=${pageState.pathname}`,
              page: pageState,
              plugin,
              png,
            });
          } catch (diagErr) {
            console.error(
              `[e2e:catch-fail] panel-wrong-page ${key}: ${diagErr && diagErr.message ? diagErr.message : diagErr}`
            );
          }
          failures.push(
            makeFailure({
              check: `${mode}-${key}-open`,
              description: 'Kabuk açılışı ön yüz ürün sayfasında değil (yanlış-sayfa)',
              detail: `reason=${verdict.reason} path=${pageState.pathname}`,
              screenshot: `${openName}.png`,
            })
          );
          failures.push(
            makeFailure({
              check: `${mode}-${key}-errors-assert`,
              description: 'Errors ekranı atlandı — yanlış-sayfa',
              detail: verdict.reason,
            })
          );
          return;
        }
      }

      const opened = await openShellForMode(page, mode, productId);
      if (!opened.ok) {
        if (mode === 'panel') {
          try {
            const trig = shellTriggerLocator(page, mode, { productId });
            const clickTarget = (await trig.count()) > 0 ? await collectClickTarget(page, trig) : null;
            const plugin = await collectPluginRuntime(page);
            const shellDom = await collectShellDomState(page);
            const png = await shotDebugPng(page, `panel-${key}-open-${device.id}`);
            const pageState = await collectStorefrontPageState(page, productId);
            writePanelOpenDebug(device.id, key, {
              class: 'panel-acilamadi',
              detail: opened.detail,
              page: pageState,
              trigger: {
                count: await trig.count().catch(() => 0),
                visible: (await trig.count()) > 0 ? await trig.first().isVisible().catch(() => false) : false,
                className: (await trig.count()) > 0 ? (await trig.first().getAttribute('class')) || '' : '',
                tag: 'A',
              },
              click_target: clickTarget,
              plugin,
              shell: shellDom,
              console_errors: errors.slice(-10),
              png,
            });
          } catch (diagErr) {
            console.error(
              `[e2e:catch-fail] panel-open-diag ${key}: ${diagErr && diagErr.message ? diagErr.message : diagErr}`
            );
          }
        }
        failures.push(
          makeFailure({
            check: `${mode}-${key}-open`,
            description: 'Bağış kabuğu açılamadı veya yanlış tip — ekran yine de alındı',
            detail: opened.detail,
            screenshot: `${openName}.png`,
          })
        );
        try {
          await shotShellAndCheck(page, openName, key, mode);
        } catch (_) {
          /* ignore */
        }
        // errors shot yok: validation tetiklenmedi — sahte “errors=open” üretme
        failures.push(
          makeFailure({
            check: `${mode}-${key}-errors-assert`,
            description: 'Errors ekranı atlandı — kabuk açılamadığı için doğrulama yok',
            detail: opened.detail,
          })
        );
        return;
      }

      await waitTwoFrames(page);
      await waitForShellProductReady(page);
      try {
        await assertNoUnexpectedPluginErrors(page, { scenarioId: openName });
      } catch (e) {
        failures.push(
          makeFailure({
            check: `${mode}-${key}-open-plugin-error`,
            description: 'Açık kabukta beklenmeyen eklenti hata bildirimi',
            error: e,
            screenshot: `${openName}.png`,
          })
        );
      }

      const shotMode = opened.openedAs === 'panel' ? 'panel' : mode;
      const qty = await readShellInitialQty(page, key);
      if (!qty.ok) {
        failures.push(
          makeFailure({
            check: `shell-${mode}-${key}-initial-qty`,
            description: 'Form açılışında adet/hisse 1 olmalı',
            detail: `alan=${qty.field} görülen=${qty.value}`,
            screenshot: `${openName}.png`,
          })
        );
      }

      await shotShellAndCheck(page, openName, key, shotMode);

      if (runFunctional && mode === 'popup') {
        for (const how of /** @type {const} */ (['close', 'esc', 'backdrop'])) {
          const check = `close-${key}-${how}`;
          const labels = {
            close: 'Kapat butonu ([data-dp-close]) ile form kapanmalı',
            esc: 'ESC tuşu ile form kapanmalı',
            backdrop: 'Arka plana tıklayınca form kapanmalı',
          };
          try {
            if ((await page.locator(SEL.openModalShell).count()) === 0) {
              const re = await openShellForMode(page, 'popup', productId);
              if (!re.ok) throw new Error(re.detail || 'popup yeniden açılamadı');
            }
            await closeOpenShell(page, how);
          } catch (e) {
            failures.push(
              makeFailure({
                check,
                description: labels[how],
                error: e,
                screenshot: openName + '.png',
              })
            );
          }
        }
      }

      // errors: aynı sayfada yeniden aç (goto yok) → goCheckout → iddia → shot
      let opened2 = { ok: true, openedAs: shotMode, shell: null };
      if ((await page.locator(SEL.openModalShell).count()) === 0) {
        opened2 = await openShellForMode(page, mode, productId);
      }
      if (!opened2.ok) {
        failures.push(
          makeFailure({
            check: `${mode}-${key}-errors-open`,
            description: 'Hata ekranı için kabuk açılamadı',
            detail: opened2.detail,
            screenshot: `${errorsName}.png`,
          })
        );
        return;
      }
      const shotMode2 = opened2.openedAs === 'panel' ? 'panel' : mode;
      pausePluginAjaxWatch();
      try {
        await triggerShellValidationErrors(page, shotMode2);
      } catch (e) {
        failures.push(
          makeFailure({
            check: `${mode}-${key}-errors-trigger`,
            description: 'goCheckout ile doğrulama hatası tetiklenemedi',
            error: e,
            screenshot: `${errorsName}.png`,
          })
        );
        // Yine de durum kaydı için shot dene (iddia aşağıda fail eder)
      } finally {
        resumePluginAjaxWatch();
      }
      await prepareErrorShot(page, { shares: key === 'shares', shellMode: shotMode2 });
      await waitTwoFrames(page);
      try {
        await assertNoUnexpectedPluginErrors(page, { scenarioId: errorsName });
      } catch (e) {
        failures.push(
          makeFailure({
            check: `${mode}-${key}-errors-plugin-error`,
            description: 'Errors ekranında beklenmeyen genel eklenti hatası',
            error: e,
            screenshot: `${errorsName}.png`,
          })
        );
      }
      const errState = await readShellValidationErrorState(page, shotMode2).catch((e) => ({
        ok: false,
        detail: String(e.message || e),
        lastValidation: null,
        visibleErrors: [],
      }));
      if (runFunctional && !errState.ok) {
        failures.push(
          makeFailure({
            check: `${mode}-${key}-errors-assert`,
            description:
              'Errors ekranı: lastValidation.failures’taki her alan için görünür alan mesajı zorunlu (başlık tek başına yetmez)',
            detail: errState.detail,
            screenshot: `${errorsName}.png`,
          })
        );
      }
      // Shot yine alınır (teşhis); işlevsel hata yukarıda
      try {
        await shotShellAndCheck(page, errorsName, key, shotMode2);
      } catch (e) {
        failures.push(
          makeFailure({
            check: `${mode}-${key}-errors-shot`,
            description: 'Errors kabuk ekranı alınamadı',
            error: e,
            screenshot: `${errorsName}.png`,
          })
        );
      }

      try {
        assertNoConsoleErrors(errors);
      } catch (e) {
        if (runFunctional) {
          failures.push(
            makeFailure({
              check: `${mode}-${key}-console`,
              description: 'Tarayıcı konsolunda hata var',
              error: e,
              screenshot: `${errorsName}.png`,
            })
          );
        }
      }
    } catch (e) {
      failures.push(
        makeFailure({
          check: `${mode}-${key}`,
          description: 'Kabuk senaryosu hata verdi — diğer kontroller devam',
          error: e,
          screenshot: `${openName}.png`,
        })
      );
      try {
        await shotShellAndCheck(page, openName, key, mode);
      } catch (_) {
        /* ignore */
      }
    } finally {
      await page.close().catch((e) => catchSoft('shell:page.close', e));
    }
  };
  const popupJobs = shellJobs.filter((j) => j.mode === 'popup');
  const panelJobs = shellJobs.filter((j) => j.mode === 'panel');
  const shellsPromise = productsPromise
    .then(() => mapPool([...popupJobs, ...panelJobs], maxWorkers, runShellJob))
    .finally(async () => {
    for (const leftover of productPageCache.values()) {
      await leftover.page.close().catch((e) => catchSoft('productCache.close', e));
    }
    productPageCache.clear();
    if (shellJobs.length) logSection('popup/panel ekranları', tShells);
  });

  // e) list + shop — kabuklarla örtüşür (ayrı guest page’ler)
  const tList = Date.now();
  const listShopPromise = !want('core')
    ? Promise.resolve()
    : (async () => {
    if (!env.E2E_LIST_PAGE) {
      skips.push(
        makeSkip({
          check: `${pfx}-list`,
          reason: SKIP_REASONS.NO_LIST_PAGE,
          evidence: SKIP_EVIDENCE.WP_DATA,
        })
      );
      functionalStats.skipped += 1;
      return;
    }
    const listPage = await visit(guest, env.E2E_LIST_PAGE, `${pfx}-list`, { checkImages: true });
    if (runFunctional) {
      const adminNotices = await listPage.locator('.wdp-admin-notice').count();
      if (adminNotices > 0) {
        failures.push(
          makeFailure({
            check: 'visitor-admin-notice',
            description: 'Ziyaretçiye yönetici notu sızdı (.wdp-admin-notice)',
            detail: `count=${adminNotices}`,
            screenshot: `${pfx}-list.png`,
          })
        );
      } else {
        functionalStats.passed += 1;
      }
      const wrap = listPage.locator('.wdp-list-wrap').first();
      const hasList = await wrap
        .waitFor({ state: 'attached', timeout: 8000 })
        .then(() => true)
        .catch(() => false);
      if (!hasList) {
        failures.push(
          makeFailure({
            check: 'list-card-links',
            description: 'Liste sayfasında [wdp_donations] ızgarası yok (WP içeriğinde kısa kod/blok var)',
            screenshot: `${pfx}-list.png`,
          })
        );
        functionalStats.failed += 1;
      } else {
        const nestedA = await listPage
          .locator('.wdp-card a a, .wdp-card a:has(a)')
          .count()
          .catch(() => 0);
        if (nestedA > 0) {
          failures.push(
            makeFailure({
              check: 'list-card-nested-a',
              description: 'Liste kartında iç içe <a> var',
              detail: `count=${nestedA}`,
              screenshot: `${pfx}-list.png`,
            })
          );
        }
        const titleLinks = await listPage.locator('.wdp-card__title a[href]').count();
        const mediaLinks = await listPage.locator('a.wdp-card__media[href]').count();
        const donateBtns = await listPage.locator('button.wdp-card__cta[data-wdp-form], a.wdp-card__cta[data-wdp-form]').count();
        if (titleLinks < 1 || donateBtns < 1) {
          failures.push(
            makeFailure({
              check: 'list-card-links',
              description: 'Kart başlık bağlantısı veya Bağış Yap düğmesi yok',
              detail: `titleA=${titleLinks} mediaA=${mediaLinks} donate=${donateBtns}`,
              screenshot: `${pfx}-list.png`,
            })
          );
        } else {
          functionalStats.passed += 1;
        }
      }
      const uncatTab = await listPage.locator('[data-wdp-tab="uncategorized"]').count();
      if (uncatTab > 0) {
        failures.push(
          makeFailure({
            check: 'list-uncategorized-tab',
            description: 'Varsayılan Uncategorized sekme olarak görünmemeli',
            screenshot: `${pfx}-list.png`,
          })
        );
      }
    }
    await listPage.close();
    if (!env.E2E_SHOP_PAGE) {
      skips.push(
        makeSkip({
          check: `${pfx}-shop`,
          reason: SKIP_REASONS.NO_SHOP_PAGE,
          evidence: SKIP_EVIDENCE.WP_DATA,
        })
      );
      functionalStats.skipped += 1;
      return;
    }
    const shopPage = await visit(catalogCtx, env.E2E_SHOP_PAGE, `${pfx}-shop`, { checkImages: true });
    if (runFunctional) {
      const addTexts = await shopPage.locator('a.button, button').allTextContents();
      const bad = addTexts.some((t) => /sepete\s*ekle/i.test(t || ''));
      if (bad) {
        failures.push(
          makeFailure({
            check: 'shop',
            description: 'Döngüde "Sepete ekle" metni görünmemeli',
            detail: 'shop sayfasında Sepete ekle metni bulundu',
            screenshot: 'desktop-shop.png',
          })
        );
      }
      await assertLoopCardsTitleAndDonate(
        shopPage,
        'shop',
        'desktop-shop',
        failures,
        functionalStats,
        skips
      );
      await assertDonationLoopButtons({
        guest: catalogCtx,
        env,
        products,
        productUrls,
        failures,
        stats: functionalStats,
        guestExtra,
      });
    }
    await shopPage.close();
  })().finally(() => {
    logSection('liste + mağaza', tList);
  });

  const tSkelCart = Date.now();
  const skelCartPromise = runFunctional && (want('shell') || want('checkout-flow'))
    ? (async () => {
      await Promise.all([
        (async () => {
          const tSkel = Date.now();
          await runSubmitFaultChecks({
            browser,
            contextOpts,
            env,
            productPath: productUrls.fixed,
            guestExtra,
            failures,
            stats: functionalStats,
          }).catch((e) => {
            failures.push(
              makeFailure({
                check: 'submit-fault',
                description: 'Gönderim hatası kilit açılma kontrolü çöktü',
                error: e,
              })
            );
          });
          logSection('submit-fault', tSkel);
        })(),
        (async () => {
      const tCart = Date.now();
      const cartPaths = tracePaths(runLabel, 'fixed-cart');
      const cartTimeline = createTimeline('fixed-cart');
      const cartDecision = decideScenarioProduct(env, 'fixed', 'cart');
      const cartCtx = cartDecision.admin
        ? await asAdmin(browser, env, contextOpts)
        : await asVisitor(browser, env, contextOpts);
      const cartAddContext = cartDecision.admin ? 'admin' : 'visitor';
      await installPageProbe(cartCtx).catch((e) => catchFail('installPageProbe:cart', e));
      const cartTrace = !quick;
      if (cartTrace) {
        await cartCtx.tracing.start({ screenshots: true, snapshots: true, sources: false });
      }
      const page = await cartCtx.newPage();
      const cartCacheProbe = attachDocumentCacheProbe(page);
      let cartFailed = false;
      /** @type {object|null} */
      let cartFirstAttempt = null;
      try {
        cartTimeline.mark('empty-cart');
        await emptyCart(page, env.E2E_BASE_URL);
        cartTimeline.mark('goto-product');
        await page.goto(withCacheBust(env.E2E_BASE_URL, productUrls.fixed, guestExtra), {
          waitUntil: 'domcontentloaded',
        });
        cartTimeline.mark('open-shell');
        await openDonate(page);
        const shell = openShellLocator(page);
        const amountBefore = String((await shell.locator(SEL.lineTotal).first().innerText()) || '');
        await shell.locator(SEL.qtyIncrease).first().click({ timeout: CHECK_MS });
        try {
          await page.waitForFunction(
            (prev) => {
              const el = document.querySelector('[data-dp-overlay].is-open [data-dp-total]');
              return !!el && String(el.textContent || '') !== prev;
            },
            amountBefore,
            { timeout: CHECK_MS }
          );
        } catch (qtyErr) {
          failures.push(
            makeFailure({
              check: 'fixed-qty',
              description: 'Adet artınca görünen tutar değişmeli',
              detail: `önce=${amountBefore} (${String(qtyErr && qtyErr.message ? qtyErr.message : qtyErr).split('\n')[0]})`,
              screenshot: 'desktop-popup-fixed-open.png',
            })
          );
        }

        try {
          cartTimeline.mark('fill-donor');
          const donorFilled = await fillDonorFields(shell);
          await assertDonorFieldsPersist(
            shell,
            { name: donorFilled.name, phone: donorFilled.phone },
            failures,
            'fixed-cart'
          );
          // "Sepete ekle": son adımda görünen ikincil düğme (ödemeye yönlendirmez, katmanı kapatır).
          const addBtn = formOf(shell).locator(SEL.addOnly).first();
          await startDomMutationProbe(page).catch((e) => catchFail('startDomMutationProbe', e));
          const tClick = Date.now();
          const snapBeforeClick = await snapshotAddonAndButton(page).catch(() => null);
          const snapAfter50Promise = (async () => {
            await new Promise((r) => setTimeout(r, 50));
            return snapshotAddonAndButton(page).catch(() => null);
          })();
          cartTimeline.mark('click-add-to-cart');
          const ajax = await clickAddToCartWithRetry(page, addBtn, {
            checkId: 'fixed-cart',
            onAttemptFail: async (info) => {
              const snapAfter50 = await snapAfter50Promise.catch(() => null);
              const probe = await collectPageProbeLogs(page);
              const clickDiag = await collectAddToCartDiagnostics(page, addBtn, {
                networkTail: info.networkRaw || [],
              }).catch((e) => ({ error: String(e.message || e) }));
              const bundle = {
                phase: 'attempt1-before-retry',
                check: 'fixed-cart',
                attempt: info.attempt,
                ajax: info.ajax,
                buttonState: info.buttonState,
                networkRaw: info.networkRaw,
                consoleErrors: info.consoleErrors,
                clickDiag,
                lastValidation: clickDiag && clickDiag.lastValidation ? clickDiag.lastValidation : null,
                visibleErrors: clickDiag && clickDiag.visibleErrors ? clickDiag.visibleErrors : [],
                fields: clickDiag && clickDiag.fields ? clickDiag.fields : [],
                cacheHeaders: cartCacheProbe.get(),
                activeScenarios: listActiveScenarios(),
                timeline: cartTimeline.toJSON(),
                snapBeforeClick,
                snapAfter50ms: snapAfter50,
                pageEvents: probe.pageEvents,
                listeners: probe.listeners,
                xhrLog: probe.xhrLog,
                validation: probe.validation,
              };
              cartFirstAttempt = bundle;
              writeDebugJson(cartPaths.firstAttemptJson, bundle);
              return bundle;
            },
          });
          if (/checkout|order-pay|payment/i.test(page.url()) && !/cart/i.test(page.url())) {
            failures.push(
              makeFailure({
                check: 'fixed-cart-nav',
                description: 'Sepete Ekle ödeme/checkout’a gitmemeli',
                detail: `url=${page.url()}`,
                screenshot: 'desktop-popup-fixed-open.png',
              })
            );
          }

          let items = await cartItemCount(page, env.E2E_BASE_URL);
          if (items === 0 && ajax.ok) {
            await page
              .waitForFunction(async () => {
                try {
                  const res = await fetch('/wp-json/wc/store/v1/cart', { credentials: 'same-origin' });
                  if (!res.ok) return false;
                  const data = await res.json();
                  return Array.isArray(data.items) && data.items.length > 0;
                } catch (e) {
                  return false;
                }
              }, { timeout: CHECK_MS })
              .catch(() => {});
            items = await cartItemCount(page, env.E2E_BASE_URL);
          }
          const cartOk = items > 0;
          const mutationWait = cartOk ? 0 : Math.max(0, 2000 - (Date.now() - tClick));
          const mutationSummary = await stopDomMutationProbe(page, mutationWait).catch(() => null);
          if (items === 0) {
            cartFailed = true;
            const valErrors = await visibleValidationErrors(page);
            const clickDiag = await collectAddToCartDiagnostics(page, addBtn, {
              networkTail: ajax.networkRaw || [],
            }).catch((e) => ({ error: String(e.message || e) }));
            const cartState = await collectAndWriteCartState(page, {
              baseUrl: env.E2E_BASE_URL,
              scenario: 'fixed-cart',
              device: e2eDeviceLabel(device.id),
              ajax,
              addContext: cartAddContext || pageContextKind(page),
              cartPath: env.E2E_CART_PAGE || '/cart/',
            });
            const debugBundle = {
              phase: 'final-fail',
              check: 'fixed-cart',
              runLabel,
              ajax,
              clickDiag,
              mutationSummary,
              cacheHeaders: cartCacheProbe.get(),
              activeScenarios: listActiveScenarios(),
              timeline: cartTimeline.toJSON(),
              firstAttempt: cartFirstAttempt || ajax.firstAttemptDiag || null,
              valErrors,
              cartStateClass: cartState.class,
              cartStateFile: cartState.debugFile,
              debugFiles: {
                json: path.relative(ROOT, cartPaths.json),
                firstAttempt: path.relative(ROOT, cartPaths.firstAttemptJson),
                trace: path.relative(ROOT, cartPaths.zip),
                cartState: cartState.debugFile,
              },
            };
            writeDebugJson(cartPaths.json, debugBundle);
            debugFiles.push(path.relative(ROOT, cartPaths.json));
            if (cartState.debugFile) debugFiles.push(cartState.debugFile);
            failures.push(
              makeFailure({
                check: 'fixed-cart',
                description: 'Sepete Ekle sonrası sepet boş kalmamalı',
                detail: [
                  `sınıf=${cartState.class}`,
                  `HTTP ${ajax.status} ok=${ajax.ok} timedOut=${ajax.timedOut}`,
                  `yanıt (ilk 300): ${ajax.bodyPreview}`,
                  `buton: visible=${ajax.buttonState?.visible} disabled=${ajax.buttonState?.disabled}`,
                  `denemeler: ${JSON.stringify(ajax.attempts || [])}`,
                  `son 15 network: ${(ajax.networkTail || []).join(' | ') || '(yok)'}`,
                  `konsol hataları: ${(ajax.consoleErrors || []).join(' | ') || '(yok)'}`,
                  `debug: ${path.relative(ROOT, cartPaths.json)}`,
                  `trace: ${path.relative(ROOT, cartPaths.zip)}`,
                  `cart-state: ${cartState.debugFile}`,
                  `teşhis: ${JSON.stringify({
                    formFlags: clickDiag.formFlags,
                    modules: clickDiag.modules,
                    topAtPoint: clickDiag.topAtPoint,
                    nonce: clickDiag.nonce,
                    cacheHeaders: cartCacheProbe.get(),
                    activeScenarios: listActiveScenarios(),
                    cartStateClass: cartState.class,
                    cartContext: cartState.context,
                  })}`,
                  valErrors.length
                    ? `form hataları: ${valErrors.join(' | ')}`
                    : 'formda görünür doğrulama hatası yok',
                ].join('\n'),
                screenshot: 'desktop-popup-fixed-open.png',
                debugFile: cartState.debugFile || path.relative(ROOT, cartPaths.json),
              })
            );
          } else {
            if (ajax.flaky) {
              const first = (ajax.attempts || []).find((a) => a.attempt === 1);
              flaky.push({
                check: 'fixed-cart',
                firstError: first?.error || 'waitForResponse timeout',
                attemptMs: (ajax.attempts || []).map((a) => a.ms),
              });
            }
            functionalStats.passed += 1;
          }
        } catch (e) {
          cartFailed = true;
          const valErrors = await visibleValidationErrors(page).catch(() => []);
          writeDebugJson(cartPaths.json, {
            phase: 'exception',
            check: 'fixed-cart',
            error: String(e.message || e),
            activeScenarios: listActiveScenarios(),
            timeline: cartTimeline.toJSON(),
          });
          debugFiles.push(path.relative(ROOT, cartPaths.json));
          failures.push(
            makeFailure({
              check: 'fixed-cart',
              description: 'Sepete Ekle akışı hata verdi',
              detail: [
                String(e.message || e),
                valErrors.length ? `form hataları: ${valErrors.join(' | ')}` : '',
                `debug: ${path.relative(ROOT, cartPaths.json)}`,
              ]
                .filter(Boolean)
                .join('\n'),
              screenshot: 'desktop-popup-fixed-open.png',
              debugFile: path.relative(ROOT, cartPaths.json),
            })
          );
        }
      } catch (e) {
        cartFailed = true;
        failures.push(
          makeFailure({
            check: 'fixed-cart',
            description: 'Sabit ürün sepet senaryosu açılamadı',
            error: e,
            screenshot: 'desktop-product-fixed.png',
          })
        );
      }

      await emptyCart(page, env.E2E_BASE_URL).catch((e) => catchFail('emptyCart', e));
      cartCacheProbe.dispose();
      cartTimeline.end();
      await page.close().catch(() => {});
      if (cartTrace) {
        await cartCtx.tracing.stop({ path: cartPaths.zip }).catch(() => {});
        if (cartFailed) {
          debugFiles.push(path.relative(ROOT, cartPaths.zip));
        } else {
          try {
            fs.unlinkSync(cartPaths.zip);
          } catch (e) {
            /* ignore */
          }
        }
      }
      await cartCtx.close().catch(() => {});
      logSection('sepet (fixed)', tCart);
        })(),
      ]);
      logSection('gönderim-hatası+sepet (paralel)', tSkelCart);
      })()
    : Promise.resolve();

  try {
    await Promise.all([productsPromise, shellsPromise, listShopPromise, skelCartPromise]);
  } finally {
    endNavCache();
  }


  // f) admin settings tabs + product Bağış tab (quick’te atlanır)
  if (!quick && device.id === 'desktop' && want('admin')) {
    const tAdmin = Date.now();
    const admin = await authed.newPage();
    const adminErrors = attachConsoleErrorCollector(admin);
    await admin.goto(withCacheBust(env.E2E_BASE_URL, '/wp-admin/admin.php?page=donation-panel'), {
      waitUntil: 'domcontentloaded',
    });
    await assertNoCriticalError(admin).catch((e) =>
      failures.push(
        makeFailure({
          check: 'admin-settings',
          description: 'Ayar sayfasında kritik hata',
          error: e,
          screenshot: 'admin-tab-0.png',
        })
      )
    );
    for (const slug of ['donation-panel', 'donation-panel-campaigns', 'donation-panel-forms', 'donation-panel-checkout', 'donation-panel-account', 'donation-panel-privacy', 'donation-panel-tools', 'donation-panel-guide']) {
      await admin.goto(withCacheBust(env.E2E_BASE_URL, `/wp-admin/admin.php?page=${slug}`), { waitUntil: 'domcontentloaded' });
      const panel = admin.locator('.dpa').first();
      await panel.waitFor({ state: 'visible', timeout: CHECK_MS });
      const fields = await panel.locator('input, select, textarea, table, a, button').count();
      if (runFunctional && fields < 1) {
        failures.push(
          makeFailure({
            check: `admin-screen-${slug}`,
            description: 'Yönetici ekranı boş',
            detail: `fields=${fields}`,
            screenshot: `admin-screen-${slug}.png`,
          })
        );
      }
      shots.push(await shot(admin, outDir, `admin-screen-${slug}`, maskList));
    }
    try {
      if (runFunctional) assertNoConsoleErrors(adminErrors);
    } catch (e) {
      failures.push(
        makeFailure({
          check: 'admin-console',
          description: 'Admin konsol hataları',
          error: e,
        })
      );
    }

    const fixedId = await resolveProductIdBySlug(admin, env.E2E_BASE_URL, products.fixed);
    if (fixedId) {
      await admin.goto(
        withCacheBust(env.E2E_BASE_URL, `/wp-admin/post.php?post=${fixedId}&action=edit`),
        { waitUntil: 'domcontentloaded' }
      );
      await admin.locator(SEL.productDonationTab).first().click().catch(() => {});
      await admin
        .locator('#wdp_donation_data, .wdp_donation_panel, #woocommerce-product-data')
        .first()
        .waitFor({ state: 'visible', timeout: CHECK_MS })
        .catch(() => {});
      shots.push(await shot(admin, outDir, 'admin-product-donation-tab', maskList));
    }
    await admin.close();
    logSection('admin sekmeleri', tAdmin);
  }

  // Functional: alt bağış (gönderim-hatası + sepet yukarıda örtüştü)
  if (runFunctional) {
    try {
      assertRunMutationTargetsAreFixtures(env);
    } catch (e) {
      failures.push(
        makeFailure({
          check: 'mutation-targets-fixtures',
          description: String(e && e.message ? e.message : e),
          error: e,
        })
      );
      functionalStats.failed += 1;
    }

    // Alt bağış: admin config (üstte başlatıldı) bitince 4 senaryo paralel
    await adminConfigPromise;
    const tAddon = Date.now();
    /** @type {number[]} */
    const addonProductIds = [];
    const addonJobs = [];
    for (const productKey of /** @type {const} */ (['fixed', 'custom'])) {
      for (const mode of /** @type {const} */ (['popup', 'panel'])) {
        addonJobs.push({ productKey, mode });
      }
    }
    // 4 senaryo paralel (kendi context + emptyCart). 2 worker denemesi wall’ı uzattı.
    const addonWorkers = Math.min(4, addonJobs.length);
    const addonPromise = !want('sadaka')
      ? Promise.resolve()
      : mapPool(addonJobs, addonWorkers, async ({ productKey, mode }) => {
      const check = `addon-${productKey}-${mode}`;
      const paths = tracePaths(runLabel, check);
      const addonDecision = decideScenarioProduct(env, productKey, mode);
      if (addonDecision.action === 'skip') {
        if (!skips.some((s) => s.check === check)) {
          skips.push(
            makeSkip({
              check,
              reason: addonDecision.reason,
              evidence: addonDecision.evidence || SKIP_EVIDENCE.WP_DATA,
              detail: addonDecision.detail,
            })
          );
          functionalStats.skipped += 1;
        }
        return;
      }
      // Karantina: hata kırmızı sayılmaz, 'quarantined' listesine bilgi olarak yazılır.
      const quarantine = quarantineFor(check, device.id, profile.id);
      const jobFailures = quarantine ? [] : failures;
      const jobStats = quarantine ? { passed: 0, skipped: 0, failed: 0 } : functionalStats;
      const ctx =
        getActiveProfile()?.comingSoon || addonDecision.admin
          ? await asAdmin(browser, env, contextOpts)
          : await contextWithBypass(browser, contextOpts, env);
      // Quick’te tracing pahalı (200s’nin büyük kısmı); full’da koru. Hata → debug JSON.
      const useTrace = !quick;
      if (useTrace) {
        await ctx.tracing.start({ screenshots: true, snapshots: true, sources: false });
      }
      /** @type {{ ok?: boolean, skipped?: boolean, debugFile?: string }|null} */
      let result = null;
      try {
        result = await runAddonScenario({
          context: ctx,
          authed,
          env,
          productPath: productUrls[productKey],
          productSlug: products[productKey],
          productKey,
          mode,
          listPagePath: mode === 'popup' ? popupPagePath(env) : env.E2E_LIST_PAGE,
          productId: productIds[productKey] || 0,
          failures: jobFailures,
          skips,
          stats: jobStats,
          flaky,
          addonAmount: '5566',
          addonProductIds,
          adminConfigCache,
          failDiagnostics: {
            // Quick: teşhis sondajı kapalı (süre); hata yine makeFailure + AJAX özeti
            enabled: !quick,
            runLabel,
            onCollected: (d) => {
              if (d && d.debugFiles && d.debugFiles.json) {
                debugFiles.push(d.debugFiles.json);
              }
            },
          },
          noSideCart,
        });
      } catch (e) {
        result = { ok: false, skipped: false };
        if (quarantine) jobFailures.push({ description: 'Senaryo exception', detail: String(e && e.message ? e.message : e) });
        writeDebugJson(paths.json, {
          phase: 'mapPool-exception',
          check,
          error: String(e && e.message ? e.message : e),
          activeScenarios: listActiveScenarios(),
        });
        debugFiles.push(path.relative(ROOT, paths.json));
      } finally {
        const failed = !result || (!result.skipped && result.ok === false);
        if (quarantine) {
          const qFailed = failed || jobFailures.length > 0;
          quarantined.push({
            status: qFailed ? 'BAŞARISIZ' : 'geçti',
            check,
            device: device.id,
            env: profile.id,
            reason: quarantine.reason,
            ref: quarantine.ref,
            detail: qFailed ? String((jobFailures[0] && (jobFailures[0].description || jobFailures[0].detail)) || 'başarısız').slice(0, 300) : '',
          });
        }
        if (useTrace) {
          await ctx.tracing.stop({ path: paths.zip }).catch(() => {});
          if (failed) {
            debugFiles.push(path.relative(ROOT, paths.zip));
          } else {
            try {
              fs.unlinkSync(paths.zip);
            } catch (e) {
              /* ignore */
            }
          }
        }
        if (failed && result && result.debugFile) {
          debugFiles.push(path.relative(ROOT, result.debugFile));
        }
        await ctx.close().catch(() => {});
      }
    }).finally(() => {
      logSection('alt bağış senaryoları', tAddon);
    });

    await addonPromise;
    void addonProductIds;

    // 12.0.0: eski motorun ürün-meta suite'leri (amount-options, form-fields, campaign-blocks, product-theme)
    // eski modal / sihirbaz / ikon / ürün rengi seçeneklerini sınıyordu; yeni motorda eşdeğeri
    // tests/e2e/specs/* (experiences-types, experiences-containers, campaign, ...) ve PHPUnit'tedir.
    // Dosyaları duruyor ama koşulmaz (silme/yeniden yazma kararı RAPOR-12-e2e.md "Kalan işler").
    const mutationSuites = [
      ['shortcodes', './shortcodes.mjs', 'runShortcodeChecks', 'Kısa kod E2E koşucusu çöktü'],
      ['empty-price', './empty-price.mjs', 'runEmptyPriceChecks', 'Fiyatsız ürün E2E koşucusu çöktü'],
    ];
    // layout.mjs (eski modalın .wdp-* yerleşim ölçüleri) koşulmaz: yeni formda kabuk bütünlüğü + eylem çubuğu
    // (assertShellCompleteness, assertPanelCtaPinnedWhenShort, POPUP-OVERLAP) ve tasarım karşılaştırması kapsar.
    const { withEnvMutationLock } = await import('./mutation-lock.mjs');
    const { deviceRunsMutations } = await import('./mutation-policy.mjs');
    const expectAjaxError = new Set(['form-fields', 'campaign-blocks', 'shortcodes']);
    const runOneMeta = async ([area, mod, fn, crash], locked) => {
      const tSuite = Date.now();
      const pauseAjax = expectAjaxError.has(area);
      if (pauseAjax) pausePluginAjaxWatch();
      try {
        if (!want(area)) {
          /* alan süzgeci */
        } else {
          const imported = await import(mod);
          await imported[fn]({
            browser,
            contextOpts,
            env,
            productUrls,
            productIds,
            listPagePath: env.E2E_LIST_PAGE,
            failures,
            stats: functionalStats,
            skips,
            deviceId: e2eDeviceLabel(device.id),
            createAdminContext: () => asAdmin(browser, env, contextOpts),
            createVisitorContext: () => asVisitor(browser, env, contextOpts),
          });
        }
      } catch (e) {
        failures.push(makeFailure({ check: `${area}-runner`, description: crash, error: e }));
        functionalStats.failed += 1;
      } finally {
        if (pauseAjax) resumePluginAjaxWatch();
        logSection(area, tSuite);
      }
      void locked;
    };
    try {
      if (deviceRunsMutations(device.id) && wantAnyMutationArea(want, mutationSuites)) {
        for (const suite of mutationSuites) {
          await withEnvMutationLock(profile.id, () => runOneMeta(suite, true), {
            deviceId: device.id,
            skipIfNotMutationDevice: true,
          });
        }
      }
    } catch (e) {
      failures.push(
        makeFailure({
          check: 'mutation-lock',
          description: String(e && e.message ? e.message : e),
          error: e,
        })
      );
      functionalStats.failed += 1;
      await Promise.all([
        guest.close().catch((err) => {
          console.error(`[e2e:catch-fail] guest close: ${err && err.message ? err.message : err}`);
        }),
        authed.close().catch((err) => {
          console.error(`[e2e:catch-fail] authed close: ${err && err.message ? err.message : err}`);
        }),
        browser.close().catch((err) => {
          console.error(`[e2e:catch-fail] browser close: ${err && err.message ? err.message : err}`);
        }),
      ]);
    }

    const a11yCheckoutPromise =
      want('mobile-a11y') || want('checkout-flow')
        ? (async () => {
            const tA11y = Date.now();
            const flowPage = await (profile.comingSoon ? catalogCtx : guest).newPage();
            const flowT = getActiveTimeouts();
            flowPage.setDefaultTimeout(flowT.action);
            flowPage.setDefaultNavigationTimeout(flowT.navigation);
            try {
              const openFlowShell = async () => {
                const listOrProduct = popupPagePath(env) || productUrls.custom || productUrls.fixed || '/';
                await flowPage.goto(withCacheBust(env.E2E_BASE_URL, listOrProduct, guestExtra), {
                  waitUntil: 'domcontentloaded',
                  timeout: flowT.navigation,
                });
                await revealListProductTrigger(flowPage);
                const trigger = flowPage.locator(
                  `${SEL.centeredPopupTrigger}, ${SEL.sidePanelTrigger}, .wdp-card__cta, .wdp-loop-donate`
                );
                if ((await trigger.count()) > 0) {
                  await clickShellTrigger(trigger, 15000).catch(() => {});
                  await flowPage
                    .locator(SEL.openModalShell)
                    .first()
                    .waitFor({ state: 'visible', timeout: 15000 })
                    .catch(() => {});
                  await waitOpenShellSettled(flowPage, 4000);
                }
              };
              await openFlowShell();
              if (want('mobile-a11y')) {
                await Promise.race([
                  runMobileA11yChecks({
                    page: flowPage,
                    device,
                    profile,
                    failures,
                    stats: functionalStats,
                    knownFindings: a11yFindings,
                  }),
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('mobile-a11y 90s zaman aşımı')), 90000)
                  ),
                ]);
              }
              if (want('checkout-flow')) {
                await Promise.race([
                  runDonationFlowChecks({
                    page: flowPage,
                    env,
                    productUrls,
                    productIds,
                    listPagePath: popupPagePath(env),
                    failures,
                    stats: functionalStats,
                    skips,
                    deviceId: device.id,
                    checkoutUrl: checkoutEnv?.checkoutUrl || '',
                    offlineGateway: checkoutEnv?.offline || null,
                    skipOrderReason: checkoutEnv?.skipOrderReason || '',
                  }),
                  new Promise((_, reject) =>
                    setTimeout(
                      () => reject(new Error('checkout-flow 420s zaman aşımı')),
                      420000
                    )
                  ),
                ]);
              }
            } catch (e) {
              failures.push(
                makeFailure({
                  check: `device-flow-${device.id}`,
                  description: 'Cihaz akışı / a11y koşucusu çöktü',
                  error: e,
                })
              );
              functionalStats.failed += 1;
            } finally {
              await Promise.race([
                flowPage.close(),
                new Promise((resolve) => setTimeout(resolve, 5000)),
              ]).catch(() => {});
              logSection('a11y+checkout-flow', tA11y);
            }
          })()
        : Promise.resolve();

    const currencyPromise =
      currencySwitchFromProfile(profile) && (want('core') || want('checkout-flow'))
        ? (async () => {
            const tCur = Date.now();
            try {
              await runCurrencySwitchChecks({
                browser,
                contextOpts,
                env,
                productUrls,
                productIds,
                listPagePath: env.E2E_LIST_PAGE,
                failures,
                stats: functionalStats,
                skips,
              });
            } catch (e) {
              failures.push(
                makeFailure({
                  check: 'currency-switch-runner',
                  description: 'Para birimi gösterimi koşucusu çöktü',
                  error: e,
                })
              );
              functionalStats.failed += 1;
            } finally {
              logSection('currency-switch', tCur);
            }
          })()
        : Promise.resolve();

    await Promise.all([a11yCheckoutPromise, currencyPromise]);
  }

  await guest.close();
  await authed.close();
  await browser.close();

  if (checkoutEnv && typeof checkoutEnv.restore === 'function') {
    try {
      checkoutEnv.restore();
    } catch (e) {
      failures.push(
        makeFailure({
          check: 'checkout-restore',
          description: 'Ödeme yöntemi eski haline alınamadı',
          error: e,
        })
      );
    }
  }

  if (canaryBefore) {
    try {
      const after = snapshotCanary();
      const cmp = compareWithRegistry(canaryBefore, after, undefined, { envId: profile.id });
      if (!cmp.ok) {
        writeCanaryAlert(cmp, 'Koşu durdu; sonraki testler başlatılmaz.');
        failures.push(
          makeFailure({
            check: 'canary-diff',
            description: 'Kanarya: kayıt defteri dışı fark',
            error: new Error(formatCanaryDiff(cmp)),
          })
        );
      }
    } catch (e) {
      failures.push(
        makeFailure({
          check: 'canary-after',
          description: 'Kanarya son görüntü alınamadı',
          error: e,
        })
      );
    }
  }

  if (runFunctional) {
    try {
      const cleaned = await Promise.race([
        cleanupE2EData({ guardOrderId: guardOrder?.id, envId: profile.id }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('cleanup 120s zaman aşımı')), 120000)
        ),
      ]);
      debugFiles.push(`cleanup:${JSON.stringify(cleaned)}`);
      if (canaryBefore) {
        const afterCleanup = snapshotCanary();
        const cmpCleanup = compareWithRegistry(canaryBefore, afterCleanup, undefined, { envId: profile.id });
        if (!cmpCleanup.ok) {
          writeCanaryAlert(cmpCleanup, 'Temizlik sonrası kayıt defteri dışı fark; koşu kırmızı.');
          failures.push(
            makeFailure({
              check: 'canary-after-cleanup',
              description: 'Kanarya: temizlik sonrası beklenmeyen fark',
              error: new Error(formatCanaryDiff(cmpCleanup)),
            })
          );
        }
      }
    } catch (e) {
      failures.push(
        makeFailure({
          check: 'e2e-cleanup',
          description: 'İşaretli test sipariş/müşteri silinemedi',
          error: e,
        })
      );
    }
  }

  if (runFunctional) {
    functionalStats.failed = failures.length;
    const otherFails = failures.filter((f) => !String(f.check || '').startsWith('addon-')).length;
    if (otherFails === 0) {
      functionalStats.passed += 1; // addon dışı işlevsel kontroller
    }
  }

  printSectionTable();

  const screens = [
    ...new Set(
      shots
        .map((p) => path.basename(String(p)))
        .filter((n) => n.endsWith('.png'))
    ),
  ].sort();

  const blockedOrders = consumeOrderBlocks();
  for (const requestPath of blockedOrders) {
    failures.push(
      makeFailure({
        check: 'remote-order-block',
        description: `REMOTE-ORDER-BLOCKED: ${requestPath}`,
      })
    );
    functionalStats.failed += 1;
  }

  const blockedAdminWrites = consumeAdminWriteBlocks();
  for (const requestPath of blockedAdminWrites) {
    failures.push(
      makeFailure({
        check: 'remote-admin-write-block',
        description: `REMOTE-ADMIN-WRITE-BLOCKED: ${requestPath}`,
      })
    );
    functionalStats.failed += 1;
  }

  const blockedForeignWrites = consumeForeignWriteBlocks();
  for (const requestPath of blockedForeignWrites) {
    failures.push(
      makeFailure({
        check: 'remote-foreign-write',
        description: `REMOTE-FOREIGN-WRITE: ${requestPath}`,
      })
    );
    functionalStats.failed += 1;
  }

  const blockedRetiredHosts = consumeRetiredHostBlocks();
  for (const requestPath of blockedRetiredHosts) {
    failures.push(
      makeFailure({
        check: 'remote-retired-host',
        description: `REMOTE-RETIRED-HOST: ${requestPath}`,
      })
    );
    functionalStats.failed += 1;
  }

  try {
    assertNoPluginAjaxFailures(snapshotPluginAjaxFails());
  } catch (e) {
    failures.push(
      makeFailure({
        check: 'plugin-ajax-fail',
        description: String(e && e.message ? e.message : e),
      })
    );
    functionalStats.failed += 1;
  }

  promoteIllegalSkips({ skips, failures, stats: functionalStats, makeFailure });

  const blockedTrackers = snapshotBlockedTrackers();
  const blockedLive = snapshotBlockedLive();
  const remotePostBlocked = snapshotRemotePostBlocked();
  const izinliOkuma = snapshotAllowedReads();
  console.log(formatRemotePostBlockedLines(remotePostBlocked, izinliOkuma, { blocked_live: blockedLive }));

  removeSignals();
  resetMutationLockAbort();

  return {
    shots,
    screens,
    failures,
    skips,
    warnings,
    flaky,
    quarantined,
    debugFiles: [...new Set(debugFiles)],
    stats: functionalStats,
    outDir,
    sections: sectionTimings.slice(),
    mode,
    runLabel,
    noSideCart: !!noSideCart,
    device: device.id,
    profileId: profile.id,
    a11yFindings,
    blocked_trackers: blockedTrackers,
    blocked_live: blockedLive,
    remote_post_blocked: remotePostBlocked,
    izinli_okuma: izinliOkuma,
  };
}
