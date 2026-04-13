/**
 * International phone fields — intl-tel-input for format/validation/dial code + WDP country panel.
 * Library dropdown is disabled (allowDropdown: false) to avoid portal/scroll/modal conflicts; the
 * visible list is a single controlled panel (fixed, high z-index) opened only from the flag strip.
 *
 * @package WooCommerce\Donation_Popup
 */

(function (window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const wdp_ajax = window.wdp_ajax || {};

  function debugPhone(msg) {
    if (typeof window !== 'undefined' && window.wdpDebugPhoneCountry && window.console && window.console.debug) {
      window.console.debug('[WDP phone]', msg);
    }
  }

  function getPhoneConfig() {
    const phone = wdp_ajax.phone || {};
    const raw = phone.default_country || 'tr';
    const defaultCountry = typeof raw === 'string' && raw.length === 2 ? raw.toLowerCase() : 'tr';
    const preferred = Array.isArray(phone.preferred_countries) ? phone.preferred_countries : ['tr', 'de', 'us', 'gb'];
    return {
      defaultCountry: defaultCountry,
      preferredCountries: preferred.filter(function (c) {
        return typeof c === 'string' && c.length === 2;
      }),
    };
  }

  function getPhoneInputs(root) {
    if (!root || !root.querySelectorAll) {
      return [];
    }
    return Array.prototype.slice.call(
      root.querySelectorAll(
        'input[type="tel"][name="donation_phone"], input[type="tel"][name^="shareholder_phone_"]'
      )
    );
  }

  /**
   * Match visual gap from dial-code/flag strip to typed text with the name row rhythm
   * (icon column + column-gap: --wdp-field-stack-gap-icon-text). intl-tel-input uses ~6px;
   * we override padding-left after layout using the flag container width + design token.
   */
  function getFieldStackIconTextGapPx() {
    let gapPx = 10;
    try {
      const raw = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue('--wdp-field-stack-gap-icon-text')
        .trim();
      if (raw.endsWith('px')) {
        const n = Number.parseFloat(raw);
        if (Number.isFinite(n) && n >= 0) {
          gapPx = n;
        }
      }
    } catch (e) {
      /* ignore */
    }
    return gapPx;
  }

  function syncTelInputPaddingToFieldRhythm(input) {
    if (!input) {
      return;
    }
    const wrap = input.closest('.iti');
    const fc = wrap ? wrap.querySelector('.iti__flag-container') : null;
    if (!fc) {
      return;
    }
    const w = fc.offsetWidth || 0;
    const gapPx = getFieldStackIconTextGapPx();
    input.style.paddingLeft = w + gapPx + 'px';
  }

  function scheduleTelInputPaddingSync(input) {
    if (!input) {
      return;
    }
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        syncTelInputPaddingToFieldRhythm(input);
      });
    });
  }

  function hasUtils() {
    return typeof window.intlTelInputUtils !== 'undefined' && window.intlTelInputUtils;
  }

  function normalizePhoneDigits(value) {
    if (value == null) {
      return '';
    }
    return String(value).replace(/\D+/g, '');
  }

  function sanitizePhoneInputValue(input) {
    if (!input) {
      return;
    }
    const oldValue = String(input.value || '');
    const start = typeof input.selectionStart === 'number' ? input.selectionStart : oldValue.length;
    const digitsBeforeCursor = normalizePhoneDigits(oldValue.slice(0, start)).length;
    const nextValue = normalizePhoneDigits(oldValue);
    if (nextValue === oldValue) {
      return;
    }
    input.value = nextValue;
    try {
      input.setSelectionRange(digitsBeforeCursor, digitsBeforeCursor);
    } catch (eSel) {
      /* ignore */
    }
  }

  function attachDigitsOnlyGuards(input) {
    if (!input) {
      return;
    }
    if (typeof input.inputMode === 'string') {
      input.inputMode = 'numeric';
    } else {
      input.setAttribute('inputmode', 'numeric');
    }
    input.setAttribute('pattern', '[0-9]*');
    input.setAttribute('autocomplete', 'tel-national');

    if (input._wdpPhoneBeforeInputGuard) {
      input.removeEventListener('beforeinput', input._wdpPhoneBeforeInputGuard);
    }
    if (input._wdpPhoneInputSanitizer) {
      input.removeEventListener('input', input._wdpPhoneInputSanitizer);
    }
    if (input._wdpPhonePasteSanitizer) {
      input.removeEventListener('paste', input._wdpPhonePasteSanitizer);
    }

    input._wdpPhoneBeforeInputGuard = function (e) {
      if (!e || typeof e.data !== 'string') {
        return;
      }
      if (e.inputType && e.inputType.indexOf('insert') !== 0) {
        return;
      }
      if (/\D/.test(e.data)) {
        e.preventDefault();
      }
    };
    input._wdpPhoneInputSanitizer = function () {
      sanitizePhoneInputValue(input);
    };
    input._wdpPhonePasteSanitizer = function () {
      window.requestAnimationFrame(function () {
        sanitizePhoneInputValue(input);
      });
    };

    input.addEventListener('beforeinput', input._wdpPhoneBeforeInputGuard);
    input.addEventListener('input', input._wdpPhoneInputSanitizer);
    input.addEventListener('paste', input._wdpPhonePasteSanitizer);
    sanitizePhoneInputValue(input);
  }

  function getIntlCountryDataset() {
    try {
      const g = window.intlTelInputGlobals;
      if (g && typeof g.getCountryData === 'function') {
        return g.getCountryData().slice();
      }
    } catch (e) {
      /* ignore */
    }
    try {
      if (window.intlTelInput && typeof window.intlTelInput.getCountryData === 'function') {
        return window.intlTelInput.getCountryData().slice();
      }
    } catch (e2) {
      /* ignore */
    }
    return [];
  }

  function readVisualViewportFrame() {
    const vv = window.visualViewport;
    if (!vv) {
      return {
        top: 0,
        left: 0,
        bottom: window.innerHeight,
        right: window.innerWidth,
      };
    }
    return {
      top: vv.offsetTop,
      left: vv.offsetLeft,
      bottom: vv.offsetTop + vv.height,
      right: vv.offsetLeft + vv.width,
    };
  }

  function sortCountriesForConfig(all, preferredIso2) {
    const prefSet = {};
    preferredIso2.forEach(function (p) {
      prefSet[p.toLowerCase()] = true;
    });
    const preferred = [];
    const rest = [];
    for (let i = 0; i < all.length; i++) {
      const c = all[i];
      if (!c || !c.iso2) {
        continue;
      }
      const iso = c.iso2.toLowerCase();
      if (prefSet[iso]) {
        preferred.push(c);
      } else {
        rest.push(c);
      }
    }
    preferred.sort(function (a, b) {
      const ia = preferredIso2.indexOf(a.iso2.toLowerCase());
      const ib = preferredIso2.indexOf(b.iso2.toLowerCase());
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    rest.sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    });
    return preferred.concat(rest);
  }

  /** Single floating panel — explicit visibility, no intl-tel-input portal. */
  const countryPanel = {
    root: null,
    list: null,
    search: null,
    currentInput: null,
    currentIti: null,
    triggerEl: null,
    sortedCountries: null,
    onDocPointerDown: null,
    onDocKeyDown: null,
    onVv: null,
    filterDebounce: null,
  };

  function ensureCountryPanelDom() {
    if (countryPanel.root) {
      return countryPanel.root;
    }
    const el = document.createElement('div');
    el.className = 'wdp-phone-country-panel';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Country');
    el.hidden = true;
    el.id = 'wdp-phone-country-panel';
    el.innerHTML =
      '<div class="wdp-phone-country-panel__inner">' +
      '<input type="search" class="wdp-phone-country-panel__search" autocomplete="off" autocorrect="off" spellcheck="false" />' +
      '<ul class="wdp-phone-country-panel__list" role="listbox"></ul>' +
      '</div>';
    document.body.appendChild(el);
    countryPanel.root = el;
    countryPanel.list = el.querySelector('.wdp-phone-country-panel__list');
    countryPanel.search = el.querySelector('.wdp-phone-country-panel__search');
    const ph = wdp_ajax.strings && wdp_ajax.strings.phone_search_placeholder;
    if (ph) {
      countryPanel.search.setAttribute('placeholder', ph);
    } else {
      countryPanel.search.setAttribute('placeholder', 'Search');
    }
    countryPanel.search.addEventListener('click', function (e) {
      e.stopPropagation();
    });
    countryPanel.search.addEventListener('input', function () {
      if (countryPanel.filterDebounce) {
        clearTimeout(countryPanel.filterDebounce);
      }
      countryPanel.filterDebounce = window.setTimeout(function () {
        countryPanel.filterDebounce = null;
        renderFilteredList();
      }, 80);
    });
    countryPanel.list.addEventListener('click', function (e) {
      const btn = e.target && e.target.closest ? e.target.closest('button[data-iso]') : null;
      if (!btn || !countryPanel.currentIti) {
        return;
      }
      const iso = btn.getAttribute('data-iso');
      if (!iso) {
        return;
      }
      try {
        countryPanel.currentIti.setCountry(iso.toLowerCase());
      } catch (err) {
        debugPhone('setCountry failed: ' + err);
      }
      closeCountryPanel();
      if (countryPanel.currentInput && typeof countryPanel.currentInput.focus === 'function') {
        try {
          countryPanel.currentInput.focus({ preventScroll: true });
        } catch (e2) {
          countryPanel.currentInput.focus();
        }
      }
    });
    return el;
  }

  function positionCountryPanel(anchorInput) {
    const el = countryPanel.root;
    if (!el || !anchorInput) {
      return;
    }
    const inner = el.querySelector('.wdp-phone-country-panel__inner');
    const rect = anchorInput.getBoundingClientRect();
    const frame = readVisualViewportFrame();
    const gap = 6;
    const pad = 8;

    inner.style.maxHeight = '';
    const naturalH = 280;
    const spaceBelow = frame.bottom - rect.bottom - gap;
    const spaceAbove = rect.top - frame.top - gap;
    const preferUp = spaceBelow < Math.min(naturalH + 48, 200) && spaceAbove > spaceBelow;
    const avail = preferUp ? spaceAbove : spaceBelow;
    const maxH = Math.max(140, Math.min(320, Math.floor(avail - 12)));
    inner.style.maxHeight = maxH + 'px';

    const ih = inner.offsetHeight || maxH;
    let top = preferUp ? rect.top - ih - gap : rect.bottom + gap;
    top = Math.max(frame.top + pad, Math.min(top, frame.bottom - pad - ih));

    const width = Math.min(Math.max(rect.width, 280), frame.right - frame.left - 2 * pad);
    let left = rect.left;
    left = Math.max(frame.left + pad, Math.min(left, frame.right - width - pad));

    el.style.position = 'fixed';
    el.style.top = Math.round(top) + 'px';
    el.style.left = Math.round(left) + 'px';
    el.style.width = Math.round(width) + 'px';
    el.classList.toggle('wdp-phone-country-panel--dropup', preferUp);
  }

  function renderFilteredList() {
    if (!countryPanel.list || !countryPanel.sortedCountries) {
      return;
    }
    const q = (countryPanel.search && countryPanel.search.value ? countryPanel.search.value : '').trim().toLowerCase();
    const cur =
      countryPanel.currentIti && typeof countryPanel.currentIti.getSelectedCountryData === 'function'
        ? countryPanel.currentIti.getSelectedCountryData()
        : null;
    const curIso = cur && cur.iso2 ? cur.iso2.toLowerCase() : '';

    countryPanel.list.textContent = '';
    for (let i = 0; i < countryPanel.sortedCountries.length; i++) {
      const c = countryPanel.sortedCountries[i];
      if (!c || !c.iso2) {
        continue;
      }
      const name = (c.name || '').toLowerCase();
      const iso = c.iso2.toLowerCase();
      const dial = String(c.dialCode || '');
      if (
        q &&
        !name.includes(q) &&
        !iso.includes(q) &&
        !('+' + dial).includes(q) &&
        !dial.includes(q)
      ) {
        continue;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wdp-phone-country-panel__item';
      btn.setAttribute('data-iso', iso);
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', iso === curIso ? 'true' : 'false');
      const flagBox = document.createElement('span');
      flagBox.className = 'iti__flag-box';
      const flag = document.createElement('div');
      flag.className = 'iti__flag iti__' + iso;
      flagBox.appendChild(flag);
      const nameSpan = document.createElement('span');
      nameSpan.className = 'wdp-phone-country-panel__name';
      nameSpan.textContent = c.name || iso.toUpperCase();
      const dialSpan = document.createElement('span');
      dialSpan.className = 'wdp-phone-country-panel__dial';
      dialSpan.textContent = '+' + dial;
      btn.appendChild(flagBox);
      btn.appendChild(nameSpan);
      btn.appendChild(dialSpan);
      if (iso === curIso) {
        btn.classList.add('wdp-phone-country-panel__item--current');
      }
      countryPanel.list.appendChild(btn);
    }
  }

  function bindCountryPanelGlobalListeners() {
    if (countryPanel.onDocPointerDown) {
      return;
    }
    countryPanel.onDocPointerDown = function (e) {
      if (!countryPanel.root || countryPanel.root.hidden) {
        return;
      }
      const t = e.target;
      if (countryPanel.root.contains(t)) {
        return;
      }
      if (countryPanel.triggerEl && countryPanel.triggerEl.contains(t)) {
        return;
      }
      closeCountryPanel();
    };
    countryPanel.onDocKeyDown = function (e) {
      if (!countryPanel.root || countryPanel.root.hidden) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        const tr = countryPanel.triggerEl;
        closeCountryPanel();
        if (tr && typeof tr.focus === 'function') {
          try {
            tr.focus({ preventScroll: true });
          } catch (err) {
            tr.focus();
          }
        }
      }
    };
    document.addEventListener('pointerdown', countryPanel.onDocPointerDown, true);
    document.addEventListener('keydown', countryPanel.onDocKeyDown, true);
  }

  function unbindCountryPanelGlobalListeners() {
    if (countryPanel.onDocPointerDown) {
      document.removeEventListener('pointerdown', countryPanel.onDocPointerDown, true);
      countryPanel.onDocPointerDown = null;
    }
    if (countryPanel.onDocKeyDown) {
      document.removeEventListener('keydown', countryPanel.onDocKeyDown, true);
      countryPanel.onDocKeyDown = null;
    }
    if (countryPanel.onVv) {
      const vv = window.visualViewport;
      if (vv) {
        vv.removeEventListener('resize', countryPanel.onVv);
        vv.removeEventListener('scroll', countryPanel.onVv);
      }
      countryPanel.onVv = null;
    }
  }

  function openCountryPanel(input, iti) {
    ensureCountryPanelDom();
    const wrap = input.closest('.iti');
    const trigger = wrap ? wrap.querySelector('.iti__flag-container') : null;
    if (!trigger) {
      debugPhone('openCountryPanel: no flag container');
      return;
    }

    countryPanel.currentInput = input;
    countryPanel.currentIti = iti;
    countryPanel.triggerEl = trigger;

    if (!countryPanel.sortedCountries || !countryPanel.sortedCountries.length) {
      const raw = getIntlCountryDataset();
      const cfg = getPhoneConfig();
      countryPanel.sortedCountries = sortCountriesForConfig(raw, cfg.preferredCountries);
    }

    if (countryPanel.search) {
      countryPanel.search.value = '';
    }
    renderFilteredList();

    countryPanel.root.hidden = false;
    countryPanel.root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('wdp-iti-country-open');
    trigger.setAttribute('aria-expanded', 'true');

    positionCountryPanel(input);
    bindCountryPanelGlobalListeners();

    countryPanel.onVv = function () {
      if (countryPanel.currentInput) {
        positionCountryPanel(countryPanel.currentInput);
      }
    };
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', countryPanel.onVv);
      vv.addEventListener('scroll', countryPanel.onVv);
    }

    window.requestAnimationFrame(function () {
      positionCountryPanel(input);
      if (countryPanel.search && typeof countryPanel.search.focus === 'function') {
        try {
          countryPanel.search.focus({ preventScroll: true });
        } catch (e) {
          countryPanel.search.focus();
        }
      }
    });

    debugPhone('panel open for ' + (input.name || input.id || 'tel'));
  }

  function closeCountryPanel() {
    if (!countryPanel.root || countryPanel.root.hidden) {
      return;
    }
    countryPanel.root.hidden = true;
    countryPanel.root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('wdp-iti-country-open');
    if (countryPanel.triggerEl) {
      countryPanel.triggerEl.setAttribute('aria-expanded', 'false');
    }
    unbindCountryPanelGlobalListeners();
    countryPanel.currentInput = null;
    countryPanel.currentIti = null;
    countryPanel.triggerEl = null;
    debugPhone('panel closed');
  }

  function closeCountryPanelIfInput(input) {
    if (input && countryPanel.currentInput === input) {
      closeCountryPanel();
    }
  }

  function buildItiOptions() {
    const cfg = getPhoneConfig();
    return {
      initialCountry: cfg.defaultCountry || 'tr',
      preferredCountries: cfg.preferredCountries,
      allowDropdown: false,
      countrySearch: false,
      strictMode: false,
      separateDialCode: true,
      nationalMode: true,
      formatOnDisplay: true,
      customContainer: 'wdp-iti',
      showFlags: true,
      useFullscreenPopup: false,
      utilsScript: '',
    };
  }

  function attachWdpCountryTrigger(input, iti) {
    const wrap = input.closest('.iti');
    if (!wrap) {
      return function () {};
    }
    const fc = wrap.querySelector('.iti__flag-container');
    const sf = wrap.querySelector('.iti__selected-flag');
    if (!fc || !sf) {
      return function () {};
    }

    ensureCountryPanelDom();
    fc.classList.add('wdp-phone-flag-trigger');
    fc.setAttribute('role', 'button');
    fc.setAttribute('tabindex', '0');
    fc.setAttribute('aria-haspopup', 'dialog');
    fc.setAttribute('aria-expanded', 'false');
    fc.setAttribute('aria-controls', countryPanel.root && countryPanel.root.id ? countryPanel.root.id : 'wdp-phone-country-panel');

    if (!sf.querySelector('.wdp-phone-selector-chevron')) {
      const ch = document.createElement('span');
      ch.className = 'wdp-phone-selector-chevron';
      ch.setAttribute('aria-hidden', 'true');
      sf.appendChild(ch);
    }

    function openFromUser(e) {
      if (input.disabled || input.readOnly) {
        return;
      }
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') {
        return;
      }
      if (e.type === 'keydown') {
        e.preventDefault();
      }
      e.stopPropagation();
      if (!countryPanel.root || countryPanel.root.hidden || countryPanel.currentInput !== input) {
        openCountryPanel(input, iti);
      } else {
        closeCountryPanel();
      }
    }

    fc.addEventListener('click', openFromUser);
    fc.addEventListener('keydown', openFromUser);

    return function cleanup() {
      fc.removeEventListener('click', openFromUser);
      fc.removeEventListener('keydown', openFromUser);
      fc.classList.remove('wdp-phone-flag-trigger');
      fc.removeAttribute('role');
      fc.removeAttribute('tabindex');
      fc.removeAttribute('aria-haspopup');
      fc.removeAttribute('aria-expanded');
      const chev = sf.querySelector('.wdp-phone-selector-chevron');
      if (chev) {
        chev.remove();
      }
      closeCountryPanelIfInput(input);
    };
  }

  function destroyField(input) {
    if (!input) {
      return;
    }
    closeCountryPanelIfInput(input);
    if (typeof input._wdpCountryPickerCleanup === 'function') {
      try {
        input._wdpCountryPickerCleanup();
      } catch (e) {
        /* ignore */
      }
      input._wdpCountryPickerCleanup = null;
    }
    if (input._wdpPaddingSyncCountryChange) {
      try {
        input.removeEventListener('countrychange', input._wdpPaddingSyncCountryChange);
      } catch (eRm) {
        /* ignore */
      }
      input._wdpPaddingSyncCountryChange = null;
    }
    if (input._wdpPhoneBeforeInputGuard) {
      try {
        input.removeEventListener('beforeinput', input._wdpPhoneBeforeInputGuard);
      } catch (eBg) {
        /* ignore */
      }
      input._wdpPhoneBeforeInputGuard = null;
    }
    if (input._wdpPhoneInputSanitizer) {
      try {
        input.removeEventListener('input', input._wdpPhoneInputSanitizer);
      } catch (eIg) {
        /* ignore */
      }
      input._wdpPhoneInputSanitizer = null;
    }
    if (input._wdpPhonePasteSanitizer) {
      try {
        input.removeEventListener('paste', input._wdpPhonePasteSanitizer);
      } catch (ePg) {
        /* ignore */
      }
      input._wdpPhonePasteSanitizer = null;
    }
    const iti = input._wdpIti;
    if (iti && typeof iti.destroy === 'function') {
      try {
        iti.destroy();
      } catch (e2) {
        /* ignore */
      }
    }
    if (input._wdpFlagResizeObserver && typeof input._wdpFlagResizeObserver.disconnect === 'function') {
      try {
        input._wdpFlagResizeObserver.disconnect();
      } catch (e3) {
        /* ignore */
      }
    }
    input._wdpFlagResizeObserver = null;
    input._wdpPaddingSyncCountryChange = null;
    input.style.paddingLeft = '';
    input._wdpIti = null;
    delete input.dataset.wdpIntlInit;
  }

  function isInitialized(input) {
    return input && input.dataset && input.dataset.wdpIntlInit === '1' && input._wdpIti;
  }

  function initField(input) {
    if (!input || !window.intlTelInput || input.readOnly || input.disabled) {
      return null;
    }
    if (isInitialized(input)) {
      return input._wdpIti;
    }

    const iti = window.intlTelInput(input, buildItiOptions());
    input._wdpIti = iti;
    input.dataset.wdpIntlInit = '1';

    input._wdpCountryPickerCleanup = attachWdpCountryTrigger(input, iti);

    const wrap = input.closest('.iti');
    const fc = wrap ? wrap.querySelector('.iti__flag-container') : null;
    if (fc && typeof window.ResizeObserver === 'function') {
      if (input._wdpFlagResizeObserver && typeof input._wdpFlagResizeObserver.disconnect === 'function') {
        try {
          input._wdpFlagResizeObserver.disconnect();
        } catch (eRo) {
          /* ignore */
        }
      }
      input._wdpFlagResizeObserver = new window.ResizeObserver(function () {
        scheduleTelInputPaddingSync(input);
      });
      try {
        input._wdpFlagResizeObserver.observe(fc);
      } catch (eObs) {
        input._wdpFlagResizeObserver = null;
      }
    }

    const onCountryChange = function () {
      scheduleTelInputPaddingSync(input);
    };
    input._wdpPaddingSyncCountryChange = onCountryChange;
    input.addEventListener('countrychange', onCountryChange);
    scheduleTelInputPaddingSync(input);
    attachDigitsOnlyGuards(input);

    return iti;
  }

  function setupInRoot(root) {
    if (!root || !window.intlTelInput) {
      return;
    }
    getPhoneInputs(root).forEach(function (input) {
      if (input.readOnly || input.disabled) {
        return;
      }
      if (isInitialized(input)) {
        return;
      }
      destroyField(input);
      initField(input);
    });
  }

  function refreshInRoot(root) {
    if (!root || !window.intlTelInput) {
      return;
    }
    getPhoneInputs(root).forEach(function (input) {
      if (input.readOnly || input.disabled) {
        return;
      }
      destroyField(input);
      initField(input);
    });
  }

  function getE164(input) {
    if (!input) {
      return '';
    }
    const iti = input._wdpIti;
    const utils = window.intlTelInputUtils;
    if (!iti || !utils || !input.value.trim()) {
      return '';
    }
    try {
      if (iti.isValidNumber()) {
        return iti.getNumber(utils.numberFormat.E164) || '';
      }
    } catch (e) {
      /* ignore */
    }
    return '';
  }

  function syncE164FieldsInForm(form) {
    if (!form || !hasUtils()) {
      return;
    }
    getPhoneInputs(form).forEach(function (input) {
      const e164 = getE164(input);
      if (e164) {
        input.value = e164;
      }
    });
  }

  function getValueForCopy(input) {
    if (!input) {
      return '';
    }
    const e164 = getE164(input);
    if (e164) {
      return e164;
    }
    return (input.value || '').trim();
  }

  function applyPastedNumber(input, value) {
    if (!input || value == null) {
      return;
    }
    const v = String(value).trim();
    if (!v) {
      return;
    }
    const iti = input._wdpIti;
    if (iti && typeof iti.setNumber === 'function') {
      try {
        iti.setNumber(v);
        return;
      } catch (e) {
        /* fall through */
      }
    }
    input.value = v;
  }

  /**
   * Result shape for form validation:
   * - Simplified rule: only presence is validated at form level.
   * - Country-aware strict validity is intentionally not enforced for submit blocking.
   */
  function validatePhoneField(input) {
    if (!input || !String(input.value || '').trim()) {
      return { ok: true, empty: true, reason: 'empty' };
    }
    return { ok: true, empty: false, reason: 'present' };
  }

  WDPApp.phoneInput = {
    setupInRoot: setupInRoot,
    refreshInRoot: refreshInRoot,
    destroyField: destroyField,
    syncE164FieldsInForm: syncE164FieldsInForm,
    getValueForCopy: getValueForCopy,
    applyPastedNumber: applyPastedNumber,
    validatePhoneField: validatePhoneField,
    getPhoneInputs: getPhoneInputs,
    hasUtils: hasUtils,
    /** Manual QA: open state + anchor rect in console */
    debugCountryPanelState: function () {
      return {
        open: !!(countryPanel.root && !countryPanel.root.hidden),
        anchor: countryPanel.currentInput ? countryPanel.currentInput.getBoundingClientRect() : null,
      };
    },
  };
})(window);
