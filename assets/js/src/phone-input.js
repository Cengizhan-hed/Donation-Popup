/**
 * Custom country-code phone fields (no intl-tel-input).
 *
 * @package WooCommerce\Donation_Popup
 */

(function (window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const wdp_ajax = window.wdp_ajax || {};

  const PANEL_ID = 'wdp-phone-country-panel';

  function getCountries() {
    const list = wdp_ajax.phone && Array.isArray(wdp_ajax.phone.countries) ? wdp_ajax.phone.countries : [];
    return list.filter(function (c) {
      return c && typeof c.iso === 'string' && c.iso.length === 2 && c.dial;
    });
  }

  function getPhoneConfig() {
    const phone = wdp_ajax.phone || {};
    const raw = phone.default_country || 'tr';
    const defaultCountry = typeof raw === 'string' && raw.length === 2 ? raw.toLowerCase() : 'tr';
    return { defaultCountry: defaultCountry };
  }

  function findCountry(iso) {
    const key = (iso || '').toLowerCase();
    const countries = getCountries();
    for (let i = 0; i < countries.length; i++) {
      if (countries[i].iso === key) {
        return countries[i];
      }
    }
    return countries[0] || { iso: 'tr', name: 'Türkiye', dial: '90' };
  }

  function stripDigits(value) {
    return String(value == null ? '' : value).replace(/\D+/g, '');
  }

  function normalizePhoneNumber(iso, dialCode, rawInput) {
    let digits = stripDigits(rawInput);
    const dial = stripDigits(dialCode);
    if (!digits) {
      return '';
    }

    if (digits.startsWith(dial) && digits.length >= dial.length + 6) {
      return digits;
    }

    if (iso === 'tr') {
      if (digits.startsWith('0')) {
        digits = digits.slice(1);
      }
      if (digits.startsWith('90') && digits.length >= 12) {
        return digits;
      }
      if (digits.startsWith(dial)) {
        return digits;
      }
      return dial + digits;
    }

    if (digits.startsWith('0')) {
      digits = digits.replace(/^0+/, '');
    }
    if (digits.startsWith(dial)) {
      return digits;
    }
    return dial + digits;
  }

  function getPhoneNumberInputs(root) {
    if (!root || !root.querySelectorAll) {
      return [];
    }
    return Array.prototype.slice.call(
      root.querySelectorAll(
        '.wdp-phone-field__number, input[type="tel"][name="donation_phone"], input[type="tel"][name^="shareholder_phone_"]'
      )
    );
  }

  function getPhoneFieldRoot(input) {
    if (!input) {
      return null;
    }
    return input.closest('[data-wdp-phone-field]');
  }

  function getSelectedCountry(fieldRoot) {
    if (!fieldRoot) {
      return findCountry(getPhoneConfig().defaultCountry);
    }
    const iso = (fieldRoot.dataset.selectedCountry || fieldRoot.dataset.defaultCountry || getPhoneConfig().defaultCountry).toLowerCase();
    return findCountry(iso);
  }

  function setSelectedCountry(fieldRoot, country) {
    if (!fieldRoot || !country) {
      return;
    }
    fieldRoot.dataset.selectedCountry = country.iso;
    fieldRoot.dataset.dialCode = country.dial;
    const label = fieldRoot.querySelector('.wdp-phone-field__code-label');
    if (label) {
      label.textContent = '+' + country.dial;
    }
  }

  function sanitizeNationalInput(input) {
    if (!input) {
      return;
    }
    const oldValue = String(input.value || '');
    const start = typeof input.selectionStart === 'number' ? input.selectionStart : oldValue.length;
    const digitsBefore = stripDigits(oldValue.slice(0, start)).length;
    const nextValue = stripDigits(oldValue);
    if (nextValue === oldValue) {
      return;
    }
    input.value = nextValue;
    try {
      input.setSelectionRange(digitsBefore, digitsBefore);
    } catch (e) {
      /* ignore */
    }
  }

  function attachDigitsOnlyGuards(input) {
    if (!input || input._wdpPhoneDigitsBound) {
      return;
    }
    input._wdpPhoneDigitsBound = true;
    if (typeof input.inputMode === 'string') {
      input.inputMode = 'numeric';
    } else {
      input.setAttribute('inputmode', 'numeric');
    }
    input.setAttribute('pattern', '[0-9]*');
    input.setAttribute('autocomplete', 'tel-national');

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
      sanitizeNationalInput(input);
    };
    input._wdpPhonePasteSanitizer = function () {
      window.requestAnimationFrame(function () {
        sanitizeNationalInput(input);
      });
    };

    input.addEventListener('beforeinput', input._wdpPhoneBeforeInputGuard);
    input.addEventListener('input', input._wdpPhoneInputSanitizer);
    input.addEventListener('paste', input._wdpPhonePasteSanitizer);
    sanitizeNationalInput(input);
  }

  const countryPanel = {
    root: null,
    list: null,
    search: null,
    currentField: null,
    triggerEl: null,
    onDocClick: null,
    onDocKeyDown: null,
    onVv: null,
    filterDebounce: null,
    repositionTimer: null,
    outsideClickArmed: false,
    openToken: 0,
  };

  function canFocusCountrySearch() {
    try {
      return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    } catch (e) {
      return true;
    }
  }

  function schedulePanelReposition() {
    if (!countryPanel.triggerEl) {
      return;
    }
    if (countryPanel.repositionTimer) {
      clearTimeout(countryPanel.repositionTimer);
    }
    countryPanel.repositionTimer = window.setTimeout(function () {
      countryPanel.repositionTimer = null;
      if (countryPanel.root && !countryPanel.root.hidden && countryPanel.triggerEl) {
        positionCountryPanel(countryPanel.triggerEl);
      }
    }, 48);
  }

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
    el.id = PANEL_ID;

    const inner = document.createElement('div');
    inner.className = 'wdp-phone-country-panel__inner';

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'wdp-phone-country-panel__search';
    search.setAttribute('autocomplete', 'off');
    search.setAttribute('autocorrect', 'off');
    search.setAttribute('spellcheck', 'false');

    const list = document.createElement('ul');
    list.className = 'wdp-phone-country-panel__list';
    list.setAttribute('role', 'listbox');

    inner.appendChild(search);
    inner.appendChild(list);
    el.appendChild(inner);
    document.body.appendChild(el);

    countryPanel.root = el;
    countryPanel.list = list;
    countryPanel.search = search;

    const ph = wdp_ajax.strings && wdp_ajax.strings.phone_search_placeholder;
    search.setAttribute('placeholder', ph || 'Ara');

    search.addEventListener('click', function (e) {
      e.stopPropagation();
    });
    search.addEventListener('input', function () {
      if (countryPanel.filterDebounce) {
        clearTimeout(countryPanel.filterDebounce);
      }
      countryPanel.filterDebounce = window.setTimeout(function () {
        countryPanel.filterDebounce = null;
        renderFilteredList();
      }, 80);
    });

    list.addEventListener('click', function (e) {
      const btn = e.target && e.target.closest ? e.target.closest('button[data-iso]') : null;
      if (!btn || !countryPanel.currentField) {
        return;
      }
      const iso = btn.getAttribute('data-iso');
      if (!iso) {
        return;
      }
      setSelectedCountry(countryPanel.currentField, findCountry(iso));
      closeCountryPanel();
      const num = countryPanel.currentField.querySelector('.wdp-phone-field__number');
      if (num && typeof num.focus === 'function') {
        try {
          num.focus({ preventScroll: true });
        } catch (e2) {
          num.focus();
        }
      }
    });

    return el;
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

  function positionCountryPanel(anchorEl) {
    const el = countryPanel.root;
    if (!el || !anchorEl) {
      return;
    }
    const inner = el.querySelector('.wdp-phone-country-panel__inner');
    const rect = anchorEl.getBoundingClientRect();
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

    el.style.top = Math.round(top) + 'px';
    el.style.left = Math.round(left) + 'px';
    el.style.width = Math.round(width) + 'px';
    el.classList.toggle('wdp-phone-country-panel--dropup', preferUp);
  }

  function renderFilteredList() {
    if (!countryPanel.list) {
      return;
    }
    const q = (countryPanel.search && countryPanel.search.value ? countryPanel.search.value : '').trim().toLowerCase();
    const cur = countryPanel.currentField ? getSelectedCountry(countryPanel.currentField) : null;
    const curIso = cur ? cur.iso : '';

    countryPanel.list.textContent = '';
    getCountries().forEach(function (c) {
      const name = (c.name || '').toLowerCase();
      const iso = c.iso.toLowerCase();
      const dial = String(c.dial || '');
      if (q && !name.includes(q) && !iso.includes(q) && !('+' + dial).includes(q) && !dial.includes(q)) {
        return;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wdp-phone-country-panel__item';
      btn.setAttribute('data-iso', iso);
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', iso === curIso ? 'true' : 'false');

      const nameSpan = document.createElement('span');
      nameSpan.className = 'wdp-phone-country-panel__name';
      nameSpan.textContent = c.name || iso.toUpperCase();

      const dialSpan = document.createElement('span');
      dialSpan.className = 'wdp-phone-country-panel__dial';
      dialSpan.textContent = '+' + dial;

      btn.appendChild(nameSpan);
      btn.appendChild(dialSpan);
      if (iso === curIso) {
        btn.classList.add('wdp-phone-country-panel__item--current');
      }
      countryPanel.list.appendChild(btn);
    });
  }

  function bindCountryPanelGlobalListeners() {
    if (countryPanel.onDocClick) {
      return;
    }
    countryPanel.onDocClick = function (e) {
      if (!countryPanel.root || countryPanel.root.hidden || !countryPanel.outsideClickArmed) {
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
    document.addEventListener('click', countryPanel.onDocClick, false);
    document.addEventListener('keydown', countryPanel.onDocKeyDown, true);
  }

  function unbindCountryPanelGlobalListeners() {
    if (countryPanel.onDocClick) {
      document.removeEventListener('click', countryPanel.onDocClick, false);
      countryPanel.onDocClick = null;
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
    if (countryPanel.repositionTimer) {
      clearTimeout(countryPanel.repositionTimer);
      countryPanel.repositionTimer = null;
    }
    countryPanel.outsideClickArmed = false;
  }

  function openCountryPanel(fieldRoot, triggerBtn) {
    ensureCountryPanelDom();
    if (!fieldRoot || !triggerBtn) {
      return;
    }

    countryPanel.currentField = fieldRoot;
    countryPanel.triggerEl = triggerBtn;

    if (countryPanel.search) {
      countryPanel.search.value = '';
    }
    renderFilteredList();

    const openToken = ++countryPanel.openToken;
    countryPanel.outsideClickArmed = false;

    countryPanel.root.hidden = false;
    countryPanel.root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('wdp-phone-panel-open');
    triggerBtn.setAttribute('aria-expanded', 'true');

    positionCountryPanel(triggerBtn);
    bindCountryPanelGlobalListeners();

    countryPanel.onVv = function () {
      schedulePanelReposition();
    };
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', countryPanel.onVv);
      vv.addEventListener('scroll', countryPanel.onVv);
    }

    window.requestAnimationFrame(function () {
      if (openToken !== countryPanel.openToken || countryPanel.root.hidden) {
        return;
      }
      positionCountryPanel(triggerBtn);
      window.setTimeout(function () {
        if (openToken === countryPanel.openToken && countryPanel.root && !countryPanel.root.hidden) {
          countryPanel.outsideClickArmed = true;
        }
      }, 0);
      if (canFocusCountrySearch() && countryPanel.search && typeof countryPanel.search.focus === 'function') {
        try {
          countryPanel.search.focus({ preventScroll: true });
        } catch (e) {
          countryPanel.search.focus();
        }
      }
    });
  }

  function closeCountryPanel() {
    if (!countryPanel.root || countryPanel.root.hidden) {
      return;
    }
    countryPanel.openToken += 1;
    countryPanel.outsideClickArmed = false;
    countryPanel.root.hidden = true;
    countryPanel.root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('wdp-phone-panel-open');
    if (countryPanel.triggerEl) {
      countryPanel.triggerEl.setAttribute('aria-expanded', 'false');
    }
    unbindCountryPanelGlobalListeners();
    countryPanel.currentField = null;
    countryPanel.triggerEl = null;
  }

  function closeCountryPanelIfField(fieldRoot) {
    if (fieldRoot && countryPanel.currentField === fieldRoot) {
      closeCountryPanel();
    }
  }

  function getNormalizedValue(input) {
    if (!input) {
      return '';
    }
    const fieldRoot = getPhoneFieldRoot(input);
    const country = getSelectedCountry(fieldRoot);
    const national = stripDigits(input.value);
    if (!national) {
      return '';
    }
    return normalizePhoneNumber(country.iso, country.dial, national);
  }

  function createFieldElement(options) {
    const opts = Object.assign(
      {
        name: 'donation_phone',
        placeholder: 'Telefon Numarası *',
        required: true,
        autocomplete: 'tel',
        inputmode: 'tel',
        className: 'wdp-field-stack__input',
        defaultCountry: getPhoneConfig().defaultCountry,
      },
      options || {}
    );

    const country = findCountry(opts.defaultCountry);
    const wrap = document.createElement('div');
    wrap.className = 'wdp-phone-field';
    wrap.setAttribute('data-wdp-phone-field', '');
    wrap.setAttribute('data-default-country', country.iso);
    wrap.setAttribute('data-selected-country', country.iso);
    wrap.setAttribute('data-dial-code', country.dial);

    const inner = document.createElement('div');
    inner.className = 'wdp-phone-field__inner';

    const codeWrap = document.createElement('div');
    codeWrap.className = 'wdp-phone-field__code-wrap';

    const codeBtn = document.createElement('button');
    codeBtn.type = 'button';
    codeBtn.className = 'wdp-phone-field__code-btn';
    codeBtn.setAttribute('aria-haspopup', 'listbox');
    codeBtn.setAttribute('aria-expanded', 'false');
    codeBtn.setAttribute('aria-label', 'Ülke kodu seç');

    const codeLabel = document.createElement('span');
    codeLabel.className = 'wdp-phone-field__code-label';
    codeLabel.textContent = '+' + country.dial;

    const chevron = document.createElement('span');
    chevron.className = 'wdp-phone-field__chevron';
    chevron.setAttribute('aria-hidden', 'true');

    codeBtn.appendChild(codeLabel);
    codeBtn.appendChild(chevron);
    codeWrap.appendChild(codeBtn);

    const divider = document.createElement('span');
    divider.className = 'wdp-phone-field__divider';
    divider.setAttribute('aria-hidden', 'true');

    const numberInput = document.createElement('input');
    numberInput.type = 'tel';
    numberInput.className = opts.className + ' wdp-phone-field__number';
    numberInput.name = opts.name;
    numberInput.placeholder = opts.placeholder;
    numberInput.autocomplete = opts.autocomplete;
    numberInput.setAttribute('inputmode', opts.inputmode);
    if (opts.required) {
      numberInput.required = true;
    }

    inner.appendChild(codeWrap);
    inner.appendChild(divider);
    inner.appendChild(numberInput);
    wrap.appendChild(inner);

    return wrap;
  }

  function wrapBareTelInput(input) {
    if (!input || getPhoneFieldRoot(input)) {
      return null;
    }
    const parent = input.parentNode;
    if (!parent) {
      return null;
    }
    const field = createFieldElement({
      name: input.name || 'donation_phone',
      placeholder: input.getAttribute('placeholder') || '',
      required: input.required,
      autocomplete: input.getAttribute('autocomplete') || 'tel',
      className: (input.className || 'wdp-field-stack__input').replace(/\bwdp-phone-field__number\b/g, '').trim(),
    });
    const newInput = field.querySelector('.wdp-phone-field__number');
    if (newInput && input.value) {
      newInput.value = stripDigits(input.value);
    }
    if (input.id) {
      newInput.id = input.id;
    }
    parent.replaceChild(field, input);
    return field;
  }

  function destroyField(input) {
    if (!input) {
      return;
    }
    const fieldRoot = getPhoneFieldRoot(input);
    closeCountryPanelIfField(fieldRoot);

    if (typeof input._wdpCountryPickerCleanup === 'function') {
      try {
        input._wdpCountryPickerCleanup();
      } catch (e) {
        /* ignore */
      }
      input._wdpCountryPickerCleanup = null;
    }

    if (input._wdpPhoneBeforeInputGuard) {
      input.removeEventListener('beforeinput', input._wdpPhoneBeforeInputGuard);
      input._wdpPhoneBeforeInputGuard = null;
    }
    if (input._wdpPhoneInputSanitizer) {
      input.removeEventListener('input', input._wdpPhoneInputSanitizer);
      input._wdpPhoneInputSanitizer = null;
    }
    if (input._wdpPhonePasteSanitizer) {
      input.removeEventListener('paste', input._wdpPhonePasteSanitizer);
      input._wdpPhonePasteSanitizer = null;
    }
    input._wdpPhoneDigitsBound = false;
    delete input.dataset.wdpPhoneInit;
  }

  function isInitialized(fieldRoot) {
    return fieldRoot && fieldRoot.dataset && fieldRoot.dataset.wdpPhoneInit === '1';
  }

  function initFieldRoot(fieldRoot) {
    if (!fieldRoot || isInitialized(fieldRoot)) {
      return;
    }

    const input = fieldRoot.querySelector('.wdp-phone-field__number');
    const codeBtn = fieldRoot.querySelector('.wdp-phone-field__code-btn');
    if (!input || !codeBtn || input.readOnly || input.disabled) {
      return;
    }

    const defaultIso = (fieldRoot.dataset.defaultCountry || getPhoneConfig().defaultCountry).toLowerCase();
    setSelectedCountry(fieldRoot, findCountry(defaultIso));
    fieldRoot.dataset.wdpPhoneInit = '1';

    function toggleFromUser(e) {
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
      const isOpen =
        countryPanel.root &&
        !countryPanel.root.hidden &&
        countryPanel.currentField === fieldRoot;
      if (isOpen) {
        closeCountryPanel();
      } else {
        openCountryPanel(fieldRoot, codeBtn);
      }
    }

    codeBtn.addEventListener('click', toggleFromUser);
    codeBtn.addEventListener('keydown', toggleFromUser);

    input._wdpCountryPickerCleanup = function () {
      codeBtn.removeEventListener('click', toggleFromUser);
      codeBtn.removeEventListener('keydown', toggleFromUser);
      closeCountryPanelIfField(fieldRoot);
    };

    attachDigitsOnlyGuards(input);
    input.dataset.wdpPhoneInit = '1';
  }

  function setupInRoot(root) {
    if (!root) {
      return;
    }
    root.querySelectorAll('[data-wdp-phone-field]').forEach(function (fieldRoot) {
      initFieldRoot(fieldRoot);
    });
    getPhoneNumberInputs(root).forEach(function (input) {
      if (input.readOnly || input.disabled) {
        return;
      }
      if (getPhoneFieldRoot(input)) {
        return;
      }
      const field = wrapBareTelInput(input);
      if (field) {
        initFieldRoot(field);
      }
    });
  }

  function refreshInRoot(root) {
    if (!root) {
      return;
    }
    getPhoneNumberInputs(root).forEach(function (input) {
      destroyField(input);
    });
    root.querySelectorAll('[data-wdp-phone-field]').forEach(function (fieldRoot) {
      delete fieldRoot.dataset.wdpPhoneInit;
    });
    setupInRoot(root);
  }

  function syncNormalizedFieldsInForm(form) {
    if (!form) {
      return;
    }
    getPhoneNumberInputs(form).forEach(function (input) {
      const normalized = getNormalizedValue(input);
      if (normalized) {
        input.value = normalized;
      }
    });
  }

  function getValueForCopy(input) {
    if (!input) {
      return '';
    }
    const normalized = getNormalizedValue(input);
    if (normalized) {
      return normalized;
    }
    return stripDigits(input.value || '');
  }

  function detectCountryFromDigits(digits) {
    const countries = getCountries().slice().sort(function (a, b) {
      return String(b.dial).length - String(a.dial).length;
    });
    for (let i = 0; i < countries.length; i++) {
      const dial = String(countries[i].dial);
      if (digits.startsWith(dial) && digits.length > dial.length + 5) {
        return {
          country: countries[i],
          national: digits.slice(dial.length),
        };
      }
    }
    return null;
  }

  function applyPastedNumber(input, value) {
    if (!input || value == null) {
      return;
    }
    const fieldRoot = getPhoneFieldRoot(input) || wrapBareTelInput(input);
    if (!fieldRoot) {
      input.value = stripDigits(value);
      return;
    }
    initFieldRoot(fieldRoot);
    const numInput = fieldRoot.querySelector('.wdp-phone-field__number') || input;
    let digits = stripDigits(String(value).trim());
    if (!digits) {
      return;
    }
    const detected = detectCountryFromDigits(digits);
    if (detected) {
      setSelectedCountry(fieldRoot, detected.country);
      numInput.value = detected.national;
      return;
    }
    numInput.value = digits;
  }

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
    createFieldElement: createFieldElement,
    syncE164FieldsInForm: syncNormalizedFieldsInForm,
    syncNormalizedFieldsInForm: syncNormalizedFieldsInForm,
    getValueForCopy: getValueForCopy,
    applyPastedNumber: applyPastedNumber,
    validatePhoneField: validatePhoneField,
    getPhoneInputs: getPhoneNumberInputs,
    getNormalizedValue: getNormalizedValue,
    normalizePhoneNumber: normalizePhoneNumber,
    hasUtils: function () {
      return true;
    },
    debugCountryPanelState: function () {
      return {
        open: !!(countryPanel.root && !countryPanel.root.hidden),
        anchor: countryPanel.triggerEl ? countryPanel.triggerEl.getBoundingClientRect() : null,
      };
    },
  };
})(window);
