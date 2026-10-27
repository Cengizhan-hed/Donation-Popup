/**
 * Yeni nesil bağış formunu (src/Modules/Experiences) sürmek için ortak yardımcılar.
 * Yalnız eklentinin kendi öznitelikleri (`data-dp-*`, `name=`); tema/oluşturucu adı yok.
 *
 * Akış: tutar adımı (varsa) → "Devam" → bilgi adımı → "Bağış yap" (tek `[data-dp-submit]` düğmesi).
 * Sabit uyku yok; her bekleme öğe/olay bazlıdır.
 */
import { DP_SEL, SEL } from './selectors.mjs';
import { CHECK_MS } from './checks.mjs';
import { DONOR_NAME, DONOR_EMAIL, DONOR_PHONE, DEDICATION, SHAREHOLDERS } from './place-order.mjs';

/**
 * @param {import('@playwright/test').Locator} shell Kök, katman ya da form.
 * @returns {import('@playwright/test').Locator}
 */
export function formOf(shell) {
  return shell.locator(DP_SEL.form).first();
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
 * Bilgi adımı görünene kadar "Devam"a basar (adımlar tek sayfaysa bir şey yapmaz).
 * @param {import('@playwright/test').Locator} form
 * @param {number} [timeout]
 */
export async function advanceToDetails(form, timeout = CHECK_MS) {
  const details = form.locator(DP_SEL.detailsStep).first();
  if (await details.isVisible()) return;
  await form.locator(DP_SEL.submit).first().click({ timeout });
  try {
    await details.waitFor({ state: 'visible', timeout });
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
  if ((await amountStep.count()) > 0 && (await amountStep.isVisible())) {
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
  await formOf(shell).locator(DP_SEL.submit).first().click({ timeout, noWaitAfter: true });
}
