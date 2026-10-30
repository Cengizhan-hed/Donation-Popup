/**
 * 122-cascade: satır içi yüzey stilleri çizim sırasıyla basılır; hangi yüzey önce çizilirse çizilsin bileşenlerin
 * hesaplanmış stilleri BİREBİR aynı ve tasarım jetonlarından olmalı (staging bulgusu: kampanya çubuğu formdan sonra
 * çizilince ikincil "Sepete Ekle" `--outline` düğmesi dolu marka rengiyle çizildi).
 * YALNIZ yerel WP: `npm run e2e:queue -- node tests/e2e/run-first-paint.mjs --spec style-order-independence [--theme X]`.
 */
import { test, expect } from '@playwright/test';

const IDS = JSON.parse(process.env.WDP_FP_IDS || '{"product":0,"fixed":0,"campaign":0}');
const url = (order) => `/?dp_fp=order&dp_order=${order}&dp_product=${IDS.product}&dp_fixed=${IDS.fixed}&dp_campaign=${IDS.campaign}`;

/** Yüzey sıraları: c kampanya, f sabit fiyatlı form, h serbest tutarlı form, l liste, s yan sepet, a hesap, k compact, p sosyal kanıt. */
const ORDERS = ['cfhlsakp', 'fhclkasp', 'lsakcpfh', 'kasfhlpc'];

/** Denetlenen bileşenler. */
const SELECTORS = [
  '.donation-panel-btn',
  '.donation-panel-iconbtn',
  '.donation-panel-amount',
  '.donation-panel-custom',
  '.donation-panel-input',
  '.donation-panel-stepper button',
  '.donation-panel-bar',
  '.donation-panel-bar__fill',
  '.donation-panel-impact',
  '.donation-panel-badge',
  '.dpx-btn',
  'svg.donation-panel-ico',
];
const PROPS = [
  'background-color',
  'color',
  'border-top-color',
  'border-top-width',
  'border-top-left-radius',
  'box-shadow',
  'font-size',
  'font-weight',
  'min-height',
  'padding-left',
  'stroke-width',
  'height',
];

/**
 * Sayfadaki bileşenlerin hesaplanmış stilleri (anahtar: yüzey kabı + seçici + sınıf + sıra) ve jeton denetimleri.
 *
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<{styles: Record<string, Record<string,string>>, tokens: Array<{key:string, prop:string, got:string, want:string}>}>}
 */
async function snapshot(page) {
  return page.evaluate(
    ({ selectors, props }) => {
      /** Öğe bağlamında bir CSS değişkeninin çözülmüş rengi. */
      const token = (el, name) => {
        const probe = document.createElement('i');
        probe.style.cssText = `position:absolute;inline-size:0;block-size:0;background-color:var(${name})`;
        (el.parentElement || el).appendChild(probe);
        const c = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return c;
      };
      const styles = {};
      const tokens = [];
      for (const section of document.querySelectorAll('section[id^="ord-"]')) {
        for (const sel of selectors) {
          section.querySelectorAll(sel).forEach((el, i) => {
            const cls = Array.from(el.classList).filter((c) => /--|^dpx-btn|^donation-panel-btn/.test(c)).sort().join('.');
            const key = `${section.id} ${sel} ${cls} #${i}`;
            const cs = getComputedStyle(el);
            styles[key] = Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
            const want = (name) => tokens.push({ key, prop: 'background-color', got: cs.backgroundColor, want: token(el, name) });
            if (el.classList.contains('donation-panel-btn--outline')) {
              want('--dp-color-surface');
              tokens.push({ key, prop: 'box-shadow (çerçeve)', got: /inset/.test(cs.boxShadow) ? 'çerçeve' : cs.boxShadow, want: 'çerçeve' });
            } else if (el.classList.contains('donation-panel-btn--accent')) {
              want('--dp-color-accent-solid');
            } else if (el.classList.contains('donation-panel-btn--secondary')) {
              want('--dp-color-primary-soft');
            }
          });
        }
      }
      return { styles, tokens };
    },
    { selectors: SELECTORS, props: PROPS }
  );
}

/** Yüzey kabı kimlikleri sıradan bağımsız olduğundan anahtarlar doğrudan karşılaştırılır. */
test.describe('stil sıra bağımsızlığı', () => {
  test('bileşen stilleri yüzey çizim sırasından bağımsız ve jetonlardan', async ({ page }) => {
    test.skip(!IDS.product, 'Test ürünleri yok (run-first-paint ile koşun).');
    const shots = {};
    for (const order of ORDERS) {
      await page.goto(url(order), { waitUntil: 'load' });
      await expect(page.locator('#ord-f .donation-panel-btn--outline'), 'sabit fiyatlı formda ikincil düğme').toHaveCount(1);
      const snap = await snapshot(page);
      const inline = await page.locator('style[id^="donation-panel-inline-"]').evaluateAll((els) => els.map((e) => e.id));
      expect(new Set(inline).size, `stil etiketi tekrarı yok (${order}): ${inline.join(',')}`).toBe(inline.length);
      for (const t of snap.tokens) {
        expect(t.got, `${order} ${t.key} ${t.prop} jetondan`).toBe(t.want);
      }
      shots[order] = snap.styles;
    }
    const [first, ...rest] = ORDERS;
    const keys = Object.keys(shots[first]).sort();
    expect(keys.length, 'denetlenen öğe sayısı').toBeGreaterThan(10);
    for (const order of rest) {
      expect(Object.keys(shots[order]).sort(), `aynı öğeler (${order})`).toEqual(keys);
      const diffs = [];
      for (const k of keys) {
        for (const p of PROPS) {
          if (shots[order][k][p] !== shots[first][k][p]) diffs.push(`${k} ${p}: ${first}=${shots[first][k][p]} ${order}=${shots[order][k][p]}`);
        }
      }
      expect(diffs, `${first} ile ${order} hesaplanmış stil farkı`).toEqual([]);
    }
  });
});
