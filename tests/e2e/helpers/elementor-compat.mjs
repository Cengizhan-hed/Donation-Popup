/**
 * Elementor Pro uyum testi (E8N) — YALNIZ TEST. Eklenti kodunda Elementor tespiti YOKTUR (CLAUDE.md §0).
 *
 * Elementor Pro DOM işaretleri burada yalnız "bu sayfada şablon/widget var mı" kararı içindir; yoksa senaryo
 * `ScenarioSkip` ile atlanır ("Theme Builder <tür> şablonu yok: kullanıcı oluşturunca koşar").
 * Ziyaretçi gibi gezer; forma kişisel veri yazılmaz; sipariş yok. Koşucu: run-elementor-compat.mjs.
 */
import { withCacheBust } from './env.mjs';
import { SEL } from './selectors.mjs';
import {
  classifyVisiblePluginEntry,
  collectVisiblePluginEntry,
  LOOP_EXCLUDE_SEL,
} from './product-page-ui.mjs';
import {
  cartStoreSnapshot,
  clickShellTrigger,
  emptyCart,
  openShellLocator,
} from './checks.mjs';
import { waitAndAssertShellOverlap } from './shell-overlap.mjs';
import { fillDonationShell, resolveDonationFillAmount } from './donation-flow.mjs';
import { comingSoonQuery } from './coming-soon.mjs';
import { textHasFormattedAmount } from './currency.mjs';
import { clickAddOrGo } from './remote-smoke.mjs';

/** Elementor Pro işaretleri (yalnız testte). */
export const ELEMENTOR_MARKERS = Object.freeze({
  product: '[data-elementor-type="product"], .elementor-location-single',
  cart: '.elementor-widget-woocommerce-cart',
  checkout: '.elementor-widget-woocommerce-checkout-page',
  account: '.elementor-widget-woocommerce-my-account',
  menuCart: '.elementor-widget-woocommerce-menu-cart',
});

/** Elementor menü sepeti öğeleri (Pro Menu Cart widget'ı). */
export const MENU_CART = Object.freeze({
  toggle: '.elementor-widget-woocommerce-menu-cart .elementor-menu-cart__toggle_button',
  shown: '.elementor-widget-woocommerce-menu-cart.elementor-menu-cart--shown, .elementor-menu-cart--shown',
  counter: '.elementor-widget-woocommerce-menu-cart .elementor-button-icon-qty',
  close: '.elementor-menu-cart__close-button',
  fragmentKey: 'elementor-menu-cart__wrapper',
});

/** Eklentinin yan sepeti ve bağışçı hesabı (assets/src). */
export const PLUGIN_UI = Object.freeze({
  scOpen: '[data-dp-sc-open]',
  scOverlayOpen: '[data-dp-sc-overlay].is-open',
  accOpen: '[data-dp-acc-open]',
  accDialog: '[data-dp-acc]',
  accOverlayOpen: '[data-dp-acc-overlay].is-open',
  accMenuLink: '.woocommerce-MyAccount-navigation-link--my-donations',
});

/** Senaryo atlama (hata değil). */
export class ScenarioSkip extends Error {
  /** @param {string} message Atlama gerekçesi. */
  constructor(message) {
    super(message);
    this.name = 'ScenarioSkip';
  }
}

/**
 * @param {string} kind Şablon/widget türü (ör. "ürün").
 * @return {string} Standart atlama mesajı.
 */
export function missingTemplateMessage(kind) {
  return `Theme Builder ${kind} şablonu yok: kullanıcı oluşturunca koşar`;
}

/** Eklentiye ait hata kaynağı (eklenti klasörü / wdp / donation-panel). */
const PLUGIN_SRC_RE = /woo-donation-popup|donation-panel|\bwdp[_-]|wdp_ajax/i;

/**
 * Hata metni eklentiden mi? (üçüncü taraf hataları eklentiye yüklenmez.)
 *
 * @param {string} text Mesaj + kaynak/yığın.
 * @return {boolean} Eklenti kaynaklı ise true.
 */
