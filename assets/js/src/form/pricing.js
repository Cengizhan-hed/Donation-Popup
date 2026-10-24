/**
 * @file pricing.js
 * Özel fiyat, miktar çarpanı ve preset tutar hesaplamaları.
 * Dış API: WDPApp.formPricing
 */
(function(window) {
  'use strict';

  const WDPApp = window.WDPApp || (window.WDPApp = {});
  const state = WDPApp.state || {};
  const utils = WDPApp.utils || {};
  const formatCurrency = typeof utils.formatCurrency === 'function' ? utils.formatCurrency : function(v) { return String(v); };
  const productPrices = state.productPrices || {};

  const WDP_PRODUCT_ID_INPUT_SELECTOR = 'input[name="wdp_product_id"], input[name="add-to-cart"]';

  function getWdpFormRoot(form) {
    if (!form) {
      return null;
    }
    return form.closest('.wdp-modal') || form.closest('.wdp-donation-form');
  }

  /** Form için birim fiyat (ürün önbelleği veya data attribute). */
  function getWdpUnitPriceForForm(form) {
    const root = getWdpFormRoot(form);
    const idInput = form.querySelector(WDP_PRODUCT_ID_INPUT_SELECTOR);
    const pid = idInput ? Number.parseInt(idInput.value, 10) : 0;
    if (pid && Number.isFinite(Number(productPrices[pid]))) {
      return Number(productPrices[pid]);
    }
    if (root && root.dataset && root.dataset.wdpUnitPrice !== undefined && root.dataset.wdpUnitPrice !== '') {
      const v = Number.parseFloat(root.dataset.wdpUnitPrice);
      if (Number.isFinite(v)) {
        return v;
      }
    }
    return 0;
  }

  /** Sabit fiyat + miktar satırında toplam tutarı günceller. */
  function updateFixedPriceLineDisplay(form) {
    const row = form.querySelector('.wdp-fixed-price-counter-row');
    if (!row) {
      return;
    }
    const qtyEl = row.querySelector('input[name="quantity"]');
    const out = row.querySelector('.wdp-line-total-value');
    if (!out || !qtyEl) {
      return;
    }
    const qty = Number.parseInt(qtyEl.value, 10) || 1;
    const unit = getWdpUnitPriceForForm(form);
    if (unit > 0) {
      out.textContent = formatCurrency(unit * qty);
    }
  }

  function parseNormalizedAmount(raw) {
    const utils = WDPApp.utils || {};
    if (typeof utils.parseMoney === 'function') {
      return utils.parseMoney(raw);
    }
    return NaN;
  }

  function priceDecimals() {
    const d = window.wdp_ajax && window.wdp_ajax.currency && window.wdp_ajax.currency.decimals;
    return Number.isFinite(Number(d)) ? Math.max(0, Number(d)) : 2;
  }

  function roundMoney(n) {
    const f = Math.pow(10, priceDecimals());
    return Math.round(n * f) / f;
  }

  function formatPriceInputValue(n) {
    if (!Number.isFinite(n) || n <= 0) {
      return '';
    }
    const r = roundMoney(n);
    if (Math.abs(r - Math.round(r)) < 0.0001) {
      return String(Math.round(r));
    }
    return String(r);
  }

  function formatSubmitUnitPrice(unit) {
    const u = WDPApp.utils || {};
    if (typeof u.formatAmountForSubmit === 'function') {
      return u.formatAmountForSubmit(unit);
    }
    if (!Number.isFinite(unit) || unit <= 0) {
      return '';
    }
    const r = roundMoney(unit);
    return Number.isInteger(r) ? r.toFixed(0) : r.toFixed(2);
  }

  function getCustomPriceRow(form) {
    if (!form) {
      return null;
    }
    // Alt bağış satırını ana tutar satırı sanma (sabit ürünlerde tek .wdp-custom-price-row sadaka olabilir).
    return (
      form.querySelector('.wdp-custom-price-row:not(.wdp-sadaka-donation__amount)') ||
      form.querySelector('.wdp-custom-price-with-qty-row:not(.wdp-sadaka-donation__amount)')
    );
  }

  function customPriceRowHasQtyCounter(row) {
    return !!(row && row.querySelector('.wdp-quantity-counter input[name="quantity"]'));
  }

  function ensureCustomUnitFromDisplayed(customIn, qty) {
    if (!customIn) {
      return NaN;
    }
    const q = Number.parseInt(String(qty), 10) || 1;
    const total = parseNormalizedAmount(customIn.value);
    if (Number.isFinite(total) && total > 0 && q > 0) {
      const u = roundMoney(total / q);
      customIn.dataset.wdpCustomUnit = String(u);
      return u;
    }
    delete customIn.dataset.wdpCustomUnit;
    return NaN;
  }

  function syncCustomPriceQtyRowDisplay(form) {
    const row = getCustomPriceRow(form);
    if (!row || !customPriceRowHasQtyCounter(row)) {
      return;
    }
    const customIn = row.querySelector('input[name="custom_price"]');
    const qtyEl = row.querySelector('input[name="quantity"]');
    if (!customIn || !qtyEl) {
      return;
    }
    const qty = Number.parseInt(qtyEl.value, 10) || 1;
    const unit = Number.parseFloat(customIn.dataset.wdpCustomUnit);
    if (Number.isFinite(unit) && unit > 0) {
      customIn.value = formatPriceInputValue(unit * qty);
    }
  }

  /** Tüm fiyat satırı gösterimlerini senkronize eder. */
  function updateLineTotals(form) {
    updateFixedPriceLineDisplay(form);
    syncCustomPriceQtyRowDisplay(form);
    updateCoverFeeTotal(form);
  }

  /**
   * K1: tutar seçimini / kutuyu temizler (sessionStorage yok; yalnız DOM).
   * Bağışçı adı/telefon vb. alanlara dokunmaz.
   */
  function clearAmountSelection(form) {
    if (!form) {
      return;
    }
    form.querySelectorAll('input[name="custom_price"]').forEach(function(input) {
      if (input.closest('[data-wdp-sadaka-donation], .wdp-sadaka-donation')) {
        return;
      }
      input.value = '';
      delete input.dataset.wdpCustomUnit;
      delete input.dataset.wdpDefaultPrice;
      input.classList.remove('wdp-error', 'wdp-input-error');
    });
    form.querySelectorAll('.wdp-amount-preset').forEach(function(btn) {
      btn.classList.remove('selected');
      btn.setAttribute('aria-pressed', 'false');
    });
    const coverFee = form.querySelector('input[name="donation_cover_fee"]');
    if (coverFee) {
      coverFee.checked = false;
    }
    updateCoverFeeTotal(form);
    updateFixedPriceLineDisplay(form);
  }

  /** Formdaki baz tutar (ücret öncesi): custom_price, sabit birim×adet veya hisse toplamı. */
  function getFormBaseAmount(form) {
    if (!form) {
      return NaN;
    }
    const shareTotal = form.querySelector('.wdp-shares-total-bar__value');
    const shareCount = form.querySelector('input[name="share_count"]');
    if (shareCount && shareTotal && !shareTotal.closest('[hidden]')) {
      const fromBar = parseNormalizedAmount(shareTotal.textContent);
      if (Number.isFinite(fromBar) && fromBar > 0) {
        return fromBar;
      }
    }
    const customRow = getCustomPriceRow(form);
    const customIn = customRow ? customRow.querySelector('input[name="custom_price"]') : form.querySelector('input[name="custom_price"]:not([name="sadaka_custom_price"])');
    if (customIn) {
      const n = parseNormalizedAmount(customIn.value);
      if (Number.isFinite(n) && n > 0) {
        return n;
      }
    }
    const fixedRow = form.querySelector('.wdp-fixed-price-counter-row');
    if (fixedRow) {
      const qtyEl = fixedRow.querySelector('input[name="quantity"]');
      const qty = qtyEl ? Number.parseInt(qtyEl.value, 10) || 1 : 1;
      const unit = getWdpUnitPriceForForm(form);
      if (unit > 0) {
        return roundMoney(unit * qty);
      }
    }
    return NaN;
  }

  /** İşlem ücreti kutusu → Toplam satırı (+ sabit/hisse satır tutarı). */
  function updateCoverFeeTotal(form) {
    if (!form) {
      return;
    }
    const totalRoot = form.querySelector('[data-wdp-form-total]');
    const coverFee = form.querySelector('input[name="donation_cover_fee"]');
    const pctAttr = coverFee ? Number.parseFloat(coverFee.getAttribute('data-wdp-cover-fee-percent') || '0') : 0;
    const pct = Number.isFinite(pctAttr) && pctAttr > 0 ? pctAttr : 0;
    const base = getFormBaseAmount(form);
    const feeOn = !!(coverFee && coverFee.checked && pct > 0 && Number.isFinite(base) && base > 0);
    const withFee = feeOn ? roundMoney(base * (1 + pct / 100)) : base;

    if (totalRoot) {
      const valueEl = totalRoot.querySelector('.wdp-form-total__value');
      if (feeOn && valueEl) {
        totalRoot.hidden = false;
        valueEl.textContent = formatCurrency(withFee);
      } else {
        totalRoot.hidden = true;
        if (valueEl) {
          valueEl.textContent = '—';
        }
      }
    }

    const fixedOut = form.querySelector('.wdp-fixed-price-counter-row .wdp-line-total-value');
    if (fixedOut && Number.isFinite(base) && base > 0) {
      fixedOut.textContent = formatCurrency(feeOn ? withFee : base);
    }

    const barVal = form.querySelector('.wdp-shares-total-bar__value');
    if (barVal && form.querySelector('input[name="share_count"]') && Number.isFinite(base) && base > 0) {
      if (feeOn) {
        barVal.setAttribute('data-wdp-fee-applied', '1');
        barVal.textContent = formatCurrency(withFee);
      } else if (barVal.getAttribute('data-wdp-fee-applied') === '1') {
        barVal.removeAttribute('data-wdp-fee-applied');
        barVal.textContent = formatCurrency(base);
      }
    }
  }

  function bindCoverFeeTotal(form) {
    if (!form || form.dataset.wdpCoverFeeBound === '1') {
      return;
    }
    form.dataset.wdpCoverFeeBound = '1';
    form.addEventListener('change', function(e) {
      const t = e.target;
      if (!t) {
        return;
      }
      if (t.name === 'donation_cover_fee' || t.name === 'custom_price' || t.name === 'quantity' || t.name === 'share_count') {
        updateCoverFeeTotal(form);
      }
    });
    form.addEventListener('input', function(e) {
      const t = e.target;
      if (t && (t.name === 'custom_price' || t.name === 'quantity' || t.name === 'share_count')) {
        updateCoverFeeTotal(form);
      }
    });
    updateCoverFeeTotal(form);
  }

  function updateDonationSummary() {
    /* Bağışın özeti kaldırıldı (10.10.6). */
  }

  function bindDonationSummary() {
    /* no-op */
  }

  /** Ürün miktarı +/- butonları için event delegation. */
  function bindProductQuantityDelegation(form) {
    if (!form || form.dataset.wdpQtyDelegationBound === '1') {
      return;
    }
    form.dataset.wdpQtyDelegationBound = '1';
    form.addEventListener('click', function(e) {
      const btn = e.target.closest('.wdp-product-quantity-decrease, .wdp-product-quantity-increase');
      if (!btn || !form.contains(btn)) {
        return;
      }
      if (form.querySelector('input[name="share_count"]')) {
        return;
      }
      const counter = btn.closest('.wdp-quantity-counter');
      if (!counter) {
        return;
      }
      const quantityInput = counter.querySelector('input[name="quantity"]');
      if (!quantityInput) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const currentValue = Number.parseInt(quantityInput.value, 10) || 1;
      const isDecrease = btn.classList.contains('wdp-product-quantity-decrease');
      const customRow = getCustomPriceRow(form);
      if (customRow && customPriceRowHasQtyCounter(customRow) && customRow.contains(quantityInput)) {
        const customIn = customRow.querySelector('input[name="custom_price"]');
        if (customIn) {
          ensureCustomUnitFromDisplayed(customIn, currentValue);
        }
      }
      if (isDecrease) {
        if (currentValue > 1) {
          quantityInput.value = String(currentValue - 1);
          updateLineTotals(form);
        }
        return;
      }
      const maxAttr = Number.parseInt(quantityInput.getAttribute('max') || '99', 10);
      const maxAllowed = Number.isFinite(maxAttr) && maxAttr > 0 ? maxAttr : 99;
      quantityInput.value = String(Math.min(maxAllowed, currentValue + 1));
      updateLineTotals(form);
    });
  }

  /** Özel fiyat + miktar satırını FormData'ya birim fiyat olarak yazar. */
  function patchSimpleCustomPriceQtyRowFormData(form, formData) {
    if (!form || !formData) {
      return;
    }
    if (form.querySelector('input[name="share_count"]')) {
      return;
    }
    const row = getCustomPriceRow(form);
    if (!row) {
      return;
    }
    const priceInput = row.querySelector('input[name="custom_price"]');
    if (!priceInput) {
      return;
    }
    if (!customPriceRowHasQtyCounter(row)) {
      formData.set('quantity', '1');
      return;
    }
    const qEl = row.querySelector('input[name="quantity"]');
    if (!qEl) {
      return;
    }
    const q = Number.parseInt(qEl.value, 10) || 1;
    let unit = Number.parseFloat(priceInput.dataset.wdpCustomUnit);
    if (!Number.isFinite(unit) || unit <= 0) {
      const total = parseNormalizedAmount(priceInput.value);
      if (Number.isFinite(total) && total > 0 && q > 0) {
        unit = roundMoney(total / q);
        priceInput.dataset.wdpCustomUnit = String(unit);
      }
    }
    if (Number.isFinite(unit) && unit > 0) {
      formData.set('custom_price', formatSubmitUnitPrice(unit));
      formData.set('quantity', String(q));
    }
  }

  function syncAmountPresetSelection(scope, amount) {
    if (!scope) {
      return;
    }
    const presets = scope.querySelectorAll('.wdp-amount-preset');
    if (!presets.length) {
      return;
    }
    const target = Number.isFinite(amount) ? roundMoney(amount) : NaN;
    presets.forEach(function(btn) {
      const n = Number.parseFloat(btn.getAttribute('data-amount') || '');
      const match = Number.isFinite(target) && Number.isFinite(n) && Math.abs(n - target) < 0.001;
      btn.classList.toggle('selected', match);
      btn.setAttribute('aria-pressed', match ? 'true' : 'false');
    });
  }

  /** Min altına düşen preset chip'lerini gizler. */
  function syncAmountPresetsToMin(form) {
    if (!form) return;
    const input = form.querySelector('input[name="custom_price"]');
    const minAttr = input ? parseFloat(input.getAttribute('min') || input.getAttribute('data-base-min') || '0') : 0;
    const min = Number.isFinite(minAttr) ? minAttr : 0;
    form.querySelectorAll('.wdp-amount-preset').forEach(function(btn) {
      const n = Number.parseFloat(btn.getAttribute('data-amount') || '');
      const hide = min > 0 && Number.isFinite(n) && n + 0.0001 < min;
      btn.hidden = hide;
      btn.setAttribute('aria-hidden', hide ? 'true' : 'false');
      if (hide) {
        btn.classList.remove('selected');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
  }

  function findPriceInputNearPresets(presetsRoot) {
    if (!presetsRoot) {
      return null;
    }
    const wrap =
      presetsRoot.closest('.wdp-custom-price-row, .wdp-custom-price-with-qty-row, .wdp-progress-bar-price-row, .wdp-price-quantity-row') ||
      presetsRoot.parentElement;
    if (!wrap) {
      return null;
    }
    return wrap.querySelector('input[name="custom_price"]');
  }

  /** Hızlı tutar chip'leri — tıklayınca custom_price doldurur. */
  function bindAmountPresets(form) {
    if (!form || form.dataset.wdpAmountPresetsBound === '1') {
      return;
    }
    form.dataset.wdpAmountPresetsBound = '1';
    syncAmountPresetsToMin(form);

    form.addEventListener('click', function(e) {
      const btn = e.target.closest('.wdp-amount-preset');
      if (!btn || !form.contains(btn)) {
        return;
      }
      e.preventDefault();
      const amount = Number.parseFloat(btn.getAttribute('data-amount') || '');
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }
      const input = findPriceInputNearPresets(btn);
      if (!input) {
        return;
      }
      const row = input.closest('.wdp-custom-price-row, .wdp-custom-price-with-qty-row');
      const qtyEl = row && row.querySelector('input[name="quantity"]');
      const qty = qtyEl ? Number.parseInt(qtyEl.value, 10) || 1 : 1;
      if (customPriceRowHasQtyCounter(row)) {
        input.dataset.wdpCustomUnit = String(roundMoney(amount));
        input.value = formatPriceInputValue(amount * qty);
      } else {
        input.value = formatPriceInputValue(amount);
        delete input.dataset.wdpCustomUnit;
      }
      input.classList.remove('wdp-error');
      syncAmountPresetSelection(btn.parentElement, amount);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      updateLineTotals(form);
    });

    form.addEventListener('input', function(e) {
      const input = e.target;
      if (!input || input.name !== 'custom_price') {
        return;
      }
      const presets =
        (input.closest('.wdp-custom-price-row, .wdp-progress-bar-price-row, .wdp-price-quantity-row') || form)
          .querySelector('.wdp-amount-presets');
      if (!presets) {
        return;
      }
      const row = input.closest('.wdp-custom-price-row, .wdp-custom-price-with-qty-row');
      let compare = parseNormalizedAmount(input.value);
      if (customPriceRowHasQtyCounter(row)) {
        const unit = Number.parseFloat(input.dataset.wdpCustomUnit);
        if (Number.isFinite(unit) && unit > 0) {
          compare = unit;
        }
      }
      syncAmountPresetSelection(presets, compare);
    });
  }

  WDPApp.formPricing = {
    parseNormalizedAmount: parseNormalizedAmount,
    roundMoney: roundMoney,
    formatPriceInputValue: formatPriceInputValue,
    formatSubmitUnitPrice: formatSubmitUnitPrice,
    getCustomPriceRow: getCustomPriceRow,
    customPriceRowHasQtyCounter: customPriceRowHasQtyCounter,
    ensureCustomUnitFromDisplayed: ensureCustomUnitFromDisplayed,
    getWdpUnitPriceForForm: getWdpUnitPriceForForm,
    updateLineTotals: updateLineTotals,
    updateDonationSummary: updateDonationSummary,
    bindDonationSummary: bindDonationSummary,
    bindProductQuantityDelegation: bindProductQuantityDelegation,
    patchSimpleCustomPriceQtyRowFormData: patchSimpleCustomPriceQtyRowFormData,
    bindAmountPresets: bindAmountPresets,
    syncAmountPresetSelection: syncAmountPresetSelection,
    syncAmountPresetsToMin: syncAmountPresetsToMin,
    clearAmountSelection: clearAmountSelection,
    updateCoverFeeTotal: updateCoverFeeTotal,
    bindCoverFeeTotal: bindCoverFeeTotal,
    getFormBaseAmount: getFormBaseAmount,
  };
})(window);
