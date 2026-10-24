/**
 * @file feedback.js
 * Alan ve form düzeyinde hata gösterimi, toast tetikleme.
 * Dış API: WDPApp.formFeedback
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const utils = WDPApp.utils || {};
  const announceStatus = typeof utils.announceStatus === 'function' ? utils.announceStatus : function() {};

  let wdpFieldErrorIdSeq = 0;

  /** Hata mesajının ekleneceği DOM kökü (fiyat alanı, field-stack satırı vb.). */
  function getInputErrorAnchor(input) {
    if (!input) {
      return null;
    }
    const row = input.closest('.wdp-field-stack__row');
    if (row) {
      return row;
    }
    if (
      input.classList &&
      (input.classList.contains('wdp-custom-price-input') ||
        input.classList.contains('wdp-addon-custom-price-input'))
    ) {
      const priceField = input.closest('.wdp-price-field');
      if (priceField) {
        return priceField;
      }
    }
    return input.parentNode;
  }

  function isCompactShareholderViewport() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(max-width: 768px)').matches;
  }

  /** Hissedar alanı hatasında ilgili satırı görünür alana kaydırır. */
  function scrollShareholderValidationIntoView(input) {
    if (!input || typeof input.closest !== 'function') {
      return;
    }
    const shareholderForm = input.closest('.wdp-shareholder-form');
    if (!shareholderForm) {
      return;
    }
    const scrollRoot =
      shareholderForm.closest('.wdp-shareholders-scroll') ||
      shareholderForm.closest('.wdp-shareholders-area');
    const anchor =
      getInputErrorAnchor(input) ||
      input.closest('.wdp-field-stack__row') ||
      input;
    if (!scrollRoot || !anchor) {
      return;
    }
    window.requestAnimationFrame(() => {
      if (typeof utils.scrollIntoViewSafe === 'function') {
        utils.scrollIntoViewSafe(anchor, { block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      } else {
        try {
          anchor.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        } catch (eScroll1) {
          try {
            anchor.scrollIntoView(false);
          } catch (eScroll2) {
            /* ignore */
          }
        }
      }
      if (isCompactShareholderViewport()) {
        const footerZone = (shareholderForm.closest('form') || document).querySelector(
          '.wdp-side-panel-footer-zone, .wdp-form-cta-zone, .wdp-button-group'
        );
        if (footerZone && typeof footerZone.scrollIntoView === 'function') {
          window.setTimeout(() => {
            if (typeof utils.scrollIntoViewSafe === 'function') {
              utils.scrollIntoViewSafe(footerZone, { block: 'end', behavior: 'smooth' });
            } else {
              try {
                footerZone.scrollIntoView({ block: 'end', behavior: 'smooth' });
              } catch (eFooter) {
                /* ignore */
              }
            }
          }, 160);
        }
      }
    });
  }

  function nextFieldErrorId() {
    wdpFieldErrorIdSeq += 1;
    return 'wdp-field-err-' + wdpFieldErrorIdSeq;
  }

  /** Gönderim doğrulamasında alan mesajı kullanıcı düzeltine kadar kalır (otomatik silinmez). */
  let errorBatchActive = false;
  let errorBatchAnnounced = false;

  function beginErrorBatch() {
    errorBatchActive = true;
    errorBatchAnnounced = false;
  }

  function endErrorBatch() {
    errorBatchActive = false;
  }

  function clearInputError(input) {
    if (!input) return;
    try {
      input.classList.remove('wdp-error');
      input.removeAttribute('aria-invalid');
      const described = input.getAttribute('aria-describedby');
      if (described && described.indexOf('wdp-field-err-') === 0) {
        input.removeAttribute('aria-describedby');
      }
    } catch (e) {
      /* ignore */
    }
    if (typeof input.setCustomValidity === 'function') {
      try {
        input.setCustomValidity('');
      } catch (eCv) {
        /* ignore */
      }
    }
    const anchor = getInputErrorAnchor(input) || input.parentNode;
    if (anchor && typeof anchor.querySelector === 'function') {
      const errorDiv = anchor.querySelector('.wdp-input-error');
      if (errorDiv) errorDiv.remove();
    }
    if (input._wdpErrorTimer) {
      window.clearTimeout(input._wdpErrorTimer);
      input._wdpErrorTimer = null;
    }
  }

  function clearFormBanner(form) {
    if (!form) return;
    const formError = form.querySelector('.wdp-form-error');
    if (!formError) return;
    formError.textContent = '';
    formError.style.display = 'none';
    if (form._wdpFormErrorTimer) {
      window.clearTimeout(form._wdpFormErrorTimer);
      form._wdpFormErrorTimer = null;
    }
  }

  function bindImmediateErrorClear(input, errorDiv, errorId) {
    if (!input || input.dataset.wdpErrorClearBound === '1') {
      // Re-bind fresh closures by removing old and adding new below
    }
    input.dataset.wdpErrorClearBound = '1';

    function onEdit() {
      clearInputError(input);
      const form = input.closest && input.closest('form');
      if (form) clearFormBanner(form);
      input.removeEventListener('input', onEdit);
      input.removeEventListener('change', onEdit);
      input.dataset.wdpErrorClearBound = '0';
    }

    input.removeEventListener('input', input._wdpOnErrorEdit);
    input.removeEventListener('change', input._wdpOnErrorEdit);
    input._wdpOnErrorEdit = onEdit;
    input.addEventListener('input', onEdit);
    input.addEventListener('change', onEdit);
  }

  function isFormProcessing(form) {
    return form && form.dataset && form.dataset.wdpProcessing === '1';
  }

  function setFormProcessing(form, processing) {
    if (!form || !form.dataset) {
      return;
    }
    form.dataset.wdpProcessing = processing ? '1' : '0';
  }

  /** Tek alan için görünür hata mesajı gösterir. */
  function showInputError(input, message) {
    if (!input) {
      return;
    }
    // Ayrılmış node'a yazma — açık kabuktaki eşleşen alana yönlendir
    if (input.isConnected === false && input.name && WDPApp.dom && typeof WDPApp.dom.getLiveDonationForm === 'function') {
      const liveForm = WDPApp.dom.getLiveDonationForm(null);
      if (liveForm) {
        let live = null;
        try {
          if (typeof CSS !== 'undefined' && CSS.escape) {
            live = liveForm.querySelector('[name="' + CSS.escape(input.name) + '"]');
          }
        } catch (eCss) {
          live = null;
        }
        if (!live) {
          live = liveForm.querySelector(
            'input[name="' + input.name + '"], textarea[name="' + input.name + '"], select[name="' + input.name + '"]'
          );
        }
        if (live) {
          input = live;
        }
      }
    }
    try {
      input.classList.add('wdp-error');
    } catch (eClass) {
      /* ignore */
    }
    const anchor = getInputErrorAnchor(input) || input.parentNode || null;
    if (!anchor || typeof anchor.appendChild !== 'function') {
      return;
    }
    let errorDiv = null;
    try {
      errorDiv = anchor.querySelector('.wdp-input-error');
    } catch (eQ) {
      errorDiv = null;
    }
    if (errorDiv) {
      errorDiv.remove();
    }
    errorDiv = document.createElement('div');
    errorDiv.className = 'wdp-input-error';
    const announceThis = !errorBatchActive || !errorBatchAnnounced;
    errorDiv.setAttribute('role', announceThis ? 'alert' : 'status');
    if (announceThis) {
      errorDiv.setAttribute('aria-live', 'assertive');
    } else {
      errorDiv.setAttribute('aria-live', 'off');
    }
    const errorId = nextFieldErrorId();
    errorDiv.id = errorId;
    errorDiv.textContent = typeof message === 'string' && message.trim() ? message.trim() : WDPApp.i18n.__('This field is required.', 'woo-donation-popup');
    try {
      anchor.appendChild(errorDiv);
    } catch (eAppend) {
      return;
    }
    try {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', errorId);
    } catch (eAria) {
      /* ignore */
    }
    if (input.closest && input.closest('.wdp-shareholder-form')) {
      scrollShareholderValidationIntoView(input);
    }

    bindImmediateErrorClear(input, errorDiv, errorId);
    if (announceThis) {
      announceStatus(errorDiv.textContent, 'assertive');
      errorBatchAnnounced = true;
    }

    // Alanı görünür kıl (sticky CTA altında kalmasın)
    try {
      if (typeof errorDiv.scrollIntoView === 'function') {
        requestAnimationFrame(function() {
          if (typeof utils.scrollIntoViewSafe === 'function') {
            utils.scrollIntoViewSafe(errorDiv, { behavior: 'smooth', block: 'nearest' });
          } else {
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        });
      }
    } catch (eScroll) {
      /* ignore */
    }
  }

  /**
   * Collect visible field-error texts when errorMessages array is empty.
   */
  function collectVisibleFieldErrorMessages(form) {
    if (!form) {
      return [];
    }
    const out = [];
    form.querySelectorAll('.wdp-input-error').forEach((el) => {
      if (!el || !el.textContent) {
        return;
      }
      if (el.closest && el.closest('.wdp-shareholder-form.collapsed')) {
        return;
      }
      const text = el.textContent.trim();
      if (text && out.indexOf(text) === -1) {
        out.push(text);
      }
    });
    return out;
  }

  function showFormError(form, message) {
    let formError = form.querySelector('.wdp-form-error');
    if (!formError) {
      formError = document.createElement('div');
      formError.className = 'wdp-form-error';
      form.insertBefore(formError, form.firstChild);
    }
    formError.setAttribute('role', 'alert');
    formError.setAttribute('data-wdp-protected', 'true');
    formError.textContent = message;
    formError.style.display = 'block';

    if (form.dataset.wdpFormErrorInputBound !== '1') {
      form.dataset.wdpFormErrorInputBound = '1';
      form.addEventListener('input', function onFormInputClearBanner() {
        clearFormBanner(form);
      });
    }

    if (!errorBatchActive || !errorBatchAnnounced) {
      announceStatus(message, 'assertive');
      errorBatchAnnounced = true;
    }
  }

  /**
   * Alan düzeyi hatalar render edilemezse form üstünde yedek mesaj gösterir.
   * Kapalı (collapsed / display:none) satırlardaki hatalar "görünür" sayılmaz.
   */
  function isVisibleInForm(el) {
    if (!el) {
      return false;
    }
    if (el.closest && el.closest('.wdp-shareholder-form.collapsed')) {
      return false;
    }
    if (el.getClientRects && el.getClientRects().length > 0) {
      return true;
    }
    return false;
  }

  function ensureVisibleValidationFeedback(form, errorMessages) {
    if (!form) {
      return;
    }
    const visibleFieldErrors = Array.prototype.slice.call(form.querySelectorAll('.wdp-error'))
      .some(isVisibleInForm);
    if (visibleFieldErrors) {
      // Field chrome is visible — still ensure a concrete banner if messages exist and no visible input-error text
      const hasVisibleMsg = Array.prototype.slice.call(form.querySelectorAll('.wdp-input-error')).some(isVisibleInForm);
      if (hasVisibleMsg) {
        return;
      }
    }
    const fieldErrors = Array.prototype.slice.call(form.querySelectorAll('.wdp-input-error'));
    const hasVisibleFieldErrors = fieldErrors.some(isVisibleInForm);
    if (hasVisibleFieldErrors) {
      return;
    }
    let msgs = Array.isArray(errorMessages) ? errorMessages.filter((m) => typeof m === 'string' && m.trim()) : [];
    if (!msgs.length) {
      msgs = collectVisibleFieldErrorMessages(form);
    }
    const msg = msgs.length ? msgs[0] : WDPApp.i18n.__('Please check the highlighted fields.', 'woo-donation-popup');
    showFormError(form, msg);
  }

  function showShareholderValidationFeedback(form, summaryLines, fallbackMessage) {
    const lines = Array.isArray(summaryLines)
      ? summaryLines.filter((line) => typeof line === 'string' && line.trim())
      : [];
    let primary =
      lines.length > 0
        ? lines[0]
        : (typeof fallbackMessage === 'string' && fallbackMessage.trim()
            ? fallbackMessage.trim()
            : '');
    if (!primary) {
      const collected = collectVisibleFieldErrorMessages(form);
      primary = collected.length ? collected[0] : WDPApp.i18n.__('Please check the highlighted fields.', 'woo-donation-popup');
    }
    ensureVisibleValidationFeedback(form, lines.length ? lines : [primary]);
  }

  WDPApp.formFeedback = {
    getInputErrorAnchor: getInputErrorAnchor,
    scrollShareholderValidationIntoView: scrollShareholderValidationIntoView,
    isCompactShareholderViewport: isCompactShareholderViewport,
    isFormProcessing: isFormProcessing,
    setFormProcessing: setFormProcessing,
    showInputError: showInputError,
    clearInputError: clearInputError,
    clearFormBanner: clearFormBanner,
    showFormError: showFormError,
    collectVisibleFieldErrorMessages: collectVisibleFieldErrorMessages,
    ensureVisibleValidationFeedback: ensureVisibleValidationFeedback,
    showShareholderValidationFeedback: showShareholderValidationFeedback,
    beginErrorBatch: beginErrorBatch,
    endErrorBatch: endErrorBatch,
  };
})(window);
