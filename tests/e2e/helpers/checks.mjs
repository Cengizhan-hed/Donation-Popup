/**
 * Shared functional checks for staging E2E.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env.mjs';
import { SEL } from './selectors.mjs';

/** Kontrol başına en fazla bekleme (ms). Bulunamayan öğe hemen hata yazar. */
export const CHECK_MS = 5000;

/** Sepete ekle AJAX yanıtı (alt bağış / fixed cart). */
export const CART_AJAX_MS = 15000;

/**
 * POST gövdesinden action (url-encoded veya multipart FormData).
 * @param {import('@playwright/test').Request} req
 * @returns {string}
 */
export function extractPostActionFromRequest(req) {
  try {
    const post = req.postData();
    if (post) {
      try {
        const a = new URLSearchParams(post).get('action');
        if (a) return a;
      } catch (e) {
        /* fall through */
      }
      const multi = String(post).match(/name=["']action["']\r?\n\r?\n([^\r\n]+)/);
      if (multi) return multi[1].trim();
      const m = String(post).match(/(?:^|&)action=([^&]*)/);
      if (m) return decodeURIComponent(m[1]);
    }
    // multipart: Playwright postData() çoğu zaman null → buffer
    if (typeof req.postDataBuffer === 'function') {
      const buf = req.postDataBuffer();
      if (buf && buf.length) {
        const s = Buffer.from(buf).toString('utf8');
        const multi = s.match(/name=["']?action["']?\r?\n\r?\n([^\r\n]+)/);
        if (multi) return multi[1].trim();
        const q = s.match(/(?:^|&)action=([^&\s]+)/);
        if (q) return decodeURIComponent(q[1]);
      }
    }
    // Son çare: URL query
    try {
      const u = new URL(req.url());
      const qa = u.searchParams.get('action');
      if (qa) return qa;
    } catch (e) {
      /* ignore */
    }
  } catch (e) {
    /* ignore */
  }
  return '';
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function assertNoCriticalError(page) {
  const body = ((await page.locator('body').innerText().catch(() => '')) || '').toLowerCase();
  if (body.includes('ciddi bir sorun') || body.includes('critical error')) {
    throw new Error('Page shows a critical error message');
  }
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  if (overflow) {
    throw new Error('Horizontal overflow detected');
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
export function attachConsoleErrorCollector(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Never retain password-looking query fragments.
      if (!/pass(word)?=/i.test(text)) {
        errors.push(text.slice(0, 300));
      }
    }
  });
  page.on('pageerror', (err) => {
    errors.push(String(err.message || err).slice(0, 300));
  });
  return errors;
}

/**
 * @param {string[]} errors
 */
export function assertNoConsoleErrors(errors) {
  if (errors.length) {
    throw new Error('Browser console errors: ' + errors.slice(0, 5).join(' | '));
  }
}

/**
 * Empty WooCommerce cart via Store API.
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 */
export async function emptyCart(page, baseUrl) {
  await page.evaluate(async (base) => {
    const root = base.replace(/\/$/, '');
    const res = await fetch(`${root}/wp-json/wc/store/v1/cart/items`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { Nonce: window?.wcSettings?.storeApiNonce || '' },
    }).catch(() => null);
    if (!res || !res.ok) {
      return;
    }
  }, baseUrl);

  await page
    .goto(baseUrl.replace(/\/$/, '') + '/cart/?wdp_e2e=' + Date.now(), {
      waitUntil: 'domcontentloaded',
    })
    .catch(() => {});
  const remove = page.locator('.woocommerce-cart-form .remove, a.remove');
  const count = await remove.count();
  for (let i = 0; i < count; i++) {
    await remove.nth(0).click().catch(() => {});
    await page.waitForTimeout(400);
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 */
export async function cartItemCount(page, baseUrl) {
  return page.evaluate(async (base) => {
    const root = base.replace(/\/$/, '');
    try {
      const res = await fetch(`${root}/wp-json/wc/store/v1/cart`, {
        credentials: 'same-origin',
      });
      if (!res.ok) {
        return -1;
      }
      const data = await res.json();
      return Array.isArray(data.items) ? data.items.length : (data.items_count ?? -1);
    } catch (e) {
      return -1;
    }
  }, baseUrl);
}

/**
 * Store API sepet kalemleri (id + ad + tutar).
 * TRY gibi currency_minor_unit=0 sitelerde `|| 2` kullanılmaz (0 geçerli).
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @returns {Promise<Array<{id:number,name:string,totals:string,quantity:number}>>}
 */
export async function cartItemsDetail(page, baseUrl) {
  return page.evaluate(async (base) => {
    const root = base.replace(/\/$/, '');
    try {
      const res = await fetch(`${root}/wp-json/wc/store/v1/cart`, {
        credentials: 'same-origin',
      });
      if (!res.ok) return [];
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const cartMinor =
        data.totals && data.totals.currency_minor_unit != null
          ? Number(data.totals.currency_minor_unit)
          : NaN;
      return items.map((it) => {
        const totals = it.totals || {};
        const raw =
          totals.line_subtotal != null
            ? totals.line_subtotal
            : totals.line_total != null
              ? totals.line_total
              : null;
        const minor = raw != null ? Number(raw) : NaN;
        const itemMinor =
          totals.currency_minor_unit != null
            ? Number(totals.currency_minor_unit)
            : NaN;
        // ?? : 0 (TRY) geçerli; yalnızca null/undefined iken üst/varsayılan
        let decimals = 2;
        if (Number.isFinite(itemMinor)) {
          decimals = itemMinor;
        } else if (Number.isFinite(cartMinor)) {
          decimals = cartMinor;
        }
        const amount = Number.isFinite(minor) ? minor / Math.pow(10, decimals) : NaN;
        const id = Number(it.id) || Number(it.product_id) || 0;
        return {
          id,
          name: String(it.name || '').trim(),
          totals: Number.isFinite(amount) ? String(amount) : '',
          quantity: Number(it.quantity) || 0,
        };
      });
    } catch (e) {
      return [];
    }
  }, baseUrl);
}

/**
 * Staging kalıcı bağlantısından ürün URL’si (Store API permalink veya sayfa linki).
 * /product/ sabit yazılmaz.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @param {string} slug
 * @returns {Promise<string>} absolute or site-relative path usable with withCacheBust
 */
export async function resolveProductPath(page, baseUrl, slug) {
  const root = baseUrl.replace(/\/$/, '');
  const fromApi = await page.evaluate(
    async ({ base, productSlug }) => {
      try {
        const url =
          `${base}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(productSlug)}&per_page=5`;
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) return null;
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        const hit =
          list.find((p) => p && p.slug === productSlug) ||
          list.find((p) => p && String(p.permalink || '').includes(productSlug));
        return hit && hit.permalink ? String(hit.permalink) : null;
      } catch (e) {
        return null;
      }
    },
    { base: root, productSlug: slug }
  );

  if (fromApi) {
    try {
      const u = new URL(fromApi, root + '/');
      return u.pathname.replace(/\/?$/, '/') + (u.search || '');
    } catch (e) {
      /* fall through */
    }
  }

  // Shop / arama sayfasındaki ürün linki
  for (const probe of [`/?s=${encodeURIComponent(slug)}&post_type=product`, '/shop/']) {
    await page.goto(root + probe, { waitUntil: 'domcontentloaded' }).catch(() => {});
    const link = page
      .locator(
        `a[href*="${slug}"][href*="product"], .woocommerce ul.products li.product a.woocommerce-LoopProduct-link`
      )
      .first();
    if (await link.count()) {
      const href = await link.getAttribute('href');
      if (href && href.includes(slug)) {
        try {
          const u = new URL(href, root + '/');
          return u.pathname.replace(/\/?$/, '/') + (u.search || '');
        } catch (e) {
          /* continue */
        }
      }
    }
  }

  // Son çare: WordPress varsayılan ürün yolu (yalnızca çözümleme başarısızsa)
  return `/product/${slug}/`;
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @param {Record<string,string>} products key → slug
 * @returns {Promise<Record<string,string>>} key → path
 */
export async function resolveAllProductPaths(page, baseUrl, products) {
  const out = {};
  for (const [key, slug] of Object.entries(products)) {
    out[key] = await resolveProductPath(page, baseUrl, slug);
  }
  return out;
}

/**
 * Store API ile ürün ID’si (slug).
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @param {string} slug
 * @returns {Promise<number>}
 */
export async function resolveProductIdBySlug(page, baseUrl, slug) {
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

/**
 * Açık bağış kabuğu.
 * @param {import('@playwright/test').Page} page
 * @param {'popup'|'panel'|''} [mode] popup → ortadaki modal; panel → sağ panel; boş → herhangi .show
 */
export function openShellLocator(page, mode = '') {
  if (mode === 'panel') {
    return page.locator(SEL.openSidePanel).first();
  }
  if (mode === 'popup') {
    return page.locator(SEL.openCenteredPopup).first();
  }
  return page.locator(SEL.openModalShell).first();
}

/**
 * Kabuk tetikleyici: panel → side-panel sınıfı; popup → ortadaki (side-panel değil).
 * @param {import('@playwright/test').Page} page
 * @param {'popup'|'panel'} mode
 * @param {{ productId?: number }} [opts]
 */
export function shellTriggerLocator(page, mode, opts = {}) {
  const productId = Number(opts.productId) > 0 ? Number(opts.productId) : 0;
  if (mode === 'panel') {
    const base = SEL.sidePanelTrigger;
    if (productId) {
      return page.locator(`${base}[data-product-id="${productId}"]`).first();
    }
    return page.locator(base).first();
  }
  const base = SEL.centeredPopupTrigger;
  if (productId) {
    return page.locator(`${base}[data-product-id="${productId}"]`).first();
  }
  return page.locator(base).first();
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeout]
 */
export async function waitForShellClosed(page, timeout = CHECK_MS) {
  await page.waitForFunction(
    (sel) => document.querySelectorAll(sel).length === 0,
    SEL.openModalShell,
    { timeout }
  ).catch(() => {
    throw new Error('Bağış formu kabuğu kapanmadı (.show hâlâ var)');
  });
  // aria-hidden da true olmalı (assets/js/src/modal.js finalizeModalClose)
  const stillAriaOpen = await page
    .locator('.hdf-donation-modal-wrapper.wdp-modal[aria-hidden="false"]')
    .count();
  if (stillAriaOpen > 0) {
    throw new Error('Bağış formu kabuğu kapanmadı (aria-hidden=false)');
  }
}

/**
 * Formda görünen doğrulama hata metinleri.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
export async function visibleValidationErrors(page) {
  const shell = openShellLocator(page);
  const root = (await shell.count()) ? shell : page.locator('body');
  const texts = [];
  // Banner + satır içi + role=alert (eski .wdp-error sınıfı metinsiz olabilir)
  const nodes = root.locator(
    `${SEL.formError}, .wdp-input-error, [role="alert"].wdp-input-error, [role="alert"].wdp-form-error`
  );
  const n = await nodes.count();
  for (let i = 0; i < n; i++) {
    const el = nodes.nth(i);
    const visible = await el.isVisible().catch(() => false);
    if (!visible) continue;
    const t = ((await el.innerText().catch(() => '')) || '').trim();
    if (t && !texts.includes(t.slice(0, 200))) texts.push(t.slice(0, 200));
  }
  return texts;
}

/**
 * Sepete ekleme AJAX yanıtını bekle (admin-ajax wdp_ajax_add_to_cart veya wc-ajax).
 * waitForResponse tıklamadan ÖNCE kurulur.
 *
 * @param {import('@playwright/test').Page} page
 * @param {() => Promise<void>} clickFn
 * @param {{ timeout?: number }} [opts]
 * @returns {Promise<{ status: number, bodyPreview: string, ok: boolean, url: string, timedOut: boolean, ms: number }>}
 */
export async function clickAddToCartAndWait(page, clickFn, opts = {}) {
  const timeout = Number(opts.timeout) > 0 ? Number(opts.timeout) : CART_AJAX_MS;
  const t0 = Date.now();
  const matchAjax = (res) => {
    const req = res.request();
    if (req.method() !== 'POST') return false;
    const url = res.url();
    const post = req.postData() || '';
    const isAdminAjax = /admin-ajax\.php/i.test(url);
    const isWcAjax = /[?&]wc-ajax=/i.test(url) || /\/wc-ajax\//i.test(url);
    if (!isAdminAjax && !isWcAjax) return false;
    if (isAdminAjax) {
      return (
        post.includes('wdp_ajax_add_to_cart') ||
        post.includes('action=wdp_ajax_add_to_cart') ||
        post.includes('donation_add_to_cart')
      );
    }
    return true;
  };

  let status = 0;
  let bodyPreview = '';
  let url = '';
  let ok = false;
  let timedOut = false;
  try {
    // waitForResponse tıklamadan ÖNCE kurulur
    const [res] = await Promise.all([
      page.waitForResponse(matchAjax, { timeout }),
      clickFn(),
    ]);
    status = res.status();
    url = res.url();
    const text = await res.text().catch(() => '');
    bodyPreview = String(text || '').slice(0, 300);
    ok = res.ok();
    try {
      const json = JSON.parse(text);
      if (json && typeof json.success === 'boolean') {
        ok = json.success;
      }
    } catch (e) {
      /* non-JSON */
    }
  } catch (e) {
    timedOut = true;
    bodyPreview = `waitForResponse failed: ${String(e.message || e).slice(0, 200)}`;
  }

  return { status, bodyPreview, ok, url, timedOut, ms: Date.now() - t0 };
}

/**
 * Sepete Ekle tıklaması: görünür/enabled + 2 rAF, AJAX 15 sn, zaman aşımında 1 yeniden deneme.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} button
 * @param {{ checkId?: string }} [opts]
 * @returns {Promise<{
 *   status: number,
 *   bodyPreview: string,
 *   ok: boolean,
 *   url: string,
 *   timedOut: boolean,
 *   flaky: boolean,
 *   attempts: Array<{ attempt: number, ms: number, timedOut: boolean, ok: boolean, error?: string }>,
 *   buttonState: { visible: boolean, disabled: boolean },
 *   networkTail: string[],
 *   consoleErrors: string[]
 * }>}
 */
export async function clickAddToCartWithRetry(page, button, opts = {}) {
  const checkId = opts.checkId || 'cart-ajax';
  /** @type {(info: object) => Promise<void>|void|undefined} */
  const onAttemptFail = opts.onAttemptFail;
  /** @type {string[]} */
  const consoleErrors = [];
  const onConsole = (msg) => {
    if (msg.type() === 'error') consoleErrors.push(String(msg.text() || '').slice(0, 200));
  };
  const onPageError = (err) => {
    consoleErrors.push(String(err.message || err).slice(0, 200));
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  /** @type {Array<{ method: string, url: string, status: number, action: string, bodyPreview: string }>} */
  const network = [];
  const onResponse = (res) => {
    const req = res.request();
    const action = extractPostActionFromRequest(req);
    const entry = {
      method: req.method(),
      url: res.url().slice(0, 180),
      status: res.status(),
      action,
      bodyPreview: '',
    };
    network.push(entry);
    if (network.length > 40) network.shift();
    // Yanıt gövdesi (ilk 200) — async, fire-and-forget
    res
      .text()
      .then((t) => {
        entry.bodyPreview = String(t || '').slice(0, 200);
      })
      .catch(() => {});
  };
  page.on('response', onResponse);

  const attempts = [];
  let lastAjax = {
    status: 0,
    bodyPreview: '',
    ok: false,
    url: '',
    timedOut: true,
    ms: 0,
  };
  let buttonState = { visible: false, disabled: true };
  /** @type {object|null} */
  let firstAttemptDiag = null;

  try {
    for (let attempt = 1; attempt <= 2; attempt++) {
      await button.waitFor({ state: 'visible', timeout: CHECK_MS }).catch(() => {});
      // Form/wizard JS init: data-wdp-ready veya 2 rAF
      await page
        .evaluate(async () => {
          const ready =
            document.querySelector('[data-wdp-form-ready], [data-wdp-ready], .wdp-form.is-ready') ||
            document.querySelector('.wdp-shell form, form.wdp-donation-form');
          if (ready) {
            /* form DOM var — rAF ile paint/init bekle */
          }
          await new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          });
        })
        .catch(() => {});
      // enabled olana kadar kısa bekle
      const enableDeadline = Date.now() + CHECK_MS;
      while (Date.now() < enableDeadline) {
        const vis = await button.isVisible().catch(() => false);
        const dis = vis ? await button.isDisabled().catch(() => true) : true;
        buttonState = { visible: vis, disabled: dis };
        if (vis && !dis) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      buttonState = {
        visible: await button.isVisible().catch(() => false),
        disabled: await button.isDisabled().catch(() => true),
      };

      lastAjax = await clickAddToCartAndWait(
        page,
        async () => {
          await button.click({ timeout: CHECK_MS });
        },
        { timeout: CART_AJAX_MS }
      );
      attempts.push({
        attempt,
        ms: lastAjax.ms,
        timedOut: lastAjax.timedOut,
        ok: lastAjax.ok,
        error: lastAjax.timedOut ? lastAjax.bodyPreview : undefined,
      });

      if (!lastAjax.timedOut) {
        return {
          ...lastAjax,
          flaky: attempt > 1,
          attempts,
          buttonState,
          networkTail: network
            .slice(-15)
            .map(
              (n) =>
                `${n.method} ${n.status} action=${n.action || '-'} ${n.url}`
            ),
          networkRaw: network.slice(-15),
          consoleErrors: consoleErrors.slice(-10),
          checkId,
          firstAttemptDiag,
        };
      }

      // İlk deneme zaman aşımı → retry ÖNCESİ teşhis
      if (attempt === 1 && typeof onAttemptFail === 'function') {
        try {
          firstAttemptDiag = await onAttemptFail({
            attempt,
            ajax: lastAjax,
            buttonState,
            networkRaw: network.slice(-15),
            consoleErrors: consoleErrors.slice(-10),
          });
        } catch (e) {
          firstAttemptDiag = { error: String(e.message || e) };
        }
      }
      // Zaman aşımı → bir kez daha dene
    }
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('response', onResponse);
  }

  return {
    ...lastAjax,
    flaky: false,
    attempts,
    buttonState,
    networkTail: network
      .slice(-15)
      .map((n) => `${n.method} ${n.status} action=${n.action || '-'} ${n.url}`),
    networkRaw: network.slice(-15),
    consoleErrors: consoleErrors.slice(-10),
    checkId,
    firstAttemptDiag,
  };
}

/**
 * Playwright Call log’unu kısalt; tam metni debug dosyasına yaz.
 * @param {string} checkId
 * @param {string} fullMessage
 * @returns {{ short: string, debugFile: string }}
 */
export function shortenAndStoreError(checkId, fullMessage) {
  const debugDir = path.join(ROOT, 'build/e2e/debug');
  fs.mkdirSync(debugDir, { recursive: true });
  const safe = String(checkId || 'error').replace(/[^\w.-]+/g, '_');
  const debugFile = path.join(debugDir, `${safe}.txt`);
  const full = String(fullMessage || '');
  fs.writeFileSync(debugFile, full, 'utf8');

  const lines = full.split(/\r?\n/);
  let shortLines = lines.slice(0, 3);
  // Call log bloğunu 3 satırla sınırla
  const callIdx = lines.findIndex((l) => /Call log:/i.test(l));
  if (callIdx >= 0) {
    shortLines = [...lines.slice(0, callIdx + 1), ...lines.slice(callIdx + 1, callIdx + 3)];
    if (lines.length > callIdx + 3) {
      shortLines.push(`… (tam log: ${path.relative(ROOT, debugFile)})`);
    }
  } else if (lines.length > 3) {
    shortLines = [...lines.slice(0, 3), `… (tam log: ${path.relative(ROOT, debugFile)})`];
  }

  return { short: shortLines.join('\n'), debugFile: path.relative(ROOT, debugFile) };
}

/**
 * @param {object} opts
 * @param {string} opts.check
 * @param {string} opts.description
 * @param {string} [opts.detail]
 * @param {string} [opts.screenshot]
 * @param {Error|string} [opts.error]
 */
export function makeFailure(opts) {
  const errText = opts.error
    ? typeof opts.error === 'string'
      ? opts.error
      : String(opts.error.message || opts.error)
    : opts.detail || '';
  const { short, debugFile } = shortenAndStoreError(opts.check, errText);
  return {
    check: opts.check,
    description: opts.description,
    detail: short,
    screenshot: opts.screenshot || '',
    debugFile: opts.debugFile || debugFile,
  };
}
