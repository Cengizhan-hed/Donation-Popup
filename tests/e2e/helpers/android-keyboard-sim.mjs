/**
 * Android Chrome ekran klavyesi benzetimi (Playwright Chromium + Pixel 7 emülasyonu).
 *
 * İki gerçek davranış:
 *  - 'visual'  (Chrome 108+ varsayılanı, `interactive-widget=resizes-visual`): düzen viewport'u (innerHeight) SABİT;
 *    yalnız visualViewport.height küçülür; offsetTop genelde 0 (Android odaktaki alan için nadiren kaydırır). Sahte
 *    visualViewport + tek `resize` olayı ile benzetilir.
 *  - 'content' (`resizes-content`, eski WebView/Chrome <108): düzen viewport'u GERÇEKTEN küçülür (innerHeight ve
 *    visualViewport.height birlikte). `page.setViewportSize` ile gerçek düzen yeniden boyutlandırması yapılır.
 * Alan odağında klavye ~DELAY ms sonra açılır; odak alan dışına çıkınca ~150 ms sonra kapanır; alandan alana
 * geçişte kapanmaz. Kapanışta Android bazen alan odakta kalır (geri hareketi): `window.__dpAndroidKbClose()`.
 * `window.__dpKbSim` sayaçları iOS benzetimiyle aynı biçimde.
 *
 * @param {import('@playwright/test').Page} page Sayfa (goto öncesi).
 * @param {{mode?: 'visual'|'content', kb?: number, delay?: number}} [opts] Seçenekler.
 */
export async function installAndroidKeyboardSim(page, opts = {}) {
  const mode = opts.mode === 'content' ? 'content' : 'visual';
  const KB = opts.kb || 300;
  const DELAY = opts.delay || 220;
  const full = page.viewportSize();
  if (mode === 'content') {
    await page.exposeFunction('__dpAndroidResize', async (h) => {
      await page.setViewportSize({ width: full.width, height: h });
    });
  }
  await page.addInitScript(({ m, kb, delay, fullH }) => {
    const FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=hidden]), textarea';
    const sim = { keyboardUp: false, scrollIntoView: 0, resize: 0, scroll: 0, focusCount: 0 };
    window.__dpKbSim = sim;
    let vv = null;
    let target = null;
    if (m === 'visual') {
      target = new EventTarget();
      vv = {
        height: window.innerHeight, width: window.innerWidth, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1,
        addEventListener: target.addEventListener.bind(target),
        removeEventListener: target.removeEventListener.bind(target),
        dispatchEvent: target.dispatchEvent.bind(target),
      };
      Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    }
    let timers = [];
    const clear = () => { timers.forEach((t) => clearTimeout(t)); timers = []; };
    const setKb = (up) => {
      sim.keyboardUp = up;
      if (m === 'visual') {
        vv.height = up ? fullH - kb : fullH;
        sim.resize += 1;
        target.dispatchEvent(new Event('resize'));
      } else {
        window.__dpAndroidResize(up ? fullH - kb : fullH);
      }
    };
    const open = () => {
      clear();
      if (sim.keyboardUp) {
        return;
      }
      timers.push(setTimeout(() => setKb(true), delay));
    };
    const close = () => {
      clear();
      timers.push(setTimeout(() => setKb(false), delay));
    };
    document.addEventListener('focusin', (e) => {
      if (e.target instanceof Element && e.target.matches(FIELD)) {
        sim.focusCount += 1;
        open();
      }
    }, true);
    document.addEventListener('focusout', () => {
      timers.push(setTimeout(() => {
        const a = document.activeElement;
        if (!(a && a.matches && a.matches(FIELD))) {
          close();
        }
      }, 150));
    }, true);
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) {
      sim.scrollIntoView += 1;
      return orig.apply(this, args);
    };
    window.__dpAndroidKbClose = close;
  }, { m: mode, kb: KB, delay: DELAY, fullH: full.height });
}
