/**
 * Tema durum sızıntısı ölçümü (12.3; theme-state-isolation.spec.mjs ile aynı ölçüt, yan sepet gibi başka yüzeyler için
 * ortak yardımcı). Sayfaya `.donation-panel` DIŞINDA yoklama düğmesi/bağlantısı eklenir; onların hover/focus/active
 * renkleri "tema sızıntı renkleri"dir. Eklenti kontrolünün durumdaki rengi bu renklerden biri olamaz (dinlenme değeri
 * zaten aynıysa sızıntı sayılmaz); metin süslemesi dinlenmeden değişmez. Tema/oluşturucu adı yok.
 */
export const CONTROL_SEL = ['button', '[role="radio"]', '[role="checkbox"]', 'input:not([type="hidden"])', 'select', 'textarea', 'summary', 'a[href]'].join(',');
export const PROPS = ['backgroundColor', 'color', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor'];
const STATES = ['hover', 'focus', 'active'];

const isClear = (v) => !v || v === 'transparent' || /^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$/.test(v);

/**
 * @param {import('@playwright/test').Locator} loc Öğe.
 * @return {Promise<Record<string,string>>} Hesaplanmış değerler (yalnız çizilen renkler).
 */
export function snap(loc) {
  return loc.evaluate((el, props) => {
    const cs = getComputedStyle(el);
    const out = {};
    props.forEach((p) => {
      out[p] = cs[p];
    });
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
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<Set<string>>} Temanın düğme/bağlantı durum renkleri.
 */
export async function leakColors(page) {
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
 * Eklentinin KENDİ renk belirteçlerinin çözülmüş değerleri (kök içinde yoklama öğesiyle). Tema paletinden türeyen
 * belirteç (ör. yazı rengi = temanın "contrast" rengi) tema bağlantı rengiyle aynı olabilir; eklentinin kendi tasarladığı
 * durum rengi bu durumda sızıntı sayılmaz.
 *
 * @param {import('@playwright/test').Locator} root Kök.
 * @return {Promise<string[]>} rgb() değerleri.
 */
export function ownColors(root) {
  return root.evaluate((el) => {
    const names = ['--dp-color-text', '--dp-color-primary', '--dp-color-primary-strong', '--dp-color-accent', '--dp-color-on-primary', '--dp-color-on-accent'];
    const probe = document.createElement('span');
    el.appendChild(probe);
    const out = names.map((n) => {
      probe.style.color = `var(${n})`;
      return getComputedStyle(probe).color;
    });
    probe.remove();
    return out;
  });
}

/**
 * Kökteki görünür her kontrolü üç durumda ölçer.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @param {import('@playwright/test').Locator} root Kök.
 * @param {Set<string>} leak Tema sızıntı renkleri.
 * @param {string} label Etiket.
 * @param {{x:number,y:number}} park Farenin bırakıldığı boş nokta (tıklama oluşturmaz).
 * @return {Promise<{checked:number,bad:string[]}>} Sonuç.
 */
export async function audit(page, root, leak, label, park) {
  const handles = root.locator(CONTROL_SEL);
  const n = await handles.count();
  const bad = [];
  let checked = 0;
  for (let i = 0; i < n; i += 1) {
    const el = handles.nth(i);
    if (!(await el.isVisible()) || (await el.isDisabled())) continue;
    const desc = await el.evaluate((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(/\s+/).slice(0, 2).join('.')}`);
    await page.mouse.move(park.x, park.y);
    await el.evaluate((e) => e.blur && e.blur());
    const rest = await snap(el);
    if (rest.opacity === '0') continue;
    for (const state of STATES) {
      await page.mouse.move(park.x, park.y); // her durum ayrı: önceki durumun fare üstü kalıntısı ölçüme girmez
      if (state === 'hover') {
        await el.hover({ timeout: 1500 });
      } else if (state === 'focus') {
        await el.focus({ timeout: 1500 });
      } else {
        await el.hover({ timeout: 1500 });
        await page.mouse.down();
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
        await el.evaluate((e) => e.blur && e.blur());
      }
    }
  }
  return { checked, bad };
}
