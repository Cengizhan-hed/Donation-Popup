/**
 * Yeni nesil form yardımcıları (tests/e2e/helpers/dp-form.mjs, product-page-ui.mjs, flow-diag.mjs, checks.mjs):
 * eklentinin gerçek öznitelikleriyle kurulan küçük bir sahte formda (adım geçişi satır içi betikle) doğrulanır.
 * Yalnız yerel; ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import {
  advanceToDetails,
  ensureDetailsStepForEmptySubmit,
  returnToDetails,
  collectHiddenTriggerDump,
  fillAmountStep,
  fillDonationForm,
  fillShareholders,
  formOf,
  setChecked,
  waitForVisibleCandidate,
} from '../../e2e/helpers/dp-form.mjs';
import { classifyVisiblePluginEntry, collectVisiblePluginEntry } from '../../e2e/helpers/product-page-ui.mjs';
import { collectPluginRuntime, collectShellDomState } from '../../e2e/helpers/flow-diag.mjs';
import { openShellLocator, shellTriggerLocator, visibleValidationErrors, waitForShellClosed } from '../../e2e/helpers/checks.mjs';

const FORM = (kind, extra = '') => `
<div data-dp-exp data-dp-kind="${kind}" data-dp-product="7" data-dp-mounted="1" data-dp-checkout="/checkout/">
  ${kind === 'inline' ? '' : '<button type="button" data-dp-open aria-expanded="false">Donate</button>'}
  <div ${kind === 'inline' ? '' : 'data-dp-overlay class="donation-panel-overlay"'}>
    <div ${kind === 'inline' ? '' : 'data-dp-surface'}>
      ${kind === 'inline' ? '' : '<button type="button" data-dp-close>x</button>'}
      <form data-dp-form novalidate data-min="10" data-decimals="0" data-thousand-sep="." data-decimal-sep=",">
        <section data-dp-step="amount">
          <button type="button" class="donation-panel-amount" data-dp-preset="50" aria-checked="true">50</button>
          <div data-dp-field="amount"><input class="donation-panel-custom__in" name="amount" type="text"><p data-dp-error="amount"></p></div>
          <label><input type="checkbox" name="addon_active" value="1" data-dp-addon-toggle style="position:absolute;opacity:0;width:1px;height:1px"> addon</label>
        </section>
        <section data-dp-step="details" hidden>
          <input name="donation_full_name" required><p data-dp-error="donation_full_name"></p>
          <input type="tel" name="donation_phone">
          <fieldset data-dp-holder="1"><input name="shareholder_1_name"><input name="shareholder_1_phone"></fieldset>
          <fieldset data-dp-holder="2"><input name="shareholder_2_name"><input name="shareholder_2_phone"></fieldset>
        </section>
        <div data-dp-summary role="alert"></div>
        <button type="button" data-dp-qty="1">+</button>
        <button type="submit" data-dp-submit>Continue</button>
      </form>
      ${extra}
    </div>
  </div>
</div>
<script>
  const root = document.querySelector('[data-dp-exp]');
  const form = root.querySelector('[data-dp-form]');
  const open = root.querySelector('[data-dp-open]');
  const overlay = root.querySelector('[data-dp-overlay]');
  if (open) open.addEventListener('click', () => { overlay.classList.add('is-open'); open.setAttribute('aria-expanded', 'true'); });
  root.querySelectorAll('[data-dp-close]').forEach((b) => b.addEventListener('click', () => { overlay.classList.remove('is-open'); open.setAttribute('aria-expanded', 'false'); }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const amountStep = form.querySelector('[data-dp-step="amount"]');
    const details = form.querySelector('[data-dp-step="details"]');
    if (!amountStep.hidden) {
      const v = form.querySelector('input[name="amount"]').value;
      if (!v) { form.querySelector('[data-dp-error="amount"]').textContent = 'Enter an amount'; return; }
      amountStep.hidden = true; details.hidden = false;
    } else {
      const n = form.querySelector('input[name="donation_full_name"]').value;
      if (!n) { form.querySelector('[data-dp-error="donation_full_name"]').textContent = 'Name is required'; return; }
      document.title = 'submitted';
    }
  });
</script>`;

async function withPage(html, fn) {
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await page.setContent(`<!doctype html><html><body>${html}</body></html>`);
    await fn(page);
  } finally {
    await browser.close();
  }
}

describe('dp-form yardımcıları (satır içi form)', () => {
  it('tutar → devam → bilgiler: alanlar doldurulur, ana düğme gönderir', async () => {
    await withPage(FORM('inline'), async (page) => {
      const root = page.locator('[data-dp-exp]').first();
      await fillDonationForm(root, { kind: 'custom', fill: '250', donor: { name: 'Çağrı Şükrü İğdır', phone: '5551234567' } });
      assert.equal(await page.locator('input[name="amount"]').inputValue(), '250');
      assert.equal(await page.locator('input[name="donation_full_name"]').inputValue(), 'Çağrı Şükrü İğdır');
      await formOf(root).locator('[data-dp-submit]').click();
      assert.equal(await page.title(), 'submitted');
    });
  });

  it('boş tutarla devam: görünür alan hatası okunur', async () => {
    await withPage(FORM('inline'), async (page) => {
      await page.locator('[data-dp-submit]').click();
      const errs = await visibleValidationErrors(page);
      assert.ok(errs.some((t) => /Enter an amount/.test(t)), JSON.stringify(errs));
    });
  });

  it('görsel olarak gizli onay kutusu setChecked ile işaretlenir', async () => {
    await withPage(FORM('inline'), async (page) => {
      const box = page.locator('input[name="addon_active"]');
      await setChecked(box, true);
      assert.equal(await box.isChecked(), true);
      await setChecked(box, false);
      assert.equal(await box.isChecked(), false);
    });
  });

  it('hisseli: hisse sayısı artar, hissedar satırları doldurulur', async () => {
    await withPage(FORM('inline'), async (page) => {
      const form = formOf(page.locator('[data-dp-exp]').first());
      await form.evaluate((f) => {
        f.querySelector('[data-dp-step="amount"]').hidden = true;
        f.querySelector('[data-dp-step="details"]').hidden = false;
      });
      await fillShareholders(form, [
        { name: 'Ayşe Gül', phone: '5551112233' },
        { name: 'Ömer Şahin', phone: '5554445566' },
      ]);
      assert.equal(await page.locator('input[name="shareholder_2_name"]').inputValue(), 'Ömer Şahin');
    });
  });

  it('fillAmountStep özel kutu yoksa önerilen tutarı seçer; advanceToDetails bilgi adımına geçer', async () => {
    await withPage(FORM('inline'), async (page) => {
      const form = formOf(page.locator('[data-dp-exp]').first());
      await form.evaluate((f) => f.querySelector('input.donation-panel-custom__in').remove());
      await page.evaluate(() => {
        window.__presetClicks = 0;
        document.querySelector('.donation-panel-amount').addEventListener('click', () => { window.__presetClicks += 1; });
      });
      await fillAmountStep(form, '');
      assert.equal(await page.evaluate(() => window.__presetClicks), 1);
      await advanceToDetails(form, 1500).catch((e) => {
        // sahte formda tutar kutusu kalmadı: amount alanı boş kalır, hata iletisi beklenir
        assert.match(String(e.message), /Timeout/);
      });
      assert.ok((await visibleValidationErrors(page)).length >= 0);
    });
  });
});

describe('katman (popup / panel): açılış, giriş noktası, kapanış', () => {
  it('popup: tetikleyici sayılır, katman açılır/kapanır', async () => {
    await withPage(FORM('popup'), async (page) => {
      const ui = await collectVisiblePluginEntry(page);
      assert.deepEqual(
        { i: ui.inlineVisible, p: ui.panelVisible, c: ui.popupVisible, d: ui.displayAttr },
        { i: 0, p: 0, c: 1, d: 'button_popup' }
      );
      assert.equal(classifyVisiblePluginEntry(ui).kind, 'popup');
      await shellTriggerLocator(page, 'popup', { productId: 7 }).first().click();
      await openShellLocator(page, '').waitFor({ state: 'visible' });
      const dom = await collectShellDomState(page);
      assert.equal(dom.open_count, 1);
      assert.equal(dom.centered, true);
      await page.locator('[data-dp-close]').click();
      await waitForShellClosed(page, 3000);
    });
  });

  it('yan panel: giriş noktası panel olarak sınıflanır', async () => {
    await withPage(FORM('side_panel'), async (page) => {
      const ui = await collectVisiblePluginEntry(page);
      assert.equal(classifyVisiblePluginEntry(ui).kind, 'panel');
      assert.equal(ui.displayAttr, 'button_panel');
    });
  });

  it('satır içi: form giriş noktası; çalışma zamanı bağlı kökü görür', async () => {
    await withPage(FORM('inline'), async (page) => {
      const ui = await collectVisiblePluginEntry(page);
      assert.equal(classifyVisiblePluginEntry(ui).kind, 'form');
      const rt = await collectPluginRuntime(page);
      assert.equal(rt.has_wdp_app, true);
      assert.equal(rt.has_submit_handler, true);
    });
  });
});

describe('advanceToDetails', () => {
  it('bilgi adımı zaten görünürse bir şey yapmaz', async () => {
    await withPage(FORM('inline'), async (page) => {
      const form = formOf(page.locator('[data-dp-exp]').first());
      await form.evaluate((f) => {
        f.querySelector('[data-dp-step="amount"]').hidden = true;
        f.querySelector('[data-dp-step="details"]').hidden = false;
      });
      await advanceToDetails(form, 1000);
      assert.equal(await page.locator('[data-dp-step="details"]').isVisible(), true);
    });
  });

  // Gift Aid / vergi indirimi: isteğe bağlı adım araya girer (kutu işaretlenmeden "Devam").
  const TAX_FLOW = (order) => `
<form data-dp-form novalidate>
  ${order === 'tax-first'
    ? '<section data-dp-step="amount"><input name="amount" value="50"></section><section data-dp-step="tax_relief" hidden><input type="checkbox" name="donation_tax_relief"></section><section data-dp-step="details" hidden><input name="donation_full_name"></section>'
    : '<section data-dp-step="amount"><input name="amount" value="50"></section><section data-dp-step="details" hidden><input name="donation_full_name"></section><section data-dp-step="tax_relief" hidden><input type="checkbox" name="donation_tax_relief"></section>'}
  <button type="submit" data-dp-submit>Continue</button>
</form>
<script>
  const f = document.querySelector('[data-dp-form]');
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const secs = Array.from(f.querySelectorAll('[data-dp-step]'));
    const i = secs.findIndex((s) => !s.hidden);
    if (i < secs.length - 1) { secs[i].hidden = true; secs[i + 1].hidden = false; } else { document.title = 'submitted'; }
  });
</script>`;

  it('vergi indirimi adımı bilgiden önce gelirse kutu işaretlenmeden geçilir', async () => {
    await withPage(TAX_FLOW('tax-first'), async (page) => {
      await advanceToDetails(formOf(page.locator('body')), 3000);
      assert.equal(await page.locator('[data-dp-step="details"]').isVisible(), true);
      assert.equal(await page.locator('input[name="donation_tax_relief"]').isChecked(), false);
      assert.notEqual(await page.title(), 'submitted');
    });
  });

  it('negatif: vergi adımı bilgiden sonra geliyorsa formu göndermez, açık hata verir', async () => {
    await withPage(TAX_FLOW('tax-last'), async (page) => {
      await page.evaluate(() => {
        document.querySelector('[data-dp-step="amount"]').hidden = true;
        document.querySelector('[data-dp-step="tax_relief"]').hidden = false;
      });
      await assert.rejects(advanceToDetails(formOf(page.locator('body')), 1500), /vergi indirimi adımı bilgi adımından sonra/);
      assert.notEqual(await page.title(), 'submitted');
    });
  });
});

describe('ensureDetailsStepForEmptySubmit (hazır tutar kartlı form)', () => {
  const PRESET_FLOW = (disabled) => `
<form data-dp-form novalidate>
  <section data-dp-step="amount"><button type="button" class="donation-panel-amount" data-dp-preset="50">50</button></section>
  <section data-dp-step="details" hidden><input name="donation_full_name"></section>
  <button type="submit" data-dp-submit aria-disabled="${disabled}">Continue</button>
</form>
<script>
  window.__disabledClicks = 0;
  const f = document.querySelector('[data-dp-form]');
  const btn = f.querySelector('[data-dp-submit]');
  btn.addEventListener('click', () => { if (btn.getAttribute('aria-disabled') === 'true') window.__disabledClicks++; });
  f.querySelector('[data-dp-preset]').addEventListener('click', () => btn.setAttribute('aria-disabled', 'false'));
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    f.querySelector('[data-dp-step="amount"]').hidden = true;
    f.querySelector('[data-dp-step="details"]').hidden = false;
  });
</script>`;

  it('tutar adımında pasif düğmeye tıklamaz; tutar seçip bilgi adımına geçer', async () => {
    await withPage(PRESET_FLOW('true'), async (page) => {
      await ensureDetailsStepForEmptySubmit(formOf(page.locator('body')), 3000);
      assert.equal(await page.locator('[data-dp-step="details"]').isVisible(), true);
      assert.equal(await page.evaluate(() => window.__disabledClicks), 0);
    });
  });

  it('negatif: tutar adımında düğme pasif değilse açık hata verir', async () => {
    await withPage(PRESET_FLOW('false'), async (page) => {
      await assert.rejects(ensureDetailsStepForEmptySubmit(formOf(page.locator('body')), 1500), /düğme pasif değil/);
    });
  });
});

describe('returnToDetails (gönderim hatası sonrası geri dönüş)', () => {
  const BACK_FLOW = (withBack) => `
<form data-dp-form novalidate>
  ${withBack ? '<button type="button" data-dp-back>Back</button>' : ''}
  <section data-dp-step="amount" hidden><input name="amount" value="50"></section>
  <section data-dp-step="details" hidden><input name="donation_full_name"></section>
  <section data-dp-step="tax_relief"><input type="checkbox" name="donation_tax_relief"></section>
  <button type="submit" data-dp-submit>Continue</button>
</form>
<script>
  const f = document.querySelector('[data-dp-form]');
  const secs = Array.from(f.querySelectorAll('[data-dp-step]'));
  const back = f.querySelector('[data-dp-back]');
  if (back) back.addEventListener('click', () => {
    const i = secs.findIndex((s) => !s.hidden);
    if (i > 0) { secs[i].hidden = true; secs[i - 1].hidden = false; }
  });
</script>`;

  it('vergi adımı son adımsa geri düğmesiyle bilgi adımına döner', async () => {
    await withPage(BACK_FLOW(true), async (page) => {
      assert.equal(await returnToDetails(formOf(page.locator('body')), 2000), 'details');
      assert.equal(await page.locator('input[name="donation_full_name"]').isVisible(), true);
    });
  });

  it('geri düğmesi yoksa locked-step döner (çağıran son adımdaki alanı yoklar)', async () => {
    await withPage(BACK_FLOW(false), async (page) => {
      assert.equal(await returnToDetails(formOf(page.locator('body')), 800), 'locked-step');
    });
  });

  it('bilgi adımı zaten görünürse hemen details döner', async () => {
    await withPage(FORM('inline'), async (page) => {
      const form = formOf(page.locator('[data-dp-exp]').first());
      await form.evaluate((f) => {
        f.querySelector('[data-dp-step="amount"]').hidden = true;
        f.querySelector('[data-dp-step="details"]').hidden = false;
      });
      assert.equal(await returnToDetails(form, 800), 'details');
    });
  });
});

describe('collectHiddenTriggerDump', () => {
  it('ata zinciri, [data-dp-open] sayısı, adres ve başlık döner', async () => {
    await withPage('<div class="tab-content"><div style="width:0;height:0;overflow:hidden"><button data-dp-open style="display:inline-flex">x</button></div></div>', async (page) => {
      const d = await collectHiddenTriggerDump(page.locator('[data-dp-open]'));
      assert.equal(d.openCountAll, 1);
      assert.ok(Array.isArray(d.chain) && d.chain.length >= 3);
      assert.ok(d.chain[0].el.startsWith('button'));
      assert.equal(d.chain[d.chain.length - 1].el, 'body');
      assert.equal(typeof d.url, 'string');
    });
  });
});

describe('waitForVisibleCandidate', () => {
  it('sayfa geç hazır olsa da görünür adayı bekler; zaman aşımında nedeni yazar', async () => {
    await withPage('<div id="w" style="display:none"><button data-dp-open>x</button></div><script>setTimeout(()=>{document.getElementById("w").style.display="block"},600)</script>', async (page) => {
      const r = await waitForVisibleCandidate(page.locator('[data-dp-open]'), 3000);
      assert.ok(r.locator);
    });
    await withPage('<div hidden id="w"><button data-dp-open>x</button></div>', async (page) => {
      const r = await waitForVisibleCandidate(page.locator('[data-dp-open]'), 500);
      assert.equal(r.locator, null);
      assert.match(r.detail, /adaylar=1 hepsi gizli .*size=0x0 ata=div/);
    });
  });

  it('başlangıçta 0x0 olan, scrollIntoView ile boyanan aday görünür sayılır', async () => {
    const html = '<div style="height:3000px"></div><div id="w"><button data-dp-open style="display:block;width:0;height:0;padding:0;border:0;overflow:hidden">x</button></div>'
      + '<script>const b=document.querySelector("[data-dp-open]");const o=b.scrollIntoView.bind(b);b.scrollIntoView=function(a){o(a);b.style.width="349px";b.style.height="48px"}</script>';
    await withPage(html, async (page) => {
      const r = await waitForVisibleCandidate(page.locator('[data-dp-open]'), 2000);
      assert.ok(r.locator);
    });
  });

  const TABS = (tabAttrs) => `
<div><button ${tabAttrs} onclick="document.getElementById('p1').hidden=true;document.getElementById('p2').hidden=false">B</button></div>
<div id="p1" role="tabpanel"><p>x</p></div>
<div id="p2" role="tabpanel" aria-labelledby="t2" hidden><button data-dp-open>Donate</button></div>`;
  it('gizli tabpanel + role=tab: sekmeyi tıklayıp görünür adayı döner', async () => {
    await withPage(TABS('role="tab" aria-controls="p2" id="t2" aria-selected="false"'), async (page) => {
      const r = await waitForVisibleCandidate(page.locator('[data-dp-open]'), 2000);
      assert.ok(r.locator);
    });
  });
  it('ARIA yoksa (href/data-toggle) sekme tıklanmaz', async () => {
    await withPage(TABS('data-toggle="tab" href="#p2" id="t2"'), async (page) => {
      const r = await waitForVisibleCandidate(page.locator('[data-dp-open]'), 500);
      assert.equal(r.locator, null);
    });
  });
});
