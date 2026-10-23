/**
 * Profil currencySwitch: liste + form + sepet tutar tutarlılığı (salt okunur gösterim).
 * Curcy’ye özel eklenti kodu yok; yalnız profil ?param=CODE.
 */
import { withCacheBust } from './env.mjs';
import { parseMoney } from './currency.mjs';
import { SEL } from './selectors.mjs';
import {
  attachConsoleErrorCollector,
  assertNoConsoleErrors,
  cartStoreSnapshot,
  clickAddToCartWithRetry,
  emptyCart,
  gotoWooCart,
  makeFailure,
  openShellLocator,
  clickShellTrigger,
} from './checks.mjs';
import { comingSoonQuery } from './coming-soon.mjs';
import { popupPagePath } from './catalog-core.mjs';

const CHECK_MS = 25000;

/**
 * @param {object|null|undefined} profile
 * @returns {{ param: string, codes: string[] }|null}
 */
export function currencySwitchFromProfile(profile) {
  const raw = profile?.currencySwitch;
  if (!raw || typeof raw !== 'object') return null;
  const param = String(raw.param || '').trim();
  const codes = Array.isArray(raw.codes)
    ? raw.codes.map((c) => String(c || '').trim().toUpperCase()).filter(Boolean)
    : [];
  if (!param || !codes.length) return null;
  return { param, codes };
}

/**
 * Woo fiyat HTML + eklenti kart/form metninden sembol ve tutarlar.
 * Kaynak: WooCommerce’in kendi fiyat HTML’i (.woocommerce-Price-amount / currencySymbol).
 *
 * @param {string} html
 * @param {{decimals?:number,thousandSeparator?:string,decimalSeparator?:string}} [currency]
 */
