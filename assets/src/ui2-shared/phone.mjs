/**
 * Telefon alanı davranışı (form ve compact kart ortak): yazarken biçimleme, yapıştırma temizliği, ülke seçimi
 * eşitleme, en çok hane sınırı ve doğrulama durumu. Kural: `phone-logic.mjs` (PHP `Phone_Rules` ile aynı tablo).
 * Tablo `src/Support/phone-rules.json` (≈1,5 KB gzip); yalnız telefon alanı olan yüzeyin paketine girer.
 */
import rules from '../../../src/Support/phone-rules.json';
import { buildIndex, parsePhone, typing } from './phone-logic.mjs';

let index = null;

/** @return {object} Tablo dizini (ilk kullanımda kurulur). */
function getIndex() {
  if (!index) {
    index = buildIndex(rules);
  }
  return index;
}

/**
 * Sayı sayısına göre imleç konumu (biçimleme boşlukları imleci kaydırmasın).
 *
 * @param {string} text   Değer.
 * @param {number} digits Imlecin solundaki rakam sayısı.
 * @return {number} Konum.
 */
function caretAfter(text, digits) {
  if (digits <= 0) {
    return 0;
  }
  let seen = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (/\d/.test(text[i])) {
      seen += 1;
      if (seen === digits) {
        return i + 1;
      }
    }
  }
  return text.length;
}

/**
 * Alanın doğrulama durumu (seçili ülkeye göre).
 *
 * @param {HTMLInputElement} input Telefon girdisi.
 * @return {{status:string, warning:boolean, empty:boolean, blocked:boolean}} blocked: dolu ama eksik/fazla/tanınmayan.
 */
export function phoneState(input) {
  const box = input.closest('.donation-panel-phone');
  const select = box ? box.querySelector('[data-dp-dial]') : null;
  const option = select && select.selectedOptions ? select.selectedOptions[0] : null;
  const iso = option && option.dataset.iso ? option.dataset.iso : '';
  if (!select || !iso) {
    // Ülke seçici yok: yalnız eski ölçüt (en az 6 hane).
    const digits = input.value.replace(/\D/g, '');
    return { status: digits === '' ? 'empty' : digits.length < 6 ? 'short' : 'ok', warning: false, empty: digits === '', blocked: digits !== '' && digits.length < 6 };
  }
  const result = parsePhone(input.value, iso, getIndex());
  return { status: result.status, warning: result.warning, empty: result.status === 'empty', blocked: result.status !== 'empty' && result.status !== 'ok' };
}

/**
 * Telefon kutusunu bağlar (bir kez).
 *
 * @param {HTMLElement} box   `.donation-panel-phone` kutusu.
 * @param {{onInput?:Function, onBlur?:Function}} [hooks] Olaylar: (durum) => void.
 */
export function bindPhone(box, hooks = {}) {
  const input = box.querySelector('.donation-panel-phone__input');
  const select = box.querySelector('[data-dp-dial]');
  if (!input || !select || input.dataset.dpPhone === '1') {
    return;
  }
  input.dataset.dpPhone = '1';
  const options = Array.from(select.options);
  const available = new Set(options.map((option) => option.dataset.iso).filter(Boolean));
  const isoOf = () => (select.selectedOptions[0] && select.selectedOptions[0].dataset.iso) || '';
  const idx = getIndex();

  const setIso = (iso) => {
    const at = options.findIndex((option) => option.dataset.iso === iso);
    if (at >= 0 && select.selectedIndex !== at) {
      select.selectedIndex = at;
      // Mevcut dinleyici (+kod etiketi) çalışsın; bu dosyanın change dinleyicisi kendi olayını yok sayar.
      select.dispatchEvent(new Event('change'));
    }
  };

  let own = false;
  const format = () => {
    const before = input.value;
    const focused = document.activeElement === input;
    const caret = focused && input.selectionStart !== null ? input.selectionStart : before.length;
    const left = before.slice(0, caret).replace(/\D/g, '').length;
    const atEnd = caret >= before.length;
    const result = typing(before, isoOf(), idx, available);
    if (result.hold) {
      return;
    }
    if (result.iso !== isoOf()) {
      own = true;
      setIso(result.iso);
      own = false;
    }
    if (result.display !== before) {
      input.value = result.display;
      if (focused && !atEnd && input.setSelectionRange) {
        const pos = caretAfter(result.display, left);
        input.setSelectionRange(pos, pos);
      }
    }
  };

  input.addEventListener('input', () => {
    format();
    if (hooks.onInput) {
      hooks.onInput(phoneState(input));
    }
  });
  // Tarayıcı otomatik doldurma bazen yalnız `change` bildirir.
  input.addEventListener('change', () => {
    format();
    if (hooks.onInput) {
      hooks.onInput(phoneState(input));
    }
  });
  input.addEventListener('blur', () => {
    if (hooks.onBlur) {
      hooks.onBlur(phoneState(input));
    }
  });
  select.addEventListener('change', () => {
    if (own) {
      return;
    }
    // Ülke elle değişti: mevcut rakamlar yeni ülkenin sınırına/biçimine uyar.
    format();
    if (hooks.onInput) {
      hooks.onInput(phoneState(input));
    }
    if (hooks.onBlur && input.value !== '') {
      hooks.onBlur(phoneState(input));
    }
  });
  // Sunucudan/otomatik doldurmayla gelen ilk değer.
  if (input.value !== '') {
    format();
  }
}
