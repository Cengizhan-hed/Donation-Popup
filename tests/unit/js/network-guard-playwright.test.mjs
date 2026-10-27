/**
 * Yerel Playwright kanıtı — uzak site yok. Tracker istekleri sunucuya ulaşmaz;
 * uzakta POST checkout REMOTE-ORDER-BLOCKED ile kırmızı.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from '@playwright/test';
import {
  applyNetworkGuard,
  resetBlockedTrackers,
  resetRemotePostBlocked,
  snapshotBlockedTrackers,
  snapshotBlockedLive,
  snapshotRemotePostBlocked,
  snapshotPluginAjaxFails,
  throwIfRemoteOrderBlocked,
  throwIfRemoteAdminWriteBlocked,
  throwIfRemoteRetiredHostBlocked,
  throwIfRemoteForeignWriteBlocked,
  consumeOrderBlocks,
  consumeAdminWriteBlocks,
  consumeRetiredHostBlocks,
  consumeForeignWriteBlocks,
  RemoteOrderBlockedError,
  RemoteAdminWriteBlockedError,
  RemoteRetiredHostBlockedError,
} from '../../../tests/e2e/helpers/network-guard.mjs';
import {
  assertNoUnexpectedPluginErrors,
  assertNoPluginAjaxFailures,
  assertNoConsoleErrors,
} from '../../../tests/e2e/helpers/checks.mjs';

/** @type {http.Server} */
let server;
/** @type {number} */
let port;
/** @type {string[]} */
const hits = [];

