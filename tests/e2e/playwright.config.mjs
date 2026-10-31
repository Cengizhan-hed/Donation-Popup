/**
 * Playwright cihaz projeleri (öncelik: iPhone → Android → masaüstü).
 * Asıl giriş: npm run e2e:quick / e2e:full (özel koşucular).
 */
import { defineConfig, devices } from '@playwright/test';

const iphone = devices['iPhone 15'] || devices['iPhone 14'];
const android = devices['Pixel 7'] || devices['Pixel 5'];

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // E8Z: e2e:queue kaynak durumundan WDP_E2E_WORKERS türetir; yoksa 1.
  workers: Math.max(1, Number.parseInt(process.env.WDP_E2E_WORKERS || '', 10) || 1),
  // Yönetici oturumu: ensureAuth kilit dosyası; işçiler storageState paylaşır, kendileri giriş yapmaz.
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || undefined,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'iphone',
      use: { ...iphone, hasTouch: true, isMobile: true },
    },
    {
      name: 'android',
      use: { ...android, hasTouch: true, isMobile: true },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});
