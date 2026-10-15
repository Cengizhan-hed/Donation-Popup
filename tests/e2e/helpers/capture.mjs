/**
 * Capture staging screens for baseline / compare runs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from '@playwright/test';
import { withCacheBust, productPaths, ROOT } from './env.mjs';
import {
  assertNoConsoleErrors,
  assertNoCriticalError,
  assertNoHorizontalOverflow,
  attachConsoleErrorCollector,
  cartItemCount,
  cartItemsDetail,
  CHECK_MS,
  clickAddToCartWithRetry,
  emptyCart,
  makeFailure,
  openShellLocator,
  resolveAllProductPaths,
  visibleValidationErrors,
  waitForShellClosed,
} from './checks.mjs';
import { ensureAuth, AUTH_FILE } from './auth.mjs';
import { FREEZE_MOTION_CSS, SEL, maskSelectors } from './selectors.mjs';
import { currentSrcMatchesExpected } from './image-url.mjs';
import {
  collectAddToCartDiagnostics,
  startDomMutationProbe,
  stopDomMutationProbe,
} from './click-diagnostics.mjs';
import {
  attachDocumentCacheProbe,
  createTimeline,
  listActiveScenarios,
  tracePaths,
  writeDebugJson,
} from './scenario-debug.mjs';
import {
  collectPageProbeLogs,
  installPageProbe,
  snapshotSadakaAndButton,
  wrapWdpValidationHooks,
} from './page-probe.mjs';

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

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
}

/**
 * Açık kabukta adet/hisse girişinin 1 olduğunu oku.
 * @param {import('@playwright/test').Page} page
 * @param {string} productKey
 * @returns {Promise<{ ok: boolean, value: string, field: string }>}
 */
async function readShellInitialQty(page, productKey) {
  const shell = openShellLocator(page);
  if (productKey === 'shares') {
    const input = shell.locator('input[name="share_count"]').first();
    const n = await input.count().catch(() => 0);
    if (!n) {
      return { ok: false, value: '(yok)', field: 'share_count' };
    }
    const value = String((await input.inputValue().catch(() => '')) || '').trim();
    return { ok: value === '1', value: value || '(boş)', field: 'share_count' };
  }
  const input = shell.locator('.wdp-product-quantity input[name="quantity"], input[name="quantity"][type="number"]').first();
  const n = await input.count().catch(() => 0);
  if (!n) {
    // Bazı tiplerde gizli quantity=1 yeterli
    const hidden = shell.locator('input[name="quantity"]').first();
    if ((await hidden.count().catch(() => 0)) > 0) {
      const value = String((await hidden.inputValue().catch(() => '')) || '').trim();
      return { ok: value === '1' || value === '', value: value || '1(gizli)', field: 'quantity' };
    }
    return { ok: true, value: '1(varsayılan)', field: 'quantity' };
  }
  const value = String((await input.inputValue().catch(() => '')) || '').trim();
  return { ok: value === '1', value: value || '(boş)', field: 'quantity' };
}

/** Hata ekran görüntüsü için odak halkasını da kes (shares-errors kararlılığı). */
const FREEZE_ERROR_SHOT_CSS = `
${FREEZE_MOTION_CSS}
*:focus, *:focus-visible {
  outline: none !important;
  box-shadow: none !important;
}
.wdp-input-error,
.wdp-form-error,
.wdp-shareholder-header,
.wdp-shareholder-form {
  animation: none !important;
  transition: none !important;
  opacity: 1 !important;
  transform: none !important;
}
.wdp-shareholders-scroll {
  scroll-behavior: auto !important;
}
`;

/**
 * Yalnızca ekran alınırken enjekte edilir (işlevsel kontrollerde kullanılmaz).
 */
const STABILIZE_SHOT_CSS = `
*{transition:none!important;animation:none!important;caret-color:transparent!important}
img.lazyload, img.lazyloading, img.lazyloaded, .fusion-image-wrapper img, .lazyload,
.fusion-image-wrapper, .fusion-lazy-load, .awb-image-wrapper, .lazyloaded{
  opacity:1!important;visibility:visible!important
}
`;

/**
 * @param {import('@playwright/test').Page} page
 */
