/**
 * Donation Panel — telefon paketi (tembel): kural tablosu + biçimleme. Çekirdekteki `phone-lazy.mjs` ilk etkileşimde yükler.
 */
import { bindPhone, phoneState } from '../ui2-shared/phone.mjs';

window.__dpPhone = {
  bindPhone,
  /** @param {HTMLElement} root Bölüm. @return {HTMLInputElement[]} Dolu ama eksik/fazla/tanınmayan açık telefon alanları. */
  bad: (root) => Array.from(root.querySelectorAll('.donation-panel-phone__input:not(:disabled)')).filter((input) => phoneState(input).blocked),
};