export function isPluginSourcedError(text) {
  return PLUGIN_SRC_RE.test(String(text || ''));
}

/**
 * Yakalanmamış istisna + konsol hatası dinleyicisi; yalnız eklenti kaynaklıları tutulur.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {{ errors: string[], other: number, reset: () => void }} Toplayıcı.
 */
export function attachPluginErrorWatch(page) {
  const state = { errors: [], other: 0 };
  page.on('pageerror', (err) => {
    const text = `${err && err.message ? err.message : err}\n${err && err.stack ? err.stack : ''}`;
    if (isPluginSourcedError(text)) state.errors.push(`pageerror: ${text.split('\n')[0].slice(0, 200)}`);
    else state.other += 1;
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const loc = typeof msg.location === 'function' ? msg.location() : {};
    const text = `${msg.text()} ${loc && loc.url ? loc.url : ''}`;
    if (isPluginSourcedError(text)) state.errors.push(`console: ${text.slice(0, 200)}`);
    else state.other += 1;
  });
  return {
    get errors() {
      return state.errors;
    },
    get other() {
      return state.other;
    },
    reset() {
      state.errors.length = 0;
    },
  };
}

/**
 * Aynı `wdp`/`dp-` önekli id'den birden çok var mı ve eklenti betiği iki kez yüklü mü (çift yükleme)?
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<{ duplicateIds: string[], duplicateScripts: string[] }>} Bulgular.
 */
export async function findDuplicateLoads(page) {
  return page.evaluate(() => {
    const ids = {};
    for (const el of document.querySelectorAll('[id^="wdp"],[id^="dp-"],[id^="hdf-"]')) {
      ids[el.id] = (ids[el.id] || 0) + 1;
    }
    const srcs = {};
    for (const s of document.querySelectorAll('script[src*="woo-donation-popup"]')) {
      const key = String(s.getAttribute('src') || '').split('?')[0];
      srcs[key] = (srcs[key] || 0) + 1;
    }
    const dup = (o) => Object.keys(o).filter((k) => o[k] > 1);
    return { duplicateIds: dup(ids), duplicateScripts: dup(srcs) };
  });
}

/**
 * @param {{ duplicateIds: string[], duplicateScripts: string[] }} d Bulgular.
 * @param {string} where Sayfa adı.
 */
export function assertNoDuplicateLoads(d, where) {
  if (d.duplicateIds.length || d.duplicateScripts.length) {
    throw new Error(
      `${where}: çift yükleme ids=${d.duplicateIds.join(',') || '-'} scripts=${d.duplicateScripts.join(',') || '-'}`
    );
  }
}

/**
 * İki panelin aynı anda açık olmaması kuralı (saf mantık).
 *
 * @param {{ plugin: boolean, elementor: boolean }} open Açık durumları.
 * @return {boolean} İkisi birden açıksa true (ihlal).
 */
export function bothPanelsOpen(open) {
  return !!(open && open.plugin && open.elementor);
}

/**
 * Bir öğenin merkez noktasında en üstteki öğe kabuğun içinde mi? (tıklanabilirlik / z-index)
 *
 * @param {import('@playwright/test').Locator} locator Kabuk içeriği.
 * @return {Promise<{ ok: boolean, top: string }>} Sonuç.
 */
export async function isTopmostAtCenter(locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 0), window.innerWidth - 1);
    const y = Math.min(Math.max(r.top + Math.min(r.height / 2, window.innerHeight / 2), 0), window.innerHeight - 1);
    const top = document.elementFromPoint(x, y);
    const wrapper = el.closest('.hdf-donation-modal-wrapper, .wdp-modal') || el;
    const ok = !!top && (wrapper.contains(top) || el.contains(top));
    return { ok, top: top ? `${top.tagName.toLowerCase()}.${String(top.className || '').slice(0, 50)}` : 'yok' };
  });
}

