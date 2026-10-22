/**
 * Şart b — Genel fiyat BOŞken custom/campaign: listede görünür, Bağış Yap, sepete eklenir, kart HTML bozuk değil.
 * Hedef: mevcut üründe _regular_price/_price geçici boşalt + geri yükle (geri yükleme hatası fail).
 * Ikram: gerçek fiyata dokunulmaz; private + _wdp_e2e_test işaretli geçici ürün; asAdmin; kalıcı sil (silme hatası fail).
 */
import { SEL } from './selectors.mjs';
import { withCacheBust } from './env.mjs';
import { getActiveProfile } from './profile.mjs';
import { requireFixtureRole, mutationBrowserContext, isFixtureProductId } from './fixtures.mjs';
import {
  emptyCart,
  openShellLocator,
  clickShellTrigger,
  revealListProductTrigger,
  shellTriggerLocator,
  clickAddToCartWithRetry,
  makeFailure,
  cartItemsDetail,
  gotoWooCart,
} from './checks.mjs';
import {
  bumpListCache,
  saveProductPrices,
  snapshotProductPrices,
  createMarkedDonationProduct,
  deleteMarkedProduct,
} from './staging-wp-meta.mjs';

const CHECK_MS = 20000;

/**
 * @param {import('@playwright/test').Page} page
 * @param {'popup'|'panel'} mode
 * @param {{ baseUrl: string, listPath?: string, productPath: string, productId: number }} opts
 */
async function openShell(page, mode, opts) {
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
        : page.locator(`${SEL.centeredPopupTrigger}, ${SEL.sidePanelTrigger}, .wdp-card__cta, .wdp-loop-donate`).first();
  }
  await clickShellTrigger(trigger, CHECK_MS);
  const shell = openShellLocator(page, '');
  await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
  await shell.locator(SEL.donationForm).first().waitFor({ state: 'visible', timeout: CHECK_MS });
  return shell;
}

/**
 * Private ürün permalink’i `?p=` olabilir; pathname tek başına ana sayfaya düşer.
 * Builder şablonunda sepete-ekle yoksa 10.34.1 `wdp-auto-place-fallback` tetikleyici basar.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} baseUrl
 * @param {{ id: number, url?: string, slug?: string }} created
 * @returns {Promise<import('@playwright/test').Locator>}
 */
async function openIkramPrivateProductForm(page, baseUrl, created) {
  const id = Number(created.id) || 0;
  const candidates = [];
  if (created.url) candidates.push(created.url);
  if (id) {
    candidates.push(`/?p=${id}`);
    candidates.push(`/?post_type=product&p=${id}`);
  }
  if (created.slug) candidates.push(`/product/${created.slug}/`);
  const unique = [...new Set(candidates.filter(Boolean))];
  let lastUrl = '';
  let lastDiag = '';
  for (const cand of unique) {
    const dest = withCacheBust(baseUrl, cand, { hdf_no_side_cart: '1' });
    lastUrl = dest;
    await page.goto(dest, { waitUntil: 'domcontentloaded' });
    const form = page.locator(SEL.donationForm).first();
    if ((await form.count()) > 0 && (await form.isVisible())) {
      return form;
    }
    let trigger = shellTriggerLocator(page, 'panel', { productId: id });
    if ((await trigger.count()) === 0) {
      trigger = page.locator(`${SEL.sidePanelTrigger}, ${SEL.centeredPopupTrigger}, .wdp-open-modal`).first();
    }
    if ((await trigger.count()) > 0) {
      await clickShellTrigger(trigger, CHECK_MS);
      const shell = openShellLocator(page, '');
      await shell.waitFor({ state: 'visible', timeout: CHECK_MS });
      await shell.locator(SEL.donationForm).first().waitFor({ state: 'visible', timeout: CHECK_MS });
      return shell;
    }
    const title = await page.title().catch(() => '');
    const href = page.url();
    lastDiag = `url=${href} title=${title} form=0 trigger=0`;
  }
  throw new Error(`Bağış formu yok (private ürün). last=${lastUrl} ${lastDiag}`);
}

/**
 * @param {import('@playwright/test').Locator} shell
 * @param {string} amount
 * @param {string} phone
 */
