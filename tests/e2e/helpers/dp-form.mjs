/**
 * Yeni nesil bağış formunu (src/Modules/Experiences) sürmek için ortak yardımcılar.
 * Yalnız eklentinin kendi öznitelikleri (`data-dp-*`, `name=`); tema/oluşturucu adı yok.
 *
 * Akış: tutar adımı (varsa) → "Devam" → bilgi adımı → "Bağış yap" (tek `[data-dp-submit]` düğmesi).
 * Sabit uyku yok; her bekleme öğe/olay bazlıdır.
 */
import { DP_SEL, SEL } from './selectors.mjs';
import { CHECK_MS } from './checks.mjs';
import { dismissKeyboardWithin } from './keyboard-dismiss.mjs';
import { DONOR_NAME, DONOR_EMAIL, DONOR_PHONE, DEDICATION, SHAREHOLDERS } from './place-order.mjs';

/**
 * @param {import('@playwright/test').Locator} shell Kök, katman ya da form.
 * @returns {import('@playwright/test').Locator}
 */
export function formOf(shell) {
  return shell.locator(DP_SEL.form).first();
}

/**
 * Adım gösteriliyor mu: `hidden` özniteliğine bakar (DOM durumu). `isVisible()` açılış/adım geçiş animasyonunda
 * boyut sıfırken anlık `false` verip yarış yaratır; eylemler (fill/click) zaten görünürlüğü kendileri bekler.
 * @param {import('@playwright/test').Locator} step
 * @returns {Promise<boolean>}
 */
export async function isStepShown(step) {
  return (await step.count()) > 0 && (await step.first().evaluate((el) => !el.hidden));
}

/**
 * Ekran klavyesini kapatır ve alt bölümün geri gelmesini bekler (ayrıntı: keyboard-dismiss.mjs).
 * @param {import('@playwright/test').Locator|import('@playwright/test').Page} scope
 * @param {number} [timeout]
 */
export async function dismissKeyboard(scope, timeout = CHECK_MS) {
  await dismissKeyboardWithin(scope, timeout);
}

/**
 * Alt bölümdeki bir eylem düğmesine (Devam / Bağış yap / Sepete ekle) gerçek bağışçı gibi dokunur: önce klavye kapanır.
 * @param {import('@playwright/test').Locator} button
 * @param {{ timeout?: number, noWaitAfter?: boolean, force?: boolean }} [opts]
 */
export async function tapAction(button, opts = {}) {
  const timeout = opts.timeout ?? CHECK_MS;
  await dismissKeyboard(button, timeout);
  await button.click({ ...opts, timeout });
}

/**
 * Görsel olarak gizli (özel) onay kutusu / anahtar: koordinat tıklaması yanlış öğeye (ör. alt eylem çubuğu)
 * düşebildiği için DOM click() ile işaretlenir; `change` olayı normal yoldan tetiklenir.
 * @param {import('@playwright/test').Locator} input
 * @param {boolean} [on]
 */
export async function setChecked(input, on = true) {
  await input.evaluate((el, want) => {
    if (el.checked !== want) el.click();
  }, on);
}

/**
 * Tutar adımında geçerli bir tutar seçer (hazır tutar; yoksa serbest kutuya form minimumu ya da 25) ve
 * ana düğmenin etkinleşmesini bekler. Etkinleşmezse zaman aşımı hatası verir (gevşetme yok).
 * @param {import('@playwright/test').Locator} form
 * @param {number} [timeout]
 */
export async function selectAnyAmount(form, timeout = CHECK_MS) {
  const preset = form.locator(DP_SEL.preset).first();
  const custom = form.locator(DP_SEL.amount).first();
  if ((await preset.count()) > 0) {
    await preset.click({ timeout });
  } else if ((await custom.count()) > 0) {
    const min = Number.parseFloat((await form.getAttribute('data-min')) || '0');
    await custom.fill(String(min > 0 ? min : 25));
  }
  const submit = form.locator(DP_SEL.submit).first();
  const deadline = Date.now() + timeout;
  while ((await submit.getAttribute('aria-disabled')) === 'true') {
    if (Date.now() > deadline) throw new Error('tutar seçildi ama ana düğme etkinleşmedi');
    await form.page().waitForTimeout(100);
  }
}

