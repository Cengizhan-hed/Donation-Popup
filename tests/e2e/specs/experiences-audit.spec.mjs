/**
 * Otomatik görsel denetim (12.1 tema/yalıtım): form öğelerinde iç içe çerçeve, taşan metin, kesilen öğe, tutarsız
 * yükseklik, görünmeyen odak halkası, `[hidden]` sızıntısı. Yerel WP, seçili tema (WDP_EXP_THEME) x 3 cihaz.
 * `npm run e2e:experiences -- --env local --spec experiences-audit`.
 */
import { test, expect } from '@playwright/test';

const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';

/**
 * Sayfa içinde ölçüm: kök (surface/inline form) altındaki tüm form öğeleri.
 *
 * @param {HTMLElement} root Ölçülecek kök.
 * @return {{nested: string[], overflow: string[], clipped: string[], heights: string[], hidden: string[], fonts: string[]}} Bulgular.
 */
function measure(root) {
  const out = { nested: [], overflow: [], clipped: [], heights: [], hidden: [], fonts: [] };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).join('.')}` : ''}${el.name ? `[name=${el.name}]` : ''}`;
  const hasFrame = (el) => {
    const cs = getComputedStyle(el);
    const border = ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none' && !/rgba?\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)|transparent/.test(cs[`border${s}Color`]));
    const shadow = cs.boxShadow !== 'none' && !/inset/.test(cs.boxShadow) && /\d/.test(cs.boxShadow);
    return border || shadow;
  };
  const rootRect = root.getBoundingClientRect();

  root.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select').forEach((el) => {
    if (!visible(el) && !el.classList.contains('donation-panel-phone__select')) {
      return;
    }
    if (el.classList.contains('donation-panel-phone__select')) {
      return; // Saydam seçici: görünür çerçevesi yok (kapsayıcı çizer).
    }
    // Aynı öğeden kökün içindeki en yakın çerçeveli atalara kadar çerçeve sayısı: 1'den fazla = iç içe çerçeve.
    let frames = 0;
    for (let n = el; n && n !== root; n = n.parentElement) {
      if (hasFrame(n)) {
        frames += 1;
      }
      if (n.matches('.donation-panel-phone, .donation-panel-custom, .donation-panel-field')) {
        break;
      }
    }
    if (frames > 1) {
      out.nested.push(`${label(el)} frames=${frames}`);
    }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const isBare = el.matches('.donation-panel-custom__in, .donation-panel-phone__input');
    if (!isBare && el.tagName !== 'TEXTAREA' && (r.height < 49.5 || r.height > 56.5)) {
      out.heights.push(`${label(el)} h=${r.height.toFixed(1)}`);
    }
    if (parseFloat(cs.fontSize) < 16) {
      out.fonts.push(`${label(el)} fs=${cs.fontSize}`);
    }
    if (el.scrollWidth > el.clientWidth + 1 && el.tagName !== 'SELECT') {
      out.clipped.push(`${label(el)} sw=${el.scrollWidth} cw=${el.clientWidth}`);
    }
  });

  root.querySelectorAll('*').forEach((el) => {
    if (!visible(el) || el.closest('.donation-panel-sr, [aria-hidden="true"]') || el.matches('.donation-panel-sr, svg, path, use')) {
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.right > rootRect.right + 1.5 || r.left < rootRect.left - 1.5) {
      if (!el.closest('[data-dp-handle], [class*="toast"]')) {
        out.overflow.push(`${label(el)} dx=${Math.max(r.right - rootRect.right, rootRect.left - r.left).toFixed(1)}`);
      }
    }
    const cs = getComputedStyle(el);
    if (['BUTTON', 'LABEL', 'A', 'H1', 'H2', 'H3', 'P', 'SPAN'].includes(el.tagName) && cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') {
      out.clipped.push(`${label(el)} sw=${el.scrollWidth} cw=${el.clientWidth}`);
    }
  });

  root.querySelectorAll('[hidden]').forEach((el) => {
    if (getComputedStyle(el).display !== 'none') {
      out.hidden.push(label(el));
    }
  });
  return out;
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} kind Kap.
 */
async function openForm(page, kind) {
  await page.goto(`/?dp_exp_test=${kind}&dp_product=${PRODUCT}`);
  await expect(page.locator('[data-dp-exp]').first()).toBeVisible({ timeout: 20000 });
  if (kind !== 'inline') {
    await page.locator('[data-dp-open]').first().click();
    await expect(page.locator('[data-dp-overlay]').first()).toHaveClass(/is-open/);
    await page.waitForTimeout(700);
  }
}

