/**
 * Form çekirdeği: bağış türleri (sabit/serbest/hisseli/kampanya), çok adımlı akış, durum -> DOM,
 * sepete ekleme ve doğrulama (REST `cart/add`).
 */
import { phoneBad, phoneBind } from '../ui2-shared/phone-lazy.mjs';
import { clampQty, computeTotals, firstErrorStep, formatTotal, initialState, nextPresetIndex, parseAmount, reducer, stepLabel } from './store.mjs';

const RTL = () => document.documentElement.dir === 'rtl' || document.dir === 'rtl';
const HOLDER = /^shareholder_(\d+)_/;

/**
 * Telefon değeri: ulusal numara girildiyse seçili ülke ön eki eklenir (ülke kodu seçicisi `.donation-panel-phone` içinde).
 *
 * @param {HTMLInputElement} input Numara girdisi.
 * @return {string} Sunucuya gidecek değer.
 */
export function phoneValue(input) {
  const raw = input.value.trim();
  if (raw === '' || /^(\+|00)/.test(raw)) {
    return raw;
  }
  const select = input.closest('.donation-panel-phone') ? input.closest('.donation-panel-phone').querySelector('[data-dp-dial]') : null;
  const dial = select ? select.value : '';
  if (!dial) {
    return raw;
  }
  const national = dial === '39' ? raw : raw.replace(/^0+/, '');
  return `+${dial} ${national}`;
}

/**
 * Doğrudan akışta hedef yalnız sunucunun verdiği ödeme adresidir (sepet ödeme sayfasına düşülmez).
 *
 * @param {HTMLElement} root    Kök.
 * @param {{checkoutUrl?: string}} outcome Sonuç.
 * @param {boolean}     direct  Doğrudan bağış.
 * @return {string} Yönlendirilecek adres (boş olabilir).
 */
function checkoutTarget(root, outcome, direct) {
  const target = direct ? outcome.checkoutUrl : outcome.checkoutUrl || root.dataset.dpCheckout;
  if (direct && !target) {
    throw new Error('direct');
  }
  return target;
}

/**
 * @param {unknown} error Yakalanan hata.
 * @return {string} 'rate' (hız sınırı) ya da boş.
 */
function failKind(error) {
  return error && error.message === 'rate' ? 'rate' : '';
}

/**
 * Formun veri öznitelikleri (sayısal ayarlar ve Woo ayırıcıları).
 *
 * @param {HTMLElement} form Form.
 * @return {object} Ayarlar.
 */
function readConfig(form) {
  const num = (name, fallback) => Number(form.dataset[name] || fallback);
  const kind = form.dataset.kind || '';
  const decimals = num('decimals', 2);
  return {
    kind,
    derived: kind === 'fixed' || kind === 'shares',
    unit: num('unit', 0),
    feePercent: num('fee', 0),
    qtyMax: num('qtyMax', 1),
    addonFixed: num('addonFixed', 0),
    addonMin: num('addonMin', 0),
    minAmount: num('min', 0),
    decimals,
    // Woo ayırıcıları: yazılan tutar sunucudakiyle AYNI kuralla ayrıştırılır (amount.mjs).
    currency: {
      decimals,
      thousandSeparator: form.dataset.thousandSep ?? ',',
      decimalSeparator: form.dataset.decimalSep ?? '.',
    },
  };
}

/**
 * Öğe varsa olay dinleyicisi ekler.
 *
 * @param {EventTarget|null} el      Öğe.
 * @param {string}           type    Olay.
 * @param {Function}         handler Dinleyici.
 */
function on(el, type, handler) {
  if (el) {
    el.addEventListener(type, handler);
  }
}

/**
 * Telefon ülke kodu seçicileri, ithaf ve not açma/kapama düğmeleri (durumdan bağımsız).
 *
 * @param {HTMLFormElement} form Form.
 */