/**
 * Gönderim hatasından sonra formun bulunduğu adımdan bilgi adımına döner. Gift Aid / vergi indirimi adımı
 * bilgiden SONRA geliyorsa form o adımda kalır; geri düğmesiyle (`[data-dp-back]`) bilgi adımına inilir.
 * @param {import('@playwright/test').Locator} form
 * @param {number} [timeout]
 * @returns {Promise<'details'|'locked-step'>} 'locked-step': bilgi adımına dönülemedi (geri düğmesi yok/gizli).
 */
export async function returnToDetails(form, timeout = CHECK_MS) {
  const details = form.locator(DP_SEL.detailsStep).first();
  const back = form.locator('[data-dp-back]').first();
  const deadline = Date.now() + timeout;
  while (!(await details.isVisible()) && Date.now() < deadline) {
    if ((await back.count()) > 0 && (await back.isVisible())) {
      await back.click({ timeout });
      await form.page().waitForTimeout(50);
    } else {
      break;
    }
  }
  if (await details.isVisible()) return 'details';
  // Geri düğmesi tutar adımında gizlenir: tutar adımındaysak ileri yolla bilgi adımına geç.
  const amountStep = form.locator('[data-dp-step="amount"]').first();
  if (await amountStep.isVisible()) {
    await advanceToDetails(form, timeout);
    return 'details';
  }
  return 'locked-step';
}

/**
 * Boş gönderim hazırlığı (serbest tutar alanı olmayan, hazır tutar kartlı form): tutar adımındaysak ana düğmenin
 * pasif (aria-disabled=true) olduğu doğrulanır (tıklanmaz), sonra tutar seçilip bilgi adımına geçilir.
 * Bilgi adımı zaten görünürse bir şey yapmaz.
 * @param {import('@playwright/test').Locator} form
 * @param {number} [timeout]
 */
export async function ensureDetailsStepForEmptySubmit(form, timeout = CHECK_MS) {
  const details = form.locator(DP_SEL.detailsStep).first();
  if (await isStepShown(details)) return;
  const pending = await form.locator(DP_SEL.submit).first().getAttribute('aria-disabled');
  if (pending !== 'true') throw new Error(`tutar adımında düğme pasif değil (aria-disabled=${pending})`);
  await advanceToDetails(form, timeout);
}

/**
 * Geçersiz/belirsiz tutarla pasif ana düğme: pasifliği doğrular (aria-disabled=true), `force` ile dokunur (gerçek
 * bağışçı dokunabilir; Playwright pasif düğmeye normal tıklamaz) ve görünür, boş olmayan tutar hatasını bekler.
 * Sepet isteği/yerel gönderim yokluğunu çağıran taraf kendi sondasıyla doğrular.
 * @param {import('@playwright/test').Locator} form
 * @param {number} [timeout]
 * @returns {Promise<string>} Görünen tutar hata metni.
 */
export async function touchPendingSubmitExpectAmountError(form, timeout = CHECK_MS) {
  const submit = form.locator(DP_SEL.submit).first();
  await submit.waitFor({ state: 'visible', timeout });
  const pending = await submit.getAttribute('aria-disabled');
  if (pending !== 'true') throw new Error(`geçersiz tutarda ana düğme pasif olmalıydı (aria-disabled=${pending})`);
  await tapAction(submit, { timeout, noWaitAfter: true, force: true });
  const err = form.locator(DP_SEL.error('amount')).filter({ visible: true }).first();
  await err.waitFor({ state: 'visible', timeout });
  const text = String((await err.textContent()) || '').trim();
  if (!text) throw new Error('tutar hata metni boş');
  return text;
}

/**
 * Bilgi adımı görünene kadar "Devam"a basar (adımlar tek sayfaysa bir şey yapmaz).
 * @param {import('@playwright/test').Locator} form
 * @param {number} [timeout]
 */