/**
 * Elementor işaretleri bu sayfada var mı?
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} selector Birleşik seçici.
 * @return {Promise<boolean>} Var ise true.
 */
export async function hasMarker(page, selector) {
  return page.evaluate((sel) => !!document.querySelector(sel), selector);
}

/**
 * @param {{ base: string, env: object, profile: object, extra?: object }} ctx Bağlam.
 * @param {string} pathOrUrl Yol.
 * @return {string} Önbellek kırıcı + coming soon sorgulu tam adres.
 */
export function urlFor(ctx, pathOrUrl) {
  return withCacheBust(ctx.base, pathOrUrl, { ...comingSoonQuery(ctx.env, ctx.profile), ...(ctx.extra || {}) });
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {object} ctx Bağlam.
 * @param {string} pathOrUrl Yol.
 * @return {Promise<import('@playwright/test').Response|null>} Yanıt.
 */
export async function visit(page, ctx, pathOrUrl) {
  return page.goto(urlFor(ctx, pathOrUrl), { waitUntil: 'domcontentloaded', timeout: ctx.timeouts.navigation });
}

/**
 * Ürün sayfasında eklentinin TEK görünür girişini bulur ve (düğme/panel ise) açar; kabuğu döndürür.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {{ timeouts: object }} ctx Bağlam.
 * @return {Promise<{ shell: import('@playwright/test').Locator, kind: string }>} Kabuk.
 */
export async function openPluginEntry(page, ctx) {
  const deadline = Date.now() + ctx.timeouts.expect;
  let classified = classifyVisiblePluginEntry(await collectVisiblePluginEntry(page));
  while (!classified.ok && Date.now() < deadline) {
    await page.evaluate(() => window.scrollBy(0, Math.max(300, Math.round(window.innerHeight * 0.8))));
    await new Promise((r) => setTimeout(r, 250));
    classified = classifyVisiblePluginEntry(await collectVisiblePluginEntry(page));
  }
  if (!classified.ok) throw new Error(`eklenti girişi: ${classified.reason}`);
  if (classified.kind === 'panel' || classified.kind === 'popup') {
    const sel = classified.kind === 'panel' ? SEL.sidePanelTrigger : SEL.centeredPopupTrigger;
    const n = await page.locator(sel).count();
    let clicked = false;
    for (let i = 0; i < n && !clicked; i += 1) {
      const btn = page.locator(sel).nth(i);
      const inLoop = await btn.evaluate(
        (el, excl) => !!(el.classList.contains('wdp-loop-donate') || (el.closest && el.closest(excl))),
        LOOP_EXCLUDE_SEL
      );
      if (inLoop || !(await btn.isVisible())) continue;
      await clickShellTrigger(btn, ctx.timeouts.action);
      clicked = true;
    }
    if (!clicked) throw new Error('eklenti tetikleyicisi tıklanamadı');
  }
  const shell =
    classified.kind === 'form'
      ? page.locator(`${SEL.inlineDonationForm}, ${SEL.donationForm}`).first()
      : openShellLocator(page, classified.kind === 'panel' ? 'panel' : 'popup');
  await shell.waitFor({ state: 'visible', timeout: ctx.timeouts.expect });
  return { shell, kind: classified.kind };
}

/**
 * Ürün sayfasından geçerli tutarla bağış ekler; Store API sepet anlık görüntüsünü ve tutarı döndürür.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {object} ctx Bağlam.
 * @return {Promise<{ amount: number, store: object }>} Sonuç.
 */
export async function addDonationFromProduct(page, ctx) {
  await visit(page, ctx, ctx.paths.product);
  const { shell } = await openPluginEntry(page, ctx);
  const picked = await resolveDonationFillAmount(shell, ctx.profile.currency);
  await fillDonationShell(shell, { kind: 'custom', amount: picked.amount, fill: picked.fill });
  await clickAddOrGo(page, shell, ctx.timeouts.action);
  const store = await waitForCartItems(page, ctx);
  return { amount: picked.amount, store };
}

/**
 * Store API sepeti dolana kadar örnekler (sabit bekleme yok; süre sınırı profilden).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {object} ctx Bağlam.
 * @return {Promise<object>} Sepet anlık görüntüsü.
 */
export async function waitForCartItems(page, ctx) {
  const deadline = Date.now() + ctx.timeouts.expect;
  let store = await cartStoreSnapshot(page, ctx.base);
  while (!store.items_count && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 400));
    store = await cartStoreSnapshot(page, ctx.base);
  }
  if (!store.items_count) throw new Error('Store API sepet boş (bağış eklenmedi)');
  return store;
}

