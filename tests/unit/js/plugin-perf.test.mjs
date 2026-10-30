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
  fontMatches,
  INP_RUNS,
  inlinePluginStyles,
  inpSummary,
  isPluginCookie,
  isPluginUrl,
  judgeMetric,
  maxInteraction,
  median,
  mergeIntervals,
  nearFontLoad,
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
    assert.equal(r.font, 0);
  });
  it('kayma yoksa 0', () => {
    assert.deepEqual(clsAttribution([]), { plugin: 0, font: 0, total: 0, pluginShifts: 0, fontShifts: 0, unknown: 0 });
  });
  it('font swap: eklenti + tema öğesi aynı karede ve font yüklemesi penceresinde → tema/font sütunu', () => {
    const fontTimes = [1200];
    const r = clsAttribution(
      [
        // Tema başlığı + eklenti formu birlikte, font bitişinden 40 ms sonra → font.
        { value: 0.00058, startTime: 1240, hadRecentInput: false, sources: [{ plugin: false }, { plugin: true }] },
        // Yalnız eklenti öğesi kayıyor (font penceresinde bile) → eklenti.
        { value: 0.002, startTime: 1250, hadRecentInput: false, sources: [{ plugin: true }] },
        // Karışık ama font penceresi dışında → eklenti (muhafazakâr).
        { value: 0.003, startTime: 3000, hadRecentInput: false, sources: [{ plugin: false }, { plugin: true }] },
        // Eklenti + yalnız belgeden çıkmış düğüm (eklenti dışı kanıt yok) → eklenti.
        { value: 0.0001, startTime: 1210, hadRecentInput: false, sources: [{ plugin: true }, { plugin: false, detached: true }] },
        // Yalnız tema → hiçbirine yazılmaz.
        { value: 0.01, startTime: 1230, hadRecentInput: false, sources: [{ plugin: false }] },
      ],
      { fontTimes }
    );
    assert.equal(r.font, 0.00058);
    assert.equal(r.fontShifts, 1);
    assert.equal(r.plugin, 0.0051);
    assert.equal(r.pluginShifts, 3);
    assert.equal(r.total, 0.01568);
  });
  it('FontFace olayı yokken: eklenti + tema salt yatay metin akışı ≤100 ms arayla → tema/font; dikey kayma eklentide kalır', () => {
    const P = (dy, dh, dx) => ({ plugin: true, dy, dh, dx });
    const T = (dy, dh, dx) => ({ plugin: false, dy, dh, dx });
    // Storefront gözlemi: tema menü düğmesi dx4 (1854), eklenti düğme etiketi dx±3 (1888).
    const r = clsAttribution([
      { value: 0.00006, startTime: 1854, sources: [T(0, 0, 4)] },
      { value: 0.00003, startTime: 1888, sources: [P(0, 0, 3), P(0, 0, -3)] },
    ]);
    assert.equal(r.plugin, 0);
    assert.equal(r.font, 0.00003);
    // Eklenti öğesi dikey kayıyor (gerçek CLS) → eklenti.
    assert.equal(clsAttribution([{ value: 0.00006, startTime: 1854, sources: [T(0, 0, 4)] }, { value: 0.001, startTime: 1880, sources: [P(18, 0, 0)] }]).plugin, 0.001);
    // Tema akışı 101 ms uzakta → eklenti.
    assert.equal(clsAttribution([{ value: 0.00006, startTime: 1000, sources: [T(0, 0, 4)] }, { value: 0.00003, startTime: 1101, sources: [P(0, 0, 3)] }]).plugin, 0.00003);
    // Yalnız eklenti akışı (tema kanıtı yok) → eklenti.
    assert.equal(clsAttribution([{ value: 0.00003, startTime: 1888, sources: [P(0, 0, 3)] }]).plugin, 0.00003);
    // Tema kayması dikey (metin akışı değil) → kanıt sayılmaz.
    assert.equal(clsAttribution([{ value: 0.00006, startTime: 1854, sources: [T(12, 0, 0)] }, { value: 0.00003, startTime: 1888, sources: [P(0, 0, 3)] }]).plugin, 0.00003);
  });
  it('font zamanı yoksa karışık kayma eklentiye yazılır; pencere sınırları', () => {
    const s = [{ value: 0.001, startTime: 500, hadRecentInput: false, sources: [{ plugin: false }, { plugin: true }] }];
    assert.equal(clsAttribution(s).plugin, 0.001);
    assert.equal(clsAttribution(s, { fontTimes: [450] }).font, 0.001); // +50 ms
    assert.equal(clsAttribution(s, { fontTimes: [550] }).font, 0.001); // −50 ms (sınır)
    assert.equal(clsAttribution(s, { fontTimes: [551] }).plugin, 0.001); // pencere önü dışı
    assert.equal(clsAttribution(s, { fontTimes: [199] }).plugin, 0.001); // +301 ms dışı
    assert.equal(nearFontLoad(NaN, [1]), false);
  });
  it('yalnız eklenti metni kendi yazı tipi yüklenince kayar (Ikram ana sayfa: #text<small dy1, font 4 ms önce) → tema/font', () => {
    const src = (font, extra = {}) => ({ plugin: true, text: true, dy: 1, dh: 0, dx: 0, font, ...extra });
    const inter500 = { t: 4059, family: 'Inter', weight: '500', style: 'normal' };
    const s = [{ value: 0.00002, startTime: 4063, sources: [src(['"Inter", sans-serif', '500', 'normal'])] }];
    const r = clsAttribution(s, { fontTimes: [4059], fontFaces: [inter500] });
    assert.equal(r.plugin, 0);
    assert.equal(r.font, 0.00002);
    // Başka kalınlık yüklendi → eşleşme yok → eklenti (muhafazakâr).
    assert.equal(clsAttribution(s, { fontFaces: [{ ...inter500, weight: '700' }] }).plugin, 0.00002);
    // Değişken yazı tipi aralığı kapsar.
    assert.equal(clsAttribution(s, { fontFaces: [{ ...inter500, weight: '100 900' }] }).font, 0.00002);
    // Pencere dışı (yazı tipi 400 ms önce) → eklenti.
    assert.equal(clsAttribution(s, { fontFaces: [{ ...inter500, t: 3663 }] }).plugin, 0.00002);
    // Boy değişti (betik metni değiştirdi) ya da öğe (metin değil) → eklenti.
    assert.equal(clsAttribution([{ ...s[0], sources: [src(['Inter', '500', 'normal'], { dh: 3 })] }], { fontFaces: [inter500] }).plugin, 0.00002);
    assert.equal(clsAttribution([{ ...s[0], sources: [src(null, { text: false })] }], { fontFaces: [inter500] }).plugin, 0.00002);
  });
  it('fontMatches: aile (tırnak/büyük harf), kalınlık (anahtar sözcük/aralık), stil', () => {
    assert.equal(fontMatches({ family: 'Inter', weight: 'normal', style: 'normal' }, ["'inter', Arial", '400', 'normal']), true);
    assert.equal(fontMatches({ family: 'Inter', weight: 'bold' }, ['Inter', '700', 'normal']), true);
    assert.equal(fontMatches({ family: 'Inter', weight: '400' }, ['Roboto, Inter', '400', 'normal']), false);
    assert.equal(fontMatches({ family: 'Inter', weight: '400', style: 'italic' }, ['Inter', '400', 'normal']), false);
    assert.equal(fontMatches(null, ['Inter', '400', 'normal']), false);
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
    const one = zlib.gzipSync(Buffer.from(css), { level: 9 }).length;
    assert.deepEqual(r.surfaces, { 'donation-panel-inline-form': one, 'donation-panel-inline-list': one });
    assert.equal(r.maxSurfaceGzip, one);
    assert.deepEqual(inlinePluginStyles('<style>x</style>'), { count: 0, raw: 0, gzip: 0, ids: [], surfaces: {}, maxSurfaceGzip: 0 });
  });
});