export async function advanceToDetails(form, timeout = CHECK_MS) {
  const details = form.locator(DP_SEL.detailsStep).first();
  if (await isStepShown(details)) {
    await details.waitFor({ state: 'visible', timeout });
    return;
  }
  // 12.1: tutar seçilmeden ana düğme pasif (aria-disabled); tıklamak zaman aşımına düşer. Önce tutar seç.
  const submitBtn = form.locator(DP_SEL.submit).first();
  if ((await submitBtn.getAttribute('aria-disabled')) === 'true') {
    await selectAnyAmount(form, timeout);
  }
  // Form zaten vergi adımında ve o adım bilgiden sonra ise: ana düğme formu gönderir; tıklamadan açık hata ver.
  const taxNow = form.locator('[data-dp-step="tax_relief"]').first();
  if (
    (await isStepShown(taxNow)) &&
    (await taxNow.evaluate((t, d) => !!d && !(t.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING), await details.elementHandle().catch(() => null)))
  ) {
    throw new Error('vergi indirimi adımı bilgi adımından sonra; ilerlemek formu gönderir');
  }
  await tapAction(submitBtn, { timeout });
  try {
    // Araya isteğe bağlı adım (vergi indirimi / Gift Aid) girebilir: kutu işaretlenmeden "Devam" ile geçilir.
    const taxStep = form.locator('[data-dp-step="tax_relief"]').first();
    const deadline = Date.now() + timeout;
    while (!(await isStepShown(details)) && Date.now() < deadline) {
      if ((await isStepShown(taxStep)) && (await taxStep.isVisible())) {
        // Yalnız vergi adımı bilgi adımından ÖNCE geliyorsa "Devam" güvenlidir; sonra geliyorsa ana düğme son adımda
        // formu gönderir (bilgi adımına geri dönülemez) → açık hata.
        const taxBeforeDetails = await taxStep.evaluate((t, d) => !!d && !!(t.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING), await details.elementHandle());
        if (!taxBeforeDetails) throw new Error('vergi indirimi adımı bilgi adımından sonra; ilerlemek formu gönderir');
        await tapAction(submitBtn, { timeout });
      } else {
        await form.page().waitForTimeout(100);
      }
    }
    await details.waitFor({ state: 'visible', timeout: Math.max(1000, deadline - Date.now()) });
  } catch (err) {
    // Teşhis: adım/alan durumu (değer yok, yalnız uzunluk) + görünür hata metinleri.
    const state = await form
      .evaluate((f) => ({
        mounted: (f.closest('[data-dp-exp]') || {}).dataset ? f.closest('[data-dp-exp]').dataset.dpMounted : null,
        amountLen: Array.from(f.querySelectorAll('[name="amount"]')).map((i) => String(i.value || '').length),
        steps: Array.from(f.querySelectorAll('[data-dp-step]')).map((x) => x.dataset.dpStep + (x.hidden ? ':hidden' : ':shown')),
        errors: Array.from(f.querySelectorAll('[data-dp-error]'))
          .map((e) => e.dataset.dpError + '=' + String(e.textContent || '').trim().slice(0, 60))
          .filter((x) => !x.endsWith('=')),
      }))
      .catch((e) => ({ diag: String(e && e.message ? e.message : e) }));
    throw new Error(`bilgi adımına geçilemedi: ${JSON.stringify(state)} — ${String(err && err.message ? err.message : err).split('\n')[0]}`);
  }
}

/**
 * Tutar adımı: özel tutar kutusu varsa yazılır, yoksa ilk önerilen tutar seçilir.
 * @param {import('@playwright/test').Locator} form
 * @param {string|number} [fill] Kutuya yazılacak metin.
 * @param {number} [timeout]
 */
export async function fillAmountStep(form, fill, timeout = CHECK_MS) {
  const custom = form.locator(DP_SEL.amount).first();
  if ((await custom.count()) > 0 && fill != null && String(fill) !== '') {
    await custom.waitFor({ state: 'visible', timeout });
    await custom.fill(String(fill));
    return;
  }
  const preset = form.locator(DP_SEL.preset).first();
  if ((await preset.count()) > 0) await preset.click({ timeout });
}

/**
 * Bilgi adımındaki bağışçı alanları (yalnız formda olanlar doldurulur).
 * @param {import('@playwright/test').Locator} form
 * @param {{ name?: string, phone?: string, email?: string, dedication?: string, anonymous?: boolean }} [vals]
 */
