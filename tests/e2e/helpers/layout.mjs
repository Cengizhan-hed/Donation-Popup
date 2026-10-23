/**
 * 10.34.2 — Yerleşim regresyonu: tutar etiketi koşulu, fiyat/adet oranı, CTA alt dolgu, taşma.
 * Meta yazılmaz. Öğesi yoksa atlanmaz — fail.
 */
import fs from 'node:fs';
import nodePath from 'node:path';
import { SEL } from './selectors.mjs';
import { requireFixtureRole, donationViewContext } from './fixtures.mjs';
import { pickFixtureNavTarget, decideScenarioProduct, popupPagePath } from './catalog-core.mjs';
import { ROOT, withCacheBust } from './env.mjs';
import { comingSoonQuery } from './coming-soon.mjs';
import { getActiveProfile } from './profile.mjs';
import {
  openShellLocator,
  clickShellTrigger,
  revealListProductTrigger,
  shellTriggerLocator,
  makeFailure,
} from './checks.mjs';
import { waitAndAssertShellOverlap } from './shell-overlap.mjs';
import { classifySkipReason } from './skip-policy.mjs';

const CTA_GAP_MAX_PX = 48;

const CHECK_MS = 20000;
const RATIO_TOLERANCE = 0.02;
const EDGE_PX = 2;
/** Kabuk vs görsel viewport: 92vw panel / güvenli alan yuvarlaması. */
const SHELL_EDGE_PX = 16;

/**
 * @param {import('@playwright/test').Locator} shell
 * @param {import('@playwright/test').Page} page
 */