/**
 * Sepette bağış yoksa ekler (senaryolar arası paylaşım; ctx.state üzerinden).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {object} ctx Bağlam.
 * @return {Promise<number>} Sepetteki bağış tutarı.
 */
export async function ensureDonationInCart(page, ctx) {
  if (ctx.state.amount) {
    const store = await cartStoreSnapshot(page, ctx.base);
    if (store.items_count) return ctx.state.amount;
  }
  const res = await addDonationFromProduct(page, ctx);
  ctx.state.amount = res.amount;
  return res.amount;
}

/* ---------------------------------------------------------------- senaryolar */

/** 1) Theme Builder ürün şablonu. */
async function scenarioProductTemplate(page, ctx) {
  await visit(page, ctx, ctx.paths.product);
  if (!(await hasMarker(page, ELEMENTOR_MARKERS.product))) throw new ScenarioSkip(missingTemplateMessage('ürün'));
  ctx.errors.reset();
  const ui = classifyVisiblePluginEntry(await collectVisiblePluginEntry(page));
  if (!ui.ok) throw new Error(`eklenti girişi TEK değil/yok: ${ui.reason}`);
  const { shell } = await openPluginEntry(page, ctx);
  const overlap = await waitAndAssertShellOverlap(page, ctx.timeouts.settle);
  if (overlap && overlap.ok === false) throw new Error(`POPUP-OVERLAP: ${overlap.reason || 'form alanı örtülü'}`);
  const content = shell.locator('.wdp-modal-content, form').first();
  const target = (await content.count()) > 0 ? content : shell;
  const top = await isTopmostAtCenter(target);
  if (!top.ok) throw new Error(`kabuk Elementor katmanlarının altında kaldı (üstteki: ${top.top})`);
  const picked = await resolveDonationFillAmount(shell, ctx.profile.currency);
  await fillDonationShell(shell, { kind: 'custom', amount: picked.amount, fill: picked.fill });
  await clickAddOrGo(page, shell, ctx.timeouts.action);
  await waitForCartItems(page, ctx);
  ctx.state.amount = picked.amount;
  assertNoDuplicateLoads(await findDuplicateLoads(page), 'ürün sayfası');
  if (ctx.errors.errors.length) throw new Error(`eklenti kaynaklı JS hatası: ${ctx.errors.errors.slice(0, 2).join(' | ')}`);
}

