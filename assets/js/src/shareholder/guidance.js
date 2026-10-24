/**
 * @file guidance.js
 * Hisse formu kullanıcı rehber metinleri ve ipuçları.
 * Dış API: WDPApp.shareholderGuidance
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});

  const submitSummaryTimers = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  const SUBMIT_SUMMARY_VISIBLE_MS = 4500;
  const SUBMIT_SUMMARY_VISIBLE_MS_COMPACT = 6500;

  /** Kökten tüm hissedar satır formlarını döndürür. */
  function getShareholderForms(root) {
    if (!root) {
      return [];
    }
    return Array.from(root.querySelectorAll('.wdp-shareholder-form'));
  }

  /**
   * Doğrulama dataset bayraklarının tutulduğu form kökünü bulur.
   * Modal kökü ile iç form arasındaki farkı çözer.
   */
  function resolveShareholderValidationRoot(scope) {
    if (!scope) {
      return null;
    }
    try {
      if (scope.nodeType === 1 && scope.tagName === 'FORM') {
        if (scope.classList.contains('wdp-donation-form-fields') || scope.classList.contains('wdp-has-shareholders')) {
          return scope;
        }
      }
    } catch (eResolve) {
      /* yoksay */
    }
    if (typeof scope.closest === 'function') {
      const direct =
        scope.closest('form.wdp-donation-form-fields') ||
        scope.closest('form.wdp-has-shareholders') ||
        scope.closest('form');
      if (direct) {
        return direct;
      }
    }
    if (typeof scope.querySelector === 'function') {
      const inner = scope.querySelector('form.wdp-donation-form-fields, form.wdp-has-shareholders');
      if (inner) {
        return inner;
      }
    }
    return null;
  }

  /** Tek satır için zorunlu alan tamamlanma özeti. */
  function getRowRequiredState(form) {
    if (!form) {
      return { complete: true, missing: [] };
    }
    const validation = getShareholderRowValidationState(form);
    return {
      complete: validation.complete,
      missing: validation.issues.map(function(type) {
        return type === 'name' ? WDPApp.i18n.__('Full name', 'woo-donation-popup') : WDPApp.i18n.__('Phone', 'woo-donation-popup');
      }),
    };
  }

  /** Ad ve telefon alanlarına göre satır doğrulama durumu. */
  function getShareholderRowValidationState(shareholderForm) {
    if (!shareholderForm) {
      return { complete: true, issues: [] };
    }
    const nameInput = shareholderForm.querySelector('input[name^="shareholder_name_"]');
    const phoneInput = shareholderForm.querySelector('input[name^="shareholder_phone_"]');
    const issues = [];
    if (!nameInput || !nameInput.value.trim()) {
      issues.push('name');
    }
    if (phoneInput) {
      let phoneOk = true;
      if (WDPApp.form && typeof WDPApp.form.getPhoneValidationState === 'function') {
        phoneOk = WDPApp.form.getPhoneValidationState(phoneInput, { required: true }).ok;
      } else if (!String(phoneInput.value || '').trim()) {
        phoneOk = false;
      }
      if (!phoneOk) {
        issues.push('phone');
      }
    }
    return { complete: issues.length === 0, issues: issues };
  }

  /** Armed modda başlığa geçerli/geçersiz sınıfı uygular. */
  function applyShareholderHeaderStatus(shareholderForm, armed) {
    const header = shareholderForm ? shareholderForm.querySelector('.wdp-shareholder-header') : null;
    if (!header) {
      return;
    }
    header.classList.remove('wdp-header-status-valid', 'wdp-header-status-invalid');
    if (!armed) {
      return;
    }
    const rowState = getShareholderRowValidationState(shareholderForm);
    if (rowState.complete) {
      header.classList.add('wdp-header-status-valid');
    } else {
      header.classList.add('wdp-header-status-invalid');
    }
  }

  /** Eski satır içi durum rozetlerini temizler. */
  function stripShareholderRowStatusUI(form) {
    if (!form) {
      return;
    }
    form.querySelectorAll('.wdp-shareholder-status, .wdp-shareholder-status-note').forEach(function(el) {
      el.remove();
    });
  }

  /** Eski üst özet bandı kalıntılarını kaldırır. */
  function removeShareholderOverview(root) {
    if (!root) {
      return;
    }
    const sharesHeader = root.querySelector('.wdp-shares-header');
    if (!sharesHeader) {
      return;
    }
    sharesHeader.querySelectorAll('.wdp-shareholder-overview').forEach(function(el) {
      el.remove();
    });
  }

  /** Kullanıcı gönderim denedi mi? (dataset bayrağı) */
  function isShareValidationArmed(root) {
    return !!(root && root.dataset && root.dataset.wdpShareValidationArmed === '1');
  }

  /**
   * Doğrulama armed durumunu ayarlar; hedef satır indeksi isteğe bağlı.
   */
  function setShareValidationArmed(root, armed, targetIndex) {
    const bag = resolveShareholderValidationRoot(root) || root;
    if (!bag || !bag.dataset) {
      return;
    }
    bag.dataset.wdpShareValidationArmed = armed ? '1' : '0';
    if (armed && Number.isFinite(Number(targetIndex)) && Number(targetIndex) > 0) {
      bag.dataset.wdpShareValidationTarget = String(Number(targetIndex));
    } else {
      delete bag.dataset.wdpShareValidationTarget;
    }
    refreshShareholderGuidance(root);
  }

  /** Modal kapanınca kırmızı başlık ve özet mesajlarını sıfırlar. */
  function resetShareholderValidationUI(scope) {
    const bag = resolveShareholderValidationRoot(scope) || scope;
    if (!bag) {
      return;
    }
    if (bag.classList) {
      bag.classList.remove('wdp-shareholders-validation-active');
    }
    clearShareholdersSubmitSummary(bag);
    setShareValidationArmed(bag, false);
  }

  function clearShareholdersSubmitSummary(root) {
    const bag = resolveShareholderValidationRoot(root) || root;
    if (!bag) {
      return;
    }
    const existing = bag.querySelector('.wdp-shareholders-submit-summary');
    if (existing) {
      existing.remove();
    }
    if (submitSummaryTimers && submitSummaryTimers.has(bag)) {
      clearTimeout(submitSummaryTimers.get(bag));
      submitSummaryTimers.delete(bag);
    }
  }

  /**
   * Buton grubunun üstünde kısa doğrulama özeti gösterir.
   * @param {HTMLElement} root Form veya modal kökü
   * @param {string[]} lines Gösterilecek satırlar
   * @param {{compact?: boolean}} options Mobil için uzun süre görünür
   */
  function showShareholdersSubmitSummary(root, lines, options) {
    const bag = resolveShareholderValidationRoot(root) || root;
    if (!bag || !Array.isArray(lines) || !lines.length) {
      return;
    }
    const compact = !!(options && options.compact);
    const footerZone = bag.querySelector('.wdp-side-panel-footer-zone');
    const buttonGroup = footerZone
      ? footerZone.querySelector('.wdp-button-group')
      : bag.querySelector('.wdp-button-group');
    if (!buttonGroup) {
      return;
    }
    clearShareholdersSubmitSummary(bag);

    const summary = document.createElement('div');
    summary.className = 'wdp-shareholders-submit-summary';
    if (compact) {
      summary.classList.add('wdp-shareholders-submit-summary--compact');
    }
    summary.setAttribute('role', 'alert');
    summary.setAttribute('aria-live', 'assertive');

    lines.forEach(function(line) {
      const row = document.createElement('div');
      row.className = 'wdp-shareholders-submit-summary__line';
      row.textContent = line;
      summary.appendChild(row);
    });

    buttonGroup.parentNode.insertBefore(summary, buttonGroup);

    window.requestAnimationFrame(function() {
      summary.classList.add('is-visible');
      const scrollTarget = footerZone || summary;
      const utils = (window.WDPApp && window.WDPApp.utils) || {};
      try {
        if (typeof utils.scrollIntoViewSafe === 'function') {
          utils.scrollIntoViewSafe(scrollTarget, { behavior: 'smooth', block: 'end' });
        } else {
          scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      } catch (eScroll) {
        /* yoksay */
      }
    });

    const visibleMs = compact ? SUBMIT_SUMMARY_VISIBLE_MS_COMPACT : SUBMIT_SUMMARY_VISIBLE_MS;
    const hideTimer = window.setTimeout(function() {
      summary.classList.remove('is-visible');
      window.setTimeout(function() {
        if (summary.parentNode) {
          summary.remove();
        }
      }, 280);
    }, visibleMs);

    if (submitSummaryTimers) {
      submitSummaryTimers.set(bag, hideTimer);
    }
  }

  /** Tüm hissedar satırlarında başlık durumunu yeniler. */
  function refreshShareholderGuidance(root) {
    if (!root) {
      return;
    }
    const bag = resolveShareholderValidationRoot(root) || root;
    removeShareholderOverview(bag);
    const forms = getShareholderForms(bag);
    if (!forms.length) {
      return;
    }
    const armed = isShareValidationArmed(bag);

    forms.forEach(function(form) {
      stripShareholderRowStatusUI(form);
      form.classList.remove('is-complete', 'is-incomplete', 'is-incomplete-pending', 'is-targeted-incomplete');
      applyShareholderHeaderStatus(form, armed);
    });

    forms.forEach(function(form) {
      checkShareholderFormWarning(form);
    });
  }

  /** Eski uyarı rozeti DOM kalıntısını temizler. */
  function checkShareholderFormWarning(form) {
    if (!form) {
      return;
    }
    const warningBadge = form.querySelector('.wdp-shareholder-warning');
    if (!warningBadge) {
      return;
    }
    warningBadge.classList.remove('show');
    warningBadge.textContent = '';
    warningBadge.removeAttribute('title');
    warningBadge.removeAttribute('aria-label');
    warningBadge.remove();
  }

  /** Input değişince rehberlik durumunu güncelleyen dinleyiciler. */
  function attachGuidanceListeners(form) {
    if (!form || form.dataset.wdpGuidanceBound === '1') {
      return;
    }
    const refresh = function(e) {
      const bag = resolveShareholderValidationRoot(form) || form.closest('form');
      if (!bag) {
        return;
      }
      if (e && e.target && e.target.classList && e.target.classList.contains('wdp-error')) {
        e.target.classList.remove('wdp-error');
      }
      clearShareholdersSubmitSummary(bag);
      if (isShareValidationArmed(bag)) {
        refreshShareholderGuidance(bag);
      } else {
        applyShareholderHeaderStatus(form, false);
        checkShareholderFormWarning(form);
      }
    };
    const nameInput = form.querySelector('input[name^="shareholder_name_"]');
    const phoneInput = form.querySelector('input[name^="shareholder_phone_"]');
    if (nameInput) {
      nameInput.addEventListener('input', refresh);
    }
    if (phoneInput) {
      phoneInput.addEventListener('input', refresh);
    }
    form.dataset.wdpGuidanceBound = '1';
  }

  const guidanceRefreshRafByRoot = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  /** RAF ile tek karede rehberlik yenileme. */
  function queueShareholderGuidanceRefresh(root) {
    if (!root || typeof window === 'undefined') {
      return;
    }
    if (!guidanceRefreshRafByRoot) {
      refreshShareholderGuidance(root);
      return;
    }
    const pending = guidanceRefreshRafByRoot.get(root);
    if (pending) {
      window.cancelAnimationFrame(pending);
    }
    const rafId = window.requestAnimationFrame(function() {
      guidanceRefreshRafByRoot.delete(root);
      refreshShareholderGuidance(root);
    });
    guidanceRefreshRafByRoot.set(root, rafId);
  }

  WDPApp.shareholderGuidance = {
    getShareholderForms: getShareholderForms,
    resolveShareholderValidationRoot: resolveShareholderValidationRoot,
    getShareholderRowValidationState: getShareholderRowValidationState,
    refreshShareholderGuidance: refreshShareholderGuidance,
    setShareValidationArmed: setShareValidationArmed,
    resetShareholderValidationUI: resetShareholderValidationUI,
    showShareholdersSubmitSummary: showShareholdersSubmitSummary,
    clearShareholdersSubmitSummary: clearShareholdersSubmitSummary,
    attachGuidanceListeners: attachGuidanceListeners,
    queueShareholderGuidanceRefresh: queueShareholderGuidanceRefresh,
    checkShareholderFormWarning: checkShareholderFormWarning,
    removeShareholderOverview: removeShareholderOverview,
  };
})(window);
