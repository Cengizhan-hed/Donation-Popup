// Vitrin ekran görüntüleri: node design/shoot.mjs [ekran,ekran] [tema,tema]
import { chromium, webkit } from 'playwright';
import fs from 'node:fs';
const BASE = 'http://localhost:9910';
const screens = (process.argv[2] || 'popup,rtl,panel,inline,sheet,sheetkb,cart,campaign,list,thanks,social,tax,account,mydonations,wizard,settings').split(',');
const themes = (process.argv[3] || 'avada,blocksy,tt25,storefront').split(',');
const langOf = { avada: 'tr', blocksy: 'en', tt25: 'tr', storefront: 'en', neutral: 'tr' };
const vps = { mobil: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, masaustu: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
const dark = process.argv[4] === 'dark';
fs.mkdirSync('design/showcase', { recursive: true });
const b = await chromium.launch(); const errs = [];
for (const th of themes) for (const [vn, vp] of Object.entries(vps)) {
  const ctx = await b.newContext({ ...vp, reducedMotion: 'no-preference', colorScheme: dark ? 'dark' : 'light' }); const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(`${th}/${vn} pageerror ${e.message}`)); page.on('console', m => { if (m.type() === 'error') errs.push(`${th}/${vn} console ${m.text()}`); });
  for (const sc of screens) {
    const lang = sc === 'rtl' ? 'ar' : langOf[th];
    const full = ['campaign', 'list', 'social', 'mydonations', 'wizard', 'settings', 'inline'].includes(sc) && vn === 'masaustu' ? false : false;
    await page.goto(`${BASE}/${sc}.html?lang=${lang}&theme=${th}${dark ? '&scheme=dark' : ''}&confetti=0`, { waitUntil: 'load' });
    await page.waitForTimeout(sc === 'campaign' ? 2100 : sc === 'sheetkb' ? 1500 : sc === 'thanks' ? 1700 : 1000);
    const name = `${sc}-${th}-${vn}${dark ? '-koyu' : ''}`;
    const fp = ['campaign', 'list', 'social', 'mydonations', 'settings', 'wizard'].includes(sc);
    await page.screenshot({ path: `design/showcase/${name}.png`, fullPage: fp && vn === 'mobil' ? false : false });
  }
  await ctx.close();
}
await b.close(); fs.writeFileSync('design/showcase/.errors.txt', errs.join('\n')); console.log('errors', errs.length); console.log(errs.slice(0, 15).join('\n'));
