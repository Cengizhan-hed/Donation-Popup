/**
 * Form çekirdeği: bağış türleri (sabit/serbest/hisseli/kampanya), çok adımlı akış, durum -> DOM,
 * sepete ekleme ve doğrulama (REST `cart/add`).
 */
import { clampQty, computeTotals, firstErrorStep, formatTotal, initialState, nextPresetIndex, parseAmount, reducer, stepLabel } from './store.mjs';

const RTL = () => document.documentElement.dir === 'rtl' || document.dir === 'rtl';
const HOLDER = /^shareholder_(\d+)_/;

/**
 * @param {HTMLElement} root Kök (.dp-exp).
 * @param {{ onDone?: Function }} [hooks] Olaylar.
 * @return {{getState: Function}} Denetleyici.
 */
export function createForm(root, hooks = {}) {
  const form = root.querySelector('[data-dp-form]');
  if (!form) {
    return { getState: () => ({}) };
  }

  const kind = form.dataset.kind || '';
  const derived = kind === 'fixed' || kind === 'shares';
  const unit = Number(form.dataset.unit || 0);
  const feePercent = Number(form.dataset.fee || 0);
  const qtyMax = Number(form.dataset.qtyMax || 1);
  const addonFixed = Number(form.dataset.addonFixed || 0);
  const addonMin = Number(form.dataset.addonMin || 0);
  const minAmount = Number(form.dataset.min || 0);
  const decimals = Number(form.dataset.decimals || 2);
  const locale = document.documentElement.lang || undefined;

  const sections = Array.from(form.querySelectorAll('[data-dp-step]'));
  const stepsBar = Array.from(form.querySelectorAll('.dp-steps__i'));
  const stepText = form.querySelector('[data-dp-steplabel]');
  const backButton = form.querySelector('[data-dp-back]');
  const chips = Array.from(form.querySelectorAll('[data-dp-preset]'));
  const presets = chips.map((chip) => Number(chip.dataset.dpPreset));
  const recommended = chips.findIndex((chip) => chip.getAttribute('aria-checked') === 'true');
  let state = initialState({ presets, recommended: recommended >= 0 ? presets[recommended] : null });
  const amountInput = form.querySelector('input[name="amount"]');
  const hiddenAmount = amountInput && amountInput.type === 'hidden';
  if (hiddenAmount && presets.length) {
    state = reducer(state, { type: 'selectPreset', value: presets[0] });
  }
  const total = form.querySelector('[data-dp-total]');
  const submit = form.querySelector('[data-dp-submit]');
  const summary = form.querySelector('[data-dp-summary]');
  const symbol = total ? total.dataset.symbol || '' : '';
  const qtyInput = form.querySelector('[data-dp-qty-input]');
  const qtyOut = form.querySelector('[data-dp-qty-out]');
  const qtyButtons = Array.from(form.querySelectorAll('[data-dp-qty]'));
  const feeBox = form.querySelector('[data-dp-fee]');
  const feeHint = form.querySelector('[data-dp-fee-hint]');
  const addonToggle = form.querySelector('[data-dp-addon-toggle]');
  const addonBox = form.querySelector('[data-dp-addon-box]');
  const addonInput = form.querySelector('input[name="addon_amount"]');
  const holders = Array.from(form.querySelectorAll('[data-dp-holder]'));
  const stepId = (index) => (sections[index] ? sections[index].dataset.dpStep : '');
  const lastStep = Math.max(0, sections.length - 1);

  const money = (value) => formatTotal(value, symbol, decimals, locale);
  const addonValue = () => (addonFixed > 0 ? addonFixed : parseAmount(state.addonAmount));
  const totals = (fee) =>
    computeTotals({
      kind,
      amount: state.amount,
      unit,
      qty: state.qty,
      feePercent,
      fee,
      addon: state.addon,
      addonAmount: addonValue(),
      decimals,
    });

  const dispatch = (action) => {
    state = reducer(state, action);
    paint();
  };

  const setLine = (name, value, visible) => {
    const line = form.querySelector(`[data-dp-line="${name}"]`);
    if (!line) {
      return;
    }
    line.hidden = !visible;
    const out = line.querySelector('[data-dp-line-value]');
    if (out) {
      out.textContent = money(value);
    }
  };

  const paintSteps = () => {
    sections.forEach((section, index) => {
      section.hidden = index !== state.step;
    });
    stepsBar.forEach((bar, index) => {
      bar.classList.toggle('is-done', index < state.step);
      bar.classList.toggle('is-current', index === state.step);
    });
    if (stepText) {
      const section = sections[state.step];
      stepText.textContent = stepLabel(form.dataset.msgStep, state.step, sections.length, section ? section.dataset.stepLabel || '' : '');
    }
    if (backButton) {
      backButton.hidden = state.step === 0;
    }
    if (submit) {
      submit.textContent = (state.step >= lastStep ? form.dataset.labelSubmit : form.dataset.labelNext) || submit.textContent;
    }
  };

  const paintErrors = () => {
    form.querySelectorAll('[data-dp-error]').forEach((error) => {
      const name = error.dataset.dpError;
      const message = state.errors[name] || '';
      error.textContent = message;
      const wrap = error.closest('[data-dp-field], .dp-fieldset');
      if (wrap) {
        wrap.classList.toggle('has-error', Boolean(message));
      }
      form.querySelectorAll(`[name="${name}"]`).forEach((input) => input.setAttribute('aria-invalid', message ? 'true' : 'false'));
    });
    if (summary) {
      const has = Object.keys(state.errors).length > 0;
      summary.classList.toggle('is-visible', has);
      summary.textContent = has ? root.dataset.dpMsgInvalid || '' : '';
      if (state.status === 'failed') {
        summary.classList.add('is-visible');
        summary.textContent = root.dataset.dpMsgFailed || '';
      }
    }
  };

  const paint = () => {
    paintSteps();
    chips.forEach((chip, index) => {
      const checked = state.preset !== null && Number(chip.dataset.dpPreset) === state.preset;
      chip.setAttribute('aria-checked', checked ? 'true' : 'false');
      const focusable = state.focusPreset === presets[index] || (state.focusPreset === null && index === 0);
      chip.tabIndex = focusable ? 0 : -1;
    });
    if (qtyInput) {
      qtyInput.value = String(state.qty);
    }
    if (qtyOut) {
      qtyOut.textContent = String(state.qty);
    }
    qtyButtons.forEach((button) => {
      button.disabled = Number(button.dataset.dpQty) < 0 ? state.qty <= 1 : state.qty >= qtyMax;
    });
    holders.forEach((holder) => {
      const visible = Number(holder.dataset.dpHolder) <= state.qty;
      holder.hidden = !visible;
      holder.querySelectorAll('input').forEach((input) => {
        input.disabled = !visible;
      });
    });
    if (addonBox) {
      addonBox.hidden = !state.addon;
    }
    const current = totals(state.fee);
    if (total) {
      total.textContent = money(current.total);
    }
    if (feeHint) {
      const preview = totals(true);
      feeHint.textContent = preview.fee > 0 ? `+${money(preview.fee)}` : '';
    }
    setLine('donation', current.donation, true);
    setLine('fee', current.fee, current.fee > 0);
    setLine('addon', current.addon, current.addon > 0);
    setLine('total', current.total, true);
    paintErrors();
    if (submit) {
      const busy = state.status === 'submitting';
      submit.classList.toggle('is-loading', busy);
      submit.setAttribute('aria-disabled', busy ? 'true' : 'false');
    }
  };

  chips.forEach((chip, index) => {
    chip.addEventListener('click', () => {
      dispatch({ type: 'selectPreset', value: presets[index] });
      if (amountInput && !hiddenAmount) {
        amountInput.value = '';
      }
    });
    chip.addEventListener('keydown', (event) => {
      const next = nextPresetIndex(index, chips.length, event.key, RTL());
      if (next !== index || ['Home', 'End'].includes(event.key)) {
        event.preventDefault();
        dispatch({ type: 'selectPreset', value: presets[next] });
        chips[next].focus();
      }
    });
  });

  if (amountInput && !hiddenAmount) {
    amountInput.addEventListener('input', () => dispatch({ type: 'setCustom', value: amountInput.value }));
  }
  qtyButtons.forEach((button) => {
    button.addEventListener('click', () => dispatch({ type: 'setQty', value: clampQty(state.qty + Number(button.dataset.dpQty), qtyMax) }));
  });
  if (feeBox) {
    feeBox.addEventListener('change', () => dispatch({ type: 'setFee', value: feeBox.checked }));
  }
  if (addonToggle) {
    addonToggle.addEventListener('change', () => {
      dispatch({ type: 'setAddon', value: addonToggle.checked });
      if (addonToggle.checked && addonInput) {
        addonInput.focus();
      }
    });
  }
  if (addonInput) {
    addonInput.addEventListener('input', () => dispatch({ type: 'setAddonAmount', value: addonInput.value }));
  }
  if (backButton) {
    backButton.addEventListener('click', () => {
      dispatch({ type: 'goStep', value: state.step - 1 });
      focusStep();
    });
  }
  form.querySelectorAll('input, textarea').forEach((input) => {
    if (input.name && !['amount', 'addon_amount'].includes(input.name)) {
      input.addEventListener('input', () => {
        if (state.errors[input.name]) {
          dispatch({ type: 'clearError', name: input.name });
        }
      });
    }
  });

  /**
   * Gönderilecek değerler (kapalı hissedar satırları ve kapalı ek bağış dahil edilmez).
   *
   * @return {Record<string, unknown>} Alan adı -> değer.
   */
  const collect = () => {
    const values = { amount: state.amount === null ? form.querySelector('input[name="amount"]')?.value || '' : String(state.amount) };
    form.querySelectorAll('input[name], textarea[name]').forEach((el) => {
      if (el.name === 'amount' || el.disabled || HOLDER.test(el.name)) {
        return;
      }
      if (el.type === 'checkbox') {
        if (el.checked) {
          values[el.name] = '1';
        }
      } else if (el.type === 'radio') {
        if (el.checked) {
          values[el.name] = el.value;
        }
      } else {
        values[el.name] = el.value;
      }
    });
    if (amountInput && !hiddenAmount && state.preset === null) {
      values.amount = amountInput.value;
    }
    if (!state.addon) {
      delete values.addon_active;
      delete values.addon_amount;
    }
    if (kind === 'shares') {
      values.shareholders = holders
        .filter((holder) => Number(holder.dataset.dpHolder) <= state.qty)
        .map((holder) => {
          const row = {};
          holder.querySelectorAll('[data-dp-holder-field]').forEach((input) => {
            row[input.dataset.dpHolderField] = input.value;
          });
          return row;
        });
    }
    return values;
  };

  /**
   * Geçerli adımın hızlı denetimi (sunucu yine her şeyi doğrular).
   *
   * @return {Record<string, string>} Alan adı -> ileti.
   */
  const validateStep = () => {
    const errors = {};
    const section = sections[state.step];
    const id = stepId(state.step);
    if (id === 'amount') {
      if (!derived) {
        if (state.amount === null || !(state.amount > 0)) {
          errors.amount = form.dataset.msgAmount || '';
        } else if (state.amount < Math.max(minAmount, 0.01)) {
          errors.amount = form.dataset.msgMin || '';
        }
      }
      if (state.addon && addonFixed <= 0) {
        const value = addonValue();
        if (value === null || !(value > 0) || (addonMin > 0 && value < addonMin)) {
          errors.addon_amount = form.dataset.msgAddon || '';
        }
      }
    } else if (section) {
      section.querySelectorAll('input[required]:not(:disabled), textarea[required]:not(:disabled)').forEach((input) => {
        if (input.value.trim() === '') {
          errors[input.name] = input.dataset.requiredMsg || '';
        }
      });
    }
    return errors;
  };

  /**
   * Alan adının bulunduğu adımın sırası; bulunamazsa -1.
   *
   * @param {string} name Alan adı.
   * @return {number} Adım sırası.
   */
  const stepIndexOf = (name) => {
    const el = form.querySelector(`[name="${name}"], [data-dp-error="${name}"]`);
    const section = el ? el.closest('[data-dp-step]') : null;
    return section ? sections.indexOf(section) : -1;
  };

  const focusFirstError = () => {
    const name = Object.keys(state.errors)[0];
    let target = null;
    if (name === 'amount') {
      target = form.querySelector('input[name="amount"]:not([type="hidden"])') || form.querySelector('[role="radio"][tabindex="0"]');
    } else if (name) {
      target = form.querySelector(`[name="${name}"]:not([type="hidden"]):not(:disabled)`) || form.querySelector('[data-dp-qty]:not(:disabled)');
    }
    if (target) {
      target.focus();
    }
  };

  const focusStep = () => {
    const section = sections[state.step];
    const target = section && section.querySelector('[role="radio"][tabindex="0"], input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), [data-dp-qty]:not(:disabled)');
    const body = form.querySelector('.dp-surface__body');
    if (body) {
      body.scrollTop = 0;
    }
    if (target) {
      target.focus({ preventScroll: true });
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.status === 'submitting') {
      return;
    }
    const stepErrors = validateStep();
    if (Object.keys(stepErrors).length) {
      dispatch({ type: 'setErrors', errors: stepErrors });
      focusFirstError();
      return;
    }
    if (state.step < lastStep) {
      dispatch({ type: 'goStep', value: state.step + 1 });
      focusStep();
      return;
    }
    const values = collect();
    const productId = form.dataset.productId;
    dispatch({ type: 'submitStart' });
    try {
      const outcome = await addToCart(root, productId, values);
      if (outcome.errors) {
        const earlier = firstErrorStep(
          Object.keys(outcome.errors),
          Object.fromEntries(Object.keys(outcome.errors).map((name) => [name, stepIndexOf(name)]))
        );
        if (earlier >= 0 && earlier !== state.step) {
          dispatch({ type: 'goStep', value: earlier });
        }
        dispatch({ type: 'setErrors', errors: outcome.errors });
        focusFirstError();
        return;
      }
      if (!outcome.ok) {
        throw new Error('cart');
      }
      dispatch({ type: 'submitDone' });
      if (hooks.onDone) {
        hooks.onDone(root);
      }
      const target = outcome.checkoutUrl || root.dataset.dpCheckout;
      if (target) {
        window.location.assign(target);
      }
    } catch {
      dispatch({ type: 'submitFail' });
    }
  });

  paint();
  return { getState: () => state };
}

