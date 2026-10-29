/**
 * 12.1 Tema durum yalıtımı: temanın düğme/bağlantı durum kuralları (:hover, :focus, :active) eklentinin etkileşimli
 * kontrollerine sızmaz. Tema-bağımsız ölçüt: sayfaya `.donation-panel` DIŞINDA bir yoklama düğmesi/bağlantısı eklenir;
 * onun hover/focus/active renkleri "tema sızıntı renkleri"dir. Eklenti kontrolünün durumdaki arka plan/yazı/kenarlık/halka
 * rengi bu renklerden biri OLAMAZ (dinlenme değeri zaten aynıysa sızıntı sayılmaz); metin süslemesi dinlenmeden değişmez.
 * YALNIZ yerel WP: `WDP_EXP_THEME=<tema> npm run e2e:experiences -- --spec theme-state-isolation`.
 */
import { test, expect } from '@playwright/test';

const IDS = JSON.parse(process.env.WDP_EXP_PRODUCTS || '{}');
const THEME = process.env.WDP_EXP_THEME || 'twentytwentyfive';
const CONTROL_SEL = [
  'button',
  '[role="radio"]',
  '[role="checkbox"]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  'a[href]',
].join(',');
const PROPS = ['backgroundColor', 'color', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor'];
const STATES = ['hover', 'focus', 'active'];

const isClear = (v) => !v || v === 'transparent' || /^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$/.test(v);

/**
 * Hesaplanmış stil anlık görüntüsü (yalnız ilgili özellikler).
 *
 * @param {import('@playwright/test').Locator} loc Öğe.
 * @return {Promise<Record<string,string>>} Değerler.
 */
function snap(loc) {
  return loc.evaluate((el, props) => {
    const cs = getComputedStyle(el);
    const out = {};
    props.forEach((p) => {
      out[p] = cs[p];
    });
    // Görünmeyen çerçeve/halka (genişlik 0 ya da stil none) renk sayılmaz: yalnız çizilen renkler ölçülür.
    ['Top', 'Right', 'Bottom', 'Left'].forEach((side) => {
      if (cs[`border${side}Style`] === 'none' || parseFloat(cs[`border${side}Width`]) === 0) out[`border${side}Color`] = '';
    });
    if (cs.outlineStyle === 'none' || parseFloat(cs.outlineWidth) === 0) out.outlineColor = '';
    out.textDecorationLine = cs.textDecorationLine;
    out.opacity = cs.opacity;
    return out;
  }, PROPS);
}

/**
 * Tema sızıntı renkleri: `.donation-panel` dışındaki yoklama öğelerinin durum renkleri.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<Set<string>>} Renkler.
 */
async function leakColors(page) {
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.id = 'dp-probe-host';
    host.style.cssText = 'position:fixed;inset-block-start:4px;inset-inline-start:4px;z-index:2147483647;display:flex;gap:8px';
    host.innerHTML = '<button type="button" id="dp-probe-b">x</button><button id="dp-probe-b2">y</button><a href="#dp-probe" id="dp-probe-a">z</a>';
    document.body.appendChild(host);
  });
  const colors = new Set();
  for (const id of ['#dp-probe-b', '#dp-probe-b2', '#dp-probe-a']) {
    const loc = page.locator(id);
    for (const state of STATES) {
      if (state === 'hover') await loc.hover();
      if (state === 'focus') await loc.focus();
      if (state === 'active') {
        await loc.hover();
        await page.mouse.down();
      }
      const s = await snap(loc);
      PROPS.forEach((p) => {
        if (!isClear(s[p])) colors.add(s[p]);
      });
      if (state === 'active') {
        await page.mouse.move(0, 0);
        await page.mouse.up();
      }
    }
  }
  await page.evaluate(() => document.getElementById('dp-probe-host')?.remove());
  await page.mouse.move(0, 0);
  return colors;
}

/**
 * Kontrolü her durumda ölçer; sızıntıları döndürür.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {import('@playwright/test').Locator} root Kök.
 * @param {Set<string>} leak Tema sızıntı renkleri.
 * @param {string} label Etiket.
 * @return {Promise<{checked:number,bad:string[]}>} Sonuç.
 */
