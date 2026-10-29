/**
 * iOS Safari ekran klavyesi benzetimi (Simülatör yerine; Playwright WebKit sanal klavye göstermez).
 *
 * Gerçek iOS davranışı (benzetilen):
 *  - Klavye açılınca LAYOUT viewport (window.innerHeight) KÜÇÜLMEZ; yalnız visualViewport.height küçülür.
 *  - Safari odaktaki alanı görünür yapmak için visual viewport'u KAYDIRIR (offsetTop/pageTop büyür): önce `resize`
 *    (offsetTop 0), ~200 ms sonra `scroll` (offsetTop = klavye yüksekliği). Eski kod `layout - vv.height - offsetTop`
 *    ile klavyeyi "0" sanıp kapanmış sayıyordu (zıplama + sabit çubuğun geri gelmesi).
 *  - Alandan alana geçişte (focusout → focusin) klavye kapanmaz; odak alan dışına çıkarsa ~150 ms sonra kapanır.
 * Sayaçlar: scrollIntoView çağrıları, olay sayısı. `window.__dpKbSim` üzerinden okunur.
 *
 * @param {import('@playwright/test').Page} page Sayfa (goto öncesi).
 * @param {{kb?: number, delay?: number, pan?: boolean}} [opts] Klavye yüksekliği, animasyon gecikmesi, kaydırma.
 */
export async function installIosKeyboardSim(page, opts = {}) {
  await page.addInitScript((o) => {
    const KB = o.kb || 336;
    const DELAY = o.delay || 220;
    const PAN = o.pan !== false;
    const FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=hidden]), textarea';
    const target = new EventTarget();
    const vv = {
      height: window.innerHeight,
      width: window.innerWidth,
      offsetTop: 0,
      offsetLeft: 0,
      pageTop: 0,
      pageLeft: 0,
      scale: 1,
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      dispatchEvent: target.dispatchEvent.bind(target),
    };
    const sim = { keyboardUp: false, scrollIntoView: 0, resize: 0, scroll: 0, focusCount: 0, log: [] };
    window.__dpKbSim = sim;
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    const fire = (name) => {
      sim[name] += 1;
      target.dispatchEvent(new Event(name));
    };
    let timers = [];
    const clear = () => {
      timers.forEach((t) => clearTimeout(t));
      timers = [];
    };
    const openKb = () => {
      clear();
      if (sim.keyboardUp) {
        // Alandan alana geçiş: Safari küçük bir kaydırma ayarı yapar.
        timers.push(setTimeout(() => {
          vv.offsetTop = Math.max(0, Math.min(KB, vv.offsetTop + 12));
          vv.pageTop = vv.offsetTop;
          fire('scroll');
        }, DELAY / 2));
        return;
      }
      timers.push(setTimeout(() => {
        sim.keyboardUp = true;
        vv.height = window.innerHeight - KB;
        fire('resize');
      }, DELAY));
      if (PAN) {
        timers.push(setTimeout(() => {
          vv.offsetTop = KB;
          vv.pageTop = KB;
          fire('scroll');
        }, DELAY + 200));
      }
    };
    const closeKb = () => {
      clear();
      timers.push(setTimeout(() => {
        sim.keyboardUp = false;
        vv.height = window.innerHeight;
        vv.offsetTop = 0;
        vv.pageTop = 0;
        fire('resize');
        fire('scroll');
      }, DELAY));
    };
    document.addEventListener('focusin', (e) => {
      if (e.target instanceof Element && e.target.matches(FIELD)) {
        sim.focusCount += 1;
        openKb();
      }
    }, true);
    document.addEventListener('focusout', () => {
      timers.push(setTimeout(() => {
        const a = document.activeElement;
        if (!(a && a.matches && a.matches(FIELD))) {
          closeKb();
        }
      }, 150));
    }, true);
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) {
      sim.scrollIntoView += 1;
      return orig.apply(this, args);
    };
    window.__dpKbSimClose = closeKb;
  }, opts);
}

/**
 * @param {import('@playwright/test').Page} page Sayfa.
 * @return {Promise<{keyboardUp: boolean, scrollIntoView: number, resize: number, scroll: number, focusCount: number}>} Sayaçlar.
 */
export function readSim(page) {
  return page.evaluate(() => {
    const { keyboardUp, scrollIntoView, resize, scroll, focusCount } = window.__dpKbSim;
    return { keyboardUp, scrollIntoView, resize, scroll, focusCount };
  });
}