/** 2) Cart widget sayfası. */
async function scenarioCartWidget(page, ctx) {
  await visit(page, ctx, ctx.paths.cart);
  if (!(await hasMarker(page, ELEMENTOR_MARKERS.cart))) throw new ScenarioSkip(missingTemplateMessage('Cart (sepet)'));
  const amount = await ensureDonationInCart(page, ctx);
  ctx.errors.reset();
  await visit(page, ctx, ctx.paths.cart);
  await page.locator(`${ELEMENTOR_MARKERS.cart} .cart_item, ${ELEMENTOR_MARKERS.cart} .product-name, ${ELEMENTOR_MARKERS.cart} .wc-block-cart-items__row`).first()
    .waitFor({ state: 'attached', timeout: ctx.timeouts.expect });
  const text = await page.locator(ELEMENTOR_MARKERS.cart).first().innerText();
  if (!textHasFormattedAmount(text, amount, ctx.profile.currency)) {
    throw new Error('sepet widget\'ında WooCommerce biçimli bağış tutarı görünmüyor');
  }
  const store = await cartStoreSnapshot(page, ctx.base);
  const rows = await page.locator(`${ELEMENTOR_MARKERS.cart} tr.cart_item, ${ELEMENTOR_MARKERS.cart} .wc-block-cart-items__row`).count();
  if (rows && rows !== store.items_count) throw new Error(`sepet satırı ${rows} ≠ Store API ${store.items_count}`);
  assertNoDuplicateLoads(await findDuplicateLoads(page), 'sepet sayfası');
  if (ctx.errors.errors.length) throw new Error(`eklenti kaynaklı JS hatası: ${ctx.errors.errors.slice(0, 2).join(' | ')}`);
}

/** 3) Checkout widget sayfası — alan doldurma/gönderme YOK. */
async function scenarioCheckoutWidget(page, ctx) {
  const resp = await visit(page, ctx, ctx.paths.checkout);
  if (await page.evaluate(() => !!document.querySelector('.woocommerce-coming-soon, [class*="coming-soon"], [id*="coming-soon"]'))) {
    throw new ScenarioSkip('Ödeme sayfası coming soon engelinde: site yayına açılınca koşar');
  }
  if (!(await hasMarker(page, ELEMENTOR_MARKERS.checkout))) {
    throw new ScenarioSkip(missingTemplateMessage('Checkout (ödeme)') + (resp ? ` (HTTP ${resp.status()})` : ''));
  }
  const amount = await ensureDonationInCart(page, ctx);
  ctx.errors.reset();
  await visit(page, ctx, ctx.paths.checkout);
  await page
    .locator('form.checkout, form.woocommerce-checkout, .wc-block-checkout')
    .first()
    .waitFor({ state: 'attached', timeout: ctx.timeouts.expect });
  await page
    .locator('.product-name, .wc-block-components-product-name, .wc-block-components-order-summary-item')
    .first()
    .waitFor({ state: 'attached', timeout: ctx.timeouts.expect });
  const text = await page.locator('body').innerText();
  if (!textHasFormattedAmount(text, amount, ctx.profile.currency)) {
    throw new Error('ödeme sayfasında WooCommerce biçimli bağış tutarı görünmüyor');
  }
  assertNoDuplicateLoads(await findDuplicateLoads(page), 'ödeme sayfası');
  const forms = await page.locator('form.checkout, form.woocommerce-checkout, .wc-block-checkout').count();
  if (forms > 1) throw new Error(`ödeme formu ${forms} kez yüklü`);
  if (ctx.errors.errors.length) throw new Error(`eklenti kaynaklı JS hatası: ${ctx.errors.errors.slice(0, 2).join(' | ')}`);
}

/** 4) My Account widget — ziyaretçi bağlamı, girişli alana girilmez. */
async function scenarioMyAccountWidget(page, ctx) {
  await visit(page, ctx, ctx.paths.account);
  if (!(await hasMarker(page, ELEMENTOR_MARKERS.account))) throw new ScenarioSkip(missingTemplateMessage('My Account (hesabım)'));
  ctx.errors.reset();
  const login = await page.locator(`${ELEMENTOR_MARKERS.account} form.woocommerce-form-login, ${ELEMENTOR_MARKERS.account} form.login, ${ELEMENTOR_MARKERS.account} #customer_login`).count();
  if (!login) throw new Error('ziyaretçi için giriş formu görünmüyor (My Account widget)');
  if (!(await page.locator(PLUGIN_UI.accDialog).count())) {
    throw new ScenarioSkip('Bağışçı hesabı modülü kapalı: Donation Panel ayarlarında açılınca koşar');
  }
  const dialogs = await page.locator(PLUGIN_UI.accDialog).count();
  if (dialogs !== 1) throw new Error(`bağışçı hesabı penceresi ${dialogs} kez yazılmış`);
  const links = await page.locator(PLUGIN_UI.accMenuLink).count();
  if (links > 1) throw new Error(`Bağışlarım menü öğesi ${links} kez (yinelenen uç nokta)`);
  // Uç nokta kırık mı? Ziyaretçi için giriş sayfasına düşmeli, 404 olmamalı.
  const base = ctx.paths.account.replace(/\/$/, '');
  const res = await page.request.get(urlFor(ctx, `${base}/my-donations/`));
  if (res.status() >= 400) throw new Error(`Bağışlarım uç noktası HTTP ${res.status()} (kırık bağlantı)`);
  assertNoDuplicateLoads(await findDuplicateLoads(page), 'hesabım sayfası');
  if (ctx.errors.errors.length) throw new Error(`eklenti kaynaklı JS hatası: ${ctx.errors.errors.slice(0, 2).join(' | ')}`);
}

