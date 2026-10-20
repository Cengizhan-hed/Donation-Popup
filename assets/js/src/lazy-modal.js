/**
 * @file lazy-modal.js
 * data-wdp-lazy butonlarda modal HTML'ini AJAX ile getirir, önbelleğe alır ve açar.
 * Niyet ön yükleme (pointerenter/focus/touchstart) + isteğe bağlı boşta ön yükleme.
 * Formu sayfaya gömmez; yalnız HTML dizesi önbellekte tutulur.
 * Dış API: WDPApp.lazyModal, window.WDP.refresh
 */

(function (window) {
  "use strict";

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const cache = typeof Map !== "undefined" ? new Map() : {};
  const inflight = typeof Map !== "undefined" ? new Map() : {};

  let lastCurrency = "";
  let lastLang = "";
  let idleStarted = false;
  let idleInFlight = false;
  let currencyListenersBound = false;

  function cacheGet(key) {
    return cache.get ? cache.get(key) : cache[key];
  }
  function cacheSet(key, value) {
    if (cache.set) cache.set(key, value);
    else cache[key] = value;
  }
  function cacheDelete(key) {
    if (cache.delete) cache.delete(key);
    else delete cache[key];
  }
  function cacheClear() {
    if (cache.clear) cache.clear();
    else {
      for (const k of Object.keys(cache)) delete cache[k];
    }
  }
  function inflightGet(key) {
    return inflight.get ? inflight.get(key) : inflight[key];
  }
  function inflightSet(key, value) {
    if (inflight.set) inflight.set(key, value);
    else inflight[key] = value;
  }
  function inflightDelete(key) {
    if (inflight.delete) inflight.delete(key);
    else delete inflight[key];
  }
  function inflightClear() {
    if (inflight.clear) inflight.clear();
    else {
      for (const k of Object.keys(inflight)) delete inflight[k];
    }
  }

  function ajax() {
    return window.wdp_ajax || {};
  }

  function cookieValue(name) {
    try {
      const m = document.cookie.match(
        new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)")
      );
      return m ? decodeURIComponent(m[1]) : "";
    } catch (e) {
      return "";
    }
  }

  /**
   * Curcy (wmc_*), WOOCS ve wdp_ajax.currency — önbellek anahtarı için.
   */
  function currentCurrency() {
    const fromCookie =
      cookieValue("wmc_current_currency") ||
      cookieValue("woocommerce_currency") ||
      cookieValue("wmc_currency") ||
      cookieValue("woocs_current_currency");
    if (fromCookie) return String(fromCookie).toUpperCase();
    const cfg = ajax();
    const code = cfg.currency && cfg.currency.code ? String(cfg.currency.code) : "TRY";
    return code.toUpperCase() || "TRY";
  }

  function currentLang() {
    const htmlLang =
      (document.documentElement && document.documentElement.getAttribute("lang")) || "";
    const wpml = cookieValue("wp-wpml_current_language") || cookieValue("wpml_language");
    const raw = (wpml || htmlLang || "tr").split(/[-_]/)[0] || "tr";
    return String(raw).toLowerCase();
  }

  function cacheKey(productId, mode) {
    return String(productId) + ":" + mode + ":" + currentCurrency() + ":" + currentLang();
  }

  function syncLocaleState() {
    const cur = currentCurrency();
    const lang = currentLang();
    if (lastCurrency && lastCurrency !== cur) {
      invalidateLocaleCaches("currency");
    } else if (lastLang && lastLang !== lang) {
      invalidateLocaleCaches("lang");
    }
    lastCurrency = cur;
    lastLang = lang;
    const cfg = ajax();
    if (cfg.currency && typeof cfg.currency === "object" && cur) {
      cfg.currency.code = cur;
    }
  }

  function invalidateLocaleCaches(reason) {
    cacheClear();
    inflightClear();
    if (WDPApp.utils && typeof WDPApp.utils.safeLog === "function") {
      WDPApp.utils.safeLog("lazyModal cache cleared:", reason || "locale");
    }
  }

  function bindCurrencyListeners() {
    if (currencyListenersBound) return;
    currencyListenersBound = true;
    document.addEventListener(
      "click",
      function (e) {
        const t = e.target;
        if (!t || !t.closest) return;
        if (
          t.closest(".wmc-currency") ||
          t.closest(".wmc-currency-wrapper") ||
          t.closest(".woocommerce-currency-switcher") ||
          t.closest("[data-currency]") ||
          t.closest(".woocs_currency") ||
          t.closest("a[href*='currency=']")
        ) {
          // Curcy "Override by AJAX" — kısa gecikme sonrası cookie/DOM güncellenir
          setTimeout(function () {
            syncLocaleState();
            invalidateLocaleCaches("currency-switcher");
            lastCurrency = currentCurrency();
          }, 50);
        }
      },
      true
    );
    document.addEventListener("wmc_currency_changed", function () {
      invalidateLocaleCaches("wmc_currency_changed");
      lastCurrency = currentCurrency();
    });
    document.addEventListener("woocs_currency_changed", function () {
      invalidateLocaleCaches("woocs_currency_changed");
      lastCurrency = currentCurrency();
    });
    if (typeof window.jQuery !== "undefined" && window.jQuery.fn) {
      window.jQuery(document).on(
        "wmc_currency_changed woocs_currency_changed curcy_currency_changed",
        function () {
          invalidateLocaleCaches("jq-currency");
          lastCurrency = currentCurrency();
        }
      );
    }
  }

  function modalId(productId, mode) {
    return mode === "side_panel" ? "wdp-side-panel-" + productId : "wdp-modal-" + productId;
  }

  function existingModal(productId, mode) {
    return document.getElementById(modalId(productId, mode));
  }

  function refresh() {
    if (WDPApp.init && typeof WDPApp.init.run === "function") {
      WDPApp.init.run();
    }
    if (WDPApp.init && typeof WDPApp.init.directForms === "function") {
      WDPApp.init.directForms(document);
    }
    if (WDPApp.eventManager && typeof WDPApp.eventManager.init === "function") {
      WDPApp.eventManager.init();
    }
  }

  window.WDP = window.WDP || {};
  window.WDP.refresh = refresh;

  function modalFingerprint(modal) {
    if (!modal) return "";
    const form = modal.querySelector("form");
    const pid =
      (modal.getAttribute("data-product-id") || "") +
      "|" +
      (form && form.querySelector('input[name="wdp_product_id"]')
        ? form.querySelector('input[name="wdp_product_id"]').value
        : "") +
      "|" +
      (form && form.querySelector('input[name="share_count"]') ? "share" : "plain") +
      "|" +
      (form && form.querySelector("[data-wdp-sadaka-donation]") ? "sadaka" : "nosadaka");
    return pid;
  }

  function captureValues(root) {
    if (WDPApp.dom && typeof WDPApp.dom.captureFormValues === "function") {
      return WDPApp.dom.captureFormValues(root);
    }
    return { fields: [], focusName: "", selectionStart: null, selectionEnd: null };
  }

  function restoreValues(root, snap) {
    if (WDPApp.dom && typeof WDPApp.dom.restoreFormValues === "function") {
      WDPApp.dom.restoreFormValues(root, snap);
    }
  }

  /**
   * Yeni modal HTML'ini yerleştir. Aynı ürün/tip varsa dokunma.
   * Değiştirirken kullanıcı girdilerini koru.
   */
  function inject(html) {
    if (!html) return null;
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    const modal = wrap.querySelector(".wdp-modal");
    if (!modal) return null;
    const existing = document.getElementById(modal.id);
    if (existing) {
      const nextFp = modalFingerprint(modal);
      const curFp = modalFingerprint(existing);
      if (nextFp && curFp && nextFp === curFp) {
        // Zaten tam/güncel — değiştirme (önceki girişler karışmasın)
        return existing;
      }
      const preserved = captureValues(existing);
      try {
        existing.replaceWith(modal);
      } catch (eRep) {
        if (existing.parentNode) {
          existing.parentNode.insertBefore(modal, existing);
          existing.parentNode.removeChild(existing);
        } else {
          document.body.appendChild(modal);
        }
      }
      refresh();
      restoreValues(modal, preserved);
      return modal;
    }
    document.body.appendChild(modal);
    refresh();
    return modal;
  }

  function isAuthFailure(json, res) {
    if (res && (res.status === 403 || res.status === 401)) return true;
    if (!json) return false;
    if (json.success === false) {
      const msg = (json.data && json.data.message) || json.data || "";
      const s = String(msg).toLowerCase();
      if (/nonce|güvenlik|security|forbidden|geçersiz istek/i.test(s)) return true;
      if (json.data === -1 || json.data === "-1") return true;
    }
    return false;
  }

  function fetchModalOnce(productId, mode) {
    const cfg = ajax();
    const body =
      "action=wdp_render_modal" +
      "&product_id=" +
      encodeURIComponent(String(productId)) +
      "&mode=" +
      encodeURIComponent(mode) +
      "&security=" +
      encodeURIComponent((cfg.nonces && cfg.nonces.render_modal) || "");
    return fetch(cfg.ajax_url || "/wp-admin/admin-ajax.php", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: body,
    }).then(function (res) {
      return res.json().then(
        function (json) {
          return { res: res, json: json };
        },
        function () {
          return { res: res, json: null };
        }
      );
    });
  }

  function fetchModal(productId, mode, opts) {
    syncLocaleState();
    const key = cacheKey(productId, mode);
    const allowRetry = !(opts && opts.noRetry);
    const cached = cacheGet(key);
    if (cached) {
      return Promise.resolve(cached);
    }
    const pending = inflightGet(key);
    if (pending) {
      return pending;
    }
    const req = fetchModalOnce(productId, mode)
      .then(function (pack) {
        const html = pack.json && pack.json.success && pack.json.data && pack.json.data.html;
        if (typeof html === "string" && html !== "") {
          cacheSet(key, html);
          inflightDelete(key);
          return html;
        }
        const authFail = isAuthFailure(pack.json, pack.res);
        inflightDelete(key);
        if (authFail && allowRetry && WDPApp.utils && typeof WDPApp.utils.refreshWdpAjaxNonces === "function") {
          return WDPApp.utils.refreshWdpAjaxNonces({ force: true }).then(function () {
            return fetchModal(productId, mode, { noRetry: true });
          });
        }
        throw new Error(authFail ? "nonce" : "empty");
      })
      .catch(function (err) {
        inflightDelete(key);
        throw err;
      });
    inflightSet(key, req);
    return req;
  }

  function setBusy(button, busy) {
    if (!button) return;
    if (busy) {
      button.setAttribute("aria-busy", "true");
      button.classList.add("is-busy");
    } else {
      button.removeAttribute("aria-busy");
      button.classList.remove("is-busy");
    }
  }

  function openLoaded(productId, mode) {
    const options = mode === "side_panel" ? { modalId: modalId(productId, mode) } : undefined;
    if (WDPApp.modal && typeof WDPApp.modal.open === "function") {
      WDPApp.modal.open(productId, options);
      return;
    }
    const modal = existingModal(productId, mode);
    if (modal) {
      modal.classList.add("show");
    }
  }

  function resolveMode(button) {
    return button.getAttribute("data-wdp-mode") === "side_panel" ||
      button.classList.contains("wdp-open-side-panel")
      ? "side_panel"
      : "popup";
  }

  function ensureAndOpen(button) {
    const productId = button.getAttribute("data-product-id");
    if (!productId) return Promise.resolve();
    syncLocaleState();
    const mode = resolveMode(button);
    if (existingModal(productId, mode)) {
      openLoaded(productId, mode);
      return Promise.resolve();
    }
    setBusy(button, true);
    return fetchModal(productId, mode)
      .then(function (html) {
        inject(html);
        openLoaded(productId, mode);
      })
      .catch(function () {
        // Ön yükleme / eski nonce başarısız → tıklamada sessiz yeniden dene veya ürün sayfası
        cacheDelete(cacheKey(productId, mode));
        const refreshFn =
          WDPApp.utils && typeof WDPApp.utils.refreshWdpAjaxNonces === "function"
            ? WDPApp.utils.refreshWdpAjaxNonces({ force: true })
            : Promise.resolve(false);
        return refreshFn
          .then(function () {
            return fetchModal(productId, mode, { noRetry: true });
          })
          .then(function (html) {
            inject(html);
            openLoaded(productId, mode);
          })
          .catch(function () {
            const href = button.getAttribute("href");
            if (href) {
              window.location.href = href;
            }
          });
      })
      .then(function () {
        setBusy(button, false);
      });
  }

  function prefetch(button) {
    if (!button) return;
    const productId = button.getAttribute("data-product-id");
    if (!productId) return;
    syncLocaleState();
    const mode = resolveMode(button);
    const key = cacheKey(productId, mode);
    if (existingModal(productId, mode) || cacheGet(key) || inflightGet(key)) return;
    fetchModal(productId, mode).catch(function () {
      // Niyet ön yükleme: hata gösterme; tıklama normal yola düşer
    });
  }

  /**
   * Boşta ön yüklemeyi atla: Save-Data, 2G, slow-2G, otomasyon/bot.
   * Niyet (hover/focus/touch) ön yüklemesi etkilenmez.
   */
  function shouldSkipIdlePrefetch() {
    try {
      if (typeof navigator !== "undefined" && navigator.webdriver) {
        return true;
      }
      const conn =
        navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!conn) return false;
      if (conn.saveData === true) return true;
      const et = String(conn.effectiveType || "").toLowerCase();
      if (et === "2g" || et === "slow-2g") return true;
    } catch (eSkip) {
      /* ignore */
    }
    return false;
  }

  function idlePrefetchLimit() {
    if (shouldSkipIdlePrefetch()) return 0;
    const cfg = ajax();
    const raw =
      cfg.lazy && typeof cfg.lazy.idle_prefetch !== "undefined"
        ? Number(cfg.lazy.idle_prefetch)
        : 3;
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.min(12, Math.floor(raw));
  }

  function scheduleIdle(fn) {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(function () {
        fn();
      }, { timeout: 2500 });
      return;
    }
    setTimeout(fn, 400);
  }

  function startIdlePrefetch() {
    if (idleStarted) return;
    const limit = idlePrefetchLimit();
    if (limit <= 0 || typeof IntersectionObserver === "undefined") return;
    idleStarted = true;
    bindCurrencyListeners();

    const buttons = Array.prototype.slice.call(
      document.querySelectorAll(
        ".wdp-donate-button[data-wdp-lazy], .wdp-open-modal[data-wdp-lazy], .wdp-open-side-panel[data-wdp-lazy]"
      )
    );
    if (!buttons.length) return;

    /** @type {HTMLElement[]} */
    const queue = [];
    let done = 0;

    function pump() {
      if (idleInFlight || done >= limit) return;
      const next = queue.shift();
      if (!next) return;
      const productId = next.getAttribute("data-product-id");
      if (!productId) {
        scheduleIdle(pump);
        return;
      }
      syncLocaleState();
      const mode = resolveMode(next);
      const key = cacheKey(productId, mode);
      if (existingModal(productId, mode) || cacheGet(key) || inflightGet(key)) {
        scheduleIdle(pump);
        return;
      }
      idleInFlight = true;
      fetchModal(productId, mode)
        .catch(function () {})
        .then(function () {
          idleInFlight = false;
          done += 1;
          if (done < limit) scheduleIdle(pump);
        });
    }

    const io = new IntersectionObserver(
      function (entries) {
        for (let i = 0; i < entries.length; i++) {
          const ent = entries[i];
          if (!ent.isIntersecting) continue;
          io.unobserve(ent.target);
          if (done + queue.length >= limit) continue;
          queue.push(/** @type {HTMLElement} */ (ent.target));
          scheduleIdle(pump);
        }
      },
      { root: null, rootMargin: "80px", threshold: 0.15 }
    );

    for (let i = 0; i < buttons.length && i < limit * 3; i++) {
      io.observe(buttons[i]);
    }
  }

  function isLazyTrigger(el) {
    return !!(el && el.getAttribute && el.getAttribute("data-wdp-lazy") && el.getAttribute("data-product-id"));
  }

  // İlk yüklemede locale izle
  if (typeof document !== "undefined") {
    lastCurrency = currentCurrency();
    lastLang = currentLang();
    bindCurrencyListeners();
  }

  WDPApp.lazyModal = {
    ensureAndOpen: ensureAndOpen,
    prefetch: prefetch,
    startIdlePrefetch: startIdlePrefetch,
    isLazyTrigger: isLazyTrigger,
    refresh: refresh,
    inject: inject,
    invalidateCache: invalidateLocaleCaches,
    cacheKey: cacheKey,
    currentCurrency: currentCurrency,
    currentLang: currentLang,
  };
})(window);
