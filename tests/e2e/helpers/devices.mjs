/**
 * E2E cihaz projeleri — öncelik: iPhone (WebKit) → Android (Chromium) → masaüstü.
 */
import { devices, chromium, webkit } from '@playwright/test';

export const DEVICE_ORDER = ['iphone', 'android', 'desktop'];

const IPHONE = devices['iPhone 15'] || devices['iPhone 14'] || devices['iPhone 14 Pro'];
const ANDROID = devices['Pixel 7'] || devices['Pixel 5'];

/**
 * iPhone 15 çentik emülasyonu (CSS env(safe-area-inset-*) yoksa yedek).
 * Playwright cihaz tanımı env() üretmez; testler bu değerlerle karşılaştırır.
 */
export const IPHONE_SAFE_AREA = { top: 47, right: 0, bottom: 34, left: 0 };

/**
 * @param {'iphone'|'android'|'desktop'|string} id
 */
export function getDevicePreset(id) {
  const key = String(id || 'desktop').toLowerCase();
  if (key === 'iphone') {
    if (!IPHONE) {
      throw new Error('Playwright iPhone cihaz tanımı yok (iPhone 15/14).');
    }
    return {
      id: 'iphone',
      label: 'iPhone (WebKit)',
      browserType: webkit,
      engine: 'webkit',
      isMobile: true,
      context: {
        ...IPHONE,
        hasTouch: true,
        isMobile: true,
        reducedMotion: /** @type {'reduce'} */ ('reduce'),
      },
      safeArea: IPHONE_SAFE_AREA,
    };
  }
  if (key === 'android') {
    if (!ANDROID) {
      throw new Error('Playwright Pixel cihaz tanımı yok (Pixel 7).');
    }
    return {
      id: 'android',
      label: 'Android (Chromium)',
      browserType: chromium,
      engine: 'chromium',
      isMobile: true,
      context: {
        ...ANDROID,
        hasTouch: true,
        isMobile: true,
        reducedMotion: /** @type {'reduce'} */ ('reduce'),
      },
      safeArea: { top: 24, right: 0, bottom: 0, left: 0 },
    };
  }
  return {
    id: 'desktop',
    label: 'Masaüstü (Chrome 1440)',
    browserType: chromium,
    engine: 'chromium',
    isMobile: false,
    context: {
      viewport: { width: 1440, height: 900 },
      reducedMotion: /** @type {'reduce'} */ ('reduce'),
    },
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  };
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
export function parseDeviceList(raw) {
  const s = String(raw || '').trim();
  if (!s || s === 'all') return [...DEVICE_ORDER];
  const parts = s.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (!DEVICE_ORDER.includes(p)) {
      throw new Error(`Bilinmeyen cihaz: ${p}. Var: ${DEVICE_ORDER.join(', ')}`);
    }
    if (!out.includes(p)) out.push(p);
  }
  return out.length ? out : [...DEVICE_ORDER];
}
