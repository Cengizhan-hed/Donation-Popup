/**
 * Donation Panel — telefon paketi (tembel): kural tablosu + biçimleme. Çekirdekteki `phone-lazy.mjs` ilk etkileşimde yükler.
 */
import { bindPhone, blockedIn } from '../ui2-shared/phone.mjs';

window.__dpPhone = { bindPhone, bad: blockedIn };