/** Menü sepeti ve eklenti yan sepetinin açık durumları. */
async function readOpenState(page) {
  return {
    plugin: (await page.locator(PLUGIN_UI.scOverlayOpen).count()) > 0,
    elementor: (await page.locator(MENU_CART.shown).count()) > 0,
  };
}

/** 5) Menu Cart widget + eklenti yan sepeti. */
async function scenarioMenuCart(page, ctx) {
  await visit(page, ctx, ctx.paths.home);
  if (!(await hasMarker(page, ELEMENTOR_MARKERS.menuCart))) throw new ScenarioSkip(missingTemplateMessage('Menu Cart (başlık)'));
  if (!(await page.locator(PLUGIN_UI.scOpen).count())) {
    throw new ScenarioSkip('Eklentinin yan sepet modülü kapalı: Donation Panel ayarlarında açılınca koşar');
  }
  ctx.errors.reset();
  const trigger = page.locator(PLUGIN_UI.scOpen).first();
  await trigger.click({ timeout: ctx.timeouts.action });
  await page.locator(PLUGIN_UI.scOverlayOpen).first().waitFor({ state: 'visible', timeout: ctx.timeouts.expect });
  if (bothPanelsOpen(await readOpenState(page))) throw new Error('yan sepet açıkken Elementor menü sepeti de açık');
  await page.keyboard.press('Escape');
  await page.locator(PLUGIN_UI.scOverlayOpen).waitFor({ state: 'detached', timeout: ctx.timeouts.expect });
  await page.locator(MENU_CART.toggle).first().click({ timeout: ctx.timeouts.action });
  await page.locator(MENU_CART.shown).first().waitFor({ state: 'attached', timeout: ctx.timeouts.expect });
  const state = await readOpenState(page);
  if (bothPanelsOpen(state)) throw new Error('Elementor menü sepeti açıkken eklenti yan sepeti de açık');
  if (!state.elementor) throw new Error('Elementor menü sepeti açılmadı');
  const close = page.locator(MENU_CART.close).first();
  if ((await close.count()) > 0 && (await close.isVisible())) await close.click({ timeout: ctx.timeouts.action });
  else await page.keyboard.press('Escape');
  // Bağış ekle → Elementor sayaç parçası (Woo parçaları) güncel mi? Gözlem: başarısızlık değil, bilgi + tutarlılık.
  const amount = await ensureDonationInCart(page, ctx);
  const store = await cartStoreSnapshot(page, ctx.base);
  await visit(page, ctx, ctx.paths.home);
  const counterEl = page.locator(MENU_CART.counter).first();
  const counterText = (await counterEl.count()) > 0 ? ((await counterEl.textContent({ timeout: ctx.timeouts.action })) || '').trim() : '';
  const counter = Number(counterText.replace(/\D/g, ''));
  ctx.notes.push(`menü sepeti sayacı=${counterText || '?'} Store API öğe=${store.items_count} tutar=${amount}`);
  if (Number.isFinite(counter) && counterText && counter !== store.items_count) {
    throw new Error(`Elementor menü sepeti sayacı ${counter} ≠ sepet ${store.items_count} (parça güncellenmedi)`);
  }
  assertNoDuplicateLoads(await findDuplicateLoads(page), 'başlık/menü sepeti');
  if (ctx.errors.errors.length) throw new Error(`eklenti kaynaklı JS hatası: ${ctx.errors.errors.slice(0, 2).join(' | ')}`);
}