async function waitShellReady(shell, page) {
  await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
  await shell.locator(SEL.donationForm).first().waitFor({ state: 'visible', timeout: CHECK_MS });
  const overlap = await waitAndAssertShellOverlap(page, 8000);
  if (overlap && overlap.skipped) {
    throw new Error('Kabuk açıldı ama POPUP-OVERLAP kontrolü atlandı');
  }
  await page.evaluate(async () => {
    if (window.WDPApp && window.WDPApp.ctaViewport && typeof window.WDPApp.ctaViewport.refresh === 'function') {
      window.WDPApp.ctaViewport.refresh();
    }
    await new Promise((r) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(r));
    });
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {'popup'|'panel'} mode
 * @param {{ productId?: number, listPath?: string, productPath?: string, baseUrl: string, extraQuery?: Record<string,string> }} opts
 */
async function openProductShell(page, mode, opts) {
  const openPath = mode === 'popup' ? opts.listPath : opts.productPath;
  await page.goto(withCacheBust(opts.baseUrl, openPath, { hdf_no_side_cart: '1', ...(opts.extraQuery || {}) }), {
    waitUntil: 'domcontentloaded',
  });
  if (mode === 'popup') {
    await revealListProductTrigger(page, opts.productId || 0);
  }
  let trigger = shellTriggerLocator(page, mode, { productId: opts.productId || 0 });
  if ((await trigger.count()) === 0) {
    trigger =
      mode === 'panel'
        ? page.locator(SEL.sidePanelTrigger).first()
        : page.locator(SEL.centeredPopupTrigger).first();
  }
  await clickShellTrigger(trigger, CHECK_MS);
  const shell = mode === 'popup' ? openShellLocator(page, '') : openShellLocator(page, mode);
  await waitShellReady(shell, page);
  return shell;
}

/**
 * @param {import('@playwright/test').Page} page
 */
async function closeShell(page) {
  const closeBtn = page.locator(SEL.modalClose).first();
  if ((await closeBtn.count()) > 0) {
    await closeBtn.click({ timeout: 5000 }).catch(async () => {
      await page.keyboard.press('Escape');
    });
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(250);
}

/**
 * Kaydırma kapsayıcılarını sona alır. Öğesi yoksa hata (atlama yok).
 * @param {import('@playwright/test').Locator} shell
 */
async function scrollFormToEnd(shell) {
  const found = await shell.evaluate((root) => {
    const nodes = root.querySelectorAll(
      '.wdp-side-panel-main, .wdp-donation-form-fields, .wdp-shareholders-scroll'
    );
    if (!nodes.length) return false;
    nodes.forEach((el) => {
      el.scrollTop = el.scrollHeight;
    });
    return true;
  });
  if (!found) {
    throw new Error('Kaydırma kapsayıcısı yok (.wdp-side-panel-main / .wdp-donation-form-fields)');
  }
  await shell.page().waitForTimeout(80);
}

/**
 * Son içerik öğesi vs CTA boundingBox. Öğesi yoksa fail.
 * @param {import('@playwright/test').Locator} shell
 */
async function assertLastItemAboveCta(shell) {
  const result = await shell.evaluate((root, gapMax) => {
    const cta = root.querySelector('.wdp-form-cta-zone, .wdp-side-panel-footer-zone');
    if (!cta) {
      return { ok: false, error: 'eylem çubuğu yok (.wdp-form-cta-zone / .wdp-side-panel-footer-zone)' };
    }
    const scroll =
      root.querySelector('.wdp-side-panel-main') ||
      root.querySelector('.wdp-donation-form-fields') ||
      root;
    const skip = /wdp-form-cta-zone|wdp-side-panel-footer-zone|wdp-form-error/;
    const hiddenType = (el) => el.matches('input[type="hidden"], [hidden], [aria-hidden="true"]');
    const vis = (el) => {
      if (!el || hiddenType(el)) return false;
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    const inCta = (el) => !!(cta.contains(el) || el.closest('.wdp-form-cta-zone, .wdp-side-panel-footer-zone'));
    const nodes = Array.from(
      scroll.querySelectorAll(
        'input:not([type="hidden"]), textarea, select, button, .wdp-sadaka-donation, .wdp-cover-fee, .wdp-shareholder-form, .wdp-shareholders-area'
      )
    ).filter((el) => vis(el) && !inCta(el));
    Array.from(scroll.children)
      .filter((el) => vis(el) && !skip.test(el.className || '') && !inCta(el))
      .forEach((el) => nodes.push(el));
    let last = null;
    let lastBottom = -Infinity;
    nodes.forEach((el) => {
      const b = el.getBoundingClientRect().bottom;
      if (b > lastBottom) {
        lastBottom = b;
        last = el;
      }
    });
    if (!last) {
      return { ok: false, error: 'son form öğesi yok (kaydırma kapsayıcısında görünür içerik yok)' };
    }
    const lastBox = last.getBoundingClientRect();
    const ctaBox = cta.getBoundingClientRect();
    const gap = Math.round(ctaBox.top - lastBox.bottom);
    const behind = lastBox.bottom > ctaBox.top + 2;
    const tooWide = gap > gapMax;
    let error = '';
    if (behind) {
      error = `son öğe alt kenarı (${Math.round(lastBox.bottom)}) eylem çubuğu üst kenarının (${Math.round(ctaBox.top)}) altında`;
    } else if (tooWide) {
      error = `CTA-GAP: son öğe ile eylem çubuğu arası ${gap}px (>${gapMax})`;
    }
    return {
      ok: !behind && !tooWide,
      error,
      lastClass: last.className || last.tagName,
      lastBottom: Math.round(lastBox.bottom),
      ctaTop: Math.round(ctaBox.top),
      gap,
    };
  }, CTA_GAP_MAX_PX);
  if (!result || result.ok === false) {
    throw new Error(result && result.error ? result.error : 'CTA / son öğe ölçülemedi');
  }
}

/**
 * Kabuk öğeleri viewport dışına taşmasın.
 * @param {import('@playwright/test').Locator} shell
 */
async function assertShellInViewport(shell) {
  const overflow = await shell.evaluate((root, { edge, shellEdge }) => {
    const content = root.querySelector('.wdp-modal-content') || root;
    const box = content.getBoundingClientRect();
    const vv = window.visualViewport;
    const vw = vv ? vv.width : window.innerWidth;
    const bad = [];
    const nodes = content.querySelectorAll(
      'button:not(.wdp-modal-close), input:not([type="hidden"]), textarea, select, .wdp-line-total-display, .wdp-quantity-counter, .wdp-custom-price-row, .wdp-price-quantity-row, .wdp-sadaka-donation, .wdp-cover-fee, .wdp-amount-preset, .wdp-button-group'
    );
    nodes.forEach((el) => {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (st.display === 'none' || st.visibility === 'hidden' || r.width < 1 || r.height < 1) return;
      if (r.left < box.left - edge || r.right > box.right + edge) {
        bad.push({
          name: (el.className || el.tagName || '').toString().slice(0, 80),
          l: Math.round(r.left),
          r: Math.round(r.right),
          clipL: Math.round(box.left),
          clipR: Math.round(box.right),
        });
      }
    });
    const shellOverflow = box.left < -shellEdge || box.right > vw + shellEdge;
    return {
      overflow: bad.length > 0 || shellOverflow,
      bad: bad.slice(0, 6),
      shellOverflow,
      box: { l: Math.round(box.left), r: Math.round(box.right), w: Math.round(box.width) },
      vw: Math.round(vw),
    };
  }, { edge: EDGE_PX, shellEdge: SHELL_EDGE_PX });
  if (overflow.overflow) {
    throw new Error(
      `Viewport/kabuk dışı öğe: ${JSON.stringify(overflow.bad)} shell=${JSON.stringify(overflow.box)} vw=${overflow.vw}`
    );
  }
}

/**
 * @param {import('@playwright/test').Locator} shell
 */
async function assertFixedNoOrphanLabel(shell) {
  const n = await shell.locator('.wdp-fixed-price-counter-row .wdp-custom-price-row__label').count();
  if (n > 0) {
    throw new Error(`Sabit tutarda yetim tutar etiketi var (adet=${n})`);
  }
  const amountLabels = await shell.locator('.wdp-form-block--amount .wdp-custom-price-row__label').count();
  if (amountLabels > 0) {
    throw new Error(`Sabit tutar tutar bloğunda etiket var (adet=${amountLabels})`);
  }
}

/**
 * @param {import('@playwright/test').Locator} shell
 */
async function assertFixedPriceQtyRatio(shell) {
  const dims = await shell.evaluate((root) => {
    const price = root.querySelector('.wdp-fixed-price-counter-row .wdp-line-total-display');
    const qty = root.querySelector('.wdp-fixed-price-counter-row .wdp-quantity-counter');
    if (!price || !qty) return { error: 'Sabit tutar fiyat veya adet kutusu yok' };
    const pb = price.getBoundingClientRect();
    const qb = qty.getBoundingClientRect();
    return {
      pw: pb.width,
      qw: qb.width,
      py: pb.y,
      qy: qb.y,
    };
  });
  if (dims.error) throw new Error(dims.error);
  if (dims.pw < 8 || dims.qw < 8) {
    throw new Error(`Kutu genişliği çok dar (fiyat=${dims.pw.toFixed(1)} adet=${dims.qw.toFixed(1)})`);
  }
  if (Math.abs(dims.py - dims.qy) > 8) {
    throw new Error(`Fiyat ve adet aynı satırda değil (y fiyat=${dims.py.toFixed(1)} adet=${dims.qy.toFixed(1)})`);
  }
  const ratio = dims.pw / dims.qw;
  if (Math.abs(ratio - 1) > RATIO_TOLERANCE) {
    throw new Error(
      `Fiyat/adet genişlik oranı ${ratio.toFixed(3)} (beklenen 1.00 ±${RATIO_TOLERANCE * 100}%; fiyat=${dims.pw.toFixed(1)} adet=${dims.qw.toFixed(1)})`
    );
  }
}

/**
 * Kapat (×) başlıkla hizalı, form kutusuyla kesişmez, ≥44px dokunma.
 * @param {import('@playwright/test').Locator} shell
 */
async function assertCloseNotOverlappingForm(shell) {
  const info = await shell.evaluate(() => {
    const root =
      document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.show') ||
      document.querySelector('.wdp-donation-form');
    if (!root) return { error: 'açık kabuk yok' };
    const close = root.querySelector('button.wdp-modal-close');
    const form =
      root.querySelector('.wdp-donation-form-fields') ||
      root.querySelector('form.wdp-donation-form-fields');
    const header = root.querySelector('.wdp-modal-header, .wdp-form-title-wrapper');
    if (!close) return { error: 'kapat düğmesi yok' };
    if (!form) return { error: 'form kutusu yok' };
    const c = close.getBoundingClientRect();
    const f = form.getBoundingClientRect();
    const h = header ? header.getBoundingClientRect() : null;
    const overlap = !(c.right <= f.left || c.left >= f.right || c.bottom <= f.top || c.top >= f.bottom);
    return {
      cw: c.width,
      ch: c.height,
      cy: c.y,
      fy: f.y,
      hy: h ? h.y : null,
      hh: h ? h.height : null,
      overlap,
    };
  });
  if (info.error) throw new Error(info.error);
  if (info.cw + 1 < 44 || info.ch + 1 < 44) {
    throw new Error(`kapat dokunma hedefi < 44px (${Math.round(info.cw)}x${Math.round(info.ch)})`);
  }
  if (info.overlap) {
    throw new Error(
      `kapat düğmesi form kutusuyla kesişiyor (close.y=${info.cy.toFixed(1)} form.y=${info.fy.toFixed(1)})`
    );
  }
  if (info.hy != null && info.hh != null) {
    const headerMid = info.hy + info.hh / 2;
    const closeMid = info.cy + info.ch / 2;
    if (Math.abs(headerMid - closeMid) > 36 && info.cy > info.fy - 8) {
      throw new Error(
        `kapat başlık satırında değil (close.y=${info.cy.toFixed(1)} header.y=${info.hy.toFixed(1)})`
      );
    }
  }
}

/**
 * @param {import('@playwright/test').Locator} shell
 */
async function assertAmountLabelWithInput(shell) {
  const dims = await shell.evaluate((root) => {
    const row = root.querySelector('.wdp-custom-price-row:has(input[name="custom_price"])');
    if (!row) return { error: 'Tutar girişi satırı yok (.wdp-custom-price-row + input[name=custom_price])' };
    const label = row.querySelector('.wdp-custom-price-row__label');
    const input = row.querySelector('input[name="custom_price"]');
    if (!label) return { error: 'Tutar girişi olan türde etiket yok' };
    if (!input) return { error: 'Tutar girişi yok' };
    const lb = label.getBoundingClientRect();
    const ib = input.getBoundingClientRect();
    if (lb.width < 1 || lb.height < 1 || ib.width < 1 || ib.height < 1) {
      return { error: 'Etiket veya giriş ölçülemedi (genişlik/yükseklik 0)' };
    }
    return { ly: lb.y, iy: ib.y, lh: lb.height, ih: ib.height };
  });
  if (dims.error) throw new Error(dims.error);
  const labelMid = dims.ly + dims.lh / 2;
  const inputMid = dims.iy + dims.ih / 2;
  if (Math.abs(dims.ly - dims.iy) > 12 && Math.abs(labelMid - inputMid) > 16) {
    throw new Error(
      `Etiket girişle aynı satırda değil (etiket y=${dims.ly.toFixed(1)} giriş y=${dims.iy.toFixed(1)})`
    );
  }
}

/**
 * @param {object} args
 */
export async function runLayoutChecks({
  browser,
  contextOpts,
  env,
  productUrls,
  productIds,
  listPagePath,
  failures,
  stats,
  skips,
  createAdminContext,
  createVisitorContext,
}) {
  const profile = getActiveProfile();
  const baseUrl = env.E2E_BASE_URL;
  const listPath = popupPagePath(env, listPagePath);
  const extraQuery = comingSoonQuery(env, profile);

  const types = [
    { key: 'fixed', kind: 'fixed' },
    { key: 'custom', kind: 'input' },
    { key: 'campaign', kind: 'input' },
    { key: 'shares', kind: 'shares' },
  ];
  const modes = /** @type {const} */ (['popup', 'panel']);

  /** @type {import('@playwright/test').BrowserContext|null} */
  let visitorCtx = null;
  /** @type {import('@playwright/test').BrowserContext|null} */
  let adminCtx = null;
  /** @type {import('@playwright/test').Page|null} */
  let visitorPage = null;
  /** @type {import('@playwright/test').Page|null} */
  let adminPage = null;

  async function pageFor(admin) {
    if (admin) {
      if (!adminCtx) {
        adminCtx = await donationViewContext(browser, contextOpts, {
          admin: true,
          createAdminContext,
          createVisitorContext,
        });
        adminPage = await adminCtx.newPage();
        adminPage.setDefaultTimeout(CHECK_MS);
        adminPage.setDefaultNavigationTimeout(25000);
      }
      return adminPage;
    }
    if (!visitorCtx) {
      visitorCtx = await donationViewContext(browser, contextOpts, {
        admin: false,
        createAdminContext,
        createVisitorContext,
      });
      visitorPage = await visitorCtx.newPage();
      visitorPage.setDefaultTimeout(CHECK_MS);
      visitorPage.setDefaultNavigationTimeout(25000);
    }
    return visitorPage;
  }

  const pass = (id) => {
    stats.passed += 1;
    return id;
  };
  const fail = (id, description, error) => {
    failures.push(makeFailure({ check: id, description, error }));
    stats.failed += 1;
  };
  const skip = (id, description) => {
    if (classifySkipReason(description) === 'fail') {
      fail(id, `Altyapı atlaması hata: ${description}`);
      return;
    }
    if (skips) skips.push({ check: id, description });
    stats.skipped += 1;
  };

  /**
   * @param {import('@playwright/test').Locator} shell
   * @param {string} prefix
   * @param {boolean} failed
   */
  async function shotCta(shell, prefix, failed) {
    const dir = nodePath.join(ROOT, 'build/e2e/debug');
    fs.mkdirSync(dir, { recursive: true });
    const file = nodePath.join(dir, `${prefix}-cta-clearance${failed ? '-fail' : ''}.png`);
    try {
      await waitAndAssertShellOverlap(shell.page(), 8000);
      await shell.screenshot({ path: file, animations: 'disabled' });
    } catch (e) {
      console.error(`[e2e:catch-fail] cta-shot ${prefix}: ${e && e.message ? e.message : e}`);
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  try {
    for (const type of types) {
      let productPath = productUrls[type.key];
      let productId = productIds[type.key] || 0;
      let fromFixture = Array.isArray(env._fixtureRoles) && env._fixtureRoles.includes(type.key);
      if (!productPath) {
        try {
          const fx = requireFixtureRole(env, type.key);
          productPath = fx.path || pickFixtureNavTarget(fx) || fx.url;
          productId = fx.id;
          fromFixture = true;
        } catch {
          skip(`layout-${type.key}-missing`, `${type.key} ürün yolu yok`);
          continue;
        }
      }
      for (const mode of modes) {
        const prefix = `layout-${type.key}-${mode}`;
        const layoutEnv = {
          ...env,
          _fixtureRoles: fromFixture
            ? [type.key, ...(Array.isArray(env._fixtureRoles) ? env._fixtureRoles : [])]
            : env._fixtureRoles,
        };
        const decision = decideScenarioProduct(layoutEnv, type.key, mode);
        if (decision.action === 'skip') {
          skip(`${prefix}-private-list`, decision.reason);
          continue;
        }
        const page = await pageFor(!!decision.admin);
        let shell;
        try {
          shell = await openProductShell(page, mode, {
            baseUrl,
            listPath,
            productPath,
            productId,
            extraQuery,
          });
        } catch (e) {
          fail(`${prefix}-open`, `${type.key} ${mode} kabuk açılmadı`, e);
          continue;
        }

        try {
          if (type.kind === 'fixed') {
            await assertFixedNoOrphanLabel(shell);
            pass(`${prefix}-no-orphan-label`);
          } else if (type.kind === 'input') {
            await assertAmountLabelWithInput(shell);
            pass(`${prefix}-label-with-input`);
          } else {
            const n = await shell.locator('.wdp-form-block--amount .wdp-custom-price-row__label, .wdp-fixed-price-counter-row .wdp-custom-price-row__label').count();
            if (n > 0) {
              throw new Error(`Hisselide tutar girişi etiketi var (adet=${n})`);
            }
            pass(`${prefix}-no-amount-label`);
          }
        } catch (e) {
          fail(
            type.kind === 'fixed'
              ? `${prefix}-no-orphan-label`
              : type.kind === 'input'
                ? `${prefix}-label-with-input`
                : `${prefix}-no-amount-label`,
            'Tutar etiketi yerleşimi',
            e
          );
        }

        if (type.kind === 'fixed') {
          try {
            await assertFixedPriceQtyRatio(shell);
            pass(`${prefix}-price-qty-ratio`);
          } catch (e) {
            fail(`${prefix}-price-qty-ratio`, 'Fiyat/adet satırı ve genişlik oranı', e);
          }
        }

        try {
          await assertShellInViewport(shell);
          pass(`${prefix}-in-viewport`);
        } catch (e) {
          fail(`${prefix}-in-viewport`, 'Öğe viewport dışına taşıyor', e);
        }

        try {
          await assertCloseNotOverlappingForm(shell);
          pass(`${prefix}-close-vs-form`);
        } catch (e) {
          fail(`${prefix}-close-vs-form`, 'Kapat düğmesi form kutusuyla kesişiyor', e);
        }

        try {
          await scrollFormToEnd(shell);
          await assertLastItemAboveCta(shell);
          await shotCta(shell, prefix, false);
          pass(`${prefix}-cta-clearance`);
        } catch (e) {
          const msg = e && e.message ? String(e.message) : '';
          try {
            await shotCta(shell, prefix, true);
          } catch (shotErr) {
            console.error(
              `[e2e:catch-fail] cta-shot-fail ${prefix}: ${shotErr && shotErr.message ? shotErr.message : shotErr}`
            );
          }
          fail(
            `${prefix}-cta-clearance`,
            msg.indexOf('CTA-GAP') === 0
              ? 'Son form öğesi ile eylem çubuğu arası >48px'
              : 'Son form öğesi eylem çubuğunun arkasında',
            e
          );
        }

        await closeShell(page);
      }
    }
  } finally {
    const closeQuiet = async (target, label) => {
      if (!target) return;
      try {
        await target.close();
      } catch (e) {
        console.error(`[e2e:catch-fail] layout-close ${label}: ${e && e.message ? e.message : e}`);
      }
    };
    await closeQuiet(visitorPage, 'visitorPage');
    await closeQuiet(adminPage, 'adminPage');
    await closeQuiet(visitorCtx, 'visitorCtx');
    await closeQuiet(adminCtx, 'adminCtx');
  }
}
