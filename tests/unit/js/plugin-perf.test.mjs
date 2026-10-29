/**
 * 12.2 perf: eklentiye ait hız sayılarının atıf mantığı (sahte iz/kayma verisi; tarayıcı ve ağ yok).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {
  attributeTrace,
  clsAttribution,
  eventUrl,
  inlinePluginStyles,
  isPluginCookie,
  isPluginUrl,
  judgeMetric,
  median,
  mergeIntervals,
  parsePagesArg,
} from '../../../scripts/lib/plugin-perf.mjs';

const P = 'https://site.test/wp-content/plugins/woo-donation-popup/assets/build/experiences.js?ver=12.2.0';
const T = 'https://site.test/wp-content/themes/x/app.js';
const meta = (pid, tid, name) => ({ ph: 'M', name: 'thread_name', pid, tid, ts: 0, args: { name } });
const ev = (name, ts, dur, url, pid = 1, tid = 1) => ({ ph: 'X', name, ts, dur, pid, tid, args: { data: { url } } });
const task = (ts, dur, pid = 1, tid = 1) => ({ ph: 'X', name: 'RunTask', ts, dur, pid, tid, args: {} });

describe('isPluginUrl', () => {
  it('eklenti dizini ve REST ad alanı eşleşir; benzer adlar ve tema eşleşmez', () => {
    assert.equal(isPluginUrl(P), true);
    assert.equal(isPluginUrl('https://s.test/wp-json/donation-panel/v1/cart'), true);
    assert.equal(isPluginUrl('https://s.test/?rest_route=/donation-panel/v1/x'), true);
    assert.equal(isPluginUrl('https://s.test/?rest_route=%2Fdonation-panel%2Fv1'), true);
    assert.equal(isPluginUrl(T), false);
    assert.equal(isPluginUrl('https://s.test/wp-content/plugins/woo-donation-popup-pro/x.js'), false);
    assert.equal(isPluginUrl('https://s.test/product/woo-donation-popup/'), false);
    assert.equal(isPluginUrl(''), false);
  });
  it('çerez öneki: eklentininki sayılır, WooCommerce sepet/oturum çerezleri sayılmaz', () => {
    assert.equal(isPluginCookie('wdp_vid'), true);
    assert.equal(isPluginCookie('donation_panel_x'), true);
    assert.equal(isPluginCookie('woocommerce_cart_hash'), false);
    assert.equal(isPluginCookie('wp_woocommerce_session_abc'), false);
  });
});

describe('attributeTrace', () => {
  it('iç içe derleme + değerlendirme + çağrı iki kez sayılmaz; tema betiği sayılmaz', () => {
    const r = attributeTrace({
      traceEvents: [
        meta(1, 1, 'CrRendererMain'),
        ev('EvaluateScript', 1000, 10000, P), // 10 ms
        ev('v8.compile', 1000, 3000, P), // içinde
        ev('FunctionCall', 30000, 5000, P), // +5 ms
        ev('FunctionCall', 32000, 6000, P), // 30–38: birleşik +3 ms → toplam 18
        ev('EvaluateScript', 50000, 40000, T),
      ],
    });
    assert.equal(r.scriptMs, 18);
    assert.equal(r.byUrl['assets/build/experiences.js'], 18);
  });
  it('yalnız ana iş parçacığı (CrRendererMain) sayılır', () => {
    const r = attributeTrace([meta(1, 1, 'CrRendererMain'), meta(1, 2, 'DedicatedWorker thread'), ev('EvaluateScript', 0, 4000, P, 1, 1), ev('EvaluateScript', 0, 90000, P, 1, 2)]);
    assert.equal(r.scriptMs, 4);
  });
  it('uzun görev atfı: eklenti payı ≥ %50 ya da >50 ms ise eklentinin; az payda yalnız katkılı', () => {
    const r = attributeTrace([
      meta(1, 1, 'CrRendererMain'),
      task(0, 80000), // 80 ms görev, eklenti 60 ms → eklentinin
      ev('EvaluateScript', 1000, 60000, P),
      task(100000, 120000), // 120 ms görev, eklenti 10 ms → katkılı
      ev('FunctionCall', 101000, 10000, P),
      ev('FunctionCall', 115000, 100000, T),
      task(300000, 40000), // 40 ms: uzun değil
      ev('FunctionCall', 300000, 40000, P),
      task(400000, 70000), // 70 ms, eklenti yok
    ]);
    assert.equal(r.longTasks, 1);
    assert.equal(r.contributedLongTasks, 1);
    assert.equal(r.allLongTasks, 3);
    assert.deepEqual(r.longTaskDetails, [{ dur: 80, pluginMs: 60 }]);
  });
  it('tam 50 ms görev uzun sayılmaz; olay adresi farklı alanlardan okunur', () => {
    const r = attributeTrace([task(0, 50000), ev('EvaluateScript', 0, 50000, P)]);
    assert.equal(r.allLongTasks, 0);
    assert.equal(eventUrl({ args: { data: { scriptName: P } } }), P);
    assert.equal(eventUrl({ args: { fileName: P } }), P);
    assert.equal(eventUrl({}), '');
  });
  it('aralık birleştirme', () => {
    assert.deepEqual(mergeIntervals([[5, 9], [0, 3], [2, 4], [9, 10], [7, 7]]), [[0, 4], [5, 10]]);
  });
});

describe('clsAttribution', () => {
  it('yalnız eklenti kaynaklı ve girdi sonrası olmayan kaymalar', () => {
    const r = clsAttribution([
      { value: 0.02, hadRecentInput: false, sources: [{ plugin: true }] },
      { value: 0.05, hadRecentInput: false, sources: [{ plugin: false }] },
      { value: 0.3, hadRecentInput: true, sources: [{ plugin: true }] },
      { value: 0.01, hadRecentInput: false, sources: [{ plugin: false }, { plugin: true }] },
      { value: 0.004, hadRecentInput: false, sources: [{ plugin: false, detached: true }] },
    ]);
    assert.equal(r.plugin, 0.03);
    assert.equal(r.pluginShifts, 2);
    assert.equal(r.total, 0.084);
    assert.equal(r.unknown, 1);
  });
  it('kayma yoksa 0', () => {
    assert.deepEqual(clsAttribution([]), { plugin: 0, total: 0, pluginShifts: 0, unknown: 0 });
  });
});

describe('inlinePluginStyles', () => {
  it('yalnız donation-panel-inline kimlikli stiller; gzip birlikte', () => {
    const css = '.donation-panel{color:red}'.repeat(20);
    const html = `<style id="theme-css">body{}</style><style id="donation-panel-inline-form">${css}</style><style id='donation-panel-inline-list' media="all">${css}</style>`;
    const r = inlinePluginStyles(html);
    assert.equal(r.count, 2);
    assert.equal(r.raw, css.length * 2);
    assert.equal(r.gzip, zlib.gzipSync(Buffer.from(css + css), { level: 9 }).length);
    assert.deepEqual(r.ids, ['donation-panel-inline-form', 'donation-panel-inline-list']);
    assert.deepEqual(inlinePluginStyles('<style>x</style>'), { count: 0, raw: 0, gzip: 0, ids: [] });
  });
});

describe('judgeMetric / yardımcılar', () => {
  it('eşikler: ≤ ve < sınırları, ölçülmeyen', () => {
    assert.equal(judgeMetric('mainThreadMs', 50).pass, true);
    assert.equal(judgeMetric('mainThreadMs', 50.1).pass, false);
    assert.equal(judgeMetric('tapToPanel', 100).pass, false);
    assert.equal(judgeMetric('tapToPanel', 99).pass, true);
    assert.equal(judgeMetric('inpOpen', 199).pass, true);
    assert.equal(judgeMetric('blocking', 1).pass, false);
    assert.equal(judgeMetric('cls', 0).pass, true);
    assert.equal(judgeMetric('cls', 0.001).pass, false);
    assert.equal(judgeMetric('uiLessQueries', NaN).pass, null);
    assert.throws(() => judgeMetric('yok', 1));
  });
  it('medyan ve --pages ayrıştırma', () => {
    assert.equal(median([5, 1, 3]), 3);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.ok(Number.isNaN(median([])));
    assert.deepEqual(parsePagesArg('ana=/, urun=/urun/x/?a=1'), [
      { id: 'ana', path: '/' },
      { id: 'urun', path: '/urun/x/?a=1' },
    ]);
    assert.throws(() => parsePagesArg('ana'));
    assert.throws(() => parsePagesArg('ana=https://x'));
  });
});