/**
 * Taze REST nonce alır (sayfa önbelleğindeki nonce bayatlayabilir); başarısızsa boş döner.
 *
 * @param {HTMLElement} root Kök.
 * @return {Promise<string>} Nonce ya da boş.
 */
async function refreshNonce(root) {
  try {
    const response = await window.fetch(`${root.dataset.dpRest}nonce`, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) {
      return '';
    }
    const body = await response.json();
    root.dataset.dpNonce = body && body.nonce ? String(body.nonce) : '';
    return root.dataset.dpNonce;
  } catch {
    return '';
  }
}

/**
 * JSON gövdeyi okur; okunamazsa null.
 *
 * @param {Response} response Yanıt.
 * @return {Promise<object|null>} Gövde.
 */
async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Sepete ekleme: `POST /donation-panel/v1/cart/add` (sunucuda doğrulanır). Bayat nonce (403) bir kez tazelenip yeniden denenir;
 * aynı `submission_key` çift eklemeyi önler.
 *
 * @param {HTMLElement} root      Kök.
 * @param {string}      productId Ürün.
 * @param {object}      values    Alan değerleri.
 * @return {Promise<{ok: boolean, errors?: Record<string, string>, checkoutUrl?: string}>} Sonuç.
 */
async function addToCart(root, productId, values) {
  const payload = JSON.stringify({
    ...values,
    product_id: Number(productId),
    submission_key: `dp-${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  });
  const send = (nonce) =>
    window.fetch(`${root.dataset.dpRest}cart/add`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(nonce ? { 'X-WP-Nonce': nonce } : {}) },
      body: payload,
    });
  let response = await send(root.dataset.dpNonce || '');
  if (response.status === 403) {
    const fresh = await refreshNonce(root);
    if (fresh) {
      response = await send(fresh);
    }
  }
  const body = await readJson(response);
  if (response.ok && body && body.success) {
    return { ok: true, checkoutUrl: body.checkout_url || '' };
  }
  const errors = body && body.data && body.data.errors;
  if (errors && Object.keys(errors).length) {
    return { ok: false, errors };
  }
  return { ok: false };
}