async function freezeMotion(page) {
  await page.addStyleTag({ content: FREEZE_MOTION_CSS }).catch(() => {});
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
          ? document.querySelector('.wdp-modal.show, .hdf-donation-modal-wrapper.wdp-modal.show') ||
            null
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
 * Kabuk ekranı ürün sayfasından belirgin kısa mı?
 * @param {number} shellH
 * @param {number} productH
 * @param {string} screenName
 * @param {ReturnType<typeof makeFailure>[]} failures
 */
function assertShellPageHeight(shellH, productH, screenName, failures) {
  if (!productH || productH <= 0 || !shellH) return;
  if (shellH < productH * 0.9) {
    failures.push(
      makeFailure({
        check: `${screenName}-page-height`,
        description: 'Kabuk ekranı ürün sayfasından belirgin kısa (sayfa yarım kalmış olabilir)',
        detail: `kabuk=${shellH}px ürün=${productH}px eşik=<%10`,
        screenshot: `${screenName}.png`,
      })
    );
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
 * Hisseli hata ekranı: ilk kart açık, diğerleri kapalı; kaydırma sabit.
 * @param {import('@playwright/test').Page} page
 */
async function stabilizeShareholderErrorState(page) {
  await page
    .evaluate(() => {
      const forms = Array.from(document.querySelectorAll('.wdp-shareholder-form'));
      forms.forEach((form, i) => {
        if (i === 0) {
          form.classList.remove('collapsed');
        } else {
          form.classList.add('collapsed');
        }
      });
      document.querySelectorAll('.wdp-shareholders-scroll').forEach((el) => {
        el.scrollTop = 0;
      });
      window.scrollTo(0, 0);
    })
    .catch(() => {});
}

/**
 * Hata durumu ekranı: animasyon bitsin, odak/imleç gizlensin, scroll sabit.
 * @param {import('@playwright/test').Page} page
 * @param {{ shares?: boolean }} [opts]
 */
async function prepareErrorShot(page, opts = {}) {
  await page
    .evaluate(() => {
      const ae = document.activeElement;
      if (ae && typeof ae.blur === 'function') {
        ae.blur();
      }
      window.getSelection()?.removeAllRanges?.();
    })
    .catch(() => {});

  if (opts.shares) {
    await stabilizeShareholderErrorState(page);
  }

  await waitForAnimationsSettled(page);
  await page.addStyleTag({ content: FREEZE_ERROR_SHOT_CSS }).catch(() => {});
  if (opts.shares) {
    await stabilizeShareholderErrorState(page);
  }
  await page
    .evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelectorAll('.wdp-shareholders-scroll, .wdp-modal-body, .wdp-modal-content').forEach((el) => {
        if (el && 'scrollTop' in el) el.scrollTop = 0;
      });
    })
    .catch(() => {});
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
 * @param {{ fullPage?: boolean, scrollPage?: boolean, shellOnly?: boolean }} [opts]
 */
async function shot(page, dir, name, maskList, opts = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const fullPage = opts.fullPage !== false;
  const scrollPage = opts.scrollPage !== false;
  const shellOnly = !!opts.shellOnly;
  await settleForScreenshot(page, { fullPage: shellOnly ? false : fullPage, scrollPage: shellOnly ? false : scrollPage });
  if (!shellOnly) {
    await preparePageShotChrome(page);
  }
  // Stabilize CSS yalnızca ekran anında
  await page.addStyleTag({ content: STABILIZE_SHOT_CSS }).catch(() => {});
  await freezeMotion(page);
  const file = path.join(dir, `${name}.png`);
  if (shellOnly) {
    const shell = openShellLocator(page);
    const visible = (await shell.count().catch(() => 0)) > 0 && (await shell.isVisible().catch(() => false));
    if (visible) {
      await shell.screenshot({
        path: file,
        animations: 'disabled',
      });
      return file;
    }
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
}

/**
 * @param {import('@playwright/test').Page} page
 */
async function openDonate(page) {
  const btn = page.locator(SEL.donateTrigger).first();
  const n = await btn.count().catch(() => 0);
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
    // assets/js/src/modal.js handleOutsideClick — .wdp-modal-content dışı
    const box = await shell.boundingBox();
    if (!box) {
      throw new Error('Açık kabuk bounding box yok');
    }
    const content = shell.locator(SEL.modalContent).first();
    const cbox = await content.boundingBox();
    let x = box.x + 6;
    let y = box.y + 6;
    if (cbox) {
      if (cbox.x - box.x > 20) {
        x = box.x + 8;
        y = box.y + Math.min(40, box.height / 2);
      } else if (cbox.y - box.y > 20) {
        x = box.x + Math.min(40, box.width / 2);
        y = box.y + 8;
      } else {
        x = box.x + 2;
        y = box.y + 2;
      }
    }
    await page.mouse.click(x, y);
    await waitForShellClosed(page);
    return;
  }

  // Yalnızca açık kabuk içindeki button.wdp-modal-close (pswp lightbox değil)
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
async function fillDonorFields(root) {
  // includes/templates/class-form-fields-renderer.php — donation_full_name
  // İskelet (disabled/inert) kalkmadan fill no-op olabiliyor; actionability beklenir (senaryo sırası aynı).
  const nameVal = 'E2E Test';
  const phoneVal = '5551234567';
  const nameLoc = root.locator(SEL.donorName).first();
  await nameLoc.waitFor({ state: 'visible', timeout: CHECK_MS });
  await root.page().waitForFunction(
    () => {
      const modal = document.querySelector('.wdp-modal.show');
      if (!modal || modal.classList.contains('wdp-is-skeleton')) return false;
      const input = modal.querySelector('input[name="donation_full_name"]');
      return !!(input && !input.disabled && input.isConnected);
    },
    null,
    { timeout: CHECK_MS }
  ).catch(() => {});
  await nameLoc.fill(nameVal);
  // includes/class-phone-field.php + phone-input.js — +90 ulusal: 5551234567 (baştaki 0 yok)
  const phone = root.locator(SEL.donorPhone).first();
  await phone.click();
  await phone.fill('');
  await phone.fill(phoneVal);
  let emailVal = '';
  const email = root.locator(SEL.donorEmail);
  if (await email.count()) {
    emailVal = 'e2e@example.com';
    await email.first().fill(emailVal).catch(() => {});
  }
  return { name: nameVal, phone: phoneVal, email: emailVal };
}

/**
 * Doldurulan bağışçı alanları tıklamadan hemen önce hâlâ duruyor mu?
 * @param {import('@playwright/test').Locator} shell
 * @param {{ name?: string, phone?: string, customPrice?: string, sadakaPrice?: string }} expected
 * @param {ReturnType<typeof makeFailure>[]} failures
 * @param {string} check
 */
async function assertDonorFieldsPersist(shell, expected, failures, check) {
  const actual = await shell
    .evaluate(() => {
      const root =
        document.querySelector('.wdp-modal.show') ||
        document.querySelector('.wdp-modal[aria-hidden="false"]');
      if (!root) return null;
      const name = root.querySelector('input[name="donation_full_name"]');
      const phone = root.querySelector(
        'input[name="donation_phone"], input.wdp-phone-field__number[name="donation_phone"]'
      );
      const custom = root.querySelector('input[name="custom_price"]');
      const sadaka = root.querySelector('input[name="sadaka_custom_price"]');
      return {
        name: name ? String(name.value || '') : null,
        phone: phone ? String(phone.value || '') : null,
        custom: custom ? String(custom.value || '') : null,
        sadaka: sadaka ? String(sadaka.value || '') : null,
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
      `custom_price beklenen="${expected.customPrice}" gerçek="${actual.custom}"`
    );
  }
  if (expected.sadakaPrice != null && actual.sadaka != null && actual.sadaka !== expected.sadakaPrice) {
    mismatches.push(
      `sadaka_custom_price beklenen="${expected.sadakaPrice}" gerçek="${actual.sadaka}"`
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
 * Store API ile ürün ID’si (slug).
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @param {string} slug
 * @returns {Promise<number>}
 */
async function resolveProductIdBySlug(page, baseUrl, slug) {
  const root = baseUrl.replace(/\/$/, '');
  return page.evaluate(
    async ({ base, productSlug }) => {
      try {
        const url = `${base}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(productSlug)}&per_page=5`;
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) return 0;
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        const hit =
          list.find((p) => p && p.slug === productSlug) ||
          list.find((p) => p && String(p.permalink || '').includes(productSlug));
        return hit && hit.id ? Number(hit.id) || 0 : 0;
      } catch (e) {
        return 0;
      }
    },
    { base: root, productSlug: slug }
  );
}

export async function readProductSadakaAdminConfig(authed, env, productSlug) {
  const page = await authed.newPage();
  const empty = (reason) => ({
    enabled: false,
    productWcId: 0,
    globalWcId: 0,
    resolvedWcId: 0,
    expected: false,
    status: /** @type {'atlandı'} */ ('atlandı'),
    reason,
    detail: reason,
  });
  try {
    // Mağaza yöneticisi: ürün listesi araması yerine doğrudan post.php (Store API ID).
    await page.goto(withCacheBust(env.E2E_BASE_URL, '/'), { waitUntil: 'domcontentloaded' }).catch(() => {});
    const productId = await resolveProductIdBySlug(page, env.E2E_BASE_URL, productSlug);
    if (!productId) {
      return empty('Store API’den ürün ID bulunamadı');
    }
    await page.goto(
      withCacheBust(env.E2E_BASE_URL, `/wp-admin/post.php?post=${productId}&action=edit`),
      { waitUntil: 'domcontentloaded' }
    );
    const titleField = page.locator('#title, #post-title-0, .editor-post-title__input').first();
    if ((await titleField.count()) === 0 && (await page.locator('body.wp-admin').count()) === 0) {
      return empty(`ürün düzenleme sayfası açılamadı (#${productId})`);
    }
    await page.locator(SEL.productDonationTab).first().click().catch(() => {});
    await page
      .locator('#wdp_enable_sadaka_donation, #wdp_sadaka_wc_product_id')
      .first()
      .waitFor({ state: 'attached', timeout: CHECK_MS })
      .catch(() => {});

    const enabled = await page
      .locator('#wdp_enable_sadaka_donation')
      .isChecked()
      .catch(() => false);

    let productWcId = 0;
    const productSelect = page.locator('#wdp_sadaka_wc_product_id');
    if ((await productSelect.count()) > 0) {
      const val = await productSelect.inputValue().catch(() => '');
      productWcId = Number.parseInt(String(val || ''), 10) || 0;
    }

    // Genel varsayılan — her zaman oku (ürün ID boşsa çözülür)
    let globalWcId = 0;
    await page.goto(
      withCacheBust(env.E2E_BASE_URL, '/wp-admin/admin.php?page=wdp-popup-settings'),
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

    const resolvedWcId = productWcId > 0 ? productWcId : globalWcId;
    let reason = '';
    let status = /** @type {'beklenir'|'atlandı'} */ ('beklenir');
    if (!enabled) {
      status = 'atlandı';
      reason = 'Alt bağış ekle işaretli değil';
    } else if (resolvedWcId <= 0) {
      status = 'atlandı';
      reason = 'ürün ID boş ve genel varsayılan yok';
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
      detail: `enable=${enabled} ürün_id=${productWcId} genel_id=${globalWcId} → ${reason}`,
    };
  } catch (e) {
    return empty(`admin okuma hata: ${String(e.message || e)}`);
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
        'li.product, .product, .fusion-product, .wdp-donations-item, .wdp-card, article, .products > *';

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
            '.wdp-loop-donate, .wdp-donate-button, .wdp-open-modal, [data-wdp-lazy]'
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
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await settleForScreenshot(page, { fullPage: true, scrollPage: true });
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
    await page
      .goto(withCacheBust(env.E2E_BASE_URL, '/', guestExtra), { waitUntil: 'domcontentloaded' })
      .catch(() => {});
    /** @type {Array<{key:string,slug:string,id:number,name:string}>} */
    const donationProducts = [];
    for (const [key, slug] of Object.entries(products)) {
      const id = await resolveProductIdBySlug(page, env.E2E_BASE_URL, slug);
      let name = slug;
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
      donationProducts.push({ key, slug, id: id || 0, name });
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
 * Alt bağış (sadaka) senaryosu — popup veya panel.
 * Yapılandırma yoksa atlanır (hata sayılmaz); ayar var ama buton yoksa hata.
 * @param {object} opts
 * @param {import('@playwright/test').BrowserContext} opts.context
 * @param {import('@playwright/test').BrowserContext} opts.authed
 * @param {Record<string,string>} opts.env
 * @param {string} opts.productPath
 * @param {string} opts.productSlug
 * @param {'fixed'|'custom'} opts.productKey
 * @param {'popup'|'panel'} opts.mode
 * @param {ReturnType<typeof makeFailure>[]} opts.failures
 * @param {Array<{check:string,description:string,detail?:string}>} opts.skips
 * @param {{ passed: number, skipped: number, failed: number }} opts.stats
 * @param {string} opts.sadakaAmount
 */
export async function runSadakaScenario({
  context,
  authed,
  env,
  productPath,
  productSlug,
  productKey,
  mode,
  failures,
  skips,
  stats,
  flaky,
  sadakaAmount,
  sadakaProductIds,
  adminConfigCache,
  /** @type {{ enabled?: boolean, onCollected?: (d: object) => void, runLabel?: string }|undefined} */
  failDiagnostics,
  noSideCart = false,
}) {
  const check = `sadaka-${productKey}-${mode}`;
  const runLabel = (failDiagnostics && failDiagnostics.runLabel) || 'run';
  const wantDiag = !!(failDiagnostics && failDiagnostics.enabled !== false);
  const paths = tracePaths(runLabel, check);
  const timeline = createTimeline(check);
  const guestExtra = noSideCart ? { hdf_no_side_cart: '1' } : {};
  await installPageProbe(context).catch(() => {});
  const page = await context.newPage();
  const cacheProbe = attachDocumentCacheProbe(page);
  const postedSadaka = { fields: {} };
  /** @type {object|null} */
  let firstAttemptBundle = null;

  page.on('request', (req) => {
    if (req.method() !== 'POST') return;
    const url = req.url();
    if (!/admin-ajax\.php/i.test(url) && !/[?&]wc-ajax=/i.test(url)) return;
    const post = req.postData() || '';
    if (!post.includes('wdp_ajax_add_to_cart') && !post.includes('sadaka_')) return;
    try {
      const params = new URLSearchParams(post);
      for (const [k, v] of params.entries()) {
        if (k.startsWith('sadaka_')) {
          postedSadaka.fields[k] = v;
        }
      }
    } catch (e) {
      /* ignore */
    }
  });

  try {
    // Önce admin yapılandırması (atlandı / beklenir)
    timeline.mark('admin-config');
    let cfg = adminConfigCache.get(productSlug);
    if (!cfg) {
      cfg = await readProductSadakaAdminConfig(authed, env, productSlug);
      adminConfigCache.set(productSlug, cfg);
    }
    if (cfg.resolvedWcId > 0 && Array.isArray(sadakaProductIds)) {
      sadakaProductIds.push(cfg.resolvedWcId);
    }

    if (!cfg.expected) {
      skips.push({
        check,
        description: `Atlandı — ${cfg.reason}`,
        detail: cfg.detail,
      });
      stats.skipped += 1;
      return { ok: true, check, skipped: true };
    }

    timeline.mark('empty-cart');
    await emptyCart(page, env.E2E_BASE_URL);
    timeline.mark('goto-product');
    await page.goto(withCacheBust(env.E2E_BASE_URL, productPath, guestExtra), {
      waitUntil: 'domcontentloaded',
    });

    timeline.mark('open-shell');
    const trigger =
      mode === 'panel'
        ? page.locator(SEL.sidePanelTrigger).first()
        : page.locator(SEL.donateTrigger).first();
    await trigger.click({ timeout: CHECK_MS }).catch(() => openDonate(page));
    const shell = openShellLocator(page);
    await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
    await wrapWdpValidationHooks(page).catch(() => {});

    timeline.mark('fill-donor');
    const donorFilled = await fillDonorFields(shell);
    await wrapWdpValidationHooks(page).catch(() => {});
    if (productKey === 'custom') {
      await shell.locator(SEL.customPrice).first().fill('250');
    }

    const toggle = shell.locator(SEL.sadakaToggle).first();
    const wrap = shell.locator(SEL.sadakaWrap).first();
    const hasToggle = (await toggle.count()) > 0 || (await wrap.count()) > 0;

    if (!hasToggle) {
      failures.push(
        makeFailure({
          check,
          description: 'Alt bağış ayarı var (beklenir) ama Sadaka Bağışı Ekle butonu yok',
          detail: `data-wdp-sadaka-donation / toggle yok — ${cfg.detail}`,
          screenshot: `desktop-${mode}-${productKey}-open.png`,
        })
      );
      stats.failed += 1;
      return { ok: false, check, skipped: false };
    }

    const altWcFromDom = await wrap
      .first()
      .getAttribute('data-wdp-alt-wc-product-id')
      .catch(() => '');
    const expectedWcId =
      Number.parseInt(String(altWcFromDom || ''), 10) || cfg.resolvedWcId || 0;
    if (expectedWcId > 0 && Array.isArray(sadakaProductIds)) {
      sadakaProductIds.push(expectedWcId);
    }

    timeline.mark('open-sadaka');
    await toggle.click();
    await shell.locator(SEL.sadakaOpen).waitFor({ state: 'visible', timeout: CHECK_MS });
    const price = shell.locator(SEL.sadakaPrice).first();
    const isFixedSadaka = await price.isEditable().then((v) => !v).catch(() => false);
    if (!isFixedSadaka) {
      await price.fill(String(sadakaAmount));
      await price
        .waitFor({ state: 'visible', timeout: CHECK_MS })
        .catch(() => {});
    }

    const errsBefore = await visibleValidationErrors(page);
    const sadakaAttrs = await price.evaluate((el) => ({
      name: el.getAttribute('name'),
      required: el.required || el.hasAttribute('required'),
      min: el.getAttribute('min'),
      readonly: !!el.readOnly,
      value: el.value,
      type: el.getAttribute('type'),
    }));
    const sameNameCount = await page
      .locator(`input[name="${sadakaAttrs.name || 'sadaka_custom_price'}"]`)
      .count();

    const expectedSadakaVal = isFixedSadaka
      ? String(sadakaAttrs.value || '')
      : String(sadakaAmount);
    await assertDonorFieldsPersist(
      shell,
      {
        name: donorFilled.name,
        phone: donorFilled.phone,
        sadakaPrice: expectedSadakaVal || undefined,
      },
      failures,
      check
    );

    const addBtn = shell.locator(SEL.addToCart).first();
    const tClick = Date.now();
    if (wantDiag) {
      await startDomMutationProbe(page).catch(() => {});
    }
    // Akış aralığını bozma: yalnızca anlık okuma (ek bekleme yok)
    const snapBeforeClick = wantDiag
      ? await snapshotSadakaAndButton(page).catch(() => null)
      : null;
    /** @type {Promise<object|null>|null} */
    let snapAfter50Promise = null;
    if (wantDiag) {
      snapAfter50Promise = (async () => {
        await new Promise((r) => setTimeout(r, 50));
        return snapshotSadakaAndButton(page).catch(() => null);
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
          postedSadaka: postedSadaka.fields,
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
    let mutationSummary = null;
    if (wantDiag) {
      const left = Math.max(0, 2000 - (Date.now() - tClick));
      mutationSummary = await stopDomMutationProbe(page, left).catch(() => null);
    }

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
    const expectedSadaka = isFixedSadaka
      ? Number.parseFloat(sadakaAttrs.value || '0')
      : Number.parseFloat(String(sadakaAmount));

    const hasMain = items.length >= 1;
    // Birincil: alt bağış WC ürün ID eşlemesi
    const sadakaByProduct =
      expectedWcId > 0 ? items.find((it) => Number(it.id) === expectedWcId) : null;
    // İkincil: tutar (±0,01)
    const amountOk =
      sadakaByProduct &&
      Number.isFinite(Number.parseFloat(sadakaByProduct.totals)) &&
      Math.abs(Number.parseFloat(sadakaByProduct.totals) - expectedSadaka) < 0.01;

    const ok =
      ajax.ok &&
      !ajax.timedOut &&
      items.length >= 2 &&
      hasMain &&
      !!sadakaByProduct &&
      !!amountOk &&
      !errsAfter.some((t) => /zorunlu|geçerli bir alt bağış/i.test(t));

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
          postedSadaka: postedSadaka.fields,
          errsBefore,
          errsAfter,
          items,
          clickDiag,
          mutationSummary,
          sadakaAttrs,
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
          description: 'Alt bağış (sadaka) sepete ana bağışla birlikte eklenmeli',
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
                  sadakaFlags: clickDiag.sadakaFlags,
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
            `beklenen tutar: ${expectedSadaka}`,
            `ürün eşleşmesi: ${sadakaByProduct ? 'evet' : 'hayır'}`,
            `tutar eşleşmesi (±0,01): ${amountOk ? 'evet' : 'hayır'}`,
            `görünen hatalar (önce): ${errsBefore.join(' | ') || '(yok)'}`,
            `görünen hatalar (sonra): ${errsAfter.join(' | ') || '(yok)'}`,
            `sadaka input: ${JSON.stringify(sadakaAttrs)}`,
            `aynı name input sayısı: ${sameNameCount}`,
            `POST sadaka_* : ${JSON.stringify(postedSadaka.fields)}`,
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
        description: 'Sadaka senaryosu hata verdi',
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
    await emptyCart(page, env.E2E_BASE_URL).catch(() => {});
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
 */
export async function captureAll({
  env,
  outDir,
  runFunctional,
  mode = 'full',
  workers = 3,
  runLabel = 'run',
  noSideCart = false,
}) {
  sectionTimings.length = 0;
  fs.mkdirSync(outDir, { recursive: true });
  const tAuth = Date.now();
  await ensureAuth(env);
  logSection('auth', tAuth);

  const products = productPaths(env);
  const maskList = maskSelectors(env.E2E_MASK_SELECTORS || '');
  const quick = mode === 'quick';
  const maxWorkers = Math.max(1, Math.min(3, Number(workers) || 3));
  const guestExtra = noSideCart ? { hdf_no_side_cart: '1' } : {};
  /** @type {ReturnType<typeof makeFailure>[]} */
  const failures = [];
  /** @type {Array<{check:string,description:string,detail?:string}>} */
  const skips = [];
  /** @type {Array<{check:string,firstError:string,attemptMs:number[]}>} */
  const flaky = [];
  /** @type {string[]} */
  const debugFiles = [];
  const functionalStats = { passed: 0, skipped: 0, failed: 0 };
  const shots = [];

  const contextOpts = {
    viewport: DESKTOP,
    reducedMotion: /** @type {'reduce'} */ ('reduce'),
  };

  const browser = await chromium.launch();
  const guest = await browser.newContext(contextOpts);
  const authed = await browser.newContext({
    ...contextOpts,
    storageState: AUTH_FILE,
  });

  // Ürün kalıcı bağlantıları (Store API / sayfa linki)
  const tProbe = Date.now();
  const probe = await guest.newPage();
  await probe.goto(withCacheBust(env.E2E_BASE_URL, '/'), { waitUntil: 'domcontentloaded' }).catch(() => {});
  const productUrls = await resolveAllProductPaths(probe, env.E2E_BASE_URL, products);
  await probe.close();
  logSection('ürün URL çözümü', tProbe);

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
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
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
      if (runFunctional && visitOpts.checkImages) {
        await assertVisibleImagesLoaded(page, name, failures);
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

  // a) product pages desktop (paralel) — yükseklik kabuk karşılaştırması için saklanır
  /** @type {Record<string, number>} */
  const productPageHeights = {};
  const tProducts = Date.now();
  const productEntries = Object.entries(productUrls);
  await mapPool(productEntries, maxWorkers, async ([key, rel]) => {
    const name = `desktop-product-${key}`;
    const page = await visit(guest, rel, name, { checkImages: true });
    productPageHeights[key] = await readPageScrollHeight(page);
    if (runFunctional) {
      try {
        const cartForms = await page
          .locator('form.cart:not(.wdp-form):not(.wdp-donation-form-fields)')
          .count();
        const wdpUi = await page.locator(`${SEL.donateTrigger}, ${SEL.inlineDonationForm}`).count();
        if (cartForms > 0) {
          failures.push(
            makeFailure({
              check: `product-${key}`,
              description: 'Ürün sayfasında hâlâ yerel WooCommerce form.cart var',
              detail: `form.cart sayısı: ${cartForms}`,
              screenshot: `${name}.png`,
            })
          );
        }
        if (wdpUi !== 1) {
          failures.push(
            makeFailure({
              check: `product-${key}`,
              description: 'Beklenen tek eklenti formu/butonu yok',
              detail: `bulunan: ${wdpUi}`,
              screenshot: `${name}.png`,
            })
          );
        } else {
          functionalStats.passed += 1;
        }
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
    await page.close();
  });
  logSection('ürün sayfaları', tProducts);

  // b/c/d) modal + panel open/errors — quick + full (admin/mobil yalnız full)
  const shellJobs = [];
  for (const [key, rel] of Object.entries(productUrls)) {
    for (const shellMode of ['popup', 'panel']) {
      shellJobs.push({ key, rel, mode: shellMode });
    }
  }
  const tShells = Date.now();
  /**
   * Kabuk ekranı: shot + images-loaded + page-height.
   * @param {import('@playwright/test').Page} page
   * @param {string} screenName
   * @param {string} productKey
   */
  async function shotShellAndCheck(page, screenName, productKey) {
    shots.push(
      await shot(page, outDir, screenName, maskList, {
        scrollPage: false,
        fullPage: false,
        shellOnly: true,
      })
    );
    if (runFunctional) {
      await assertVisibleImagesLoaded(page, screenName, failures);
      const shellH = await readPageScrollHeight(page);
      assertShellPageHeight(shellH, productPageHeights[productKey] || 0, screenName, failures);
    }
  }

  await mapPool(shellJobs, maxWorkers, async ({ key, rel, mode }) => {
    // Her kabuk işi temiz context (sepet / storage taşınmasın)
    const ctx = await browser.newContext(contextOpts);
    const page = await ctx.newPage();
    const errors = attachConsoleErrorCollector(page);
    const url = withCacheBust(env.E2E_BASE_URL, rel, guestExtra);
    const openName = `desktop-${mode}-${key}-open`;
    const errorsName = `desktop-${mode}-${key}-errors`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      // Her goto sonrası, form açılmadan önce full settle
      await settleForScreenshot(page, { fullPage: true, scrollPage: true });

      const trigger =
        mode === 'panel'
          ? page.locator(SEL.sidePanelTrigger).first()
          : page.locator(SEL.donateTrigger).first();
      const hasTrigger = (await trigger.count().catch(() => 0)) > 0;
      if (!hasTrigger) {
        failures.push(
          makeFailure({
            check: `${mode}-${key}-open`,
            description: 'Bağış butonu bulunamadı — ekran yine de alındı',
            detail: `selector=${mode === 'panel' ? 'sidePanel' : 'donate'}`,
            screenshot: `${openName}.png`,
          })
        );
        await shotShellAndCheck(page, openName, key);
        await shotShellAndCheck(page, errorsName, key);
        return;
      }

      await trigger.click({ timeout: CHECK_MS }).catch(() => openDonate(page).catch(() => {}));
      await openShellLocator(page).waitFor({ state: 'visible', timeout: CHECK_MS }).catch(() => {});
      await waitTwoFrames(page);

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

      // Kabuk açık: kaydırma yok, lazy yine çözülür (scrollPage:false)
      await shotShellAndCheck(page, openName, key);

      if (runFunctional && mode === 'popup') {
        for (const how of /** @type {const} */ (['close', 'esc', 'backdrop'])) {
          const check = `close-${key}-${how}`;
          const labels = {
            close: 'Kapat butonu (.wdp-modal-close) ile form kapanmalı',
            esc: 'ESC tuşu ile form kapanmalı',
            backdrop: 'Arka plana tıklayınca form kapanmalı',
          };
          try {
            if ((await page.locator(SEL.openModalShell).count()) === 0) {
              await page.goto(url, { waitUntil: 'domcontentloaded' });
              await settleForScreenshot(page, { fullPage: true, scrollPage: true });
              await openDonate(page);
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

      // errors: taze goto + full settle, sonra form
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await settleForScreenshot(page, { fullPage: true, scrollPage: true });
      const trigger2 =
        mode === 'panel'
          ? page.locator(SEL.sidePanelTrigger).first()
          : page.locator(SEL.donateTrigger).first();
      await trigger2.click({ timeout: CHECK_MS }).catch(() => openDonate(page).catch(() => {}));
      await openShellLocator(page).waitFor({ state: 'visible', timeout: CHECK_MS }).catch(() => {});
      await page.locator(SEL.goCheckout).first().click({ timeout: CHECK_MS }).catch(() => {});
      await prepareErrorShot(page, { shares: key === 'shares' });
      await waitTwoFrames(page);
      await shotShellAndCheck(page, errorsName, key);

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
        await shotShellAndCheck(page, openName, key);
      } catch (_) {
        /* ignore */
      }
    } finally {
      await page.close().catch(() => {});
      await ctx.close().catch(() => {});
    }
  });
  if (shellJobs.length) logSection('popup/panel ekranları', tShells);

  // e) list + shop
  const tList = Date.now();
  await (await visit(guest, env.E2E_LIST_PAGE, 'desktop-list', { checkImages: true })).close();
  const shopPage = await visit(guest, env.E2E_SHOP_PAGE, 'desktop-shop', { checkImages: true });
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
    await assertDonationLoopButtons({
      guest,
      env,
      products,
      productUrls,
      failures,
      stats: functionalStats,
      guestExtra,
    });
  }
  await shopPage.close();
  logSection('liste + mağaza', tList);

  // f) admin settings tabs + product Bağış tab (quick’te atlanır)
  if (!quick) {
    const tAdmin = Date.now();
    const admin = await authed.newPage();
    const adminErrors = attachConsoleErrorCollector(admin);
    await admin.goto(withCacheBust(env.E2E_BASE_URL, '/wp-admin/admin.php?page=wdp-popup-settings'), {
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
    const tabs = await admin.locator(SEL.adminTab).all();
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      const key = (await tab.getAttribute('data-tab')) || String(i);
      await tab.click();
      const panel = admin.locator(`#wdp-${key}-tab`);
      await panel.waitFor({ state: 'visible', timeout: CHECK_MS }).catch(() => {});
      const visible = await panel.isVisible().catch(() => false);
      const fields = await panel.locator('input, select, textarea, table').count();
      if (runFunctional && (!visible || fields < 1)) {
        failures.push(
          makeFailure({
            check: `admin-tab-${key}`,
            description: 'Admin sekmesi görünür değil veya boş',
            detail: `visible=${visible} fields=${fields}`,
            screenshot: `admin-tab-${key}.png`,
          })
        );
      }
      shots.push(await shot(admin, outDir, `admin-tab-${key}`, maskList));
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

  // Functional: qty change + add to cart for fixed
  if (runFunctional) {
    const tCart = Date.now();
    const cartPaths = tracePaths(runLabel, 'fixed-cart');
    const cartTimeline = createTimeline('fixed-cart');
    const cartCtx = await browser.newContext(contextOpts);
    await installPageProbe(cartCtx).catch(() => {});
    await cartCtx.tracing.start({ screenshots: true, snapshots: true, sources: false });
    const page = await cartCtx.newPage();
    const cartCacheProbe = attachDocumentCacheProbe(page);
    let cartFailed = false;
    /** @type {object|null} */
    let cartFirstAttempt = null;
    try {
      cartTimeline.mark('goto-product');
      await page.goto(withCacheBust(env.E2E_BASE_URL, productUrls.fixed, guestExtra), {
        waitUntil: 'domcontentloaded',
      });
      cartTimeline.mark('empty-cart');
      await emptyCart(page, env.E2E_BASE_URL);
      cartTimeline.mark('goto-product-2');
      await page.goto(withCacheBust(env.E2E_BASE_URL, productUrls.fixed, guestExtra), {
        waitUntil: 'domcontentloaded',
      });
      cartTimeline.mark('open-shell');
      await openDonate(page);
      const shell = openShellLocator(page);
      await wrapWdpValidationHooks(page).catch(() => {});
      const amountBefore = await shell.locator(SEL.lineTotal).first().innerText().catch(() => '');
      await shell.locator(SEL.qtyIncrease).first().click({ timeout: CHECK_MS }).catch(() => {});
      await shell
        .locator(SEL.lineTotal)
        .first()
        .waitFor({ state: 'visible', timeout: CHECK_MS })
        .catch(() => {});
      const amountAfter = await shell.locator(SEL.lineTotal).first().innerText().catch(() => '');
      if (amountBefore && amountAfter && amountBefore === amountAfter) {
        failures.push(
          makeFailure({
            check: 'fixed-qty',
            description: 'Adet artınca görünen tutar değişmeli',
            detail: `önce=${amountBefore} sonra=${amountAfter}`,
            screenshot: 'desktop-popup-fixed-open.png',
          })
        );
      }

      try {
        cartTimeline.mark('fill-donor');
        const donorFilled = await fillDonorFields(shell);
        await wrapWdpValidationHooks(page).catch(() => {});
        await assertDonorFieldsPersist(
          shell,
          { name: donorFilled.name, phone: donorFilled.phone },
          failures,
          'fixed-cart'
        );
        const addBtn = shell.locator(SEL.addToCart).first();
        await startDomMutationProbe(page).catch(() => {});
        const tClick = Date.now();
        const snapBeforeClick = await snapshotSadakaAndButton(page).catch(() => null);
        const snapAfter50Promise = (async () => {
          await new Promise((r) => setTimeout(r, 50));
          return snapshotSadakaAndButton(page).catch(() => null);
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
        const left = Math.max(0, 2000 - (Date.now() - tClick));
        const mutationSummary = await stopDomMutationProbe(page, left).catch(() => null);

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
        if (items === 0) {
          cartFailed = true;
          const valErrors = await visibleValidationErrors(page);
          const clickDiag = await collectAddToCartDiagnostics(page, addBtn, {
            networkTail: ajax.networkRaw || [],
          }).catch((e) => ({ error: String(e.message || e) }));
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
            debugFiles: {
              json: path.relative(ROOT, cartPaths.json),
              firstAttempt: path.relative(ROOT, cartPaths.firstAttemptJson),
              trace: path.relative(ROOT, cartPaths.zip),
            },
          };
          writeDebugJson(cartPaths.json, debugBundle);
          debugFiles.push(path.relative(ROOT, cartPaths.json));
          failures.push(
            makeFailure({
              check: 'fixed-cart',
              description: 'Sepete Ekle sonrası sepet boş kalmamalı',
              detail: [
                `HTTP ${ajax.status} ok=${ajax.ok} timedOut=${ajax.timedOut}`,
                `yanıt (ilk 300): ${ajax.bodyPreview}`,
                `buton: visible=${ajax.buttonState?.visible} disabled=${ajax.buttonState?.disabled}`,
                `denemeler: ${JSON.stringify(ajax.attempts || [])}`,
                `son 15 network: ${(ajax.networkTail || []).join(' | ') || '(yok)'}`,
                `konsol hataları: ${(ajax.consoleErrors || []).join(' | ') || '(yok)'}`,
                `debug: ${path.relative(ROOT, cartPaths.json)}`,
                `trace: ${path.relative(ROOT, cartPaths.zip)}`,
                `teşhis: ${JSON.stringify({
                  formFlags: clickDiag.formFlags,
                  modules: clickDiag.modules,
                  topAtPoint: clickDiag.topAtPoint,
                  nonce: clickDiag.nonce,
                  cacheHeaders: cartCacheProbe.get(),
                  activeScenarios: listActiveScenarios(),
                })}`,
                valErrors.length
                  ? `form hataları: ${valErrors.join(' | ')}`
                  : 'formda görünür doğrulama hatası yok',
              ].join('\n'),
              screenshot: 'desktop-popup-fixed-open.png',
              debugFile: path.relative(ROOT, cartPaths.json),
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

    await emptyCart(page, env.E2E_BASE_URL).catch(() => {});
    cartCacheProbe.dispose();
    cartTimeline.end();
    await page.close().catch(() => {});
    if (cartFailed) {
      await cartCtx.tracing.stop({ path: cartPaths.zip }).catch(() => {});
      debugFiles.push(path.relative(ROOT, cartPaths.zip));
    } else {
      await cartCtx.tracing.stop({ path: cartPaths.zip }).catch(() => {});
      try {
        fs.unlinkSync(cartPaths.zip);
      } catch (e) {
        /* ignore */
      }
    }
    await cartCtx.close().catch(() => {});
    logSection('sepet (fixed)', tCart);

    // Alt bağış: önce admin yapılandırmasını sırayla oku, senaryoları kendi context’leriyle paralel çalıştır
    const tSadaka = Date.now();
    /** @type {number[]} */
    const sadakaProductIds = [];
    /** @type {Map<string, Awaited<ReturnType<typeof readProductSadakaAdminConfig>>>} */
    const adminConfigCache = new Map();
    for (const productKey of /** @type {const} */ (['fixed', 'custom'])) {
      const slug = products[productKey];
      const cfg = await readProductSadakaAdminConfig(authed, env, slug);
      adminConfigCache.set(slug, cfg);
    }
    const sadakaJobs = [];
    for (const productKey of /** @type {const} */ (['fixed', 'custom'])) {
      for (const mode of /** @type {const} */ (['popup', 'panel'])) {
        sadakaJobs.push({ productKey, mode });
      }
    }
    await mapPool(sadakaJobs, maxWorkers, async ({ productKey, mode }) => {
      const check = `sadaka-${productKey}-${mode}`;
      const paths = tracePaths(runLabel, check);
      const ctx = await browser.newContext(contextOpts);
      await ctx.tracing.start({ screenshots: true, snapshots: true, sources: false });
      /** @type {{ ok?: boolean, skipped?: boolean, debugFile?: string }|null} */
      let result = null;
      try {
        result = await runSadakaScenario({
          context: ctx,
          authed,
          env,
          productPath: productUrls[productKey],
          productSlug: products[productKey],
          productKey,
          mode,
          failures,
          skips,
          stats: functionalStats,
          flaky,
          sadakaAmount: '5566',
          sadakaProductIds,
          adminConfigCache,
          failDiagnostics: {
            enabled: true,
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
        writeDebugJson(paths.json, {
          phase: 'mapPool-exception',
          check,
          error: String(e && e.message ? e.message : e),
          activeScenarios: listActiveScenarios(),
        });
        debugFiles.push(path.relative(ROOT, paths.json));
      } finally {
        const failed = !result || (!result.skipped && result.ok === false);
        await ctx.tracing.stop({ path: paths.zip }).catch(() => {});
        if (failed) {
          debugFiles.push(path.relative(ROOT, paths.zip));
          if (result && result.debugFile) {
            debugFiles.push(path.relative(ROOT, result.debugFile));
          }
        } else {
          try {
            fs.unlinkSync(paths.zip);
          } catch (e) {
            /* ignore */
          }
        }
        await ctx.close().catch(() => {});
      }
    });
    logSection('alt bağış senaryoları', tSadaka);
    void sadakaProductIds;
  }

  // Mobile chromium + webkit sample (quick’te atlanır)
  if (!quick) {
    const tMobile = Date.now();
    for (const [engineName, engine] of [
      ['chromium', chromium],
      ['webkit', webkit],
    ]) {
      const b = engineName === 'chromium' ? browser : await engine.launch();
      const ctx = await b.newContext({
        viewport: MOBILE,
        isMobile: true,
        hasTouch: true,
        reducedMotion: 'reduce',
      });
      for (const [key, rel] of Object.entries(productUrls)) {
        const page = await ctx.newPage();
        try {
          await page.goto(withCacheBust(env.E2E_BASE_URL, rel, guestExtra), {
            waitUntil: 'domcontentloaded',
          });
          shots.push(await shot(page, outDir, `mobile-${engineName}-product-${key}`, maskList));
        } catch (e) {
          failures.push(
            makeFailure({
              check: `mobile-${engineName}-product-${key}`,
              description: 'Mobil ekran alınamadı — devam',
              error: e,
            })
          );
        }
        await page.close().catch(() => {});
      }
      const list = await ctx.newPage();
      try {
        await list.goto(withCacheBust(env.E2E_BASE_URL, env.E2E_LIST_PAGE, guestExtra), {
          waitUntil: 'domcontentloaded',
        });
        shots.push(await shot(list, outDir, `mobile-${engineName}-list`, maskList));
      } catch (e) {
        failures.push(
          makeFailure({
            check: `mobile-${engineName}-list`,
            description: 'Mobil liste ekranı alınamadı — devam',
            error: e,
          })
        );
      }
      await list.close().catch(() => {});
      if (engineName !== 'chromium') {
        await b.close();
      }
      await ctx.close();
    }
    logSection('mobil ekranlar', tMobile);
  }

  await guest.close();
  await authed.close();
  await browser.close();

  if (runFunctional) {
    functionalStats.failed = failures.length;
    const otherFails = failures.filter((f) => !String(f.check || '').startsWith('sadaka-')).length;
    if (otherFails === 0) {
      functionalStats.passed += 1; // sadaka dışı işlevsel kontroller
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

  return {
    shots,
    screens,
    failures,
    skips,
    flaky,
    debugFiles: [...new Set(debugFiles)],
    stats: functionalStats,
    outDir,
    sections: sectionTimings.slice(),
    mode,
    runLabel,
    noSideCart: !!noSideCart,
  };
}
