/**
 * 12.2 tapfix: dokunuş → panel algılaması (MutationObserver, kare gecikmesi yok) ve görünür/üstteki hedef seçimi.
 * Sahte pencere + sahte zamanlama; tarayıcı ve ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { installTapProbe, pickVisibleTarget } from '../../../scripts/lib/plugin-perf.mjs';

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
  it('ekran dışı slayt, sıfır boyut, gizli ve üstü örtülü öğeler atlanır; ilk uygun seçilir', () => {
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
    assert.equal(pickVisibleTarget(w, '[data-dp-preset]'), 4);
  });

  it('çocuk öğe isabeti kabul; dikeyde ekran dışı öğe kaydırılıp denenir', () => {
    const child = {};
    const { w } = layoutWindow(
      (win) => [el(win, { x: 10, y: 1500, w: 100, h: 44 }, { child })],
      () => child
    );
    assert.equal(pickVisibleTarget(w, '[data-dp-open]'), 0);
    assert.ok(w.scrollY > 0);
  });

  it('uygun hedef yoksa -1', () => {
    const { w } = layoutWindow(
      (win) => [el(win, { x: -200, y: 100, w: 80, h: 44 }), el(win, { x: 10, y: 100, w: 80, h: 44 }, { opacity: '0' })],
      () => null
    );
    assert.equal(pickVisibleTarget(w, '[data-dp-preset]'), -1);
  });
});
