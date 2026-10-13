/**
 * @file lazy-modal.js
 * data-wdp-lazy butonlarda modal HTML'ini AJAX ile getirir, önbelleğe alır ve açar.
 * Dış API: WDPApp.lazyModal, window.WDP.refresh
 */

(function (window) {
  "use strict";

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const cache = typeof Map !== "undefined" ? new Map() : {};
  const inflight = typeof Map !== "undefined" ? new Map() : {};

  function cacheGet(key) {
    return cache.get ? cache.get(key) : cache[key];
  }
  function cacheSet(key, value) {
    if (cache.set) cache.set(key, value);
    else cache[key] = value;
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

  function ajax() {
    return window.wdp_ajax || {};
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

  function inject(html) {
    if (!html) return null;
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    const modal = wrap.querySelector(".wdp-modal");
    if (!modal) return null;
    if (document.getElementById(modal.id)) {
      return document.getElementById(modal.id);
    }
    document.body.appendChild(modal);
    refresh();
    return modal;
  }

  function fetchModal(productId, mode) {
    const key = productId + ":" + mode;
    const cached = cacheGet(key);
    if (cached) {
      return Promise.resolve(cached);
    }
    const pending = inflightGet(key);
    if (pending) {
      return pending;
    }
    const cfg = ajax();
    const body =
      "action=wdp_render_modal" +
      "&product_id=" +
      encodeURIComponent(String(productId)) +
      "&mode=" +
      encodeURIComponent(mode) +
      "&security=" +
      encodeURIComponent((cfg.nonces && cfg.nonces.render_modal) || "");
    const req = fetch(cfg.ajax_url || "/wp-admin/admin-ajax.php", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: body,
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (json) {
        const html = json && json.success && json.data && json.data.html;
        if (typeof html !== "string" || html === "") {
          throw new Error("empty");
        }
        cacheSet(key, html);
        inflightDelete(key);
        return html;
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

  function openLoaded(productId, mode, button) {
    const modal = existingModal(productId, mode);
    const options = mode === "side_panel" ? { modalId: modalId(productId, mode) } : undefined;
    if (WDPApp.modal && typeof WDPApp.modal.open === "function") {
      WDPApp.modal.open(productId, options);
      return;
    }
    if (modal) {
      modal.classList.add("show");
    }
  }

  function ensureAndOpen(button) {
    const productId = button.getAttribute("data-product-id");
    if (!productId) return Promise.resolve();
    const mode =
      button.getAttribute("data-wdp-mode") === "side_panel" || button.classList.contains("wdp-open-side-panel")
        ? "side_panel"
        : "popup";
    if (existingModal(productId, mode)) {
      openLoaded(productId, mode, button);
      return Promise.resolve();
    }
    setBusy(button, true);
    return fetchModal(productId, mode)
      .then(function (html) {
        inject(html);
        openLoaded(productId, mode, button);
      })
      .catch(function () {
        const href = button.getAttribute("href");
        if (href) {
          window.location.href = href;
        }
      })
      .then(function () {
        setBusy(button, false);
      });
  }

  function prefetch(button) {
    const productId = button.getAttribute("data-product-id");
    if (!productId) return;
    const mode =
      button.getAttribute("data-wdp-mode") === "side_panel" || button.classList.contains("wdp-open-side-panel")
        ? "side_panel"
        : "popup";
    if (existingModal(productId, mode) || cacheGet(productId + ":" + mode)) return;
    fetchModal(productId, mode).catch(function () {});
  }

  function isLazyTrigger(el) {
    return !!(el && el.getAttribute && el.getAttribute("data-wdp-lazy") && el.getAttribute("data-product-id"));
  }

  WDPApp.lazyModal = {
    ensureAndOpen: ensureAndOpen,
    prefetch: prefetch,
    isLazyTrigger: isLazyTrigger,
    refresh: refresh,
  };
})(window);
