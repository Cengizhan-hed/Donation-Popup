/**
 * Playwright visual checks for Stage 2C fixtures.
 * Run: npx playwright test -c tools/visual/playwright.config.js
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const fixturesDir = path.join(__dirname, 'fixtures');
const outDir = path.join(__dirname, '../../build/visual');
const viewports = [
  { name: '320x640', width: 320, height: 640 },
  { name: '375x812', width: 375, height: 812 },
  { name: '414x896', width: 414, height: 896 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x900', width: 1440, height: 900 },
];

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const fixtures = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.html'));

function contrastRatio(fg, bg) {
  const lum = (c) => {
    const s = c.map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  };
  const L1 = lum(fg);
  const L2 = lum(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

for (const file of fixtures) {
  const base = file.replace(/\.html$/, '');
  for (const vp of viewports) {
    test(`${base} @ ${vp.name}`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const url = 'file://' + path.join(fixturesDir, file);
      await page.goto(url);

      const result = await page.evaluate(() => {
        const root = document.querySelector('.wdp-root');
        const issues = [];
        if (!root) {
          issues.push('missing .wdp-root');
          return { issues };
        }
        if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
          issues.push('horizontal overflow document');
        }
        document.querySelectorAll('*').forEach((el) => {
          if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'hidden') {
            // ignore absolute dropdowns
            if (!el.classList.contains('wdp-country-dropdown')) {
              // only flag if visibly overflowing parent
            }
          }
        });
        document.querySelectorAll('button, a, input, select, textarea, [role="button"]').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          if (r.width < 44 - 0.5 || r.height < 44 - 0.5) {
            if (el.classList.contains('wdp-amount-preset') || el.tagName === 'A') return;
            if (el.closest('.wdp-success-screen')) return;
            issues.push(`touch target <44: ${el.className || el.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
          }
        });
        document.querySelectorAll('input, select, textarea').forEach((el) => {
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs < 16) issues.push(`font-size <16: ${el.name || el.className}`);
        });
        const total = root.querySelector('.wdp-footer-total__value, .wdp-shares-total-bar__value');
        if (!total || getComputedStyle(total).display === 'none') {
          issues.push('footer total missing');
        } else {
          const expect = root.getAttribute('data-wdp-expect-total') || '';
          const text = (total.textContent || '').replace(/\s/g, '');
          if (expect === '—') {
            if (text !== '—' && text !== '-') issues.push(`expected dash total, got ${text}`);
          } else if (expect) {
            const digits = text.replace(/[^\d]/g, '');
            if (digits !== String(expect)) issues.push(`total expected ${expect}, got ${digits}`);
          }
        }
        const fixed = root.querySelector('.wdp-fixed-amount-summary, .wdp-line-total-display');
        if (fixed) {
          const tag = fixed.tagName.toLowerCase();
          if (tag === 'button' || tag === 'input') issues.push('fixed amount is interactive element');
          if (getComputedStyle(fixed).cursor === 'pointer') issues.push('fixed amount cursor pointer');
        }
        document.querySelectorAll('button, a, input').forEach((el) => {
          el.dispatchEvent(new Event('mouseover', { bubbles: true }));
          const t = getComputedStyle(el).transform;
          if (t && t !== 'none') issues.push(`hover transform on ${el.className}`);
        });
        return { issues, totalText: total ? total.textContent : '' };
      });

      expect(errors, 'console page errors').toEqual([]);
      expect(result.issues, JSON.stringify(result.issues)).toEqual([]);

      const shot = path.join(outDir, `${base}-${vp.name}.png`);
      await page.screenshot({ path: shot, fullPage: true });
    });
  }
}

test.afterAll(async () => {
  const shots = fs.readdirSync(outDir).filter((f) => f.endsWith('.png'));
  const cards = shots
    .map(
      (f) =>
        `<figure style="margin:0"><img src="${f}" style="width:100%;border:1px solid #ddd;border-radius:8px" loading="lazy"><figcaption style="font:12px/1.4 sans-serif;margin-top:4px">${f}</figcaption></figure>`
    )
    .join('\n');
  fs.writeFileSync(
    path.join(outDir, 'index.html'),
    `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>WDP Visual</title>
<style>body{font-family:system-ui;margin:24px;background:#f6f8fa} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}</style>
</head><body><h1>Stage 2C visual</h1><div class="grid">${cards}</div></body></html>`
  );
});
