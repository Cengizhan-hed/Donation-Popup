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
  workers: 1,
  reporter: 'list',
  use: {
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
