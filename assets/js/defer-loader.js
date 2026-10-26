/**
 * @file defer-loader.js
 * Ön yüz paketini (cta-ready + donation-modal) ilk etkileşime / boşta ana kadar erteler.
 * PHP (WDP_Assets_Defer) paket etiketlerini type="text/wdp-deferred" + data-wdp-src olarak çıktılar;
 * bu küçük yükleyici onları sırayla gerçek betik olarak ekler. Tetikleyiciler: dokunma, fare üstü,
 * odak, tıklama (tıklama kaybolmaz: yükleme bitince yeniden gönderilir), boşta (sayfa yüklendikten sonra).
 * Satır içi çıktılanır (ek istek yok); ES5 biçimli, bağımlılık yok. Dış API: window.WDPDefer.
 */
(function (w, d) {
  'use strict';
  if (w.WDPDefer) {
    return;
  }

  var TRIGGERS = '.wdp-donate-button,.wdp-open-modal,.wdp-open-side-panel,.wdp-cta-gate,.wdp-donation-form';
  // Satır içi form sayfada görünürse CTA "yükleniyor" durumunda bekler: bu sayfalarda yükleme sayfa
  // yüklenir yüklenmez (boşta) başlar; yalnız tetikleyici düğme olan sayfalarda gecikmeli.
  var EAGER = '[data-wdp-display="inline"]';
  var IDLE_EAGER_MS = 300;
  var IDLE_LAZY_MS = 4000;

  var state = 'idle'; // idle | loading | ready
  var replay = [];
  var timer = 0;

  function pending() {
    return d.querySelectorAll('script[type="text/wdp-deferred"]');
  }

  function closestTrigger(node) {
    var el = node && node.nodeType === 1 ? node : node && node.parentElement;
    return el && el.closest ? el.closest(TRIGGERS) : null;
  }

  function busyButton(el) {
    return el && el.closest ? el.closest('button') : null;
  }

  function afterReady() {
    state = 'ready';
    var A = w.WDPApp;
    if (A) {
      // Paket sayfa yüklendikten sonra geldiği için window "load" işleyicisi çalışmaz: aynı adımlar burada.
      try {
        if (A.moduleLoader && typeof A.moduleLoader.update === 'function') {
          A.moduleLoader.update();
        }
        if (A.dom && typeof A.dom.observeDOMChanges === 'function') {
          A.dom.observeDOMChanges();
        }
        if (A.formInitializer && typeof A.formInitializer.direct === 'function') {
          A.formInitializer.direct(d);
        }
      } catch (e) {
        if (w.console && w.console.error) {
          w.console.error(e);
        }
      }
    }
    var queue = replay.slice();
    replay = [];
    // Paketin kendi başlatması bir sonraki karede bitmiş olur; tıklamalar sonra yeniden gönderilir.
    (w.requestAnimationFrame || w.setTimeout)(function () {
      queue.forEach(function (el) {
        var btn = busyButton(el);
        if (btn) {
          btn.removeAttribute('aria-busy');
          btn.classList.remove('wdp-loading');
        }
        if (el.isConnected && typeof el.click === 'function') {
          el.click();
        }
      });
    });
  }

  // K3: tam stil paketi `media="print"` ile ilk boyamayı engellemeden iner (PHP: WDP_Assets_Defer::filter_style_tag).
  // Açılır pencere/panel/teşekkür stilleri bu pakette; paket işlevi başlamadan hazır olmalı (stilsiz yanıp sönme olmasın).
  function whenStyles(done) {
    var links = d.querySelectorAll('link[data-wdp-defer-css]');
    var left = 0;
    var finished = false;
    function finish() {
      if (!finished) {
        finished = true;
        done();
      }
    }
    function one() {
      left -= 1;
      if (left <= 0) {
        finish();
      }
    }
    Array.prototype.forEach.call(links, function (link) {
      if (link.media !== 'all') {
        link.media = 'all'; // onload işleyicisi (CSP/önbellek eklentisi yüzünden) çalışmadıysa devreye al.
      }
      if (!link.sheet) {
        left += 1;
        link.addEventListener('load', one);
        link.addEventListener('error', one);
      }
    });
    if (left <= 0) {
      finish();
      return;
    }
    w.setTimeout(finish, 4000); // Ağ takılırsa işlev yine de başlar.
  }

  function load() {
    if (state !== 'idle') {
      return;
    }
    state = 'loading';
    w.clearTimeout(timer);
    var nodes = Array.prototype.slice.call(pending());
    if (!nodes.length) {
      whenStyles(afterReady);
      return;
    }
    (function next(i) {
      if (i >= nodes.length) {
        whenStyles(afterReady);
        return;
      }
      var node = nodes[i];
      var s = d.createElement('script');
      s.async = false;
      s.onload = s.onerror = function () {
        next(i + 1);
      };
      s.src = node.getAttribute('data-wdp-src');
      var parent = node.parentNode;
      var ref = node.nextSibling;
      var id = node.getAttribute('id');
      parent.removeChild(node);
      if (id) {
        s.id = id;
      }
      parent.insertBefore(s, ref);
    })(0);
  }

  function intent(e) {
    if (state === 'idle' && closestTrigger(e.target)) {
      load();
    }
  }

  function onClick(e) {
    if (state === 'ready') {
      return;
    }
    var hit = closestTrigger(e.target);
    if (!hit) {
      return;
    }
    // Paket yokken tıklama: yutulmaz; görünür yükleniyor durumu + yükleme sonrası aynı hedefe yeniden gönderim.
    // Yeniden gönderilen tıklamayı bu işleyici zaten "ready" durumunda geçirir (çift işlem yok).
    if (e.target && e.target.closest && e.target.closest('a[href]')) {
      return; // Bağlantılar (ör. gizlilik metni) kendi yoluyla çalışır; yeniden gönderim yok.
    }
    var target = e.target && e.target.nodeType === 1 ? e.target : hit;
    e.preventDefault();
    e.stopPropagation();
    if (replay.indexOf(target) === -1) {
      replay.push(target);
      var btn = busyButton(target);
      if (btn) {
        btn.setAttribute('aria-busy', 'true');
        btn.classList.add('wdp-loading');
      }
    }
    load();
  }

  function schedule() {
    var eager = !!d.querySelector(EAGER);
    var wait = eager ? IDLE_EAGER_MS : IDLE_LAZY_MS;
    var run = function () {
      if (typeof w.requestIdleCallback === 'function') {
        w.requestIdleCallback(load, { timeout: 2000 });
      } else {
        load();
      }
    };
    timer = w.setTimeout(run, wait);
  }

  d.addEventListener('pointerover', intent, { passive: true });
  d.addEventListener('pointerdown', intent, { passive: true, capture: true });
  d.addEventListener('touchstart', intent, { passive: true, capture: true });
  d.addEventListener('focusin', intent);
  d.addEventListener('click', onClick, true);

  if (d.readyState === 'complete') {
    schedule();
  } else {
    w.addEventListener('load', schedule);
  }

  w.WDPDefer = {
    load: load,
    isReady: function () {
      return state === 'ready';
    },
  };
})(window, document);
