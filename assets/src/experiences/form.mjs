/**
 * Form çekirdeği: durum -> DOM, doğrulama (REST), sepete ekleme (mevcut yol).
 */
import { formatTotal, initialState, nextPresetIndex, reducer } from './store.mjs';

const RTL = () => document.documentElement.dir === 'rtl' || document.dir === 'rtl';

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
  const decimals = Number(form.dataset.decimals || 2);
  const locale = document.documentElement.lang || undefined;

  const dispatch = (action) => {
    state = reducer(state, action);
    paint();
  };

  const paint = () => {
    chips.forEach((chip, index) => {
      const checked = state.preset !== null && Number(chip.dataset.dpPreset) === state.preset;
      chip.setAttribute('aria-checked', checked ? 'true' : 'false');
      const focusable = state.focusPreset === presets[index] || (state.focusPreset === null && index === 0);
      chip.tabIndex = focusable ? 0 : -1;
    });
    if (total) {
      total.textContent = formatTotal(state.amount, total.dataset.symbol || '', decimals, locale);
    }
    form.querySelectorAll('[data-dp-field], [data-dp-amounts]').forEach((field) => {
      const name = field.dataset.dpField;
      const message = name ? state.errors[name] : state.errors.amount;
      const error = field.querySelector('[data-dp-error]');
      const input = field.querySelector('input, textarea');
      if (name === undefined && field.dataset.dpAmounts !== undefined) {
        return;
      }
      field.classList.toggle('has-error', Boolean(message));
      if (error) {
        error.textContent = message || '';
      }
      if (input) {
        input.setAttribute('aria-invalid', message ? 'true' : 'false');
      }
    });
    const amountError = state.errors.amount;
    const hiddenError = form.querySelector('[data-dp-amounts] > [data-dp-error]');
    if (hiddenError) {
      hiddenError.textContent = amountError || '';
    }
    if (summary) {
      const has = Object.keys(state.errors).length > 0;
      summary.classList.toggle('is-visible', has);
      summary.textContent = has ? root.dataset.dpMsgInvalid || '' : '';
      if (state.status === 'failed') {
        summary.classList.add('is-visible');
        summary.textContent = root.dataset.dpMsgFailed || '';
      }
    }
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
  form.querySelectorAll('input, textarea').forEach((input) => {
    if (input.name && input.name !== 'amount') {
      input.addEventListener('input', () => {
        if (state.errors[input.name]) {
          dispatch({ type: 'clearError', name: input.name });
        }
      });
    }
  });

  /**
   * @return {Record<string, string>} Alan adı -> değer.
   */
  const collect = () => {
    const values = { amount: state.amount === null ? form.querySelector('input[name="amount"]')?.value || '' : String(state.amount) };
    form.querySelectorAll('input[name], textarea[name]').forEach((el) => {
      if (el.name === 'amount') {
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
    return values;
  };

  const focusFirstError = () => {
    const name = Object.keys(state.errors)[0];
    const target = name === 'amount' ? form.querySelector('[role="radio"][tabindex="0"], input[name="amount"]') : form.querySelector(`[name="${name}"]`);
    if (target) {
      target.focus();
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state.status === 'submitting') {
      return;
    }
    const values = collect();
    const productId = form.dataset.productId;
    dispatch({ type: 'submitStart' });
    try {
      const response = await window.fetch(`${root.dataset.dpRest}validate`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': root.dataset.dpNonce || '' },
        body: JSON.stringify({ product_id: Number(productId), ...values }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.valid !== 'boolean') {
        throw new Error('validate');
      }
      if (!result.valid) {
        dispatch({ type: 'setErrors', errors: result.errors });
        focusFirstError();
        return;
      }
      const added = await addToCart(root, productId, values, result.amount);
      if (!added) {
        throw new Error('cart');
      }
      dispatch({ type: 'submitDone' });
      if (hooks.onDone) {
        hooks.onDone(root);
      }
      if (root.dataset.dpCheckout) {
        window.location.assign(root.dataset.dpCheckout);
      }
    } catch {
      dispatch({ type: 'submitFail' });
    }
  });

  paint();
  return { getState: () => state };
}

/**
 * Sepete ekleme: mevcut `wdp_ajax_add_to_cart` yolu (Store API köprüsü E2B'de).
 *
 * @param {HTMLElement} root      Kök.
 * @param {string}      productId Ürün.
 * @param {object}      values    Alan değerleri.
 * @param {number}      amount    Doğrulanmış tutar.
 * @return {Promise<boolean>} Başarılı mı.
 */
async function addToCart(root, productId, values, amount) {
  const body = new URLSearchParams();
  body.set('action', 'wdp_ajax_add_to_cart');
  body.set('security', root.dataset.dpCartNonce || '');
  body.set('wdp_product_id', productId);
  body.set('quantity', '1');
  body.set('custom_price', String(amount));
  body.set('wdp_ajax_flow', '1');
  body.set('timestamp', String(Math.floor(Date.now() / 1000)));
  body.set('unique_submission_key', `dp-${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  Object.entries(values).forEach(([name, value]) => {
    if (name.startsWith('donation_')) {
      body.set(name, value);
    }
  });
  const response = await window.fetch(root.dataset.dpAjax, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    return false;
  }
  const result = await response.json();
  return Boolean(result && result.success);
}
