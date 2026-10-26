/**
 * @file style-defer-loader.js
 * Tam ön yüz stil paketini ilk boyamayı ENGELLEMEDEN ve ilk yük bant genişliğiyle yarışmadan yükler.
 * PHP (WDP_Assets_Defer::filter_style_tag) paketin yerine <meta name="wdp-deferred-style" data-href data-id> yer tutucusu basar
 * (ilk görünüm kuralları satır içi "kritik" stilde); bu küçük yükleyici sayfa yüklendikten sonra (boşta) ya da ilk etkileşimde
 * yer tutucunun TAM yerine <link rel="stylesheet"> koyar → basamaklı sıra özgün düzenle aynı kalır.
 * Satır içi çıktılanır; ES5, bağımlılık yok. Dış API: window.WDPStyles.load(cb) / isReady().
 */
(function (w, d) {
  'use strict';
  if (w.WDPStyles) {
    return;
  }

  var state = 'idle'; // idle | loading | ready
  var waiters = [];
  var timer = 0;

  function finish() {
    state = 'ready';
    var queue = waiters;
    waiters = [];
    queue.forEach(function (fn) {
      fn();
    });
  }

  function load(cb) {
    if (typeof cb === 'function') {
      if (state === 'ready') {
        cb();
        return;
      }
      waiters.push(cb);
    }
    if (state !== 'idle') {
      return;
    }
    state = 'loading';
    w.clearTimeout(timer);
    var metas = Array.prototype.slice.call(d.querySelectorAll('meta[name="wdp-deferred-style"]'));
    var left = metas.length;
    if (!left) {
      finish();
      return;
    }
    var guard = w.setTimeout(finish, 4000); // Ağ takılırsa bekleyenler yine de devam eder.
    function one() {
      left -= 1;
      if (left <= 0) {
        w.clearTimeout(guard);
        finish();
      }
    }
    metas.forEach(function (meta) {
      var link = d.createElement('link');
      link.rel = 'stylesheet';
      link.href = meta.getAttribute('data-href');
      var id = meta.getAttribute('data-id');
      if (id) {
        link.id = id;
      }
      link.onload = one;
      link.onerror = one;
      meta.parentNode.insertBefore(link, meta);
      meta.parentNode.removeChild(meta);
    });
  }

  function intent() {
    load();
  }

  function schedule() {
    var run = function () {
      timer = 0;
      load();
    };
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(run, { timeout: 1500 });
    } else {
      timer = w.setTimeout(run, 400);
    }
  }

  d.addEventListener('pointerdown', intent, { passive: true, capture: true, once: true });
  d.addEventListener('touchstart', intent, { passive: true, capture: true, once: true });
  d.addEventListener('keydown', intent, { capture: true, once: true });
  d.addEventListener('focusin', intent, { once: true });

  if (d.readyState === 'complete') {
    schedule();
  } else {
    w.addEventListener('load', schedule);
  }

  w.WDPStyles = {
    load: load,
    isReady: function () {
      return state === 'ready';
    },
  };
})(window, document);
