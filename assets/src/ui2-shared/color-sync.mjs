/**
 * Donation Panel — CSS değişkeniyle verilen özel renkler (ör. `var(--e-global-color-primary)`) sunucuda çözülemez.
 * Sunucu yedek renge göre güvenli bir yazı rengi yazar ve `--dp-color-dynamic: 1` işaretini koyar; bu modül tarayıcıda
 * çözülen rengi okuyup düğme yazı rengini WCAG kontrastına (≥4.5:1, beyaz/siyah hangisi yüksekse) göre yalnız gerekirse
 * günceller. İşaret yoksa hiçbir şey yapmaz (tek `getComputedStyle` okuması). Temaya/oluşturucuya özel kod yoktur.
 */

const PAIRS = [
  ['--dp-color-primary', '--dp-color-on-primary'],
  ['--dp-accent', '--dp-color-on-accent'],
];

/**
 * @param {number} c 0..255 kanal.
 * @return {number} Doğrusal kanal.
 */
function lin(c) {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * WCAG göreli parlaklık.
 *
 * @param {number[]} rgb [r, g, b] 0..255.
 * @return {number} 0..1.
 */
export function luminance(rgb) {
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

/**
 * WCAG kontrast oranı.
 *
 * @param {number[]} a Renk.
 * @param {number[]} b Renk.
 * @return {number} 1..21.
 */
export function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * Zemin üzerinde okunur yazı rengi (kontrastı yüksek olan; her zaman ≥4.5:1).
 *
 * @param {number[]} rgb Zemin.
 * @return {string} '#ffffff' | '#000000'.
 */
export function textOn(rgb) {
  return contrast(rgb, [255, 255, 255]) >= contrast(rgb, [0, 0, 0]) ? '#ffffff' : '#000000';
}

/**
 * '#rgb', '#rrggbb', 'rgb()/rgba()' (virgüllü ya da boşluklu) ve 'color(srgb r g b)' biçimlerini çözer.
 *
 * @param {string} value Renk dizgesi.
 * @return {number[]|null} [r, g, b] ya da null.
 */
export function parseColor(value) {
  const s = String(value || '').trim().toLowerCase();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (m) {
    const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (m) {
    return [m[1], m[2], m[3]].map((n) => Math.max(0, Math.min(255, Math.round(Number(n)))));
  }
  m = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(s);
  if (m) {
    return [m[1], m[2], m[3]].map((n) => Math.max(0, Math.min(255, Math.round(Number(n) * 255))));
  }
  return null;
}

/**
 * Herhangi bir CSS renk dizgesini (adlı renk, hsl() vb.) tarayıcıya çözdürür.
 *
 * @param {string} value Çözülmüş renk dizgesi.
 * @param {Document} doc Belge.
 * @param {Element} host Sondanın ekleneceği öğe (değişkenler kalıtımla çözülür).
 * @return {number[]|null} [r, g, b] ya da null.
 */
export function resolveColor(value, doc, host) {
  const direct = parseColor(value);
  if (direct || !value || !host) {
    return direct;
  }
  const probe = doc.createElement('i');
  probe.hidden = true;
  probe.style.color = value;
  if (!probe.style.color) {
    return null;
  }
  host.appendChild(probe);
  const out = parseColor(doc.defaultView.getComputedStyle(probe).color);
  probe.remove();
  return out;
}

/**
 * Kapsamdaki `.donation-panel` / form köklerinde dinamik renk işareti varsa yazı rengini çözülen renge göre ayarlar.
 * Önce tüm okumalar, sonra yazmalar (tek stil hesaplaması).
 *
 * @param {ParentNode} [scope] Kapsam (varsayılan belge).
 * @return {number} Güncellenen bildirim sayısı.
 */
export function syncColors(scope) {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc || !doc.defaultView) {
    return 0;
  }
  const ctx = scope || doc;
  const els = [];
  if (ctx.matches && ctx.matches('.donation-panel, [data-dp-form]')) {
    els.push(ctx);
  }
  ctx.querySelectorAll('.donation-panel, [data-dp-form]').forEach((el) => els.push(el));
  if (!els.length) {
    return 0;
  }
  const view = doc.defaultView;
  if (view.getComputedStyle(els[0]).getPropertyValue('--dp-color-dynamic').trim() !== '1') {
    return 0;
  }
  const cache = new Map();
  const writes = [];
  els.forEach((el) => {
    const cs = view.getComputedStyle(el);
    PAIRS.forEach(([bg, fg]) => {
      const raw = cs.getPropertyValue(bg).trim();
      if (!raw) {
        return;
      }
      if (!cache.has(raw)) {
        const rgb = resolveColor(raw, doc, doc.body);
        cache.set(raw, rgb ? textOn(rgb) : '');
      }
      const want = cache.get(raw);
      if (want && cs.getPropertyValue(fg).trim().toLowerCase() !== want) {
        writes.push([el, fg, want]);
      }
    });
  });
  writes.forEach(([el, fg, want]) => el.style.setProperty(fg, want));
  return writes.length;
}
