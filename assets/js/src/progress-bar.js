/**
 * @file progress-bar.js
 * Hedefli bağış progress bar animasyonu ve toplam güncelleme.
 * Dış API: WDPApp.progressBar
 */

(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});

  const utilsCheck = (WDPApp.utils && WDPApp.utils.ensureModule)
    ? WDPApp.utils.ensureModule('utils', ['formatCurrency', 'safeLog'])
    : { module: WDPApp.utils || {}, isValid: false, missingMethods: [] };

  const utils = utilsCheck.module;
  const { formatCurrency, safeLog } = utils;

  function readNum(el, attr, fallback) {
    if (!el) return fallback;
    const n = parseFloat(el.getAttribute(attr));
    return Number.isFinite(n) ? n : fallback;
  }

  function sumPendingForProduct(items, productId) {
    const pid = String(productId);
    let sum = 0;
    (items || []).forEach((item) => {
      if (!item || item.is_sadaka_donation) return;
      if (String(item.product_id) !== pid) return;
      const line = parseFloat(item.line_total);
      sum += Number.isFinite(line) ? line : 0;
    });
    return Math.max(0, sum);
  }

  function readDraftFromForm(container) {
    const root = container.closest('.wdp-modal, .wdp-donation-form');
    if (!root) return 0;
    const form = container.closest('form') || root.querySelector('form');
    if (!form || form.classList.contains('wdp-has-success')) return 0;
    const input = form.querySelector('input[name="custom_price"]');
    if (!input || !input.value) return 0;
    const n = parseInt(String(input.value).replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function updatePercentageColor(percentageElement, fillPercentage) {
    if (!percentageElement) return;
    const overFill = fillPercentage >= 50;
    percentageElement.classList.toggle('on-fill', overFill);
    percentageElement.classList.toggle('on-track', !overFill);
  }

  function celebrateEnabled() {
    const ajax = window.wdp_ajax || {};
    const flags = ajax.flags || {};
    if (flags.progress_celebrate === 0 || flags.progress_celebrate === '0' || flags.progress_celebrate === false) {
      return false;
    }
    const host = document.querySelector('.hdf-donation-modal-wrapper.show[data-wdp-progress-celebrate], .wdp-donation-form[data-wdp-progress-celebrate]');
    if (host && host.getAttribute('data-wdp-progress-celebrate') === '0') {
      return false;
    }
    return true;
  }

  function celebrateProgressComplete(container) {
    if (!celebrateEnabled()) return;
    const announce = utils && typeof utils.announceStatus === 'function' ? utils.announceStatus : null;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (announce) announce(WDPApp.i18n.__('Goal reached', 'woo-donation-popup'), 'polite');
      return;
    }
    container.classList.add('is-celebrating');
    let burst = container.querySelector('.wdp-progress-celebrate');
    if (!burst) {
      burst = document.createElement('div');
      burst.className = 'wdp-progress-celebrate';
      burst.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 12; i++) {
        const p = document.createElement('span');
        p.className = 'wdp-progress-celebrate__dot';
        p.style.setProperty('--i', String(i));
        burst.appendChild(p);
      }
      container.appendChild(burst);
    }
    window.setTimeout(function() {
      container.classList.remove('is-celebrating');
    }, 1200);
    if (announce) announce(WDPApp.i18n.__('Goal reached', 'woo-donation-popup'), 'polite');
    if (utils && typeof utils.emitWdpEvent === 'function') {
      utils.emitWdpEvent('wdp:progress:complete', { container: container });
    }
    if (window.WDPMetaTracking && typeof window.WDPMetaTracking.trackCustom === 'function') {
      try {
        window.WDPMetaTracking.trackCustom('DonationProgressComplete', {});
      } catch (err) {
        if (safeLog) safeLog('progress celebrate meta track', err);
      }
    }
  }

  function setSegment(el, leftPct, widthPct) {
    if (!el) return;
    if (widthPct > 0.05) {
      el.style.left = leftPct + '%';
      el.style.width = widthPct + '%';
      el.style.display = 'block';
    } else {
      el.style.left = '0%';
      el.style.width = '0%';
      el.style.display = 'none';
    }
  }

  function updateMeta(container, current, limit) {
    const meta = container.querySelector('.wdp-progress-bar-meta');
    const completeEl = container.querySelector('.wdp-progress-bar-complete-label');
    if (!meta) return;

    const isComplete = current >= limit;
    if (completeEl) {
      if (isComplete) {
        completeEl.hidden = false;
        completeEl.textContent = WDPApp.i18n.__('Goal reached', 'woo-donation-popup');
      } else {
        completeEl.hidden = true;
      }
    }
    meta.hidden = !(completeEl && !completeEl.hidden);
  }

  function updateImpact(container, displayPct) {
    const impact = container.querySelector('[data-wdp-progress-impact]');
    if (!impact) return;
    const rounded = (Math.round(displayPct * 10) / 10).toFixed(1);
    impact.textContent = WDPApp.i18n.sprintf(WDPApp.i18n.__('%s%% of the goal completed', 'woo-donation-popup'), rounded);
  }

  function updateRemaining(container, current, limit) {
    const el = container.querySelector('[data-wdp-progress-remaining]');
    if (!el) return;
    const remaining = Math.max(0, limit - current);
    const sep = el.previousElementSibling;
    if (remaining <= 0 || current >= limit) {
      el.hidden = true;
      el.textContent = '';
      if (sep && sep.classList && sep.classList.contains('wdp-progress-bar-sep')) {
        sep.hidden = true;
      }
      return;
    }
    const formatted = typeof formatCurrency === 'function' ? formatCurrency(remaining) : String(Math.round(remaining));
    el.hidden = false;
    el.textContent = WDPApp.i18n.sprintf(WDPApp.i18n.__('%s remaining', 'woo-donation-popup'), formatted);
    if (sep && sep.classList && sep.classList.contains('wdp-progress-bar-sep')) {
      sep.hidden = false;
    }
  }

  function updateDelta(container, draft) {
    const el = container.querySelector('[data-wdp-progress-delta]');
    if (!el) return;
    if (!(draft > 0)) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    const formatted = typeof formatCurrency === 'function' ? formatCurrency(draft) : String(Math.round(draft));
    el.hidden = false;
    el.textContent = '+' + formatted;
  }

  function updatePctRing(container, displayPct) {
    const text = container.querySelector('[data-wdp-progress-pct-text]');
    const rounded = Math.round(displayPct * 10) / 10;
    if (text) {
      text.textContent = rounded.toFixed(1) + '%';
    }
  }

  function updateTip() {
    /* Tip removed in clean design */
  }

  /**
   * @param {HTMLElement} container
   * @param {{ current?: number, limit?: number, pending?: number, draft?: number }} opts
   */
  function updateLayers(container, opts) {
    if (!container) return;
    opts = opts || {};

    const fillBar = container.querySelector('.wdp-progress-bar-fill');
    const pendingBar = container.querySelector('.wdp-progress-bar-pending');
    const previewBar = container.querySelector('.wdp-progress-bar-preview');
    const amountElement = container.querySelector('.wdp-progress-bar-amount');
    const percentageElement = container.querySelector('.wdp-progress-bar-percentage-value');
    const track = container.querySelector('.wdp-progress-bar');

    if (!fillBar || !percentageElement) return;

    const limit = Math.max(1, opts.limit !== undefined ? opts.limit : readNum(container, 'data-limit', 100000));
    const current = Math.max(0, opts.current !== undefined ? opts.current : readNum(container, 'data-current', 0));
    const pending = Math.max(0, opts.pending !== undefined ? opts.pending : readNum(container, 'data-pending', 0));
    const draft = Math.max(0, opts.draft !== undefined ? opts.draft : 0);

    container.setAttribute('data-current', String(current));
    container.setAttribute('data-pending', String(pending));
    container.setAttribute('data-limit', String(limit));

    const fillPct = Math.min(100, (current / limit) * 100);
    let room = Math.max(0, 100 - fillPct);
    const pendingRaw = (pending / limit) * 100;
    const pendingPct = Math.min(room, pendingRaw);
    room = Math.max(0, room - pendingPct);
    const draftRaw = (draft / limit) * 100;
    const draftPct = Math.min(room, draftRaw);

    fillBar.style.width = fillPct + '%';
    fillBar.style.left = '0%';
    setSegment(pendingBar, fillPct, pendingPct);
    setSegment(previewBar, fillPct + pendingPct, draftPct);

    container.classList.toggle('has-draft', draftPct > 0.05);
    container.classList.toggle('has-pending', pendingPct > 0.05);
    container.classList.toggle('is-draft-pulse', draftPct > 0.05);

    // Yüzde metni = onaylı dolgu (tek kaynak). Pending/draft yalnız şerit olarak kalır.
    const displayPct = fillPct;
    const previewPct = Math.min(100, fillPct + pendingPct + draftPct);
    percentageElement.textContent = displayPct.toFixed(1) + '%';
    updatePercentageColor(percentageElement, displayPct);
    updatePctRing(container, displayPct);
    updateImpact(container, previewPct);
    updateRemaining(container, current, limit);
    updateDelta(container, draft);
    updateTip(container, previewPct);

    if (draftPct > 0.05) {
      container.classList.remove('is-draft-flash');
      void container.offsetWidth;
      container.classList.add('is-draft-flash');
      if (container._wdpDraftFlashTimer) {
        clearTimeout(container._wdpDraftFlashTimer);
      }
      container._wdpDraftFlashTimer = setTimeout(function() {
        container.classList.remove('is-draft-flash');
      }, 420);
    }

    const prevPct = parseFloat(container.dataset.wdpLastDisplayPct || '0');
    const milestones = [25, 50, 75, 90, 100];
    let hit = 0;
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (prevPct + 0.05 < m && displayPct + 0.0001 >= m) {
        hit = m;
      }
    }
    if (hit > 0 && hit < 100) {
      container.dataset.wdpMilestone = String(hit);
      container.classList.remove('is-milestone');
      void container.offsetWidth;
      container.classList.add('is-milestone');
      if (hit >= 90) {
        container.classList.add('is-near-goal-flash');
        if (container._wdpNearTimer) clearTimeout(container._wdpNearTimer);
        container._wdpNearTimer = setTimeout(function() {
          container.classList.remove('is-near-goal-flash');
        }, 900);
      }
      if (container._wdpMilestoneTimer) {
        clearTimeout(container._wdpMilestoneTimer);
      }
      container._wdpMilestoneTimer = setTimeout(function() {
        container.classList.remove('is-milestone');
      }, 750);
    } else if (hit === 100) {
      container.dataset.wdpMilestone = '100';
    }
    container.dataset.wdpLastDisplayPct = String(displayPct);

    if (amountElement && typeof formatCurrency === 'function') {
      amountElement.textContent = formatCurrency(current);
    }

    if (track) {
      track.setAttribute('aria-valuenow', String(Math.round(fillPct * 10) / 10));
      if (pending > 0 || draft > 0) {
        track.setAttribute(
          'aria-valuetext',
          WDPApp.i18n.sprintf(
            WDPApp.i18n.__('Confirmed %1$s%%, %2$s%% including pending and typed amounts', 'woo-donation-popup'),
            fillPct.toFixed(1),
            displayPct.toFixed(1)
          )
        );
      } else {
        track.removeAttribute('aria-valuetext');
      }
    }

    container.classList.toggle('is-complete', fillPct >= 100);
    container.classList.toggle('is-approaching', fillPct < 100 && displayPct >= 90);

    container.querySelectorAll('.wdp-progress-bar-markers i, .wdp-progress-bar-milestone, .wdp-progress-bar-scale span[data-at]').forEach(function (el) {
      const at = parseFloat(el.getAttribute('data-at') || '0');
      if (!Number.isFinite(at) || at <= 0) return;
      if (displayPct + 0.0001 >= at) {
        el.setAttribute('data-reached', '1');
      } else {
        el.removeAttribute('data-reached');
      }
    });

    const statusEl = container.querySelector('[data-wdp-progress-status]');
    if (statusEl) {
      let statusText = WDPApp.i18n.__('In progress', 'woo-donation-popup');
      if (fillPct >= 100) statusText = WDPApp.i18n.__('Goal reached', 'woo-donation-popup');
      else if (displayPct >= 90) statusText = WDPApp.i18n.__('Very close to the goal', 'woo-donation-popup');
      else if (draftPct > 0.05) statusText = WDPApp.i18n.__('Your contribution is being added', 'woo-donation-popup');
      statusEl.textContent = statusText;
    }

    const wasComplete = container.dataset.wdpWasComplete === '1';
    const nowComplete = fillPct >= 100;
    if (nowComplete && !wasComplete) {
      celebrateProgressComplete(container);
    }
    container.dataset.wdpWasComplete = nowComplete ? '1' : '0';

    updateMeta(container, current, limit);
  }

  function updatePreview(container, current, limit, previewAmount) {
    updateLayers(container, {
      current: current,
      limit: limit,
      pending: readNum(container, 'data-pending', 0),
      draft: Math.max(0, previewAmount || 0),
    });
  }

  function updateRealProgress(container, newAmount, limit) {
    updateLayers(container, {
      current: Math.max(0, newAmount || 0),
      limit: limit,
      pending: readNum(container, 'data-pending', 0),
      draft: 0,
    });
  }

  function syncFromCartItems(items) {
    const list = document.querySelectorAll('.wdp-progress-bar-container');
    list.forEach((container) => {
      const productId = container.getAttribute('data-product-id');
      if (!productId) return;
      const pending = sumPendingForProduct(items, productId);
      const current = readNum(container, 'data-current', 0);
      const limit = readNum(container, 'data-limit', 100000);
      const draft = readDraftFromForm(container);
      updateLayers(container, { current, limit, pending, draft });
    });
  }

  function setupProgressBar(container) {
    if (!container) return;

    const productId = container.getAttribute('data-product-id');
    const limit = readNum(container, 'data-limit', 100000);
    const current = readNum(container, 'data-current', 0);
    const pending = readNum(container, 'data-pending', 0);

    const fillBar = container.querySelector('.wdp-progress-bar-fill');
    const previewBar = container.querySelector('.wdp-progress-bar-preview');
    const amountElement = container.querySelector('.wdp-progress-bar-amount');
    const percentageElement = container.querySelector('.wdp-progress-bar-percentage-value');

    if (!fillBar || !previewBar || !amountElement || !percentageElement) {
      return;
    }

    if (container.getAttribute('data-wdp-progress-setup') === '1') {
      updateLayers(container, { current, limit, pending, draft: readDraftFromForm(container) });
      return;
    }
    container.setAttribute('data-wdp-progress-setup', '1');

    const root = container.closest('.wdp-modal, .wdp-donation-form');
    const form = container.closest('form') || (root ? root.querySelector('form') : null);
    if (!form) {
      updateLayers(container, { current, limit, pending, draft: 0 });
      return;
    }

    const customPriceInput = form.querySelector('input[name="custom_price"]');
    if (!customPriceInput) {
      updateLayers(container, { current, limit, pending, draft: 0 });
      return;
    }

    if (customPriceInput.classList.contains('wdp-custom-price-input')) {
      customPriceInput.setAttribute('step', '1');
    }

    if (customPriceInput._wdpProgressInputHandler) {
      customPriceInput.removeEventListener('input', customPriceInput._wdpProgressInputHandler);
    }
    if (customPriceInput._wdpProgressBlurHandler) {
      customPriceInput.removeEventListener('blur', customPriceInput._wdpProgressBlurHandler);
    }

    customPriceInput._wdpProgressInputHandler = function() {
      let rawValue = this.value.toString().trim();
      let numericOnly = rawValue.replace(/[^\d]/g, '');
      if (numericOnly !== rawValue && numericOnly !== '') {
        this.value = parseInt(numericOnly, 10) || '';
      }
      const currentValue = readNum(container, 'data-current', 0);
      const limitValue = readNum(container, 'data-limit', limit);
      const pendingValue = readNum(container, 'data-pending', 0);
      const finalValue = this.value === '' ? '' : this.value.toString().replace(/[^\d]/g, '');
      const inputValue = finalValue === '' ? 0 : parseInt(finalValue, 10) || 0;
      updateLayers(container, {
        current: currentValue,
        limit: limitValue,
        pending: pendingValue,
        draft: inputValue,
      });
    };
    customPriceInput.addEventListener('input', customPriceInput._wdpProgressInputHandler);

    customPriceInput._wdpProgressBlurHandler = function() {
      if (!this.value || parseFloat(this.value) === 0) {
        updateLayers(container, {
          current: readNum(container, 'data-current', 0),
          limit: readNum(container, 'data-limit', limit),
          pending: readNum(container, 'data-pending', 0),
          draft: 0,
        });
      }
    };
    customPriceInput.addEventListener('blur', customPriceInput._wdpProgressBlurHandler);

    updateLayers(container, {
      current,
      limit,
      pending,
      draft: readDraftFromForm(container),
    });

    safeLog('Progress bar initialized for product:', productId);
  }

  function initAllProgressBars() {
    document.querySelectorAll('.wdp-progress-bar-container').forEach((container) => {
      setupProgressBar(container);
    });
  }

  function hideExpiredUrgencyBanners() {
    const now = Math.floor(Date.now() / 1000);
    document.querySelectorAll('.wdp-urgency-banner[data-ends-at]').forEach(function (el) {
      const ends = parseInt(el.getAttribute('data-ends-at'), 10);
      if (Number.isFinite(ends) && ends > 0 && ends < now) {
        el.hidden = true;
        el.style.display = 'none';
      }
    });
  }

  function bindGoalClosedTriggers() {
    if (document.documentElement.getAttribute('data-wdp-goal-closed-bound') === '1') {
      return;
    }
    document.documentElement.setAttribute('data-wdp-goal-closed-bound', '1');
    // Pasif görünür; tıklanınca nedeni duyurulur. Modal/panel yine açılabilir (içeride mesaj + disabled alanlar).
    document.addEventListener('click', function (e) {
      const t = e.target && e.target.closest ? e.target.closest('[data-wdp-goal-closed="1"]') : null;
      if (!t) return;
      const msg = t.getAttribute('data-wdp-goal-message') || '';
      if (!msg) return;
      if (utils && typeof utils.announceStatus === 'function') {
        utils.announceStatus(msg, 'assertive');
      }
    });
  }

  function bootCampaignUi() {
    initAllProgressBars();
    hideExpiredUrgencyBanners();
    bindGoalClosedTriggers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootCampaignUi);
  } else {
    bootCampaignUi();
  }

  WDPApp.progressBar = {
    setup: setupProgressBar,
    updatePreview: updatePreview,
    updateReal: updateRealProgress,
    updateLayers: updateLayers,
    syncFromCartItems: syncFromCartItems,
    sumPendingForProduct: sumPendingForProduct,
    initAll: initAllProgressBars,
    hideExpiredUrgency: hideExpiredUrgencyBanners,
  };

})(window);
