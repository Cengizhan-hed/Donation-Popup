/**
 * 10.32.0 — Bu ürüne özel görünüm E2E (renk önceliği, on-primary kontrast, köşe, aydınlatma).
 * Staging Nafile #10695 meta geçici yazılır / eski haline döner; geri yükleme hatası fail.
 */
import { SEL } from './selectors.mjs';
import { withCacheBust } from './env.mjs';
import {
  emptyCart,
  openShellLocator,
  clickShellTrigger,
  revealListProductTrigger,
  shellTriggerLocator,
  makeFailure,
} from './checks.mjs';
import { getProductMeta, setProductMeta } from './staging-wp-meta.mjs';
import { requireFixtureRole, mutationBrowserContext } from './fixtures.mjs';
import { popupPagePath } from './catalog-core.mjs';

const CHECK_MS = 25000;

const META_KEYS = [
  '_theme_primary',
  '_theme_primary_hover',
  '_theme_modal_bg',
  '_theme_radius',
  '_theme_inherit_category_color',
];

/**
 * @param {import('@playwright/test').Locator} shell
 */
async function waitShellReady(shell) {
  await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
  await shell.locator(SEL.donationForm).first().waitFor({ state: 'visible', timeout: CHECK_MS });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {'popup'|'panel'} mode
 * @param {{ productId?: number, listPath?: string, productPath?: string, baseUrl: string }} opts
 */
async function openProductShell(page, mode, opts) {
  const openPath = mode === 'popup' ? opts.listPath : opts.productPath;
  await page.goto(withCacheBust(opts.baseUrl, openPath, { hdf_no_side_cart: '1' }), {
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
  await waitShellReady(shell);
  return shell;
}

/**
 * @param {number} productId
 * @param {Record<string,string>} snapshot
 */
async function restoreMeta(productId, snapshot) {
  for (const key of META_KEYS) {
    const prev = Object.prototype.hasOwnProperty.call(snapshot, key) ? snapshot[key] : '';
    await setProductMeta(productId, key, prev || '');
  }
}

/**
 * Relative luminance (sRGB) for contrast checks in the browser.
 * @param {string} hex
 */
function relativeLuminance(hex) {
  const h = String(hex || '')
    .replace('#', '')
    .trim();
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return 0;
  const toLin = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const r = toLin(parseInt(full.slice(0, 2), 16));
  const g = toLin(parseInt(full.slice(2, 4), 16));
  const b = toLin(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * @param {string} a
 * @param {string} b
 */
function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * @param {import('@playwright/test').Locator} shell
 * @param {string} varName
 */
async function readCssVar(shell, varName) {
  return shell.evaluate((el, name) => {
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    return v;
  }, varName);
}

/**
 * @param {object} opts
 */
export async function runProductThemeChecks(opts) {
  const { browser, contextOpts, env, productUrls, productIds, listPagePath, failures, stats, createAdminContext } =
    opts;
  const pass = (id) => {
    stats.passed += 1;
    void id;
  };
  const fail = (id, description, error) => {
    failures.push(makeFailure({ check: id, description, error }));
    stats.failed += 1;
  };

  const baseUrl = env.E2E_BASE_URL;
  const listPath = popupPagePath(env, listPagePath);
  let customId = Number(productIds?.custom || 0);
  let customPath = productUrls?.custom || '';
  try {
    const fx = requireFixtureRole(env, 'custom');
    customId = fx.id;
    customPath = fx.path || fx.url || customPath;
  } catch (e) {
    fail('product-theme-fixture', String(e.message || e), e);
    return;
  }

  /** @type {Record<string,string>} */
  const snapshot = {};
  let metaTouched = false;
  const ctx = await mutationBrowserContext(browser, contextOpts, createAdminContext);
  const page = await ctx.newPage();

  try {
    if (!customId || !customPath) {
      throw new Error('E2E custom ürün yolu/id yok');
    }

    for (const key of META_KEYS) {
      snapshot[key] = await getProductMeta(customId, key);
    }

    const open = async () =>
      openProductShell(page, 'popup', {
        baseUrl,
        listPath,
        productPath: customPath,
        productId: customId,
      });

    // --- ürün ana rengi dolu → kabukta bu renk ---
    try {
      await emptyCart(page, baseUrl);
      await setProductMeta(customId, '_theme_primary', '#c9a227');
      await setProductMeta(customId, '_theme_primary_hover', '');
      await setProductMeta(customId, '_theme_radius', '20');
      metaTouched = true;
      const shell = await open();
      const primary = await readCssVar(shell, '--wdp-primary');
      if (!primary || primary.toLowerCase() !== '#c9a227') {
        throw new Error(`beklenen #c9a227, gelen: ${primary}`);
      }
      const onPrimary = await readCssVar(shell, '--wdp-on-primary');
      const ratio = contrastRatio(primary, onPrimary || '#ffffff');
      if (ratio < 4.5) {
        throw new Error(`on-primary kontrast ${ratio.toFixed(2)} < 4.5 (bg=${primary} ink=${onPrimary})`);
      }
      // Hesaplanmış buton yazı rengi
      const btn = shell.locator('.wdp-button-group button[name="donation_go_checkout"]').first();
      if ((await btn.count()) === 0) {
        throw new Error('Ödemeye Git butonu yok');
      }
      const btnColor = await btn.evaluate((el) => getComputedStyle(el).color);
      // rgb → hex roughly for contrast; also accept computed contrast vs bg
      const btnRgb = await btn.evaluate((el) => {
        const c = getComputedStyle(el).color;
        const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) return '';
        const hex = (n) => Number(n).toString(16).padStart(2, '0');
        return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
      });
      const btnRatio = contrastRatio(primary, btnRgb || onPrimary);
      if (btnRatio < 4.5) {
        throw new Error(`buton yazı kontrastı ${btnRatio.toFixed(2)} (color=${btnColor})`);
      }
      const radiusUi = await readCssVar(shell, '--wdp-radius-ui');
      if (radiusUi !== '20px') {
        throw new Error(`köşe ui beklenen 20px, gelen: ${radiusUi}`);
      }
      pass('product-theme-primary-and-contrast');
    } catch (e) {
      fail('product-theme-primary-and-contrast', 'ürün rengi + on-primary kontrast', e);
    }

    // --- ürün rengi boş → kategori veya genel ---
    try {
      await setProductMeta(customId, '_theme_primary', '');
      metaTouched = true;
      const shell = await open();
      const primary = (await readCssVar(shell, '--wdp-primary')).toLowerCase();
      // Kabuk override yoksa kalıtım :root'tan gelir; boş string olmamalı.
      if (!primary) {
        throw new Error('ürün rengi boşken --wdp-primary boş');
      }
      // Ürün override temizlendiğinde stil attr'de ürün rengi olmamalı (#c9a227)
      const inline = await shell.evaluate((el) => el.getAttribute('style') || '');
      if (/--wdp-primary\s*:\s*#c9a227/i.test(inline)) {
        throw new Error('boş meta sonrası stil hâlâ ürün rengini yazıyor');
      }
      pass('product-theme-fallback-no-product-primary');
    } catch (e) {
      fail(
        'product-theme-fallback-no-product-primary',
        'ürün rengi boş → kategori/genel',
        e
      );
    }

    // --- köşe kenetleme çıktısı (3 → 4px) ---
    try {
      await setProductMeta(customId, '_theme_radius', '3');
      metaTouched = true;
      const shell = await open();
      const radiusUi = await readCssVar(shell, '--wdp-radius-ui');
      if (radiusUi !== '4px') {
        throw new Error(`kenetlenmiş köşe beklenen 4px, gelen: ${radiusUi}`);
      }
      pass('product-theme-radius-clamp');
    } catch (e) {
      fail('product-theme-radius-clamp', 'köşe 3→4 kenetleme', e);
    }

    // --- aydınlatma bağlantısı etiketi (global ayar açıksa) ---
    try {
      const shell = await open();
      const notice = shell.locator('.wdp-privacy-notice a').first();
      if ((await notice.count()) > 0) {
        const text = ((await notice.textContent()) || '').trim();
        const href = (await notice.getAttribute('href')) || '';
        if (!text) {
          throw new Error('aydınlatma bağlantı etiketi boş');
        }
        if (text.includes('yurt dışındaki saha')) {
          throw new Error('uzun varsayılan metin hâlâ bağlantı metni');
        }
        if (!href || href === '#') {
          throw new Error('aydınlatma href yok');
        }
        pass('product-theme-privacy-link');
      } else {
        // Ayar kapalıysa yokluk kabul (staging ayarına bağlı)
        pass('product-theme-privacy-link-absent-ok');
      }
    } catch (e) {
      fail('product-theme-privacy-link', 'aydınlatma bağlantısı etiket/adres', e);
    }
  } catch (e) {
    fail('product-theme-runner', 'Ürün görünüm E2E koşucusu', e);
  } finally {
    if (metaTouched) {
      try {
        await restoreMeta(customId, snapshot);
        pass('product-theme-meta-restore');
      } catch (restoreErr) {
        fail('product-theme-meta-restore', 'Ürün tema meta geri yükleme başarısız', restoreErr);
      }
    }
    await page.close();
    await ctx.close();
  }

  return {
    ok: failures.filter((f) => String(f.check || '').startsWith('product-theme-')).length === 0,
  };
}