function bindToggles(form) {
  form.querySelectorAll('[data-dp-dial]').forEach((select) => {
    const label = select.closest('.donation-panel-phone__code') ? select.closest('.donation-panel-phone__code').querySelector('[data-dp-dial-label]') : null;
    on(select, 'change', () => {
      if (label) {
        label.textContent = `+${select.value}`;
      }
    });
  });
  const dediToggle = form.querySelector('[data-dp-dedi-toggle]');
  if (dediToggle) {
    const box = form.querySelector(`#${dediToggle.getAttribute('aria-controls')}`);
    on(dediToggle, 'change', () => {
      if (!box) {
        return;
      }
      box.hidden = !dediToggle.checked;
      box.querySelectorAll('input').forEach((input) => {
        input.disabled = !dediToggle.checked;
      });
      if (dediToggle.checked) {
        const field = box.querySelector('input');
        if (field) {
          field.focus();
        }
      }
    });
  }
  const noteToggle = form.querySelector('[data-dp-note-toggle]');
  if (noteToggle) {
    const noteBox = form.querySelector(`#${noteToggle.getAttribute('aria-controls')}`);
    on(noteToggle, 'click', () => {
      const open = noteToggle.getAttribute('aria-expanded') !== 'true';
      noteToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (noteBox) {
        noteBox.hidden = !open;
        const field = noteBox.querySelector('textarea');
        if (field) {
          field.disabled = !open;
          if (open) {
            field.focus();
          }
        }
      }
    });
  }
}

/**
 * Girişli bağışçıda doğrudan akışın e-posta alanı gizlenir ve devre dışı kalır (sunucu hesap e-postasını kullanır).
 *
 * @param {HTMLElement} form   Form.
 * @param {boolean}     direct Doğrudan (sepetsiz) bağış.
 */
function hideAccountEmail(form, direct) {
  if (!direct || !document.body.classList.contains('logged-in')) {
    return;
  }
  const input = form.querySelector('input[name="donation_email"]');
  const wrap = input && input.closest('[data-dp-field]');
  if (input && wrap) {
    input.disabled = true;
    wrap.hidden = true;
  }
}

/**
 * @param {HTMLElement} root Kök (.donation-panel-exp).
 * @param {{ onDone?: Function }} [hooks] Olaylar.
 * @return {{getState: Function}} Denetleyici.
 */