/** 6) Bağışçı hesabı giriş penceresi + Elementor sayfası. */
async function scenarioDonorAccountPopup(page, ctx) {
  await visit(page, ctx, ctx.paths.home);
  if (!(await hasMarker(page, '[data-elementor-type]'))) throw new ScenarioSkip(missingTemplateMessage('sayfa (Elementor ile oluşturulmuş)'));
  const trigger = page.locator(PLUGIN_UI.accOpen).first();
  if (!(await trigger.count())) {
    throw new ScenarioSkip('Bağışçı hesabı simgesi yok (modül kapalı ya da kişi simgesi yerleşmedi)');
  }
  ctx.errors.reset();
  await trigger.click({ timeout: ctx.timeouts.action });
  const overlay = page.locator(PLUGIN_UI.accOverlayOpen).first();
  await overlay.waitFor({ state: 'visible', timeout: ctx.timeouts.expect });
  const locked = await page.evaluate(() => {
    const h = getComputedStyle(document.documentElement).overflow;
    const b = getComputedStyle(document.body).overflow;
    return h === 'hidden' || b === 'hidden' || document.documentElement.classList.contains('dp-ac-lock');
  });
  if (!locked) throw new Error('pencere açıkken sayfa kaydırması kilitlenmedi');
  const top = await isTopmostAtCenter(overlay);
  if (!top.ok) throw new Error(`pencere Elementor katmanlarının altında (üstteki: ${top.top})`);
  // Odak tuzağı: Tab ile 12 adım dolaş, odak pencerenin dışına çıkmamalı.
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const ov = document.querySelector('[data-dp-acc-overlay].is-open');
      return !!(ov && document.activeElement && ov.contains(document.activeElement));
    });
    if (!inside) throw new Error(`odak tuzağı kırık (Tab ${i + 1}. adımda odak pencere dışında)`);
  }
  await page.keyboard.press('Escape');
  await page.locator(PLUGIN_UI.accOverlayOpen).waitFor({ state: 'detached', timeout: ctx.timeouts.expect });
  const unlocked = await page.evaluate(() => {
    const h = getComputedStyle(document.documentElement).overflow;
    const b = getComputedStyle(document.body).overflow;
    return h !== 'hidden' && b !== 'hidden' && !document.documentElement.classList.contains('dp-ac-lock');
  });
  if (!unlocked) throw new Error('pencere kapandıktan sonra sayfa kaydırması geri açılmadı');
  assertNoDuplicateLoads(await findDuplicateLoads(page), 'sayfa (bağışçı hesabı)');
  if (ctx.errors.errors.length) throw new Error(`eklenti kaynaklı JS hatası: ${ctx.errors.errors.slice(0, 2).join(' | ')}`);
}

export const SCENARIOS = Object.freeze([
  { id: 'product-template', title: 'Theme Builder ürün şablonu: tek giriş, açılış, ekleme, katman', run: scenarioProductTemplate },
  { id: 'cart-widget', title: 'Cart widget: bağış satırı/tutar, çakışma yok', run: scenarioCartWidget },
  { id: 'checkout-widget', title: 'Checkout widget: yinelenme yok, ürün/tutar (view-only)', run: scenarioCheckoutWidget },
  { id: 'my-account-widget', title: 'My Account widget: giriş formu, Bağışlarım tek ve kırık değil', run: scenarioMyAccountWidget },
  { id: 'menu-cart', title: 'Menu Cart + yan sepet: iki panel birlikte açık değil, sayaç', run: scenarioMenuCart },
  { id: 'donor-account-popup', title: 'Bağışçı hesabı penceresi: odak tuzağı, Esc, kaydırma kilidi', run: scenarioDonorAccountPopup },
]);