export function extractPriceSnapshot(html, currency) {
  const s = String(html || '');
  const symbols = new Set();
  const amounts = [];
  const texts = [];

  const symbolRe = /<span[^>]*woocommerce-Price-currencySymbol[^>]*>([^<]*)<\/span>/gi;
  let m;
  while ((m = symbolRe.exec(s))) {
    const sym = decodeEntities(m[1]).replace(/\s+/g, ' ').trim();
    if (sym) symbols.add(sym);
  }

  for (const innerHtml of nestedSpanInners(s, 'woocommerce-Price-amount')) {
    const inner = decodeEntities(innerHtml.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (inner) texts.push(inner);
    const n = parseMoney(inner, currency);
    if (Number.isFinite(n)) amounts.push(n);
  }

  const cardRe = /<(?:p|span|div)[^>]*wdp-card__price[^>]*>([\s\S]*?)<\/(?:p|span|div)>/gi;
  while ((m = cardRe.exec(s))) {
    const inner = decodeEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (inner) texts.push(inner);
    const n = parseMoney(inner, currency);
    if (Number.isFinite(n)) amounts.push(n);
  }

  const phRe = /(?:placeholder|value)\s*=\s*["']([^"']*min:\s*[^"']+)["']/gi;
  while ((m = phRe.exec(s))) {
    const inner = decodeEntities(m[1]).trim();
    if (inner) texts.push(inner);
    const n = parseMoney(inner, currency);
    if (Number.isFinite(n)) amounts.push(n);
  }

  const bareSymbol = s.match(/[€$£₺]/g);
  if (bareSymbol) {
    for (const ch of bareSymbol) symbols.add(ch);
  }

  return {
    symbols: [...symbols],
    amounts,
    texts,
  };
}

/**
 * @param {string} html
 * @param {string} className
 * @returns {string[]}
 */
function nestedSpanInners(html, className) {
  const s = String(html || '');
  const startRe = new RegExp(`<span[^>]*${className}[^>]*>`, 'gi');
  const out = [];
  let m;
  while ((m = startRe.exec(s))) {
    let i = startRe.lastIndex;
    let depth = 1;
    while (i < s.length && depth > 0) {
      const open = s.indexOf('<span', i);
      const close = s.indexOf('</span>', i);
      if (close < 0) break;
      if (open >= 0 && open < close) {
        depth += 1;
        i = open + 5;
      } else {
        depth -= 1;
        if (depth === 0) out.push(s.slice(startRe.lastIndex, close));
        i = close + 7;
      }
    }
  }
  return out;
}

/**
 * Liste / form / sepet aynı para birimi sembolü ve dönüşmüş tutar.
 * @param {{ list: ReturnType<typeof extractPriceSnapshot>, form: ReturnType<typeof extractPriceSnapshot>, cart: ReturnType<typeof extractPriceSnapshot>, code: string }} args
 */
export function assertCurrencySurfacesConsistent(args) {
  const list = args.list || { symbols: [], amounts: [], texts: [] };
  const form = args.form || { symbols: [], amounts: [], texts: [] };
  const cart = args.cart || { symbols: [], amounts: [], texts: [] };
  const code = String(args.code || '').toUpperCase();
  const expectedSym = symbolForCode(code);

  const allSym = [...new Set([...list.symbols, ...form.symbols, ...cart.symbols])];
  if (expectedSym) {
    const has = allSym.some((s) => s.includes(expectedSym));
    if (!has && allSym.length) {
      return {
        ok: false,
        reason: `sembol ${expectedSym} yok (${allSym.join('|') || '—'})`,
      };
    }
  }

  const listAmt = list.amounts[0];
  const formAmt = form.amounts[0];
  const cartAmt = cart.amounts[0];
  const nums = [listAmt, formAmt, cartAmt].filter((n) => Number.isFinite(n));
  if (nums.length >= 2) {
    const base = nums[0];
    for (const n of nums) {
      if (Math.abs(n - base) > 0.009) {
        return {
          ok: false,
          reason: `tutar uyumsuz liste=${listAmt} form=${formAmt} sepet=${cartAmt}`,
        };
      }
    }
  }

  return { ok: true, symbol: expectedSym || allSym[0] || '', amount: nums[0] };
}

/**
 * @param {string} code
 */
export function symbolForCode(code) {
  const c = String(code || '').toUpperCase();
  if (c === 'EUR') return '€';
  if (c === 'USD') return '$';
  if (c === 'GBP') return '£';
  if (c === 'TRY' || c === 'TL') return '₺';
  return '';
}

/**
 * @param {string} html
 */
function decodeEntities(html) {
  return String(html || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8364;/g, '€')
    .replace(/&euro;/g, '€')
    .replace(/&#36;/g, '$')
    .replace(/&dollar;/g, '$')
    .replace(/&#163;/g, '£')
    .replace(/&pound;/g, '£')
    .replace(/&#8378;/g, '₺');
}

/**
 * @param {object} args
 */
export async function runCurrencySwitchChecks({
  browser,
  contextOpts,
  env,
  productUrls,
  productIds,
  listPagePath,
  failures,
  stats,
  skips,
}) {
  const profile = env._profile;
  const spec = currencySwitchFromProfile(profile);
  if (!spec) return;
  const listPath = popupPagePath(env, listPagePath);
  const productPath = productUrls.custom || productUrls.fixed || productUrls.campaign || '';
  const cartPath = env.E2E_CART_PAGE || '/cart/';
  if (!listPath || !productPath) {
    skips.push({
      check: 'currency-switch',
      description: 'Liste/ürün yolu yok, para birimi gösterimi atlandı',
    });
    stats.skipped += 1;
    return;
  }

  const extraBase = comingSoonQuery(env, profile);
  const ctx = await browser.newContext(contextOpts);
  const page = await ctx.newPage();
  const errors = attachConsoleErrorCollector(page);
  page.setDefaultTimeout(CHECK_MS);
  page.setDefaultNavigationTimeout(CHECK_MS);
  try {
    for (const code of spec.codes) {
      const check = `currency-switch-${code.toLowerCase()}`;
      const errFrom = errors.length;
      try {
        const extra = { ...extraBase, [spec.param]: code };
        await page.goto(withCacheBust(env.E2E_BASE_URL, cartPath, extra), {
          waitUntil: 'domcontentloaded',
          timeout: CHECK_MS,
        });
        await gotoWooCart(page, env.E2E_BASE_URL);
        await emptyCart(page, env.E2E_BASE_URL);

        await page.goto(withCacheBust(env.E2E_BASE_URL, listPath, extra), {
          waitUntil: 'domcontentloaded',
          timeout: CHECK_MS,
        });
        const listHtml = await page.content();
        const listSnap = extractPriceSnapshot(listHtml, profile.currency);

        await page.goto(withCacheBust(env.E2E_BASE_URL, productPath, extra), {
          waitUntil: 'domcontentloaded',
          timeout: CHECK_MS,
        });
        const trigger = page.locator(
          `${SEL.centeredPopupTrigger}, ${SEL.sidePanelTrigger}, .wdp-card__cta, .wdp-loop-donate, .single_add_to_cart_button`
        );
        if ((await trigger.count()) > 0) {
          await clickShellTrigger(trigger, CHECK_MS);
          await openShellLocator(page, '').waitFor({ state: 'visible', timeout: CHECK_MS });
        }
        const formHtml = await page.content();
        const formSnap = extractPriceSnapshot(formHtml, profile.currency);

        const add = page.locator(SEL.addToCart).first();
        if ((await add.count()) > 0) {
          await clickAddToCartWithRetry(page, add, { timeout: CHECK_MS });
        }
        await gotoWooCart(page, env.E2E_BASE_URL);
        const store = await cartStoreSnapshot(page, env.E2E_BASE_URL);
        const cartSnap = {
          symbols: store.currency_symbol ? [store.currency_symbol] : [],
          amounts: store.items
            .map((it) => Number(it.totals))
            .filter((n) => Number.isFinite(n)),
          texts: store.items.map((it) => it.totals),
        };

        const cmp = assertCurrencySurfacesConsistent({
          list: listSnap,
          form: formSnap,
          cart: cartSnap,
          code,
        });
        if (!cmp.ok) {
          failures.push(
            makeFailure({
              check,
              description: `Para birimi ${code}: liste/form/sepet tutarsız`,
              detail: cmp.reason,
            })
          );
          stats.failed += 1;
        } else {
          stats.passed += 1;
        }
        assertNoConsoleErrors(errors.slice(errFrom));
      } catch (e) {
        failures.push(
          makeFailure({
            check,
            description: `Para birimi ${code} gösterimi hata verdi`,
            error: e,
          })
        );
        stats.failed += 1;
      }
    }
  } finally {
    await page.close();
    await ctx.close();
  }
  void productIds;
}