async function fillMinimalDonor(shell, amount, phone) {
  const name = shell.locator(SEL.donorName).first();
  if (await name.count()) await name.fill('E2E Empty Price');
  const phoneLoc = shell.locator(SEL.donorPhone).first();
  if (await phoneLoc.count()) await phoneLoc.fill(phone);
  const price = shell.locator(SEL.customPrice).first();
  if ((await price.count()) === 0) {
    throw new Error('custom_price alanı yok');
  }
  await price.fill(String(amount));
}

/**
 * @param {object} args
 */
export async function runEmptyPriceChecks({
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
}) {
  const profile = getActiveProfile();
  const baseUrl = env.E2E_BASE_URL;
  const listPath = listPagePath || env.E2E_LIST_PAGE;
  const phone = profile.phone?.nationalExample || '5551234567';
  const amount = String(profile.products?.custom?.min || 100);

  const pass = (id) => {
    stats.passed += 1;
    return id;
  };
  const fail = (id, description, error) => {
    failures.push(makeFailure({ check: id, description, error }));
    stats.failed += 1;
  };
  const skip = (id, description) => {
    skips.push({ check: id, description });
    stats.skipped += 1;
  };

  let fx;
  try {
    fx = requireFixtureRole(env, 'empty-price');
  } catch (e) {
    fail('empty-price-fixture', String(e.message || e), e);
    return;
  }
  await runHedefEmptyPrice({
    browser,
    contextOpts,
    env,
    productUrls: { custom: fx.path || fx.url, campaign: fx.path || fx.url },
    productIds: { custom: fx.id, campaign: fx.id },
    listPath,
    baseUrl,
    phone,
    amount,
    pass,
    fail,
    skip,
    createAdminContext,
  });
}

/**
 * @param {object} args
 */
async function runHedefEmptyPrice({
  browser,
  contextOpts,
  env,
  productUrls,
  productIds,
  listPath,
  baseUrl,
  phone,
  amount,
  pass,
  fail,
  skip,
  createAdminContext,
}) {
  const targets = [
    { role: 'custom', id: productIds.custom || 0, path: productUrls.custom, list: true },
    { role: 'campaign', id: productIds.campaign || 0, path: productUrls.campaign, list: true },
  ];

  for (const t of targets) {
    if (!t.id || !t.path) {
      skip(
        `empty-price-${t.role}-missing`,
        `${t.role} ürünü yok → Genel fiyat boş doğrulaması atlandı`
      );
      continue;
    }

    let snapshot = { price: '', regular: '', sale: '' };
    let restored = false;
    const ctx = await mutationBrowserContext(browser, contextOpts, createAdminContext);
    const page = await ctx.newPage();
    try {
      snapshot = await snapshotProductPrices(t.id);
      await saveProductPrices(t.id, { price: '', regular: '', sale: '' });
      await bumpListCache();

      if (t.list && listPath && !isFixtureProductId(t.id, env)) {
        try {
          await page.goto(withCacheBust(baseUrl, listPath, { hdf_no_side_cart: '1' }), {
            waitUntil: 'domcontentloaded',
          });
          await revealListProductTrigger(page, t.id);
          const cta = page.locator(`[data-product-id="${t.id}"]`).first();
          if ((await cta.count()) === 0) {
            throw new Error(`Listede data-product-id=${t.id} yok (fiyatsız ürün gizlenmiş olabilir)`);
          }
          const card = page.locator(`.wdp-list__item:has([data-product-id="${t.id}"])`).first();
          const cardHtml = (await card.innerHTML().catch(() => '')) || '';
          const cardText = (await card.innerText().catch(() => '')) || '';
          if (/<p class="wdp-card__price">\s*<\/p>/.test(cardHtml) || /undefined|NaN|&nbsp;\s*&nbsp;/.test(cardHtml)) {
            throw new Error('Kart fiyat HTML bozuk/boş etiket');
          }
          if (t.role === 'custom') {
            if (/wdp-card__price/.test(cardHtml) && !/min\./i.test(cardText)) {
              throw new Error('Custom kartta min. yok; sabit fiyat sızmış olabilir');
            }
          }
          pass(`empty-price-${t.role}-list-visible`);
        } catch (e) {
          fail(`empty-price-${t.role}-list-visible`, `${t.role} fiyatsız listede görünür`, e);
        }
      } else if (isFixtureProductId(t.id, env)) {
        skip(`empty-price-${t.role}-list-visible`, 'fixture private, ziyaretçi listesinde yok');
      } else {
        skip(`empty-price-${t.role}-list-visible`, 'Liste yolu yok');
      }

      try {
        await emptyCart(page, baseUrl);
        const shell = await openShell(page, 'panel', {
          baseUrl,
          listPath,
          productPath: t.path,
          productId: t.id,
        });
        await fillMinimalDonor(shell, amount, phone);
        const addBtn = shell.locator(SEL.addToCart).first();
        const cartRes = await clickAddToCartWithRetry(page, addBtn, {
          checkId: `empty-price-${t.role}-add`,
        });
        if (!cartRes.ok) {
          throw new Error(`Sepete ekleme başarısız: ${cartRes.bodyPreview || ''}`);
        }
        await gotoWooCart(page, baseUrl);
        const items = await cartItemsDetail(page, baseUrl);
        if (!Array.isArray(items) || items.length === 0) {
          throw new Error('Sepet boş');
        }
        const match = items.find((it) => Number(it.id) === Number(t.id)) || items[0];
        const got = Number(match && match.totals);
        if (!Number.isFinite(got) || got <= 0) {
          throw new Error(`Sepet tutarı geçersiz: ${match && match.totals}`);
        }
        const want = Number(amount);
        if (Number.isFinite(want) && Math.abs(got - want) > 0.5 && got < want) {
          throw new Error(`Sepet tutarı beklenen ~${want}, gerçek ${got}`);
        }
        pass(`empty-price-${t.role}-product-cart`);
      } catch (e) {
        fail(`empty-price-${t.role}-product-cart`, `${t.role} ürün sayfası + sepet (fiyatsız)`, e);
      }
    } catch (e) {
      fail(`empty-price-${t.role}-runner`, `${t.role} fiyat boşaltma`, e);
    } finally {
      try {
        await saveProductPrices(t.id, snapshot);
        await bumpListCache();
        restored = true;
      } catch (e) {
        fail(
          `empty-price-${t.role}-restore`,
          `${t.role} Genel fiyat geri yüklenemedi`,
          e
        );
      }
      void restored;
      await ctx.close().catch(() => {});
    }
  }
}

