/**
 * Yönetici renk alanı: metin (#hex ya da `var(--ad[, #yedek])`) + renk seçici + durum satırı.
 * Değişken bu sayfada tanımlıysa tarayıcıda çözülür, örnek ve kontrast ona göre gösterilir; tanımlı değilse
 * "sitede çözülecek" bilgisi verilir. Temaya/oluşturucuya özel kod yoktur: değişken adı yönetici girdisidir.
 */
import { contrast, resolveColor } from '../ui2-shared/color-sync.mjs';

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const VAR = /^var\(\s*--([a-zA-Z0-9_-]{1,100})\s*(?:,\s*(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})\s*)?\)$/;
const MIN = 4.5;

/**
 * Değeri sınıflar (sunucudaki Theme_Colors::sanitize_color ile aynı kurallar).
 *
 * @param {string} value Alan değeri.
 * @return {{kind: string, name?: string, fallback?: string}} kind: empty | hex | var | bad.
 */
export function classify(value) {
  const s = String(value || '').trim();
  if (!s) {
    return { kind: 'empty' };
  }
  if (HEX.test(s)) {
    return { kind: 'hex' };
  }
  const m = VAR.exec(s);
  if (m) {
    return { kind: 'var', name: m[1], fallback: m[2] || '' };
  }
  return { kind: 'bad' };
}

/**
 * @param {number[]} rgb [r, g, b].
 * @return {string} '#rrggbb'.
 */
export function toHex(rgb) {
  return '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join('');
}

/**
 * Ana renk beyaz zeminde yazı olarak kullanılır: kontrast yetersizse oran (1 ondalık), değilse ''.
 *
 * @param {number[]} rgb Renk.
 * @return {string} Oran ya da ''.
 */
export function lowContrast(rgb) {
  const ratio = contrast(rgb, [255, 255, 255]);
  return ratio < MIN ? (Math.floor(ratio * 10) / 10).toFixed(1) : '';
}

/**
 * @param {HTMLElement} root Sayfa kökü.
 * @param {Function} t Çeviri yardımcısı.
 */
export function initColorFields(root, t) {
  root.querySelectorAll('input[data-dpa-color]').forEach((field) => {
    const wrap = field.closest('.dpa-colorfield');
    const picker = wrap ? wrap.querySelector('[data-dpa-color-picker]') : null;
    const status = root.querySelector('#' + field.id + '-status');
    const checkText = field.getAttribute('data-dpa-color-text') === '1';
    const host = wrap || field.parentNode;

    const say = (text, warn) => {
      if (!status) {
        return;
      }
      status.textContent = text;
      status.classList.toggle('is-warn', !!warn);
    };

    const paint = () => {
      const info = classify(field.value);
      field.setAttribute('aria-invalid', info.kind === 'bad' ? 'true' : 'false');
      if (info.kind === 'empty') {
        say('', false);
        return;
      }
      if (info.kind === 'bad') {
        say(t('colorBad', 'Enter a color like #12305A or a CSS variable like var(--brand).'), true);
        return;
      }
      let rgb = null;
      let text = '';
      if (info.kind === 'hex') {
        rgb = resolveColor(field.value.trim(), document, host);
      } else {
        const defined = window.getComputedStyle(field).getPropertyValue('--' + info.name).trim();
        if (!defined) {
          if (picker && info.fallback) {
            const fb = resolveColor(info.fallback, document, host);
            if (fb) {
              picker.value = toHex(fb);
            }
          }
          say(t('colorVarNone', 'This variable is not defined on this page. It will be resolved on your site, and the contrast will be checked there.'), false);
          return;
        }
        rgb = resolveColor(field.value.trim(), document, host);
        if (rgb) {
          text = t('colorVarOk', 'On this page the variable resolves to %s. On your site it follows your theme.').replace('%s', toHex(rgb));
        }
      }
      if (rgb && picker) {
        picker.value = toHex(rgb);
      }
      const low = rgb && checkText ? lowContrast(rgb) : '';
      if (low) {
        text = (text ? text + ' ' : '') + t('colorLow', 'Low contrast on white (%s:1). Headings and amounts may be hard to read; choose a darker color.').replace('%s', low);
      }
      say(text, !!low);
    };

    if (picker) {
      picker.addEventListener('input', () => {
        field.value = picker.value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    field.addEventListener('input', paint);
    paint();
  });
}
