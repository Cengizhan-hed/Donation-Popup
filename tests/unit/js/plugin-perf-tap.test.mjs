/**
 * 12.2 tapfix: dokunuş → panel algılaması (MutationObserver, kare gecikmesi yok) ve görünür/üstteki hedef seçimi.
 * Sahte pencere + sahte zamanlama; tarayıcı ve ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { forcedLayoutsInClick, installTapProbe, pickVisibleTarget } from '../../../scripts/lib/plugin-perf.mjs';

/** Sahte pencere: elle ilerleyen saat, rAF kuyruğu, elle tetiklenen MutationObserver. */
function fakeWindow({ triggers = [], dialogs = [] } = {}) {
  const w = { now: 0, frames: [], observers: [] };
  w.performance = { now: () => w.now };
  w.requestAnimationFrame = (cb) => w.frames.push(cb);
  w.frame = (t) => {
    w.now = t;
    const q = w.frames.splice(0);
    q.forEach((cb) => cb(t));
  };
  w.MutationObserver = class {
    constructor(cb) {
      this.cb = cb;
      this.on = false;
      w.observers.push(this);
    }
    observe(target, opts) {
      this.on = true;
      this.opts = opts;
    }
    disconnect() {
      this.on = false;
    }
  };
  w.mutate = () => w.observers.filter((o) => o.on).forEach((o) => o.cb([{ type: 'attributes', attributeName: 'open' }]));
  w.getComputedStyle = (el) => ({ visibility: el.vis || 'visible', display: el.display || 'block', opacity: el.opacity ?? '1' });
  w.document = {
    documentElement: {},
    querySelectorAll: (sel) => (sel === 'dialog[open]' ? dialogs.filter((d) => d.open) : triggers),
  };
  return w;
}

const trigger = () => {
  const t = { listeners: [] };
  t.addEventListener = (type, fn, opts) => t.listeners.push({ type, fn, opts });
  t.click = (timeStamp) => t.listeners.filter((l) => l.type === 'click').forEach((l) => l.fn({ timeStamp }));
  return t;
};
const dialog = (visible = true) => ({ open: false, visible, getClientRects() {
  return this.visible ? [{}] : [];
} });

describe('installTapProbe', () => {
  it('açılış anı MutationObserver ile yakalanır (sonraki kareyi beklemez), t1 iki rAF sonra', () => {
    const trig = trigger();
    const d = dialog();
    const w = fakeWindow({ triggers: [trig], dialogs: [d] });
    const signals = [];
    w.__dpPerfSignal = (name) => signals.push([name, w.now]);
    assert.equal(installTapProbe(w, '[data-dp-open]', 0), true);
    const l = trig.listeners[0];
    assert.deepEqual(l.opts, { capture: true, once: true });
    w.now = 5;
    trig.click(5);
    const mo = w.observers[0];
    assert.deepEqual(mo.opts, { attributes: true, attributeFilter: ['open'], subtree: true, childList: true });
    w.now = 40; // panel kodu diyaloğu 40 ms'de açar; sonraki kare 56 ms'de
    d.open = true;
    w.mutate();
    assert.equal(w.__dpTap.tOpen, 40, 'algılama gecikmesi yok');
    assert.equal(mo.on, false, 'gözlemci bırakıldı');
    w.frame(56);
    assert.equal(w.__dpTap.t1, 0);
    w.frame(72);
    assert.equal(w.__dpTap.t1, 72);
    assert.equal(w.__dpTap.t1 - w.__dpTap.t0, 67); // eski rAF yoklaması: algılama 56 → t1 88 (83 ms)
    assert.deepEqual(signals, [['tap', 72]], 'bitiş bağlamayla bir kez bildirilir (t1 anında)');
  });

  it('tıklama anında zaten açık görünür diyalog hemen sayılır', () => {
    const trig = trigger();
    const d = dialog();
    d.open = true;
    const w = fakeWindow({ triggers: [trig], dialogs: [d] });
    installTapProbe(w, '[data-dp-open]', 0);
    w.now = 3;
    trig.click(3);
    assert.equal(w.__dpTap.tOpen, 3);
    assert.equal(w.observers.length, 0);
  });

  it('açık ama görünmez diyalog: gözlemci saymaz, görünür olduğu karede yedek yoklama yakalar', () => {
    const trig = trigger();
    const d = dialog(false);
    const w = fakeWindow({ triggers: [trig], dialogs: [d] });
    installTapProbe(w, '[data-dp-open]', 0);
    trig.click(0);
    w.now = 10;
    d.open = true;
    w.mutate();
    assert.equal(w.__dpTap.tOpen, 0);
    d.visible = true;
    w.frame(16);
    assert.equal(w.__dpTap.tOpen, 16);
  });

  it('tetikleyici yoksa false', () => {
    assert.equal(installTapProbe(fakeWindow(), '[data-dp-open]', 0), false);
  });
});

/** Sahte öğe: sayfa koordinatında kutu; kaydırma (scrollY) görünüm koordinatını değiştirir. */
function el(w, box, extra = {}) {
  const e = { ...extra, contains: (x) => x === e || (e.child && x === e.child) };
  e.scrollIntoView = () => (w.scrollY += box.y - w.scrollY + box.h / 2 - w.innerHeight / 2);
  e.getBoundingClientRect = () => ({ left: box.x, top: box.y - w.scrollY, width: box.w, height: box.h });
  return e;
}
function layoutWindow(build, hitFor) {
  const w = { innerWidth: 400, innerHeight: 800, scrollY: 0 };
  w.scrollBy = (x, y) => (w.scrollY += y);
  w.getComputedStyle = (e) => ({ visibility: e.vis || 'visible', display: e.display || 'block', opacity: e.opacity ?? '1' });
  const list = build(w);
  w.document = {
    querySelectorAll: () => list,
    elementFromPoint: (x, y) => hitFor(list, x, y),
  };
  return { w, list };
}