async function audit(page, root, leak, label) {
  const handles = root.locator(CONTROL_SEL);
  const n = await handles.count();
  const bad = [];
  let checked = 0;
  // Boş bir köşe: fare düğmesi oraya bırakılır (düğmeye tıklama ya da katman arka planına tıklama oluşmaz).
  const heading = root.locator('h2').first();
  const box = (await heading.count()) ? await heading.boundingBox() : await root.boundingBox();
  const park = box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : { x: 0, y: 0 };
  for (let i = 0; i < n; i += 1) {
    const el = handles.nth(i);
    let desc;
    let rest;
    try {
      if (!(await el.isVisible()) || (await el.isDisabled())) continue;
      desc = await el.evaluate((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(/\s+/).slice(0, 2).join('.')}`);
      await page.mouse.move(park.x, park.y);
      await el.evaluate((e) => e.blur && e.blur());
      rest = await snap(el);
    } catch (e) {
      continue; // adım değişiminde kaybolan öğe
    }
    if (rest.opacity === '0') continue; // görünmez kaplama kontrolü (ör. telefon ön eki seçici): çizilmez
    for (const state of STATES) {
      try {
        if (state === 'hover') {
          await el.hover({ timeout: 700 });
        } else if (state === 'focus') {
          await el.focus({ timeout: 700 });
        } else {
          await el.hover({ timeout: 700 });
          await page.mouse.down();
        }
      } catch (e) {
        continue; // örtülü/ekran dışı kontrol: ölçülemez, atla
      }
      try {
        const s = await snap(el);
        checked += 1;
        for (const p of PROPS) {
          if (s[p] !== rest[p] && leak.has(s[p]) && !isClear(s[p])) {
            bad.push(`${label} ${desc} :${state} ${p}=${s[p]} (dinlenme ${rest[p]})`);
          }
        }
        if (s.textDecorationLine !== rest.textDecorationLine) {
          bad.push(`${label} ${desc} :${state} text-decoration ${rest.textDecorationLine} -> ${s.textDecorationLine}`);
        }
      } finally {
        if (state === 'active') {
          await page.mouse.move(park.x, park.y);
          await page.mouse.up();
        }
        if (await el.count()) {
          await el.evaluate((e) => e.blur && e.blur());
        }
      }
    }
  }
  return { checked, bad };
}

/**
 * Tutarı seçer ve ilerler (varsa); görünür adım adlarını döndürür.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {string} root Kök seçici.
 * @return {Promise<void>}
 */
async function pickAmount(page, root) {
  const form = page.locator(root);
  const preset = form.locator('[data-dp-preset]:visible').first();
  if (await preset.count()) {
    await preset.click();
  } else {
    const inp = form.locator('input[name="amount"]:not([type="hidden"])').first();
    if (await inp.isVisible()) await inp.fill('25');
  }
}

const SURFACES = [
  { name: 'inline-fixed', role: 'fixed', kind: 'inline' },
  { name: 'inline-custom', role: 'custom', kind: 'inline' },
  { name: 'inline-shares', role: 'shares', kind: 'inline' },
  { name: 'inline-campaign', role: 'campaign', kind: 'inline' },
  { name: 'popup-custom', role: 'custom', kind: 'popup' },
  { name: 'side-panel-fixed', role: 'fixed', kind: 'side_panel' },
  { name: 'sheet-custom', role: 'custom', kind: 'bottom_sheet' },
];

test.describe(`tema durum yalıtımı (${THEME})`, () => {
  for (const sf of SURFACES) {
    test(`${sf.name}: tema :hover/:focus/:active rengi sızmaz`, async ({ page }) => {
      test.skip(!IDS[sf.role], `${sf.role} test ürünü yok`);
      await page.goto(`/?dp_exp_test=${sf.kind}&dp_product=${IDS[sf.role]}`);
      await expect(page.locator('[data-dp-exp][data-dp-mounted="1"], [data-dp-form]').first()).toBeVisible({ timeout: 20000 });
      test.setTimeout(120000);
      page.setDefaultTimeout(4000); // ölçüm çağrıları takılı kalmasın; hata mesajı hangi adımda olduğunu gösterir
      // Geçişler ölçümü bulandırmasın (yalnız test sayfasında): durum rengi hemen okunur.
      await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
      const leak = await leakColors(page);
      let scope = page.locator('.donation-panel').first();
      if (sf.kind !== 'inline') {
        await page.locator('[data-dp-open]').first().click();
        await expect(page.locator('[data-dp-overlay]')).toHaveClass(/is-open/);
        await page.waitForTimeout(700);
        scope = page.locator('[data-dp-overlay].is-open [data-dp-surface]');
      }
      if (THEME === 'hello-elementor') {
        expect(leak.size, 'yoklama düğmesi tema durum rengini göstermeli (yeniden üretim)').toBeGreaterThan(0);
      }
      const all = { checked: 0, bad: [] };
      const add = (r) => {
        all.checked += r.checked;
        all.bad.push(...r.bad);
      };
      add(await audit(page, scope, leak, 'amount'));
      await pickAmount(page, sf.kind === 'inline' ? '[data-dp-form]' : '[data-dp-overlay].is-open [data-dp-surface]');
      add(await audit(page, scope, leak, 'amount+sel'));
      const submit = scope.locator('[data-dp-submit]').first();
      if ((await submit.count()) && (await submit.isEnabled())) {
        await submit.click();
        await page.waitForTimeout(500);
        add(await audit(page, scope, leak, 'step2'));
      }
      test.info().annotations.push({ type: 'ölçüm', description: `${THEME} ${sf.name}: kontrol×durum=${all.checked}, sızıntı=${all.bad.length}, tema renk sayısı=${leak.size}` });
      expect(all.checked).toBeGreaterThan(0);
      const uniq = [...new Set(all.bad.map((b) => b.replace(/^\S+ /, '')))];
      expect(uniq, uniq.join('\n')).toEqual([]);
    });
  }
});