export async function fillDonorDetails(form, vals = {}) {
  const name = form.locator(SEL.donorName).first();
  if ((await name.count()) > 0) {
    await name.waitFor({ state: 'visible', timeout: CHECK_MS });
    await name.fill(vals.name || DONOR_NAME);
  }
  const phone = form.locator(SEL.donorPhone).first();
  if ((await phone.count()) > 0 && (await phone.isVisible())) await phone.fill(vals.phone || DONOR_PHONE);
  const email = form.locator(SEL.donorEmail).first();
  if ((await email.count()) > 0 && (await email.isVisible())) await email.fill(vals.email || DONOR_EMAIL);
  const ded = form.locator('input[name="donation_dedication"]').first();
  if ((await ded.count()) > 0 && (await ded.isVisible()) && !(await ded.inputValue())) {
    await ded.fill(vals.dedication || DEDICATION);
  }
  if (vals.anonymous) {
    const anon = form.locator('input[name="donation_anonymous"]').first();
    if ((await anon.count()) > 0) await setChecked(anon, true);
  }
}

/**
 * Hisseli form: hisse sayısını artır, her hissedar satırını doldur (adım: bilgiler).
 * @param {import('@playwright/test').Locator} form
 * @param {Array<{ name: string, phone: string }>} [holders]
 */
export async function fillShareholders(form, holders = SHAREHOLDERS.slice(0, 2)) {
  const plus = form.locator(SEL.shareIncrease).first();
  await plus.waitFor({ state: 'visible', timeout: CHECK_MS });
  for (let i = 1; i < holders.length; i += 1) {
    await plus.click({ timeout: CHECK_MS });
  }
  await advanceToDetails(form);
  for (let i = 0; i < holders.length; i += 1) {
    const n = i + 1;
    const nameInput = form.locator(`input[name="shareholder_${n}_name"]`).first();
    await nameInput.waitFor({ state: 'visible', timeout: CHECK_MS });
    await nameInput.fill(holders[i].name);
    const phone = form.locator(`input[name="shareholder_${n}_phone"]`).first();
    if ((await phone.count()) > 0 && (await phone.isVisible())) await phone.fill(holders[i].phone);
  }
}

/**
 * Formu bağışçı adımına kadar eksiksiz doldurur (gönderim yapmaz).
 * @param {import('@playwright/test').Locator} shell Kök, katman ya da form.
 * @param {{ kind: 'custom'|'shares'|'campaign'|'fixed', fill?: string|number, donor?: object, holders?: Array<{name:string,phone:string}> }} spec
 */
export async function fillDonationForm(shell, spec) {
  const form = formOf(shell);
  await form.waitFor({ state: 'visible', timeout: CHECK_MS });
  if (spec.kind === 'shares') {
    await fillShareholders(form, spec.holders);
    return;
  }
  const amountStep = form.locator('[data-dp-step="amount"]').first();
  if (await isStepShown(amountStep)) {
    await fillAmountStep(form, spec.fill);
    const toggle = form.locator(DP_SEL.dediToggle).first();
    if ((await toggle.count()) > 0) {
      await setChecked(toggle, true);
      await form.locator('input[name="donation_dedication"]').first().fill((spec.donor && spec.donor.dedication) || DEDICATION);
    }
  }
  await advanceToDetails(form);
  await fillDonorDetails(form, { anonymous: true, ...(spec.donor || {}) });
}

/**
 * Açık adımda ana düğmeye basar (son adımdaysa sepete ekler ve ödemeye yönlendirir).
 * @param {import('@playwright/test').Locator} shell
 * @param {number} [timeout]
 */
export async function clickSubmit(shell, timeout = CHECK_MS) {
  const form = formOf(shell);
  await advanceToFinalStep(form, timeout);
  await tapAction(form.locator(DP_SEL.submit).first(), { timeout, noWaitAfter: true });
}

/**
 * Son adıma kadar "Devam"a basar. Adım sayısı ayara/ürüne göre 2 ya da 3 olabilir (ör. ek bilgi/özet adımı);
 * son adımda "sepete ekle" düğmesi (`[data-dp-addcart]`) görünür olur. Doğrulama hatası adımı ilerletmezse döngü
 * durur (çağıran taraf hatayı kendi kontrolüyle görür).
 * @param {import('@playwright/test').Locator} form
 * @param {number} [timeout]
 */
