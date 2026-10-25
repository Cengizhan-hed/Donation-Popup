/**
 * Form çekirdeği: durum -> DOM, sepete ekleme ve doğrulama (REST `cart/add`).
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
    const target =
      name === 'amount'
        ? form.querySelector('input[name="amount"]:not([type="hidden"])') || form.querySelector('[role="radio"][tabindex="0"]')
        : form.querySelector(`[name="${name}"]`);
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
      const outcome = await addToCart(root, productId, values);
      if (outcome.errors) {
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
