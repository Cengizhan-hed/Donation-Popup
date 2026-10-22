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
  snapshotBlockedTrackers,
  throwIfRemoteOrderBlocked,
  consumeOrderBlocks,
  RemoteOrderBlockedError,
} from '../../../tests/e2e/helpers/network-guard.mjs';

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
});