export async function advanceToFinalStep(form, timeout = CHECK_MS) {
  const signature = () =>
    form.evaluate((f) => {
      const add = f.querySelector('[data-dp-addcart]');
      return {
        last: Boolean(add) && !add.hidden,
        sig: Array.from(f.querySelectorAll('[data-dp-step]'))
          .map((s) => (s.hidden ? '0' : '1'))
          .join(''),
      };
    });
  for (let i = 0; i < 5; i += 1) {
    const before = await signature();
    if (before.last) return;
    await tapAction(form.locator(DP_SEL.submit).first(), { timeout, noWaitAfter: true });
    const deadline = Date.now() + 4000;
    let after = before;
    while (Date.now() < deadline) {
      after = await signature();
      if (after.last || after.sig !== before.sig) break;
      await form.page().waitForTimeout(100);
    }
    if (!after.last && after.sig === before.sig) return;
  }
}

/**
 * Aday öğeler arasından ilk GÖRÜNÜR olanı, sayfa/oluşturucu hazır olana dek bekleyerek çözer (anlık kontrol yok).
 * Zaman aşımında aday sayısı + her adayın neden gizli olduğu `detail` içinde döner.
 * @param {import('@playwright/test').Locator} candidates
 * @param {number} [timeout]
 * @returns {Promise<{ locator: import('@playwright/test').Locator|null, total: number, detail: string }>}
 */
/**
 * Görünmeyen tetikleyici teşhisi (yalnız yapı/ölçü; kimlik, çerez, değer yok): sayfa adresi, başlık, tüm `[data-dp-open]`
 * sayısı, ilk adayın body'ye kadar ata zinciri (tag.class, display, visibility, getBoundingClientRect).
 * @param {import('@playwright/test').Locator} candidates
 * @returns {Promise<object>}
 */
export async function collectHiddenTriggerDump(candidates) {
  const page = candidates.page();
  return page
    .evaluate(() => {
      const label = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '');
      const box = (el) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      };
      const all = Array.from(document.querySelectorAll('[data-dp-open]'));
      const first = all[0] || null;
      const chain = [];
      for (let el = first; el; el = el.parentElement) {
        const cs = getComputedStyle(el);
        chain.push({ el: label(el), display: cs.display, visibility: cs.visibility, opacity: cs.opacity, hidden: !!el.hidden, rect: box(el) });
        if (el === document.body) break;
      }
      // Sekme/panel bilgisi (yalnız standart ARIA): ilk adayın atalarındaki id/rol/aria-labelledby + bağlı sekme.
      const tabs = [];
      for (let el = first; el; el = el.parentElement) {
        const id = el.id || '';
        const role = el.getAttribute('role') || '';
        const lb = el.getAttribute('aria-labelledby') || '';
        if (role === 'tabpanel' || id || lb) {
          let tab = null;
          if (id) {
            for (const t of document.querySelectorAll('[role="tab"][aria-controls]')) {
              if (t.getAttribute('aria-controls') === id) { tab = t; break; }
            }
          }
          tabs.push({ el: label(el), id: id.slice(0, 60), role, labelledby: lb.slice(0, 60), tabFound: !!tab, tabSelected: tab ? tab.getAttribute('aria-selected') : null });
        }
        if (el === document.body) break;
      }
      return { url: location.href, title: document.title, openCountAll: all.length, chain, tabs: tabs.slice(0, 8) };
    })
    .catch((e) => ({ diag: String(e && e.message ? e.message : e).split('\n')[0] }));
}

/**
 * Aday gizliyse, atalarındaki standart ARIA sekme panelini (id'si bir `[role=tab][aria-controls]` tarafından gösterilen
 * ata; ya da `role=tabpanel` + `aria-labelledby` ile bağlı sekme) açan sekmeyi tıklar. ARIA yoksa hiçbir şey yapmaz
 * (`href="#id"` / `data-toggle` GEÇERSİZ). Tema/oluşturucu adı ya da sınıfı kullanılmaz.
 * @param {import('@playwright/test').Locator} candidate
 * @returns {Promise<boolean>} bir sekme tıklandıysa true
 */