function startServer() {
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      hits.push(`${req.method} ${req.url}`);
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (url.pathname === '/' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!doctype html><html><body>
          <p>guard-proof</p>
          <script>
            window.__trackerTried = 0;
            window.__trackerReached = 0;
            window.__trackerBlocked = 0;
            function ping(u) {
              window.__trackerTried++;
              fetch(u, { mode: 'cors' }).then(
                function () { window.__trackerReached++; },
                function () { window.__trackerBlocked++; }
              );
            }
            ping('https://www.googletagmanager.com/gtm.js?id=GTM-PROOF');
            ping('https://connect.facebook.net/en_US/fbevents.js');
          </script>
        </body></html>`);
        return;
      }
      if (url.searchParams.get('wc-ajax') === 'checkout' && req.method === 'POST') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
        return;
      }
      if (url.pathname === '/wp-admin/admin-ajax.php' && req.method === 'POST') {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          hits.push(`BODY ${raw.slice(0, 180)}`);
          let action = String(url.searchParams.get('action') || '');
          if (!action) {
            const urlenc = raw.match(/(?:^|&)action=([^&]*)/);
            const multi = raw.match(/name=["']?action["']?[^\r\n]*\r?\n\r?\n([^\r\n]*)/);
            const jsonM = raw.match(/"action"\s*:\s*"([^"]+)"/);
            action = decodeURIComponent(
              String((urlenc && urlenc[1]) || (multi && multi[1]) || (jsonM && jsonM[1]) || '')
            ).trim();
          }
          hits.push(`ACTION ${action}`);
          if (action === 'wdp_get_product_info') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ success: true, data: { min: '5.00' } }));
            return;
          }
          if (action === 'wdp_fail_probe') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ success: false, data: { message: 'SECRET_BODY_SHOULD_NOT_APPEAR' } }));
            return;
          }
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: { action } }));
        });
        return;
      }
      res.writeHead(404);
      res.end('no');
    });
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });
}

describe('network-guard Playwright kanıt', () => {
  before(async () => {
    await startServer();
  });
  after(async () => {
    await new Promise((r) => server.close(r));
  });

  it('gtm + facebook istekleri sunucuya ulaşmaz, sayaç 2', async () => {
    resetBlockedTrackers();
    consumeOrderBlocks();
    hits.length = 0;
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext();
      await applyNetworkGuard(context, {
        remote: false,
        siteHost: '127.0.0.1',
        blockTrackers: true,
      });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.__trackerTried >= 2, { timeout: 5000 });
      await page.waitForTimeout(300);
      const snap = snapshotBlockedTrackers();
      assert.equal(snap.total, 2, JSON.stringify(snap.byHost));
      assert.ok(snap.byHost['www.googletagmanager.com'] >= 1);
      assert.ok(snap.byHost['connect.facebook.net'] >= 1);
      const reached = await page.evaluate(() => window.__trackerReached);
      assert.equal(reached, 0);
      assert.equal(
        hits.some((h) => /gtm|facebook/i.test(h)),
        false
      );
    } finally {
      await browser.close();
    }
  });

  it('uzak profil benzetimi: POST wc-ajax=checkout → REMOTE-ORDER-BLOCKED (beklenen kırmızı)', async () => {
    resetBlockedTrackers();
    consumeOrderBlocks();
    hits.length = 0;
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext();
      await applyNetworkGuard(context, {
        remote: true,
        siteHost: '127.0.0.1',
        checkoutPath: '/checkout/',
      });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
      const fetchResult = await page.evaluate(async (origin) => {
        try {
          const res = await fetch(`${origin}/?wc-ajax=checkout`, {
            method: 'POST',
            body: 'billing_first_name=E2E',
          });
          return { ok: res.ok, status: res.status };
        } catch (e) {
          return { ok: false, error: String(e && e.message ? e.message : e) };
        }
      }, `http://127.0.0.1:${port}`);
      assert.equal(fetchResult.ok, false);
      assert.equal(
        hits.some((h) => h.includes('wc-ajax=checkout')),
        false,
        'checkout POST sunucuya ulaşmamalı'
      );
      assert.throws(() => throwIfRemoteOrderBlocked(), (e) => {
        assert.ok(e instanceof RemoteOrderBlockedError);
        assert.match(String(e.message), /REMOTE-ORDER-BLOCKED:/);
        return true;
      });
    } finally {
      await browser.close();
    }
  });

  it('uzak benzetim: FormData wdp_get_product_info sunucuya ulaşır, uyarı yok', async () => {
    resetBlockedTrackers();
    resetRemotePostBlocked();
    consumeOrderBlocks();
    consumeAdminWriteBlocks();
    hits.length = 0;
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext();
      await applyNetworkGuard(context, {
        remote: true,
        siteHost: '127.0.0.1',
      });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
      const result = await page.evaluate(async (origin) => {
        const fd = new FormData();
        fd.append('action', 'wdp_get_product_info');
        fd.append('product_id', '9');
        const res = await fetch(`${origin}/wp-admin/admin-ajax.php`, {
          method: 'POST',
          body: fd,
          credentials: 'same-origin',
        });
        const json = await res.json();
        return { ok: res.ok, success: json && json.success, min: json && json.data && json.data.min };
      }, `http://127.0.0.1:${port}`);
      assert.equal(result.ok, true);
      assert.equal(result.success, true);
      assert.equal(result.min, '5.00');
      assert.ok(
        hits.some((h) => h.includes('ACTION wdp_get_product_info')),
        'FormData action sunucuya ulaşmalı'
      );
      assert.equal(snapshotRemotePostBlocked().total, 0);
    } finally {
      await browser.close();
    }
  });

  it('uzak benzetim: FormData wdp_save_* REMOTE-ADMIN-WRITE-BLOCKED', async () => {
    resetBlockedTrackers();
    resetRemotePostBlocked();
    consumeOrderBlocks();
    consumeAdminWriteBlocks();
    hits.length = 0;
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext();
      await applyNetworkGuard(context, {
        remote: true,
        siteHost: '127.0.0.1',
      });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
      const result = await page.evaluate(async (origin) => {
        const fd = new FormData();
        fd.append('action', 'wdp_save_placement_settings');
        try {
          const res = await fetch(`${origin}/wp-admin/admin-ajax.php`, {
            method: 'POST',
            body: fd,
          });
          return { ok: res.ok, status: res.status };
        } catch (e) {
          return { ok: false, error: String(e && e.message ? e.message : e) };
        }
      }, `http://127.0.0.1:${port}`);
      assert.equal(result.ok, false);
      assert.equal(
        hits.some((h) => h.includes('ACTION wdp_save_placement_settings')),
        false,
        'yönetici action sunucuya ulaşmamalı'
      );
      const snap = snapshotRemotePostBlocked();
      assert.ok(snap.total >= 1);
      assert.ok(
        Object.keys(snap.byPath).some((k) => /action=wdp_save_placement_settings/.test(k)),
        JSON.stringify(snap.byPath)
      );
      assert.throws(() => throwIfRemoteAdminWriteBlocked(), (e) => {
        assert.ok(e instanceof RemoteAdminWriteBlockedError);
        assert.match(String(e.message), /REMOTE-ADMIN-WRITE-BLOCKED:/);
        return true;
      });
    } finally {
      await browser.close();
    }
  });

  it('kasıtlı success=false → senaryo KIRMIZI (gövde yok)', async () => {
    resetBlockedTrackers();
    resetRemotePostBlocked();
    consumeOrderBlocks();
    consumeAdminWriteBlocks();
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext();
      await applyNetworkGuard(context, {
        remote: false,
        siteHost: '127.0.0.1',
      });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(async (origin) => {
        await fetch(`${origin}/wp-admin/admin-ajax.php`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: 'action=wdp_fail_probe',
        });
      }, `http://127.0.0.1:${port}`);
      await page.waitForTimeout(300);
      const hitsAjax = snapshotPluginAjaxFails();
      assert.ok(hitsAjax.length >= 1, JSON.stringify(hitsAjax));
      assert.equal(hitsAjax[0].action, 'wdp_fail_probe');
      assert.equal(String(JSON.stringify(hitsAjax)).includes('SECRET_BODY_SHOULD_NOT_APPEAR'), false);
      assert.throws(() => assertNoPluginAjaxFailures(hitsAjax), (e) => {
        assert.match(String(e.message), /action=wdp_fail_probe/);
        assert.equal(String(e.message).includes('SECRET_BODY_SHOULD_NOT_APPEAR'), false);
        return true;
      });
    } finally {
      await browser.close();
    }
  });

  it('görünür genel gönderim hatası açık kabukta KIRMIZI', async () => {
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.setContent(`<!doctype html><html><body>
        <div data-dp-overlay class="dp-overlay is-open">
          <form data-dp-form>
            <div data-dp-summary class="is-visible" role="alert">Something went wrong. Please try again.</div>
          </form>
        </div>
      </body></html>`);
      await assert.rejects(
        () => assertNoUnexpectedPluginErrors(page, { scenarioId: 'iphone-panel-custom-open' }),
        /Something went wrong/
      );
      // errors senaryosunda beklenen alan doğrulaması (genel hata değil) serbest
      await page.setContent(`<!doctype html><html><body>
        <div data-dp-overlay class="dp-overlay is-open">
          <form data-dp-form>
            <div data-dp-summary class="is-visible" role="alert">Please check the highlighted fields.</div>
            <div data-dp-field class="has-error"><p data-dp-error="donation_full_name">Name is required</p></div>
          </form>
        </div>
      </body></html>`);
      await assertNoUnexpectedPluginErrors(page, { scenarioId: 'iphone-panel-custom-errors' });
    } finally {
      await browser.close();
    }
  });

  it('uzak: canlı font + emekli staging28 POST sunucuya ulaşmaz', async () => {
    resetBlockedTrackers();
    resetRemotePostBlocked();
    consumeOrderBlocks();
    consumeAdminWriteBlocks();
    consumeRetiredHostBlocks();
    consumeForeignWriteBlocks();
    hits.length = 0;
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext();
      await applyNetworkGuard(context, {
        remote: true,
        siteHost: '127.0.0.1',
        allowedHosts: ['127.0.0.1'],
        blockTrackers: true,
      });
      const page = await context.newPage();
      const errors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(async () => {
        window.__liveTried = 0;
        window.__liveReached = 0;
        window.__retiredTried = 0;
        window.__retiredReached = 0;
        function ping(u, flagTried, flagReached) {
          window[flagTried]++;
          return fetch(u, { method: 'GET', mode: 'cors' }).then(
            function () {
              window[flagReached]++;
            },
            function () {
              /* iptal beklenen */
            }
          );
        }
        await ping(
          'https://hedefdernegi.org/wp-content/themes/Avada/fonts/font.woff2', // live-scan:blacklist-def
          '__liveTried',
          '__liveReached'
        );
        window.__retiredTried++;
        try {
          const res = await fetch('https://staging28.hedefdernegi.org/wp-admin/admin-ajax.php', { // live-scan:allow-reject-test
            method: 'POST',
            body: 'action=heartbeat',
          });
          if (res && res.ok) window.__retiredReached++;
        } catch {
          /* iptal beklenen */
        }
      });
      await page.waitForTimeout(400);
      const live = await page.evaluate(() => ({
        tried: window.__liveTried,
        reached: window.__liveReached,
        retiredTried: window.__retiredTried,
        retiredReached: window.__retiredReached,
      }));
      assert.equal(live.reached, 0);
      assert.equal(live.retiredReached, 0);
      assert.equal(
        hits.some((h) => /hedefdernegi|staging28|Avada/i.test(h)),
        false,
        'canlı/emekli istek yerel sunucuya düşmemeli'
      );
      const liveSnap = snapshotBlockedLive();
      assert.ok(liveSnap.total >= 1, JSON.stringify(liveSnap));
      assert.throws(() => throwIfRemoteRetiredHostBlocked(), (e) => {
        assert.ok(e instanceof RemoteRetiredHostBlockedError);
        assert.match(String(e.message), /REMOTE-RETIRED-HOST:/);
        return true;
      });
      assert.doesNotThrow(() => throwIfRemoteForeignWriteBlocked());
      assertNoConsoleErrors(errors.map((t) => t.slice(0, 300)));
    } finally {
      await browser.close();
    }
  });
});
