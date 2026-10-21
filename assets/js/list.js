/**
 * @file list.js
 * [wdp_donations] sekmeleri: klavye, hash paylaşımı, JS kapalıyken tüm kartlar görünür.
 */
(function () {
  "use strict";

  var SLUG_OK = /^[a-z0-9_-]+$/i;

  function cssEscape(value) {
    var s = String(value || "");
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(s);
    }
    return s.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function tabsIn(root) {
    return Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
  }

  function setTab(wrap, tab, fromHash) {
    var tabs = tabsIn(wrap.querySelector("[data-wdp-tabs]") || wrap);
    var slug = tab.getAttribute("data-wdp-tab") || "all";
    var panel = wrap.querySelector('[role="tabpanel"]');
    tabs.forEach(function (btn) {
      var on = btn === tab;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.tabIndex = on ? 0 : -1;
    });
    if (panel && tab.id) {
      panel.setAttribute("aria-labelledby", tab.id);
    }
    Array.prototype.forEach.call(wrap.querySelectorAll(".wdp-list__item"), function (item) {
      if (slug === "all") {
        item.classList.remove("is-hidden");
        return;
      }
      var cats = (item.getAttribute("data-wdp-cats") || "").split(/\s+/);
      item.classList.toggle("is-hidden", cats.indexOf(slug) === -1);
    });
    if (!fromHash && window.history && typeof window.history.replaceState === "function") {
      var hash = tab.getAttribute("data-wdp-hash");
      if (hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search + "#" + hash);
      } else if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
  }

  function findTabBySlug(wrap, slug) {
    if (!SLUG_OK.test(slug)) {
      return null;
    }
    try {
      return wrap.querySelector('[data-wdp-tab="' + cssEscape(slug) + '"]');
    } catch (err) {
      return null;
    }
  }

  function applyHash(wrap) {
    var raw = (window.location.hash || "").replace(/^#/, "");
    if (raw.indexOf("bagis-") !== 0) {
      return;
    }
    var slug = raw.slice("bagis-".length);
    var tab = findTabBySlug(wrap, slug);
    if (tab) {
      setTab(wrap, tab, true);
    }
  }

  function onKey(event, wrap) {
    var tabs = tabsIn(wrap.querySelector("[data-wdp-tabs]") || wrap);
    var i = tabs.indexOf(event.target);
    if (i < 0) {
      return;
    }
    var next = i;
    if (event.key === "ArrowRight") {
      next = (i + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      next = (i - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = tabs.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    tabs[next].focus();
    setTab(wrap, tabs[next]);
  }

  function bind(wrap) {
    var tablist = wrap.querySelector("[data-wdp-tabs]");
    if (!tablist) {
      return;
    }
    tablist.addEventListener("click", function (event) {
      var tab = event.target.closest("[role='tab']");
      if (!tab) {
        return;
      }
      setTab(wrap, tab);
    });
    tablist.addEventListener("keydown", function (event) {
      onKey(event, wrap);
    });
    applyHash(wrap);
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll(".wdp-list-wrap"), bind);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