for (const kind of ['popup', 'inline']) {
  test(`denetim: ${kind} tutar adımı`, async ({ page }) => {
    await openForm(page, kind);
    const root = kind === 'inline' ? page.locator('[data-dp-exp]').first() : page.locator('[data-dp-surface]').first();
    const found = await root.evaluate(measure);
    expect(found, JSON.stringify(found)).toEqual({ nested: [], overflow: [], clipped: [], heights: [], hidden: [], fonts: [] });
  });

  test(`denetim: ${kind} bilgiler adımı + odak halkası`, async ({ page }) => {
    await openForm(page, kind);
    const exp = kind === 'inline' ? page.locator('[data-dp-exp]').first() : page.locator('[data-dp-surface]').first();
    const preset = exp.locator('[data-dp-preset]').first();
    if (await preset.count()) {
      await preset.click();
    } else {
      await exp.locator('input[name="amount"]').fill('25');
    }
    await exp.locator('[data-dp-submit]').first().click();
    await expect(exp.locator('[data-dp-step="details"]')).toBeVisible();
    await page.waitForTimeout(400);
    const found = await exp.evaluate(measure);
    expect(found, JSON.stringify(found)).toEqual({ nested: [], overflow: [], clipped: [], heights: [], hidden: [], fonts: [] });

    // 12.3 odak sözleşmesi, tüm alanlar: (a) fare/programatik odakta yalnız ince kenarlık rengi, belirgin outline yok;
    // (b) klavye odağında (Tab) görünür halka (outline ~2 px) ya da kap halkası.
    const fields = exp.locator('[data-dp-step="details"] input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([disabled])');
    const count = await fields.count();
    const probe = (el) => {
      const own = getComputedStyle(el);
      const wrap = el.closest('.donation-panel-phone, .donation-panel-custom');
      const target = wrap ? getComputedStyle(wrap) : own;
      const outlineOf = (cs) => (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && !/rgba\(\s*0,\s*0,\s*0,\s*0\)|transparent/.test(cs.outlineColor) ? parseFloat(cs.outlineWidth) : 0);
      return {
        border: target.borderTopColor + '|' + target.borderTopWidth,
        ownOutline: outlineOf(own),
        wrapOutline: wrap ? outlineOf(target) : 0,
        shadow: target.boxShadow !== 'none' && /\d/.test(target.boxShadow),
        kbd: document.querySelector('[data-dp-kbd]') !== null || document.documentElement.hasAttribute('data-dp-kbd'),
      };
    };
    // Not: klavye kipi (data-dp-kbd) bir kez açılınca programatik odak da klavye odağı sayılır; bu yüzden önce
    // tüm alanlarda fare/programatik geçiş, sonra klavye geçişi koşulur.
    const visibleIdx = [];
    for (let i = 0; i < count; i += 1) {
      if (await fields.nth(i).isVisible()) {
        visibleIdx.push(i);
      }
    }
    for (const i of visibleIdx) {
      const field = fields.nth(i);
      const name = await field.evaluate((el) => el.name || el.id);
      await field.evaluate((el) => el.blur());
      await page.waitForTimeout(350); // kenarlık geçişi (transition) bitsin
      const idle = await field.evaluate(probe);
      // (a) programatik odak: ince kenarlık rengi, belirgin outline yok
      await field.focus();
      await page.waitForTimeout(350);
      const prog = await field.evaluate(probe);
      expect(prog.border, `programatik odakta kenarlık rengi değişmedi: ${name}`).not.toBe(idle.border);
      expect(prog.ownOutline, `programatik odakta kalın outline (bug): ${name}`).toBe(0);
      expect(prog.wrapOutline, `programatik odakta kap outline (bug): ${name}`).toBe(0);
    }
    for (const i of visibleIdx) {
      const field = fields.nth(i);
      const name = await field.evaluate((el) => el.name || el.id);
      // (b) klavye odağı: önceki öğeye git, Tab ile alana gel
      await field.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      const onField = await field.evaluate((el) => document.activeElement === el);
      expect(onField, `Tab alana gelmedi: ${name}`).toBe(true);
      await page.waitForTimeout(350);
      const kbd = await field.evaluate(probe);
      const visible = (kbd.ownOutline >= 1.5 && kbd.ownOutline <= 3) || (kbd.wrapOutline >= 1.5 && kbd.wrapOutline <= 3) || kbd.shadow;
      expect(visible, `klavye odağında halka yok: ${name} ${JSON.stringify(kbd)}`).toBe(true);
    }
  });
}