export function createForm(root, hooks = {}) {
  const form = root.querySelector('[data-dp-form]');
  if (!form) {
    return { getState: () => ({}) };
  }

  const { kind, derived, unit, feePercent, qtyMax, addonFixed, addonMin, minAmount, decimals, currency } = readConfig(form);
  /**
   * Seçili (yazılmamış) tutarı sunucunun beklediği mağaza biçiminde yazar (binliksiz, Woo ondalık ayırıcılı).
   *
   * @param {number} value Tutar.
   * @return {string} Örn. "1,250" (3 ondalıklı, virgül ondalık).
   */
  const canonicalAmount = (value) => {
    const fixed = Number.isInteger(value) ? String(value) : value.toFixed(Math.max(decimals, 2)).replace(/0+$/, '').replace(/\.$/, '');
    return fixed.replace('.', currency.decimalSeparator);
  };
  const locale = document.documentElement.lang || undefined;

  const sections = Array.from(form.querySelectorAll('[data-dp-step]'));
  const stepsBar = Array.from(form.querySelectorAll('.donation-panel-steps__i'));
  const stepsWrap = form.querySelector('[data-dp-steps]');
  const stepText = form.querySelector('[data-dp-steplabel]');
  const titleNode = form.querySelector('[data-dp-title]');
  const totalRow = form.querySelector('[data-dp-total-row]');
  const submitLabel = form.querySelector('[data-dp-submit-label]');
  const submitLock = form.querySelector('[data-dp-submit-lock]');
  const submitArrow = form.querySelector('[data-dp-submit-arrow]');
  const addCart = form.querySelector('[data-dp-addcart]');
  // Doğrudan (sepetsiz) bağış: gönderim siparişe gider (`POST direct`), sepet düğmesi yok, ödeme order-pay sayfasında.
  const direct = form.dataset.direct === '1';
  // Girişli bağışçıda e-posta sorulmaz: sunucu hesap e-postasını kullanır (sayfa HTML'i kullanıcıya özel olamaz; WordPress'in
  // standart `logged-in` gövde sınıfı okunur, yoksa alan görünür ve zorunlu kalır).
  hideAccountEmail(form, direct);
  const trust = form.querySelector('[data-dp-trust]');
  const legal = form.querySelector('[data-dp-legal]');
  const recapAmount = form.querySelector('[data-dp-recap-amount]');
  const qtyTotal = form.querySelector('[data-dp-qty-total]');
  const qtySum = form.querySelector('[data-dp-qty-sum]');
  // Tek adette sunucu metni korunur (ör. "£100 hisse başına"): bağlanınca metin değişmez (CLS 0, §25).
  const qtyOneText = qtySum ? qtySum.textContent : '';
  const backButton = form.querySelector('[data-dp-back]');
  const chips = Array.from(form.querySelectorAll('[data-dp-preset]'));
  const presets = chips.map((chip) => Number(chip.dataset.dpPreset));
  const recommended = chips.findIndex((chip) => chip.getAttribute('aria-checked') === 'true');
  const seed = { presets, recommended: recommended >= 0 ? presets[recommended] : null };
  let state = initialState(seed);
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
  const lastStep = Math.max(0, sections.length - 1);

  // Sunucunun sayı ayırıcıları (WP number_format_i18n): metin sunucu çıktısıyla aynı, Intl kurulumu yok.
  const numSeps = form.dataset.numDecimal !== undefined ? { thousands: form.dataset.numThousands ?? '', decimal: form.dataset.numDecimal } : null;
  const money = (value) => formatTotal(value, symbol, decimals, locale, numSeps);
  const addonValue = () => (addonFixed > 0 ? addonFixed : parseAmount(state.addonAmount, currency));
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

  /**
   * Ekran okuyucu ve görünür kısa durum iletisi (sepete eklendi).
   *
   * @param {string} message İleti.
   */
  const announce = (message) => {
    let node = form.querySelector('[data-dp-added]');
    if (!node) {
      node = document.createElement('p');
      node.className = 'donation-panel-added';
      node.setAttribute('role', 'status');
      node.dataset.dpAdded = '';
      const bar = form.querySelector('.donation-panel-actionbar');
      form.insertBefore(node, bar);
    }
    node.textContent = message;
    window.setTimeout(() => {
      node.textContent = '';
    }, 4000);
  };

  // Kampanya çubuğunun kişisel önizlemesi (ortak canlı çubuk; yalnız bu tarayıcı): bağış tutarı (ücret/ek bağış hariç;
  // sabit/hisseli: adet × fiyat). Yalnız bağışçı eylemiyle bildirilir: önerilen tutar kendiliğinden önizlenmez.
  let emitted = 0;
  const emitAmount = (value) => {
    if (emitted !== value) {
      emitted = value;
      form.dispatchEvent(new CustomEvent('donation-panel:amount', { bubbles: true, detail: { productId: Number(form.dataset.productId), amount: value } }));
    }
  };

  const dispatch = (action) => {
    state = reducer(state, action);
    paint();
    const donation = Number(totals(state.fee).donation);
    emitAmount(Number.isFinite(donation) && donation > 0 ? donation : 0);
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

  // Tutar seçilmemişken (tutar adımında) ana düğme pasif ve "Tutar seçin"; "Toplam 0" gösterilmez.
  const needsAmount = !derived && Boolean(form.querySelector('[data-dp-amounts]'));
  const amountPending = () => {
    const section = sections[state.step];
    return needsAmount && Boolean(section && section.querySelector('[data-dp-amounts]')) && !(state.amount > 0);
  };

  let paintedStep = null;
  const paintProgress = () => {
    // Doğrudan bağışta ödeme sayfası son (form dışı) adımdır: göstergede ek çubuk olarak sayılır.
    const extraSteps = direct ? stepsBar.length - sections.length : 0;
    const multi = sections.length + extraSteps > 1;
    // Adım geçişinde yalnız yeni adım içeri süzülür; ilk çizimde/katman açılırken içerik sabit (panel kayarken içerik
    // ayrıca hareket etmesin: titreme yok).
    const changed = paintedStep !== null && paintedStep !== state.step;
    paintedStep = state.step;
    sections.forEach((section, index) => {
      section.hidden = index !== state.step;
      section.classList.toggle('is-entering', changed && index === state.step);
    });
    stepsBar.forEach((bar, index) => {
      bar.classList.toggle('is-done', index < state.step);
      bar.classList.toggle('is-current', index === state.step);
    });
    if (stepsWrap) {
      stepsWrap.hidden = !multi || state.step === 0;
    }
    if (stepText) {
      stepText.hidden = !multi;
      stepText.textContent = multi ? stepLabel(form.dataset.msgStep, state.step, sections.length + extraSteps, '') : '';
    }
    if (titleNode) {
      const section = sections[state.step];
      titleNode.textContent = state.step === 0 ? form.dataset.title || titleNode.textContent : (section && section.dataset.stepLabel) || titleNode.textContent;
    }
    if (backButton) {
      backButton.hidden = state.step === 0;
    }
  };

  const paintSubmitLabel = (last, pending) => {
    if (!submitLabel) {
      return;
    }
    let label = last ? (form.dataset.labelSubmit || '').replace('%s', money(totals(state.fee).total)) : form.dataset.labelNext;
    if (pending && form.dataset.labelChoose) {
      label = form.dataset.labelChoose;
    }
    submitLabel.textContent = label || submitLabel.textContent;
  };

  const paintSteps = () => {
    const last = state.step >= lastStep;
    const pending = amountPending();
    paintProgress();
    if (totalRow) {
      totalRow.hidden = last || pending;
    }
    paintSubmitLabel(last, pending);
    if (submitLock) {
      submitLock.hidden = !last;
    }
    if (submitArrow) {
      submitArrow.toggleAttribute('hidden', last);
    }
    if (addCart) {
      addCart.hidden = !last || direct;
    }
    if (legal) {
      legal.hidden = !last;
    }
    if (trust) {
      trust.hidden = last && Boolean(legal);
    }
  };

  // Telefon: odak çıkınca gösterilen (yazarken rahatsız etmeyen) eksik/fazla hane iletisi; alan adı -> ileti.
  const phoneBlurErrors = {};
  /** Geçerli adımda dolu ama eksik/fazla telefon var mı (devam düğmesi geçerli olana kadar pasif). */
  const phoneBlocked = () => phoneBad(sections[state.step]).length > 0;

  const paintErrors = () => {
    form.querySelectorAll('[data-dp-error]').forEach((error) => {
      const name = error.dataset.dpError;
      const message = state.errors[name] || phoneBlurErrors[name] || '';
      error.textContent = message;
      const wrap = error.closest('[data-dp-field], .donation-panel-fieldset');
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
        // 429 (hız sınırı) için ayırt edici ileti; diğer hatalar genel iletiyi gösterir.
        summary.textContent =
          root.dataset.dpFailKind === 'rate'
            ? root.dataset.dpMsgRate || root.dataset.dpMsgFailed || ''
            : (direct && form.dataset.msgFailedDirect) || root.dataset.dpMsgFailed || '';
      }
    }
  };

  const paintChoices = () => {
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
  };

  const paintTotals = () => {
    const current = totals(state.fee);
    if (total) {
      total.textContent = money(current.total);
    }
    if (feeHint) {
      const preview = totals(true);
      feeHint.textContent = preview.fee > 0 ? `+${money(preview.fee)}` : '';
    }
    if (recapAmount) {
      recapAmount.textContent = money(current.total);
    }
    if (qtyTotal) {
      qtyTotal.textContent = money(current.donation);
    }
    if (qtySum && qtySum.dataset.unitText && state.qty > 1) {
      qtySum.textContent = `${qtySum.dataset.unitText} × ${state.qty}`;
    } else if (qtySum && qtySum.dataset.unitText) {
      qtySum.textContent = qtyOneText || qtySum.dataset.unitText;
    }
    setLine('donation', current.donation, true);
    setLine('fee', current.fee, current.fee > 0);
    setLine('addon', current.addon, current.addon > 0);
    setLine('total', current.total, true);
  };

  const paint = () => {
    paintSteps();
    paintChoices();
    paintTotals();
    paintErrors();
    if (submit) {
      const busy = state.status === 'submitting';
      const pending = amountPending();
      submit.classList.toggle('is-loading', busy);
      submit.classList.toggle('is-pending', pending);
      paintGate();
    }
  };

  /** Yazarken yalnız devam düğmesinin pasifliği güncellenir (tam boyama yok). */
  const paintGate = () => {
    if (submit) {
      submit.setAttribute('aria-disabled', state.status === 'submitting' || amountPending() || phoneBlocked() ? 'true' : 'false');
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

  on(hiddenAmount ? null : amountInput, 'input', () => dispatch({ type: 'setCustom', value: amountInput.value, currency }));
  qtyButtons.forEach((button) => {
    button.addEventListener('click', () => dispatch({ type: 'setQty', value: clampQty(state.qty + Number(button.dataset.dpQty), qtyMax) }));
  });
  on(feeBox, 'change', () => dispatch({ type: 'setFee', value: feeBox.checked }));
  on(addonToggle, 'change', () => {
    dispatch({ type: 'setAddon', value: addonToggle.checked });
    if (addonToggle.checked && addonInput) {
      addonInput.focus();
    }
  });
  on(addonInput, 'input', () => dispatch({ type: 'setAddonAmount', value: addonInput.value }));
  on(backButton, 'click', () => {
    dispatch({ type: 'goStep', value: state.step - 1 });
    focusStep();
  });
  bindToggles(form);
  // Telefon kuralları tembel pakettedir (ilk odak/yazma/otomatik doldurmada yüklenir); çekirdekte yalnız bu bağlam.
  phoneBind(form, {
    gate: paintGate,
    say: (input, message) => {
      if (message || phoneBlurErrors[input.name]) {
        phoneBlurErrors[input.name] = message;
        paintErrors();
      }
    },
  });
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
    const values = { amount: state.amount === null ? form.querySelector('input[name="amount"]')?.value || '' : canonicalAmount(state.amount) };
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
        values[el.name] = el.type === 'tel' ? phoneValue(el) : el.value;
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
            row[input.dataset.dpHolderField] = input.type === 'tel' ? phoneValue(input) : input.value;
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
  const amountError = () => {
    if (state.amountStatus === 'ambiguous') {
      // Belirsiz biçim (ör. 3 ondalıklı para biriminde "1,250"): tahmin etmeden net biçim istenir.
      return form.dataset.msgAmountFormat || form.dataset.msgAmount || '';
    }
    if (state.amount === null || !(state.amount > 0)) {
      return form.dataset.msgAmount || '';
    }
    return state.amount < Math.max(minAmount, 0.01) ? form.dataset.msgMin || '' : null;
  };

  const addonError = () => {
    const value = addonValue();
    return value === null || !(value > 0) || (addonMin > 0 && value < addonMin) ? form.dataset.msgAddon || '' : null;
  };

  const validateStep = () => {
    const errors = {};
    const section = sections[state.step];
    if (!section) {
      return errors;
    }
    // Tutar kontrolleri: tutarı bağışçının seçtiği adımda ya da tutarla bilgilerin tek adım olduğu formlarda.
    if (section.querySelector('[data-dp-amounts], [data-dp-qtyset], [data-dp-addon]')) {
      if (!derived && section.querySelector('[data-dp-amounts]')) {
        const message = amountError();
        if (message !== null) {
          errors.amount = message;
        }
      }
      if (state.addon && addonFixed <= 0 && section.querySelector('[data-dp-addon]')) {
        const message = addonError();
        if (message !== null) {
          errors.addon_amount = message;
        }
      }
    }
    section.querySelectorAll('input[required]:not(:disabled), textarea[required]:not(:disabled)').forEach((input) => {
      if (input.value.trim() === '') {
        errors[input.name] = input.dataset.requiredMsg || '';
      }
    });
    // Telefon: dolu ama eksik/fazla/tanınmayan numara ilerletmez (mobil önek uyarısı engel değildir).
    phoneBad(section).forEach((input) => {
      errors[input.name] = errors[input.name] || input.dataset.msgShort || '';
    });
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

  // Adım değişince odak başlığa gider (alana değil): mobilde klavye kendiliğinden açılmaz, ekran okuyucu yeni adımı duyar.
  const focusStep = () => {
    const target = titleNode;
    const body = form.querySelector('.donation-panel-surface__body');
    if (body) {
      body.scrollTop = 0;
    }
    if (target) {
      target.focus({ preventScroll: true });
    }
  };

  let addOnly = false;
  on(addCart, 'click', () => {
    addOnly = true;
    form.requestSubmit();
  });

  /** "Sepete ekle" sonrası formu başlangıç durumuna döndürür ve haber verir. */
  const resetAfterAdd = (productId) => {
    form.reset();
    form.querySelectorAll('[data-dp-dedi-toggle], [data-dp-note-toggle]').forEach((el) => {
      if (el.matches('[data-dp-dedi-toggle]')) {
        el.dispatchEvent(new Event('change'));
      } else if (el.getAttribute('aria-expanded') === 'true') {
        el.click();
      }
    });
    state = initialState(seed);
    paint();
    announce(form.dataset.msgAdded || '');
    document.dispatchEvent(new CustomEvent('donation-panel:cart-added', { detail: { productId: Number(productId), amount: emitted } }));
    emitAmount(0);
    root.dispatchEvent(new CustomEvent('dp:added', { bubbles: true }));
  };

  /** Sunucu alan hatalarını gösterir (en erken hatalı adıma gider). */
  const showServerErrors = (errors) => {
    const earlier = firstErrorStep(
      Object.keys(errors),
      Object.fromEntries(Object.keys(errors).map((name) => [name, stepIndexOf(name)]))
    );
    if (earlier >= 0 && earlier !== state.step) {
      dispatch({ type: 'goStep', value: earlier });
    }
    dispatch({ type: 'setErrors', errors });
    focusFirstError();
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const onlyAdd = addOnly;
    addOnly = false;
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
      const outcome = await addToCart(root, productId, values, direct);
      if (outcome.errors) {
        showServerErrors(outcome.errors);
        return;
      }
      if (!outcome.ok) {
        throw new Error(outcome.rate ? 'rate' : 'cart');
      }
      root.dataset.dpFailKind = '';
      dispatch({ type: 'submitDone' });
      if (onlyAdd) {
        resetAfterAdd(productId);
        return;
      }
      if (hooks.onDone) {
        hooks.onDone(root);
      }
      const target = checkoutTarget(root, outcome, direct);
      if (target) {
        window.location.assign(target);
      }
    } catch (error) {
      root.dataset.dpFailKind = failKind(error);
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
 * Güvenli rastgele kimlik (yalnız [0-9a-f]): `crypto.randomUUID`, yoksa `crypto.getRandomValues`; ikisi de yoksa (çok eski
 * tarayıcı) Math.random yedeği.
 *
 * @param {number} bytes Bayt sayısı (yedek yolda yaklaşık).
 * @return {string} Onaltılık metin (2 x bayt karakter).
 */
function randomId(bytes) {
  const cryptoApi = window.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID().replace(/-/g, '').slice(0, bytes * 2);
  }
  const values = new Uint8Array(bytes);
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(values);
  } else {
    for (let i = 0; i < bytes; i += 1) {
      values[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
}

/**
 * Tarayıcıya özel rastgele belirteç (çerez değil; yalnız doğrudan bağışta gönderilir): ortak IP'deki (mobil operatör, vekil)
 * bağışçıların sunucu tarafı kotasını ayırır ve idempotency anahtarının sahibini belirler. Saklama yoksa sayfa oturumu kullanılır.
 *
 * @return {string} Belirteç.
 */
function clientToken() {
  try {
    let token = window.localStorage.getItem('donation_panel_client');
    if (!token) {
      token = randomId(16);
      window.localStorage.setItem('donation_panel_client', token);
    }
    return token;
  } catch {
    return pageSession;
  }
}

/** Sayfa oturumu: doğrudan bağış anahtarının sabit parçası (sayfa yenilenince değişir). */
const pageSession = randomId(8);

/**
 * Kısa, kararlı içerik özeti (djb2; güvenlik amaçlı değil, yalnız aynı içeriği aynı anahtara bağlar).
 *
 * @param {string} text Metin.
 * @return {string} Özet.
 */
function digest(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * Sepete ekleme: `POST /donation-panel/v1/cart/add` (sunucuda doğrulanır). Bayat nonce (403) bir kez tazelenip yeniden denenir;
 * aynı `submission_key` çift eklemeyi önler.
 *
 * @param {HTMLElement} root      Kök.
 * @param {string}      productId Ürün.
 * @param {object}      values    Alan değerleri.
 * @param {boolean}     direct    Doğrudan (sepetsiz) bağış: `POST direct`.
 * @param {string}      [salt]    Doğrudan bağış anahtarına eklenen tur kimliği (compact kart "yeniden bağış": aynı içerik yeni sipariş).
 * @return {Promise<{ok: boolean, errors?: Record<string, string>, checkoutUrl?: string}>} Sonuç.
 */
export async function addToCart(root, productId, values, direct = false, salt = '') {
  const body = JSON.stringify({ ...values, product_id: Number(productId) });
  const payload = JSON.stringify({
    ...values,
    product_id: Number(productId),
    submission_key: submissionKeyFor(direct, productId, body + salt),
    ...(direct ? { client_token: clientToken() } : {}),
  });
  const send = (nonce) => postJson(`${root.dataset.dpRest}${direct ? 'direct' : 'cart/add'}`, payload, nonce);
  // Sayfa HTML'inde nonce yok: ilk gönderimde REST'ten alınır (sonrakilerde dataset'ten); bayatsa 403 sonrası tazelenir.
  let response = await send(root.dataset.dpNonce || (await refreshNonce(root)));
  if (response.status === 403) {
    const fresh = await refreshNonce(root);
    if (fresh) {
      response = await send(fresh);
    }
  }
  return outcomeFrom(response, await readJson(response));
}

/**
 * Sepet: her gönderim yeni anahtar. Doğrudan bağış: anahtar sayfa oturumu + içerik özetidir; aynı içeriğin yeniden
 * gönderimi (çift dokunuş, ağ hatası sonrası yeniden deneme) sunucuda AYNI siparişi bulur, ikinci sipariş üretmez.
 *
 * @param {boolean} direct    Doğrudan bağış.
 * @param {string}  productId Ürün.
 * @param {string}  body      Gönderim gövdesi.
 * @return {string} Anahtar.
 */
function submissionKeyFor(direct, productId, body) {
  return direct
    ? `dp-${productId}-${pageSession}-${digest(body)}`
    : `dp-${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {string} url     Adres.
 * @param {string} payload JSON gövde.
 * @param {string} nonce   REST nonce (boş olabilir).
 * @return {Promise<Response>} Yanıt.
 */
function postJson(url, payload, nonce) {
  return window.fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(nonce ? { 'X-WP-Nonce': nonce } : {}) },
    body: payload,
  });
}

/**
 * @param {Response}    response Yanıt.
 * @param {object|null} result   Gövde.
 * @return {{ok: boolean, errors?: Record<string, string>, checkoutUrl?: string, rate?: boolean}} Sonuç.
 */
function outcomeFrom(response, result) {
  if (response.ok && result && result.success) {
    return { ok: true, checkoutUrl: result.redirect_url || result.checkout_url || '' };
  }
  const errors = result && result.data && result.data.errors;
  if (errors && Object.keys(errors).length) {
    return { ok: false, errors };
  }
  return { ok: false, rate: response.status === 429 };
}
