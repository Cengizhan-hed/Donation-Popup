/**
 * 12.4 mail: yerel sipariş denemesi sonrası WooCommerce e-postaları Mailpit'e düşer; içerik ve görünüm denetlenir.
 * YALNIZ yerel WP + Mailpit: `npm run e2e:queue -- node tests/e2e/run-mail.mjs [--project desktop] [--checkout blocks]`.
 *
 * Denetim: yönetici + müşteri e-postası gelir; konu/alıcı/gövdede bağışçı adı Türkçe karakterlerle bozulmadan;
 * tutar + para birimi; bağış kalemi; HTML'de kırık kodlama/ham yer tutucu yok; ≤800 px ekran görüntüsü (yollar RAPOR'a).
 */
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { completeLocalCheckout } from '../helpers/place-order.mjs';
import { clearMailboxTo, deleteByIds, waitForMessagesTo, searchTo, recipients, htmlViewUrl } from '../helpers/mailpit.mjs';

const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const CHECKOUT = process.env.WDP_EXP_CHECKOUT === 'blocks' ? 'blocks' : 'classic';
const STORE = JSON.parse(process.env.WDP_EXP_STORE || '{}');
const WP_DIR = process.env.WDP_LOCAL_WP_DIR || '';
const CHECKOUT_URL = /checkout|odeme|ödeme/i;
const RUN_ID = process.env.WDP_MAIL_RUN_ID || 'local';
const ADMIN_EMAIL = `admin.${RUN_ID}@wdp-e2e.test`;
const CUSTOM_TPL = process.env.WDP_MAIL_CUSTOMTPL === '1';
/** Test yalıtımı: alıcı adresi koşu kimliği + test adı + cihaz ile benzersiz; yalnız bu adrese bakılır. */
const donorFor = (testTitle, device) => {
  const slug = `${testTitle}`.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12);
  return { name: 'Çağlar Şükrü Öztürk İğdır', phone: '+44 7700 900123', note: 'Ğüşiöç ĞÜŞİÖÇ notu', email: `donor.${RUN_ID}.${slug}.${String(device).replace(/[^a-z0-9]/gi, '').toLowerCase()}@wdp-e2e.test` };
};
/** Satır içi stil karşılaştırması: Woo CSS satır içine alıcı boşlukları değiştirebilir. */
const squash = (s) => String(s).replace(/\s*([:;,])\s*/g, '$1').replace(/;"/g, '"');
const AMOUNT = '125';
const SHOT_DIR = path.resolve(process.cwd(), process.env.WDP_MAIL_SHOT_DIR || 'build/handoff/RAPOR-124-email3');

const LOCALE = process.env.WDP_MAIL_LOCALE === 'tr_TR' ? 'tr_TR' : 'en_US';
const BLOCK_EMAIL = process.env.WDP_MAIL_BLOCKEMAIL === '1';
const ONHOLD =process.env.WDP_MAIL_ONHOLD === '1';
const THANKS_ON = process.env.WDP_MAIL_THANKS !== '0' && !ONHOLD;
const THANKS_MESSAGE = 'Allah kabul etsin, bağışınız için çok teşekkürler: çğüşiö ÇĞÜŞİÖ.';
const LABEL_IDS = { name: 'Donor name', phone: 'Donor phone', note: 'Donation note', type: 'Donation type' };

/** Türkçe karşılık: languages/woo-donation-popup-tr_TR.po (birleşik) ya da languages/parts/email.po. */
function trMsg(msgid) {
  const files = ['languages/woo-donation-popup-tr_TR.po', 'languages/parts/email.po'];
  for (const f of files) {
    const file = path.resolve(process.cwd(), f);
    if (!fs.existsSync(file)) continue;
    const po = fs.readFileSync(file, 'utf8');
    const esc = msgid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/"/g, '\\"');
    const m = po.match(new RegExp(`msgid "${esc}"\\nmsgstr "(.*)"`));
    if (m && m[1]) return m[1];
  }
  return msgid;
}
// Dil kuralı (WooCommerce): müşteri e-postası SİTE diline geçer (wc_switch_to_site_locale); yönetici e-postası geçerli dilde gider.
// Yerel kalıp WP determine_locale'i tr_TR'ye kilitler (mu-plugin wdp-i18n-locale) = "yönetici dili"; site dili --locale ile verilir.
const localeFor = (who) => (who === 'musteri' ? LOCALE : 'tr_TR');
const L = (k, who = 'musteri') => (localeFor(who) === 'tr_TR' ? trMsg(LABEL_IDS[k]) : LABEL_IDS[k]);
const OTHER = (k, who = 'musteri') => (localeFor(who) === 'tr_TR' ? LABEL_IDS[k] : trMsg(LABEL_IDS[k]));
const count = (hay, needle) => hay.split(needle).length - 1;

/** Yalnız yerel çalışır: uzak taban adres reddedilir. */
function assertLocal(baseURL) {
  expect(String(baseURL || '')).toMatch(/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?/);
}

/** @param {import('@playwright/test').Page} page */
async function donate(page, DONOR) {
  await page.goto(`/?dp_e6_test=form&dp_product=${PRODUCT}`);
  await expect(page.locator('[data-dp-form]')).toBeVisible({ timeout: 20000 });
  await page.locator('input[name="amount"]').fill(AMOUNT);
  await page.locator('[data-dp-submit]').click();
  await expect(page.locator('[data-dp-step="details"]')).toBeVisible();
  await page.locator('input[name="donation_full_name"]').fill(DONOR.name);
  await page.locator('input[name="donation_phone"]').fill(DONOR.phone);
  await page.locator('[data-dp-note-toggle]').click();
  await page.locator('textarea[name="donation_note"]').fill(DONOR.note);
  await page.locator('[data-dp-submit]').click();
  const tax = page.locator('[data-dp-step="tax_relief"]');
  if (await tax.isVisible()) {
    await page.locator('[data-dp-submit]').click();
  }
  await page.waitForURL(CHECKOUT_URL, { timeout: 30000 });
  const { orderId } = await completeLocalCheckout(page, {
    store: STORE,
    checkoutKind: CHECKOUT,
    wpDir: WP_DIR,
    donor: { name: DONOR.name, email: DONOR.email, phone: DONOR.phone },
    expected: { donorName: DONOR.name, donorPhone: DONOR.phone, amount: AMOUNT, hpos: true },
  });
  await page.waitForURL(/order-received|key=wc_order/i);
  return orderId;
}

test.describe('e-posta içeriği ve görünümü (Mailpit)', () => {
  test('sipariş: yönetici + müşteri e-postası, Türkçe karakter, tutar, kırık içerik yok', async ({ page, baseURL, browser }, info) => {
    test.setTimeout(240000);
    assertLocal(baseURL);
    const DONOR = donorFor(info.title, info.project.name);
    // Yalıtım: yalnız kendi adresimizin eski iletileri silinir; ortak kutuya dokunulmaz.
    await clearMailboxTo(DONOR.email);
    const orderId = await donate(page, DONOR);
    // Yalnız bu teste gelenler: müşteri adresi + (koşuya özgü yönetici adresinde bu bağışçının siparişi).
    const toDonor = await waitForMessagesTo(DONOR.email, { min: 1 });
    const toAdmin = await waitForMessagesTo(ADMIN_EMAIL, { min: 1, filter: (m) => String(m.Text || '').includes(DONOR.email) });
    const messages = [...toDonor, ...toAdmin];
    expect((await searchTo(DONOR.email)).length, 'müşteri adresinde yalnız kendi iletilerimiz').toBe(toDonor.length);
    expect(toDonor.length, 'müşteriye e-posta').toBeGreaterThanOrEqual(1);
    expect(toAdmin.length, 'yöneticiye e-posta').toBeGreaterThanOrEqual(1);

    const report = [];
    const themedSections = [];
    for (const m of messages) {
      const html = String(m.HTML || '');
      const text = String(m.Text || '');
      const subject = String(m.Subject || '');
      const who = recipients(m).includes(DONOR.email) ? 'musteri' : 'yonetici';
      fs.mkdirSync(SHOT_DIR, { recursive: true });
      fs.writeFileSync(path.join(SHOT_DIR, `mail-${CHECKOUT}-${info.project.name}-${who}.txt`), `Subject: ${subject}\nTo: ${recipients(m).join(',')}\n\n${text}`);
      report.push({ who, subject, htmlBytes: html.length, hasName: text.includes(DONOR.name) || html.includes('Çağlar') });

      expect(subject, 'konu bozuk kodlama').not.toMatch(/�|=\?UTF-8|Ã.|Ä.|Å./);
      expect(html, `${who} HTML kırık kodlama`).not.toMatch(/�|Ã§|Ã¶|Ã¼|Ä±|Ä°|ÅŸ|Å\u009f|ÄŸ/);
      expect(text, `${who} metin kırık kodlama`).not.toMatch(/�/);
      // Ham yer tutucu / PHP uyarısı sızmamalı.
      expect(html + text, `${who} ham yer tutucu`).not.toMatch(/\{(site_title|order_number|order_date|customer_name)\}|Warning:|Notice:|Fatal error|Deprecated:/);
      // Tutar (125) ve bağış kalemi var.
      expect(text, `${who} tutar`).toMatch(/125/);
      expect(text, `${who} sipariş no`).toContain(String(orderId));
      // Yazılan alanlar maskelenmemiş.
      expect(text, `${who} bağışçı adı`).toContain('Çağlar Şükrü Öztürk İğdır'.split(' ')[0]);
      // Veri bütünlüğü: bağış kalemi alanları (ad, telefon, not) e-postada eksiksiz ve Türkçe karakterleri bozulmadan.
      expect(text, `${who} kalem: ad`).toContain(DONOR.name);
      expect(text, `${who} kalem: not`).toContain(DONOR.note);
      expect(html, `${who} HTML kalem: not`).toContain(DONOR.note);

      // 12.4: teknik/dahili meta hiçbir e-postada yok.
      expect(html + text, `${who} teknik meta`).not.toMatch(/wdp_[a-z_]+|donation_panel_|_custom_price|_wdp_/);
      // 12.4: etiketler e-postanın diliyle; diğer dilin etiketi kalmaz.
      for (const k of ['name', 'note', 'type']) {
        expect(text, `${who} etiket ${k} (${localeFor(who)})`).toContain(L(k, who));
        if (OTHER(k, who) !== L(k, who)) expect(text, `${who} yanlış dil etiketi ${k}`).not.toContain(OTHER(k, who));
      }
      // 12.4: telefon kalemi yalnız yönetici e-postasında.
      if (who === 'musteri') {
        expect(text, 'müşteri: telefon kalem etiketi yok').not.toContain(L('phone'));
        expect(html, 'müşteri HTML: telefon kalem etiketi yok').not.toContain(L('phone'));
      } else {
        expect(text, 'yönetici: telefon kalem etiketi var').toContain(L('phone', 'yonetici'));
        expect(text, 'yönetici: telefon değeri var').toContain(DONOR.phone);
      }
      // 12.4: teşekkür bölümü yalnız müşteri e-postasında ve sipariş tablosunun üstünde.
      const thanksAt = text.indexOf(THANKS_MESSAGE);
      if (who === 'musteri' && THANKS_ON) {
        expect(thanksAt, 'müşteri: teşekkür metni').toBeGreaterThan(-1);
        expect(html, 'müşteri HTML: teşekkür metni').toContain(THANKS_MESSAGE);
        expect(thanksAt, 'teşekkür sipariş tablosundan önce').toBeLessThan(text.indexOf(L('type')));
        // 12.4 email3: bölüm e-posta uyumlu tablo + SATIR İÇİ stil; klasik ve blok düzenleyicide AYNI yapı/renk/boşluk.
        const at = html.indexOf(THANKS_MESSAGE.slice(0, 12));
        const start = html.lastIndexOf('<table', at);
        const section = squash(html.slice(start, html.indexOf('</table>', at) + 8));
        expect(section, 'teşekkür: tablo yapısı').toMatch(/^<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;border-collapse:collapse"><tr><td style="padding:16px 20px;background-color:#[0-9a-f]{6};border-left:4px solid #[0-9a-f]{6};color:#[0-9a-f]{6};font-family:inherit;font-size:15px;line-height:1.5;text-align:left"><p style="margin:0 0 12px;padding:0;color:#[0-9a-f]{6};font-family:inherit;font-size:15px;line-height:1.5">/);
        expect(section, 'teşekkür: dış CSS/görsel yok').not.toMatch(/<img|<link|<style|class="/);
        expect(section, 'teşekkür: kampanya satırı aynı bölümde').toMatch(/5[.,]000/);
        themedSections.push(section.replace(THANKS_MESSAGE, '{M}'));
        if (BLOCK_EMAIL) expect(html, 'blok düzenleyici: yerleşim bloğu içinde').toContain('email-block-layout');
        if (BLOCK_EMAIL && CUSTOM_TPL) expect(html, 'özel şablon: yayımlanmış şablon işlenmiş').toContain('WDP-CUSTOM-TEMPLATE-MARK');
        else expect(html, 'varsayılan şablonda özel işaret yok').not.toContain('WDP-CUSTOM-TEMPLATE-MARK');
        expect(html, 'teşekkür: görsel yok').not.toMatch(/<img[^>]*>\s*<p[^>]*>Allah/);
        expect(text, 'kampanya satırı: hedef').toMatch(/5[.,]000/);
        expect(text, 'kampanya satırı (dil)').toMatch(LOCALE === 'tr_TR' ? /hedef|toplanan/i : /raised of/);
      } else {
        if (who === 'musteri' && ONHOLD) {
          // Beklemede: teşekkür/kampanya satırı yok; WooCommerce'in kendi içeriği bozulmamış (beklemede ifadesi, sipariş tablosu).
          expect(text, 'beklemede: kampanya satırı yok').not.toMatch(/raised of|hedefin|5[.,]000/);
          expect(text, 'beklemede: Woo beklemede metni').toMatch(/on-hold|on hold|beklemede|bekleme/i);
          expect(text, 'beklemede: sipariş tablosu bozulmamış').toContain(L('type'));
        }
        expect(thanksAt, `${who}: teşekkür metni olmamalı`).toBe(-1);
        expect(html, `${who} HTML: teşekkür metni olmamalı`).not.toContain(THANKS_MESSAGE);
      }
    }
    // Veri bütünlüğü: telefon değeri müşteri e-postasında yalnız Woo fatura bölümünden gelir (kalem + fatura = yönetici'de fazla).
    expect(count(String(toAdmin[0].Text || ''), DONOR.phone), 'yönetici e-postasında kalem telefonu fazladan').toBeGreaterThan(count(String(toDonor[0].Text || ''), DONOR.phone));
    const adminText = String(toAdmin[0].Text || '');
    expect(adminText, 'yönetici e-postası ad+soyad').toMatch(/Çağlar Şükrü/);
    expect(adminText, 'yönetici e-postası soyad').toMatch(/İğdır/);
    // Para birimi simgesi ya da kodu tutarın yanında.
    expect(adminText).toMatch(/[£€$₺]\s?125|125(?:[.,]00)?\s?(?:[£€$₺]|GBP|EUR|USD|TRY)/);

    // Ekran görüntüsü (≤800 px): Mailpit HTML önizlemesi.
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: info.project.name === 'desktop' ? 800 : 390, height: 900 } });
    const shotPage = await ctx.newPage();
    const paths = [];
    for (const m of [toDonor[0], toAdmin[0]]) {
      const who = recipients(m).includes(DONOR.email) ? 'musteri' : 'yonetici';
      await shotPage.goto(htmlViewUrl(m.ID));
      const file = path.join(SHOT_DIR, `mail-${CHECKOUT}-${info.project.name}-${who}.png`);
      await shotPage.screenshot({ path: file, fullPage: true });
      const width = await shotPage.evaluate(() => document.documentElement.scrollWidth);
      expect(width, `${who} e-posta yatay taşma`).toBeLessThanOrEqual((info.project.name === 'desktop' ? 800 : 390) + 2);
      paths.push(file);
    }
    await ctx.close();
    fs.writeFileSync(path.join(SHOT_DIR, `mail-${CHECKOUT}-${info.project.name}.json`), JSON.stringify({ report, paths, themedSections }, null, 2));
    // Yalnız kendi iletilerimizi sil (kimlik + adres araması); ortak kutuya dokunulmaz.
    await deleteByIds(messages.map((m) => m.ID));
    await clearMailboxTo(DONOR.email);
  });
});
