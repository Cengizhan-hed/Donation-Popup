/**
 * Elementor Pro uyum testi (E8N). Eklenti Elementor'u tanımaz (CLAUDE.md §0); bu test yalnız Elementor Pro'nun
 * şablon/widget işaretleri olan sayfalarda eklentinin standart çıktısının çakışmadığını doğrular.
 *
 * Kipler (varsayılan: TÜMÜ ATLANIR — "Elementor Pro yok"):
 *  - Yerel şablon simülasyonu: `npm run e2e:elementor-compat -- --sim` (işaretleri taklit eden mu-plugin; gerçek Elementor yok).
 *  - Uzak (Ikram, ziyaretçi gibi, salt okunur): `npm run e2e:elementor-compat -- --env ikram-aid` — bu spec'i değil,
 *    merkezi korumalı koşucuyu (run-elementor-compat.mjs) kullanır; burada uzak adrese asla gidilmez.
 */
import { test, expect } from '@playwright/test';
import { loadProfile, resolveTimeouts } from '../helpers/profile.mjs';
import {
  SCENARIOS,
  compatPaths,
  decideMode,
  isPluginSourcedError,
  makeContext,
  missingTemplateMessage,
  runScenario,
} from '../helpers/elementor-compat.mjs';

const MODE = process.env.WDP_ELEMENTOR_COMPAT || '';
const BASE = process.env.E2E_BASE_URL || '';
const PRODUCT = process.env.WDP_EXP_PRODUCT_ID || '0';
const LOOPBACK = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i;

test.describe('Elementor Pro uyumu (yerel şablon simülasyonu)', () => {
  test.skip(MODE !== 'sim', 'Elementor Pro yok: yerel şablon simülasyonu için `npm run e2e:elementor-compat -- --sim`');
  test.skip(!LOOPBACK.test(BASE), 'Uzak adrese bu spec ile gidilmez; uzak koşu run-elementor-compat.mjs üzerinden');
  test.describe.configure({ mode: 'serial' });

  const profile = loadProfile('local');
  const timeouts = { ...resolveTimeouts(profile), settle: 2500 };

  /**
   * @param {boolean} markers Simülasyon işaretleri açık mı.
   * @return {object} Senaryo bağlamı.
   */
  function context(markers) {
    return makeContext({
      base: BASE,
      env: { E2E_BASE_URL: BASE },
      profile,
      timeouts,
      paths: compatPaths({}, `/?p=${PRODUCT}`),
      extra: markers ? {} : { dp_elsim: '0' },
    });
  }

  for (const scenario of SCENARIOS) {
    test(`${scenario.id}: ${scenario.title}`, async ({ page }) => {
      const result = await runScenario(scenario, page, context(true));
      expect(result.status, `${scenario.id}: ${result.detail}`).toBe('passed');
    });
  }

  test('işaretler yokken her senaryo net mesajla ATLANIR (hata değil)', async ({ page }) => {
    for (const scenario of SCENARIOS) {
      const result = await runScenario(scenario, page, context(false));
      expect(result.status, `${scenario.id}: ${result.detail}`).toBe('skipped');
      expect(result.detail).toMatch(/Theme Builder .* şablonu yok: kullanıcı oluşturunca koşar|modülü kapalı|simgesi yok/);
    }
  });

  test('atlama mesajı biçimi ve eklenti kaynağı süzgeci', () => {
    expect(missingTemplateMessage('ürün')).toBe('Theme Builder ürün şablonu yok: kullanıcı oluşturunca koşar');
    expect(isPluginSourcedError('x at /wp-content/plugins/woo-donation-popup/assets/build/main.js')).toBe(true);
    expect(isPluginSourcedError('Slider Revolution error at /plugins/revslider/x.js')).toBe(false);
    expect(decideMode({ envId: 'local', sim: false })).toBe('skip');
  });
});