export async function activateAriaTabFor(candidate) {
  const page = candidate.page();
  const marked = await candidate
    .evaluate((el) => {
      document.querySelectorAll('[data-dp-tab-probe]').forEach((n) => n.removeAttribute('data-dp-tab-probe'));
      for (let a = el.parentElement; a; a = a.parentElement) {
        let tab = null;
        if (a.id) {
          for (const t of document.querySelectorAll('[role="tab"][aria-controls]')) {
            if (t.getAttribute('aria-controls') === a.id) { tab = t; break; }
          }
        }
        const lb = a.getAttribute('aria-labelledby');
        if (!tab && a.getAttribute('role') === 'tabpanel' && lb) {
          for (const id of lb.split(/\s+/)) {
            const t = id ? document.getElementById(id) : null;
            if (t && t.getAttribute('role') === 'tab') { tab = t; break; }
          }
        }
        if (tab) {
          tab.setAttribute('data-dp-tab-probe', '1');
          return true;
        }
      }
      return false;
    })
    .catch(() => false);
  if (!marked) return false;
  try {
    await page.locator('[data-dp-tab-probe]').first().click({ timeout: 2000 });
    return true;
  } catch (e) {
    return false;
  } finally {
    await page.evaluate(() => document.querySelectorAll('[data-dp-tab-probe]').forEach((n) => n.removeAttribute('data-dp-tab-probe'))).catch(() => {});
  }
}

export async function waitForVisibleCandidate(candidates, timeout = CHECK_MS) {
  const deadline = Date.now() + timeout;
  let total = 0;
  let tabTried = false;
  let scrollTried = false;
  for (;;) {
    total = await candidates.count();
    for (let i = 0; i < total; i += 1) {
      if (await candidates.nth(i).isVisible()) return { locator: candidates.nth(i), total, detail: '' };
    }
    // Ekran dışı içerik render atlanıyorsa (content-visibility vb.) kutu 0x0 kalır: JS ile kaydır (Playwright
    // scrollIntoViewIfNeeded görünmez öğede bekler), bir rAF bekle, yeniden dene.
    if (!scrollTried && total > 0) {
      scrollTried = true;
      for (let i = 0; i < Math.min(total, 6); i += 1) {
        const ok = await candidates
          .nth(i)
          .evaluate(
            (el) =>
              new Promise((resolve) => {
                el.scrollIntoView({ block: 'center' });
                requestAnimationFrame(() => resolve(true));
              })
          )
          .catch(() => false);
        if (ok && (await candidates.nth(i).isVisible())) return { locator: candidates.nth(i), total, detail: '' };
      }
    }
    if (!tabTried && total > 0) {
      tabTried = true;
      for (let i = 0; i < Math.min(total, 6); i += 1) {
        if (await activateAriaTabFor(candidates.nth(i))) {
          await candidates.page().waitForTimeout(150);
          if (await candidates.nth(i).isVisible()) return { locator: candidates.nth(i), total, detail: '' };
        }
      }
    }
    if (Date.now() > deadline) break;
    await candidates.page().waitForTimeout(100);
  }
  const reasons = [];
  for (let i = 0; i < Math.min(total, 6); i += 1) {
    const why = await candidates
      .nth(i)
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        let hiddenBy = '';
        for (let a = el.parentElement; a; a = a.parentElement) {
          const s = getComputedStyle(a);
          if (s.display === 'none' || s.visibility === 'hidden' || a.hidden) {
            hiddenBy = (a.tagName || '').toLowerCase() + (a.className ? '.' + String(a.className).split(' ')[0] : '');
            break;
          }
        }
        return `display=${cs.display} visibility=${cs.visibility} size=${Math.round(r.width)}x${Math.round(r.height)} ata=${hiddenBy || '-'}`;
      })
      .catch((e) => 'okunamadı:' + String(e && e.message ? e.message : e).split('\n')[0]);
    reasons.push(`#${i}[${why}]`);
  }
  return { locator: null, total, detail: total === 0 ? 'aday yok' : `adaylar=${total} hepsi gizli ${reasons.join(' ')}` };
}
