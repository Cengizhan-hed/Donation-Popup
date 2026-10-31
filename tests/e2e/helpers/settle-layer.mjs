/**
 * Açık katmanın animasyonlarının bitmesini bekler (ölçüm öncesi).
 * Tarayıcıda page.evaluate ile çalışır; birim testte sahte `env` verilir.
 * Koşul: kapsamdaki sonlu animasyon yok VE katman dikdörtgeni ≥quietMs değişmedi
 * (en az iki ardışık rAF). En çok maxMs; dolarsa timedOut=true döner.
 *
 * Not: page.evaluate için fonksiyon kendi kendine yeterli olmalı (dış değişken yok).
 */
export async function settleLayerInPage(opts, env) {
  const e = env || {
    root: document.querySelector('dialog[open]') || document.querySelector(opts.sel) || document.body,
    raf: (cb) => requestAnimationFrame(cb),
    now: () => performance.now(),
  };
  const quietMs = opts.quietMs;
  const maxMs = opts.maxMs;
  const root = e.root;
  function running() {
    let list = [];
    try {
      list = root.getAnimations({ subtree: true });
    } catch (err) {
      list = [];
    }
    return list.filter((a) => {
      try {
        const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
        if (t && t.iterations === Infinity) return false;
      } catch (err) {
        /* sayılır */
      }
      return a.playState === 'running' || a.playState === 'pending';
    }).length;
  }
  function key() {
    const r = root.getBoundingClientRect();
    return [r.left, r.top, r.width, r.height].map((n) => Math.round(n * 10) / 10).join(',');
  }
  const start = e.now();
  let last = key();
  let stableSince = start;
  let frames = 0;
  return new Promise((resolve) => {
    function tick() {
      const t = e.now();
      const k = key();
      if (k !== last) {
        last = k;
        stableSince = t;
        frames = 0;
      } else {
        frames += 1;
      }
      const anims = running();
      if (anims === 0 && frames >= 2 && t - stableSince >= quietMs) {
        resolve({ settled: true, timedOut: false, waitedMs: Math.round(t - start) });
        return;
      }
      if (t - start >= maxMs) {
        resolve({ settled: false, timedOut: true, waitedMs: Math.round(t - start), animations: anims });
        return;
      }
      e.raf(tick);
    }
    e.raf(tick);
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} scopeSel
 */
export async function waitLayerSettled(page, scopeSel) {
  // Playwright işlevi kaynağıyla serileştirir; env verilmez, tarayıcı globalleri kullanılır.
  return page.evaluate(settleLayerInPage, { sel: scopeSel, quietMs: 300, maxMs: 3000 });
}