describe('§25 bütçe eşikleri', () => {
  it('yüzey ≤9216 B, sayfa ≤16384 B gzip; CSS dosyası 0; engelleyen 0', () => {
    assert.equal(judgeMetric('inlineCssSurfaceGzip', 9216).pass, true);
    assert.equal(judgeMetric('inlineCssSurfaceGzip', 9217).pass, false);
    assert.equal(judgeMetric('inlineCssGzip', 16384).pass, true);
    assert.equal(judgeMetric('inlineCssGzip', 16385).pass, false);
    assert.equal(judgeMetric('cssGzip', 0).pass, true);
    assert.equal(judgeMetric('cssGzip', 1).pass, false);
    assert.equal(judgeMetric('blocking', 0).pass, true);
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

describe('INP: 5 örnek medyanı', () => {
  it('maxInteraction: penceredeki en uzun etkileşim; kimliksiz olay sayılmaz; boşsa 0', () => {
    const evs = [
      { interactionId: 1, startTime: 100, duration: 40 },
      { interactionId: 1, startTime: 101, duration: 72 },
      { interactionId: 2, startTime: 300, duration: 120 },
      { interactionId: 0, startTime: 150, duration: 900 },
    ];
    assert.equal(maxInteraction(evs, 0, 200), 72);
    assert.equal(maxInteraction(evs, 200), 120);
    assert.equal(maxInteraction(evs, 500), 0);
  });
  it('inpSummary: medyan tek aykırı örnekten etkilenmez; NaN örnek medyana girmez', () => {
    assert.equal(INP_RUNS, 5);
    const s = inpSummary([
      { open: 40, amount: 24 },
      { open: 260, amount: NaN },
      { open: 48, amount: 30 },
      { open: 52.4, amount: 20 },
      { open: 44, amount: 26 },
    ]);
    assert.deepEqual(s.openRuns, [40, 260, 48, 52, 44]);
    assert.equal(s.open, 48);
    assert.deepEqual(s.amountRuns, [24, 30, 20, 26]);
    assert.equal(s.amount, 25);
    assert.equal(judgeMetric('inpOpen', s.open).pass, true);
    assert.equal(judgeMetric('inpOpen', 260).pass, false);
  });
  it('inpSummary: hiç ölçüm yoksa NaN (ÖLÇÜLMEDİ)', () => {
    const s = inpSummary([{ open: NaN, amount: NaN }]);
    assert.ok(Number.isNaN(s.open));
    assert.equal(judgeMetric('inpAmount', s.amount).pass, null);
  });
});