describe('pickVisibleTarget', () => {
  it('ekran dışı slayt, sıfır boyut, gizli ve üstü örtülü öğeler atlanır; ilk uygun seçilir', async () => {
    const cover = {};
    const { w } = layoutWindow(
      (win) => [
        el(win, { x: 420, y: 100, w: 80, h: 44 }), // slider: sağda ekran dışı
        el(win, { x: 10, y: 100, w: 0, h: 0 }), // sıfır boyut
        el(win, { x: 10, y: 100, w: 80, h: 44 }, { vis: 'hidden' }),
        el(win, { x: 10, y: 200, w: 80, h: 44 }, { covered: true }), // üst üste slayt: üstte başka öğe
        el(win, { x: 10, y: 300, w: 80, h: 44 }),
      ],
      // elementFromPoint: noktadaki ilk görünür öğe; örtülü olanda üstteki başka öğe ("cover") döner.
      (list, x, y) => {
        const hit = list.find((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && e.vis !== 'hidden' && x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height;
        });
        return hit && hit.covered ? cover : hit;
      }
    );
    const t = await pickVisibleTarget(w, '[data-dp-preset]');
    assert.equal(t.index, 4);
    assert.equal(t.reason, '');
    assert.ok(t.x > 10 && t.x < 90, 'nokta öğenin içinde');
  });

  it('çocuk öğe (SVG yolu gibi) isabeti kabul; dikeyde ekran dışı öğe ortalanıp denenir', async () => {
    const child = { tagName: 'path' };
    const { w } = layoutWindow(
      (win) => [el(win, { x: 10, y: 1500, w: 100, h: 44 }, { child })],
      () => child
    );
    const t = await pickVisibleTarget(w, '[data-dp-open]');
    assert.equal(t.index, 0);
    assert.ok(w.scrollY > 0);
    assert.ok(t.y >= 0 && t.y <= w.innerHeight, 'nokta görünümde');
  });

  it('ekran içindeki öğe de ortalanır: yapışkan üstbilgi altında kalan tetikleyici ortaya alınınca seçilir', async () => {
    const header = { tagName: 'DIV', id: '', className: 'sim-sticky-header' };
    const { w } = layoutWindow(
      (win) => [el(win, { x: 10, y: 20, w: 100, h: 44 })],
      // Üstteki 72 px sabit üstbilgi örter.
      (list, x, y) => (y < 72 ? header : list[0])
    );
    w.scrollY = 0;
    const t = await pickVisibleTarget(w, '[data-dp-open]');
    // Ortalama kaydırması (y=20 → görünümün ortası) negatif kaydırma üretir; sahte pencere bunu da uygular.
    assert.equal(t.index, 0);
    assert.ok(t.y >= 72);
  });

  it('örtülüyse neden üstteki öğeyi adlandırır', async () => {
    const header = { tagName: 'HEADER', id: 'masthead', className: 'site-header is-sticky' };
    const { w } = layoutWindow(
      (win) => [el(win, { x: 10, y: 400, w: 100, h: 44 })],
      () => header
    );
    const t = await pickVisibleTarget(w, '[data-dp-open]');
    assert.equal(t.index, -1);
    assert.match(t.reason, /üstte header#masthead\.site-header\.is-sticky/);
  });

  it('uygun hedef yoksa -1 ve nedenler', async () => {
    const { w } = layoutWindow(
      (win) => [el(win, { x: -200, y: 100, w: 80, h: 44 }), el(win, { x: 10, y: 100, w: 80, h: 44 }, { opacity: '0' })],
      () => null
    );
    const t = await pickVisibleTarget(w, '[data-dp-preset]');
    assert.equal(t.index, -1);
    assert.match(t.reason, /#0 yatayda ekran dışı/);
    assert.match(t.reason, /#1 opacity:0/);
  });
});

describe('forcedLayoutsInClick', () => {
  const ev = (name, ts, durMs, extra = {}) => ({ name, ph: 'X', pid: 1, tid: 2, ts, dur: durMs * 1000, ...extra });
  it('click işleyicisinin içindeki zorunlu stil/düzen hesaplarını sayar; küçükleri ve dışarıdakileri ayırır', () => {
    const trace = {
      traceEvents: [
        ev('EventDispatch', 1000, 130, { args: { data: { type: 'click' } } }),
        ev('EventDispatch', 500, 5, { args: { data: { type: 'pointerdown' } } }),
        ev('UpdateLayoutTree', 1100, 36.7, { args: { elementCount: 1198 } }),
        ev('Layout', 40000, 21.7),
        ev('UpdateLayoutTree', 70000, 0.2, { args: { elementCount: 1 } }),
        ev('UpdateLayoutTree', 600, 3), // pointerdown içinde: sayılmaz
        ev('UpdateLayoutTree', 200000, 9), // tıklamadan sonra (kare): sayılmaz
        { ...ev('Layout', 50000, 8), tid: 9 }, // başka iş parçacığı
      ],
    };
    const r = forcedLayoutsInClick(trace);
    assert.equal(r.clicks, 1);
    assert.equal(r.clickMs, 130);
    assert.equal(r.forced, 2);
    assert.equal(r.small, 1);
    assert.equal(r.styleMs, 36.9);
    assert.equal(r.layoutMs, 21.7);
    assert.deepEqual(r.items[0], { name: 'UpdateLayoutTree', ms: 36.7, elements: 1198 });
  });

  it('click yoksa sıfır', () => {
    assert.equal(forcedLayoutsInClick([]).forced, 0);
  });
});
