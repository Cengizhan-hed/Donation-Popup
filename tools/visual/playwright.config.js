/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: __dirname,
  testMatch: 'visual.spec.js',
  timeout: 60000,
  retries: 0,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    headless: true,
  },
  outputDir: '../../build/visual/test-results',
};
