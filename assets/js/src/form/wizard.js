/**
 * @file wizard.js
 * Multi-step form — DOM taşımaz; adımları data-wdp-step + hidden ile yönetir.
 * Hisseli: Hisseler → Onay. Standart: Bilgi → Tutar → [Alt bağış] → Onay.
 * Dış API: WDPApp.formWizard
 *
 * Not: form.innerHTML reset sonrası eski _wdpWizard referansları kopar.
 * Bu yüzden state “canlı mı?” kontrol edilir; tıklama form üzerinden delege edilir.
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  if (!WDPApp.i18n || typeof WDPApp.i18n.__ !== 'function') {
    WDPApp.i18n = {
      __: function (msg) { return msg == null ? '' : String(msg); },
      _x: function (msg) { return msg == null ? '' : String(msg); },
      sprintf: function (fmt) { return String(fmt == null ? '' : fmt); },
    };
  }
  const utils = WDPApp.utils || {};
  const announce = typeof utils.announceStatus === 'function' ? utils.announceStatus : function() {};
  const emit = typeof utils.emitWdpEvent === 'function' ? utils.emitWdpEvent : function() {};

  const STEP_LABELS = {
    donor: WDPApp.i18n.__('Your details', 'woo-donation-popup'),
    amount: WDPApp.i18n._x('Amount', 'wizard step', 'woo-donation-popup'),
    shares: WDPApp.i18n.__('Shares', 'woo-donation-popup'),
    sadaka: WDPApp.i18n.__('Additional donation', 'woo-donation-popup'),
    confirm: WDPApp.i18n.__('Confirmation', 'woo-donation-popup'),
  };

  function isEnabled(form) {
    if (!form) return false;
    // 10.30.0: yalnız form sınıfı / data özniteliği (ürün bazlı PHP kararı); genel flags.multi_step yok sayılır.
    return form.classList.contains('wdp-multi-step') || form.getAttribute('data-wdp-multi-step') === '1';
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function uniqueNodes(list) {
    const out = [];
    const seen = new Set();
    (list || []).forEach(function(el) {
      if (!el || seen.has(el)) return;
      seen.add(el);
      out.push(el);
    });
    return out;
  }

  function isStateLive(state) {
    return !!(
      state &&
      state.form &&
      state.foot &&
      state.nextBtn &&
      state.shell &&
      state.form.contains(state.foot) &&
      state.form.contains(state.nextBtn) &&
      state.form.contains(state.shell)
    );
  }

  function clearStepChrome(el) {
    if (!el || !el.removeAttribute) return;
    el.removeAttribute('data-wdp-step');
    el.removeAttribute('data-wdp-step-index');
    el.removeAttribute('hidden');
    el.removeAttribute('aria-hidden');
    el.classList.remove('wdp-wizard-section', 'is-wdp-step-active');
  }

  function destroy(form) {
    if (!form) return;
    const state = form._wdpWizard;
    if (state && state.steps) {
      state.steps.forEach(function(step) {
        (step.nodes || []).forEach(clearStepChrome);
      });
    }
    form.querySelectorAll('.wdp-wizard-section, [data-wdp-step]').forEach(clearStepChrome);
    const shell = form.querySelector('.wdp-wizard');
    if (shell) shell.remove();
    const foot = form.querySelector('.wdp-wizard-foot');
    if (foot) foot.remove();
    form.classList.remove('wdp-wizard-ready', 'wdp-wizard-on-confirm');
    // multi-step class may come from PHP; only remove runtime-ready bits via dataset
    delete form.dataset.wdpWizardBuilt;
    form._wdpWizard = null;
  }

  function collectStepDefs(form) {
    const defs = [];
    if (form.querySelector('.wdp-shares-section')) {
      defs.push({
        id: 'shares',
        label: STEP_LABELS.shares,
        nodes: uniqueNodes([form.querySelector('.wdp-shares-section')]),
      });
    } else {
      // Bilgiler adımı: bağışçı yığını + ithaf/anonim bloğu (wdp-form-block--note) aynı adımda.
      const donorBlock = form.querySelector('.wdp-form-block--info');
      const donorStack = form.querySelector('.wdp-field-stack');
      const noteBlock = form.querySelector('.wdp-form-block--note');
      const donorNodes = uniqueNodes([donorBlock || donorStack, noteBlock]);
      if (donorNodes.length) {
        defs.push({ id: 'donor', label: STEP_LABELS.donor, nodes: donorNodes });
      }
      let amountNodes = uniqueNodes(form.querySelectorAll('.wdp-form-block--amount'));
      if (!amountNodes.length) {
        amountNodes = uniqueNodes(
          form.querySelectorAll(
            [
              '.wdp-custom-price-row:not(.wdp-sadaka-donation__amount)',
              '.wdp-custom-price-with-qty-row',
              '.wdp-fixed-price-counter-row',
              '.wdp-progress-bar-price-row',
              '.wdp-price-quantity-row:not(.wdp-progress-bar-price-row)',
            ].join(', ')
          )
        );
      }
      if (amountNodes.length) {
        defs.push({ id: 'amount', label: STEP_LABELS.amount, nodes: amountNodes });
      }
      const sadaka = form.querySelector('.wdp-sadaka-donation');
      if (sadaka) {
        defs.push({ id: 'sadaka', label: STEP_LABELS.sadaka, nodes: [sadaka] });
      }
    }

    const confirmNodes = uniqueNodes(
      form.querySelectorAll('.wdp-shares-total-bar, .wdp-donation-summary, .wdp-button-group, .wdp-trust-strip, .wdp-side-panel-footer-zone, .wdp-form-cta-zone')
    );
    defs.push({ id: 'confirm', label: STEP_LABELS.confirm, nodes: confirmNodes });
    return defs.filter(function(d) {
      return d.nodes && d.nodes.length > 0;
    });
  }

  function ensureChrome(form) {
    let shell = form.querySelector(':scope > .wdp-wizard');
    if (!shell) {
      shell = document.createElement('div');
      shell.className = 'wdp-wizard';
      shell.setAttribute('data-wdp-wizard', '1');

      const nav = document.createElement('div');
      nav.className = 'wdp-wizard__nav';
      nav.setAttribute('role', 'tablist');
      nav.setAttribute('aria-label', WDPApp.i18n.__('Form steps', 'woo-donation-popup'));

      const controls = document.createElement('div');
      controls.className = 'wdp-wizard__controls';
      controls.hidden = true;
      controls.innerHTML =
        '<button type="button" class="wdp-wizard__btn wdp-wizard__btn--back" hidden>' +
        WDPApp.i18n.__('Back', 'woo-donation-popup') +
        '</button>' +
        '<button type="button" class="wdp-wizard__btn wdp-wizard__btn--next">' +
        WDPApp.i18n.__('Next', 'woo-donation-popup') +
        '</button>';

      shell.appendChild(nav);
      shell.appendChild(controls);

      const error = form.querySelector(':scope > .wdp-form-error');
      if (error) {
        form.insertBefore(shell, error.nextSibling);
      } else {
        form.insertBefore(shell, form.firstChild);
      }
    }

    let foot = form.querySelector(':scope > .wdp-wizard-foot');
    if (!foot) {
      foot = form.querySelector('.wdp-wizard-foot');
    }
    if (!foot) {
      foot = document.createElement('div');
      foot.className = 'wdp-wizard-foot';
      foot.innerHTML =
        '<button type="button" class="wdp-wizard__btn wdp-wizard__btn--back" hidden>' +
        WDPApp.i18n.__('Back', 'woo-donation-popup') +
        '</button>' +
        '<button type="button" class="wdp-wizard__btn wdp-wizard__btn--next">' +
        WDPApp.i18n.__('Next', 'woo-donation-popup') +
        '</button>';
      const firstConfirm = form.querySelector(
        '.wdp-shares-total-bar, .wdp-donation-summary, .wdp-side-panel-footer-zone, .wdp-form-cta-zone, .wdp-button-group, .wdp-trust-strip'
      );
      if (firstConfirm && firstConfirm.parentNode === form) {
        form.insertBefore(foot, firstConfirm);
      } else if (firstConfirm && firstConfirm.closest && firstConfirm.closest('.wdp-side-panel-footer-zone')) {
        const zone = firstConfirm.closest('.wdp-side-panel-footer-zone');
        if (zone && zone.parentNode === form) {
          form.insertBefore(foot, zone);
        } else {
          form.appendChild(foot);
        }
      } else {
        form.appendChild(foot);
      }
    }

    const topControls = shell.querySelector('.wdp-wizard__controls');
    if (topControls) topControls.hidden = true;

    return { shell: shell, foot: foot };
  }

  function tagNodes(defs) {
    defs.forEach(function(def, index) {
      def.nodes.forEach(function(el) {
        el.setAttribute('data-wdp-step', def.id);
        el.setAttribute('data-wdp-step-index', String(index));
        el.classList.add('wdp-wizard-section');
      });
    });
  }

  function requiredMessage() {
    return (
      (window.wdp_ajax && window.wdp_ajax.strings && window.wdp_ajax.strings.required_field) ||
      WDPApp.i18n.__('This field is required', 'woo-donation-popup')
    );
  }

  function clearStepErrors(form) {
    if (!form) return;
    const formError = form.querySelector('.wdp-form-error');
    if (formError) {
      formError.textContent = '';
      formError.style.display = 'none';
    }
    form.querySelectorAll('.wdp-input-error').forEach(function(el) {
      el.remove();
    });
    form.querySelectorAll('.wdp-error').forEach(function(el) {
      el.classList.remove('wdp-error');
      el.removeAttribute('aria-invalid');
    });
  }

  function showStepSummaryError(form, message) {
    const feedback = WDPApp.formFeedback || {};
    if (typeof feedback.showFormError === 'function') {
      feedback.showFormError(form, message);
      return;
    }
    let formError = form.querySelector('.wdp-form-error');
    if (!formError) {
      formError = document.createElement('div');
      formError.className = 'wdp-form-error';
      form.insertBefore(formError, form.firstChild);
    }
    formError.setAttribute('role', 'alert');
    formError.textContent = message;
    formError.style.display = 'block';
  }

  function validateCurrentStep(state) {
    const step = state.steps[state.index];
    if (!step || step.id === 'confirm') return true;

    const feedback = WDPApp.formFeedback || {};
    const formValidate = WDPApp.formValidate || {};
    let ok = true;
    let firstInvalid = null;
    const messages = [];

    if (step.id === 'shares') {
      if (typeof formValidate.ensureShareholderRowsReady === 'function') {
        try {
          formValidate.ensureShareholderRowsReady(state.form);
        } catch (eEnsure) {
          /* ignore */
        }
      }

      const countInput = state.form.querySelector('input[name="share_count"]');
      const count = countInput ? parseInt(countInput.value, 10) || 0 : 0;
      if (count < 1) {
        ok = false;
        messages.push(WDPApp.i18n.__('Please select at least 1 share.', 'woo-donation-popup'));
        showStepSummaryError(state.form, WDPApp.i18n.__('Please select at least 1 share.', 'woo-donation-popup'));
        return ok;
      }

      let rows = [];
      if (typeof formValidate.getOrderedShareholderRows === 'function') {
        rows = formValidate.getOrderedShareholderRows(state.form) || [];
      } else {
        rows = Array.prototype.slice.call(state.form.querySelectorAll('.wdp-shareholder-form'));
      }

      if (!rows.length) {
        ok = false;
        showStepSummaryError(state.form, WDPApp.i18n.__('Please fill in the share details.', 'woo-donation-popup'));
        return ok;
      }

      const issues = [];
      let firstRowIssue = null;
      rows.forEach(function(row) {
        if (typeof formValidate.validateShareholderRow === 'function') {
          const result = formValidate.validateShareholderRow(row);
          if (result && Array.isArray(result.issues) && result.issues.length) {
            ok = false;
            if (!firstRowIssue) {
              firstRowIssue = {
                row: result.row || row,
                field: result.issues[0].field,
                message: result.issues[0].message,
                type: result.issues[0].type,
              };
            }
            result.issues.forEach(function(issue) {
              issues.push(issue);
              if (!firstInvalid && issue.field) firstInvalid = issue.field;
            });
          }
        } else {
          const nameField = row.querySelector('input[name^="shareholder_name_"]');
          const phoneField = row.querySelector('input[type="tel"][name^="shareholder_phone_"]');
          if (nameField && !String(nameField.value || '').trim()) {
            ok = false;
            firstInvalid = firstInvalid || nameField;
            if (typeof feedback.showInputError === 'function') {
              feedback.showInputError(nameField, WDPApp.i18n._x('Full name is required.', 'wizard step', 'woo-donation-popup'));
            }
          }
          if (phoneField && !String(phoneField.value || '').trim()) {
            ok = false;
            firstInvalid = firstInvalid || phoneField;
            if (typeof feedback.showInputError === 'function') {
              feedback.showInputError(phoneField, WDPApp.i18n.__('Phone number is required.', 'woo-donation-popup'));
            }
          }
        }
      });

      if (!ok) {
        const summary =
          (issues[0] && issues[0].message) ||
          WDPApp.i18n.__('Please fill in the shareholder name and phone details.', 'woo-donation-popup');
        showStepSummaryError(state.form, summary);
        if (firstRowIssue && typeof formValidate.focusShareholderIssue === 'function') {
          try {
            formValidate.focusShareholderIssue(firstRowIssue);
          } catch (eFocus) {
            /* ignore */
          }
        } else if (firstInvalid && typeof firstInvalid.focus === 'function') {
          try {
            firstInvalid.focus({ preventScroll: false });
          } catch (eF) {
            firstInvalid.focus();
          }
        }
      }
      return ok;
    }

    step.nodes.forEach(function(root) {
      root.querySelectorAll('input, textarea, select').forEach(function(input) {
        if (input.type === 'hidden' || input.disabled) return;
        if (input.closest('[hidden]')) return;
        if (!input.required && !input.hasAttribute('required')) return;
        if (input.type === 'tel' || (input.name && input.name.indexOf('phone') !== -1)) return;

        const empty = !String(input.value || '').trim();
        if (!empty) return;
        ok = false;
        if (!firstInvalid) firstInvalid = input;
        const msg = requiredMessage();
        messages.push(msg);
        if (typeof feedback.showInputError === 'function') {
          feedback.showInputError(input, msg);
        } else {
          input.classList.add('wdp-error');
        }
      });
    });

    // Telefon: HTML required yetmez; formValidate kullan
    if (step.id === 'donor') {
      const phone = state.form.querySelector(
        '.wdp-wizard-section[data-wdp-step="donor"] input[type="tel"][name="donation_phone"], .wdp-field-stack input[type="tel"][name="donation_phone"]'
      );
      if (phone && !phone.closest('[hidden]')) {
        let phoneOk = true;
        if (typeof formValidate.validatePhoneInputInForm === 'function') {
          phoneOk = formValidate.validatePhoneInputInForm(state.form, phone, { required: true });
        } else if (typeof formValidate.getPhoneValidationState === 'function') {
          const st = formValidate.getPhoneValidationState(phone, { required: true });
          phoneOk = !!(st && st.ok);
          if (!phoneOk && typeof feedback.showInputError === 'function') {
            feedback.showInputError(phone, (st && st.message) || WDPApp.i18n.__('Please enter a valid phone number.', 'woo-donation-popup'));
          }
        } else if (!String(phone.value || '').trim()) {
          phoneOk = false;
          if (typeof feedback.showInputError === 'function') {
            feedback.showInputError(phone, WDPApp.i18n.__('Phone number is required.', 'woo-donation-popup'));
          }
        }
        if (!phoneOk) {
          ok = false;
          firstInvalid = firstInvalid || phone;
          messages.push(WDPApp.i18n.__('Please check the phone number.', 'woo-donation-popup'));
        }
      }

      const nameInput = state.form.querySelector(
        '.wdp-wizard-section[data-wdp-step="donor"] input[name="donation_full_name"], .wdp-field-stack input[name="donation_full_name"]'
      );
      if (nameInput && !String(nameInput.value || '').trim()) {
        ok = false;
        firstInvalid = firstInvalid || nameInput;
        const msg =
          (window.wdp_ajax && window.wdp_ajax.strings && window.wdp_ajax.strings.donor_name_required) ||
          WDPApp.i18n._x('Full name is required.', 'wizard step', 'woo-donation-popup');
        messages.push(msg);
        if (typeof feedback.showInputError === 'function') {
          feedback.showInputError(nameInput, msg);
        }
      }
    }

    if (step.id === 'amount') {
      const price = state.form.querySelector(
        '.wdp-wizard-section[data-wdp-step="amount"] input[name="custom_price"], input[name="custom_price"]'
      );
      if (price && !price.closest('[hidden]')) {
        const raw = String(price.value || '').trim();
        const utilsW = window.WDPApp && WDPApp.utils ? WDPApp.utils : {};
        const parseAmt = typeof utilsW.parseMoney === 'function' ? utilsW.parseMoney : parseFloat;
        const detailed = raw && typeof utilsW.parseMoneyDetailed === 'function'
          ? utilsW.parseMoneyDetailed(raw)
          : null;
        const min = parseAmt(price.getAttribute('min') || price.dataset.baseMin || price.getAttribute('data-wdp-min-price') || '0');
        const n = detailed && detailed.status === 'ok' ? detailed.amount : parseAmt(raw);
        if (detailed && detailed.status === 'ambiguous') {
          ok = false;
          firstInvalid = firstInvalid || price;
          const msg = (detailed.error && String(detailed.error).trim())
            ? detailed.error
            : (typeof utilsW.getAmbiguousAmountMessage === 'function'
              ? utilsW.getAmbiguousAmountMessage()
              : WDPApp.i18n.__('Fractional amounts are not allowed on this site, e.g. 10', 'woo-donation-popup'));
          messages.push(msg);
          if (typeof feedback.showInputError === 'function') {
            feedback.showInputError(price, msg);
          }
        } else if (!raw || !Number.isFinite(n) || n <= 0 || (Number.isFinite(min) && min > 0 && n + 0.0001 < min)) {
          ok = false;
          firstInvalid = firstInvalid || price;
          const msg =
            ((window.wdp_ajax && window.wdp_ajax.strings && window.wdp_ajax.strings.min_price_error) ||
              WDPApp.i18n.__('Minimum amount: ', 'woo-donation-popup')) + (Number.isFinite(min) && min > 0 ? min : '');
          messages.push(msg);
          if (typeof feedback.showInputError === 'function') {
            feedback.showInputError(price, msg);
          }
        }
      }
    }

    if (!ok) {
      showStepSummaryError(
        state.form,
        messages[0] || WDPApp.i18n.__('Please fill in the missing or invalid fields.', 'woo-donation-popup')
      );
      if (firstInvalid && typeof firstInvalid.focus === 'function') {
        try {
          firstInvalid.focus({ preventScroll: false });
        } catch (e) {
          firstInvalid.focus();
        }
      }
    }
    return ok;
  }

  function updateChrome(state) {
    const last = state.index >= state.steps.length - 1;
    if (state.backBtn) state.backBtn.hidden = state.index === 0;
    if (state.nextBtn) state.nextBtn.hidden = last;
    state.form.classList.toggle('wdp-wizard-on-confirm', last);
    state.steps.forEach(function(step, i) {
      const active = i === state.index;
      if (!step.dot) return;
      step.dot.classList.toggle('is-active', active);
      step.dot.classList.toggle('is-done', i < state.index);
      step.dot.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function applyStepVisibility(state, index) {
    state.steps.forEach(function(step, i) {
      const active = i === index;
      step.nodes.forEach(function(el) {
        el.hidden = !active;
        el.classList.toggle('is-wdp-step-active', active);
        el.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
    });
    state.index = index;
    updateChrome(state);

    if (state.steps[index] && state.steps[index].id === 'shares') {
      if (WDPApp.shareholder && typeof WDPApp.shareholder.relayout === 'function') {
        try {
          WDPApp.shareholder.relayout(state.form);
        } catch (e) {}
      }
    }
  }

  function goTo(state, index, instant) {
    const next = Math.max(0, Math.min(state.steps.length - 1, index));
    const run = function() {
      applyStepVisibility(state, next);
      const step = state.steps[next];
      announce((step && step.label ? step.label : WDPApp.i18n.__('Step', 'woo-donation-popup')) + ' (' + (next + 1) + '/' + state.steps.length + ')');
      emit('wdp:wizard:step', {
        form: state.form,
        step: step ? step.id : '',
        index: next,
        total: state.steps.length,
      });
      if (window.WDPMetaTracking && typeof window.WDPMetaTracking.trackCustom === 'function') {
        try {
          window.WDPMetaTracking.trackCustom('DonationWizardStep', {
            step: step ? step.id : '',
            index: next,
          });
        } catch (e) {}
      }
      if (!instant && step && step.nodes[0]) {
        const focusable = step.nodes[0].querySelector(
          'input:not([type="hidden"]), textarea, select, button:not([disabled])'
        );
        if (focusable) {
          window.setTimeout(function() {
            try {
              focusable.focus({ preventScroll: true });
            } catch (e3) {}
          }, 40);
        }
      }
    };

    if (!instant && !prefersReducedMotion() && typeof document.startViewTransition === 'function') {
      try {
        document.startViewTransition(run);
        return;
      } catch (e4) {}
    }
    run();
  }

  function handleWizardClick(e) {
    const form = e.currentTarget;
    const state = form._wdpWizard;
    if (!state || !isStateLive(state)) return;

    const nextBtn = e.target.closest && e.target.closest('.wdp-wizard__btn--next');
    const backBtn = e.target.closest && e.target.closest('.wdp-wizard__btn--back');
    const stepDot = e.target.closest && e.target.closest('.wdp-wizard__step');

    if (nextBtn && state.foot && state.foot.contains(nextBtn)) {
      e.preventDefault();
      e.stopPropagation();
      if (!validateCurrentStep(state)) return;
      clearStepErrors(state.form);
      goTo(state, state.index + 1, false);
      return;
    }

    if (backBtn && state.foot && state.foot.contains(backBtn)) {
      e.preventDefault();
      e.stopPropagation();
      clearStepErrors(state.form);
      goTo(state, state.index - 1, false);
      return;
    }

    if (stepDot && state.shell && state.shell.contains(stepDot)) {
      e.preventDefault();
      const i = parseInt(stepDot.getAttribute('data-step-index'), 10);
      if (!Number.isFinite(i) || i === state.index) return;
      if (i < state.index) {
        clearStepErrors(state.form);
        goTo(state, i, false);
        return;
      }
      let ok = true;
      const start = state.index;
      for (let s = start; s < i; s++) {
        state.index = s;
        if (!validateCurrentStep(state)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        clearStepErrors(state.form);
        goTo(state, i, false);
      } else {
        updateChrome(state);
      }
    }
  }

  function ensureDelegated(form) {
    if (form._wdpWizardClickBound) return;
    form._wdpWizardClickBound = true;
    form.addEventListener('click', handleWizardClick);
  }

  function build(form) {
    if (!form) return null;
    if (!isEnabled(form)) return null;

    if (form.dataset.wdpWizardBuilt === '1' && isStateLive(form._wdpWizard)) {
      return form._wdpWizard;
    }

    // innerHTML reset / eski snapshot: kopmuş state → temizle ve yeniden kur
    if (form._wdpWizard || form.dataset.wdpWizardBuilt === '1' || form.querySelector('.wdp-wizard, .wdp-wizard-foot')) {
      destroy(form);
    }

    const defs = collectStepDefs(form);
    if (defs.length < 2) return null;

    tagNodes(defs);
    const chrome = ensureChrome(form);
    const shell = chrome.shell;
    const foot = chrome.foot;
    const nav = shell.querySelector('.wdp-wizard__nav');
    nav.innerHTML = '';

    const steps = defs.map(function(def, index) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'wdp-wizard__step' + (index === 0 ? ' is-active' : '');
      dot.setAttribute('data-step-index', String(index));
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      dot.innerHTML =
        '<span class="wdp-wizard__step-index">' +
        (index + 1) +
        '</span><span class="wdp-wizard__step-label">' +
        def.label +
        '</span>';
      nav.appendChild(dot);
      return { id: def.id, label: def.label, nodes: def.nodes, dot: dot };
    });

    form.classList.add('wdp-multi-step', 'wdp-wizard-ready');
    form.setAttribute('data-wdp-multi-step', '1');
    form.dataset.wdpWizardBuilt = '1';

    const state = {
      form: form,
      shell: shell,
      foot: foot,
      steps: steps,
      index: 0,
      backBtn: foot.querySelector('.wdp-wizard__btn--back'),
      nextBtn: foot.querySelector('.wdp-wizard__btn--next'),
    };
    form._wdpWizard = state;
    ensureDelegated(form);
    goTo(state, 0, true);
    emit('wdp:wizard:ready', { form: form, steps: steps.length });
    return state;
  }

  function setup(form) {
    if (!form || !isEnabled(form)) return null;
    return build(form);
  }

  function reset(form) {
    if (!form) return;
    if (!isStateLive(form._wdpWizard)) {
      setup(form);
      return;
    }
    goTo(form._wdpWizard, 0, true);
  }

  function revealInvalidSteps(form) {
    if (!form) return;
    const state = form._wdpWizard;
    if (!isStateLive(state)) return;
    let firstIdx = -1;
    state.steps.forEach(function(step, i) {
      const hasError = (step.nodes || []).some(function(n) {
        return n && n.querySelector && n.querySelector('.wdp-error, .wdp-input-error, [aria-invalid="true"]');
      });
      if (!hasError) return;
      if (firstIdx < 0) firstIdx = i;
      (step.nodes || []).forEach(function(el) {
        if (!el) return;
        el.hidden = false;
        if (typeof el.removeAttribute === 'function') el.removeAttribute('hidden');
        if (typeof el.setAttribute === 'function') el.setAttribute('aria-hidden', 'false');
        if (el.classList) el.classList.add('is-wdp-step-active');
      });
    });
    if (firstIdx >= 0) {
      state.index = firstIdx;
      updateChrome(state);
    }
  }

  WDPApp.formWizard = {
    setup: setup,
    reset: reset,
    destroy: destroy,
    isEnabled: isEnabled,
    revealInvalidSteps: revealInvalidSteps,
    goTo: function(form, index) {
      if (!form) return;
      if (!isStateLive(form._wdpWizard)) {
        setup(form);
      }
      if (form._wdpWizard) goTo(form._wdpWizard, index, false);
    },
  };
})(window);