/**
 * @param {object} args
 */
async function runIkramPrivateProduct({
  browser,
  contextOpts,
  env,
  baseUrl,
  phone,
  amount,
  createAdminContext,
  pass,
  fail,
  skip,
}) {
  skip(
    'empty-price-list-ikram',
    'Ikram: private ürün listede görünmez; liste kontrolü Hedef’te. Coming soon/görünürlük ayarına dokunulmadı.'
  );

  let created = { id: 0, url: '', slug: '' };
  const ctx = createAdminContext
    ? await createAdminContext()
    : await browser.newContext(contextOpts);
  const page = await ctx.newPage();
  try {
    created = await createMarkedDonationProduct({
      title: 'WDP E2E Empty Price',
      min: '5',
    });
    if (!created.id) {
      throw new Error('İşaretli geçici ürün oluşmadı');
    }
    await bumpListCache();

    try {
      await emptyCart(page, baseUrl);
      const formRoot = await openIkramPrivateProductForm(page, baseUrl, created);
      await fillMinimalDonor(formRoot, amount, phone);
      const addBtn = formRoot.locator(SEL.addToCart).first();
      const cartRes = await clickAddToCartWithRetry(page, addBtn, {
        checkId: 'empty-price-ikram-private-cart',
      });
      if (!cartRes.ok) {
        throw new Error(`Sepete ekleme başarısız: ${cartRes.bodyPreview || ''}`);
      }
      const items = await cartItemsDetail(page, baseUrl);
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Sepet boş (private fiyatsız ürün)');
      }
      pass('empty-price-ikram-private-cart');
    } catch (e) {
      fail('empty-price-ikram-private-cart', 'Ikram private fiyatsız ürün sepete', e);
    }
  } catch (e) {
    fail('empty-price-ikram-create', 'Ikram işaretli geçici ürün oluşturma', e);
  } finally {
    if (created.id) {
      try {
        await deleteMarkedProduct(created.id);
      } catch (e) {
        fail(
          'empty-price-ikram-delete',
          'İşaretli geçici ürün silinemedi',
          e
        );
      }
    }
    await ctx.close().catch(() => {});
  }
}