/**
 * Senaryo bağlamı.
 *
 * @param {{ base: string, env: object, profile: object, timeouts: object, paths: object }} opts Seçenekler.
 * @return {object} Bağlam (state/notes/errors dahil; errors sayfa başına `bindPage` ile bağlanır).
 */
export function makeContext(opts) {
  return { ...opts, state: { amount: 0 }, notes: [], errors: { errors: [], reset() {} } };
}

/**
 * Tek senaryoyu koşar; atlama/hata/geçti döndürür (hata yutulmaz, mesaj döner).
 *
 * @param {{ id: string, run: Function }} scenario Senaryo.
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {object} ctx Bağlam.
 * @return {Promise<{ id: string, status: 'passed'|'skipped'|'failed', detail: string }>} Sonuç.
 */
export async function runScenario(scenario, page, ctx) {
  ctx.errors = attachPluginErrorWatch(page);
  try {
    await scenario.run(page, ctx);
    return { id: scenario.id, status: 'passed', detail: ctx.notes.join('; ') };
  } catch (e) {
    if (e instanceof ScenarioSkip) return { id: scenario.id, status: 'skipped', detail: e.message };
    return { id: scenario.id, status: 'failed', detail: String(e && e.message ? e.message : e).slice(0, 400) };
  }
}

/**
 * Bağlam yolları (WooCommerce varsayılanları; profil/env ile geçersiz kılınabilir).
 *
 * @param {object} env Ortam.
 * @param {string} productPath Ürün sayfası yolu.
 * @return {{ home: string, product: string, cart: string, checkout: string, account: string }} Yollar.
 */
export function compatPaths(env, productPath) {
  return {
    home: '/',
    product: productPath,
    cart: env.E2E_CART_PAGE || '/cart/',
    checkout: env.E2E_CHECKOUT_PAGE || '/checkout/',
    account: env.E2E_ACCOUNT_PAGE || '/my-account/',
  };
}

/**
 * Koşu sonunda sepeti boşaltır (kendi eklediği; uzak sipariş yok).
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {object} ctx Bağlam.
 * @return {Promise<void>}
 */
export async function cleanupCart(page, ctx) {
  await emptyCart(page, ctx.base);
}

/**
 * Koşucu bayrakları.
 *
 * @param {string[]} argv Komut satırı.
 * @return {{ envId: string, sim: boolean, project: string, grep: string }} Ayrıştırılmış bayraklar.
 */
export function parseElementorCompatArgs(argv = process.argv.slice(2)) {
  const a = argv.filter((x) => x !== '--');
  const out = { envId: 'local', sim: false, project: '', grep: '' };
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    if (x === '--env' || x === '--profile') out.envId = String(a[(i += 1)] || out.envId);
    else if (x.startsWith('--env=')) out.envId = x.slice('--env='.length);
    else if (x === '--sim') out.sim = true;
    else if (x === '--project') out.project = String(a[(i += 1)] || '');
    else if (x === '--grep') out.grep = String(a[(i += 1)] || '');
  }
  return out;
}

/**
 * Koşucunun hangi kipte çalışacağı: yalnız açık `--env ikram-aid` uzak koşar; varsayılan local = atla.
 *
 * @param {{ envId: string, sim: boolean }} args Bayraklar.
 * @return {'skip'|'sim'|'remote'|'reject'} Kip.
 */
export function decideMode(args) {
  const id = String(args.envId || 'local').toLowerCase();
  if (id === 'ikram-aid' || id === 'ikram') return 'remote';
  if (id === 'local' || id === 'local-wp') return args.sim ? 'sim' : 'skip';
  return 'reject';
}
