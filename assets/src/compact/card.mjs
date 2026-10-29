/**
 * Compact bağış kartı denetleyicisi: 4 adım (tutar → bilgiler → ödeme → teşekkür) aynı grid hücresinde; yükseklik CSS ile
 * sabittir, burada ölçüm YOKTUR. Pasif adımlar `inert` + `aria-hidden`. Ödeme: doğrudan bağışta order-pay sayfası mevcut
 * katmanda (popup / alttan panel) aynı kökenli çerçevede; sepet akışında üst pencerede ödeme sayfası.
 */
import { addToCart, phoneValue } from '../experiences/form.mjs';
import { formatTotal } from '../experiences/store.mjs';
import { createLayer } from '../experiences/layer.mjs';
import { ISOLATED_EVENTS, STEPS, announcement, donorsText, embedUrl, evaluateAmount, fill, frameState, horizontalWheel, moveStep, percentOf } from './logic.mjs';

/**
 * Kart olaylarını kaydırıcılardan yalıtır (kütüphaneye özel kod yok): olaylar kart kökünde durur; yatay tekerlek sayfayı/
 * kaydırıcıyı kaydırmaz.
 *
 * @param {HTMLElement} root Kart kökü.
 */
function isolate(root) {
  ISOLATED_EVENTS.forEach((type) => {
    const wheel = type === 'wheel';
    root.addEventListener(
      type,
      (event) => {
        event.stopPropagation();
        if (wheel && horizontalWheel(event.deltaX, event.deltaY)) {
          event.preventDefault();
        }
      },
      { passive: !wheel }
    );
  });
}

/**
 * Formun veri öznitelikleri (Woo ayırıcıları, tür, akış).
 *
 * @param {DOMStringMap} ds Form `dataset`.
 * @return {object} Ayarlar.
 */
function readConfig(ds) {
  const decimals = Number(ds.decimals || 2);
  return {
    fixed: ds.kind === 'fixed',
    direct: ds.direct === '1',
    decimals,
    currency: { decimals, thousandSeparator: ds.thousandSep ?? ',', decimalSeparator: ds.decimalSep ?? '.' },
    locale: document.documentElement.lang || undefined,
    symbol: ds.symbol || '',
    unit: Number(ds.unit || 0),
    qtyMax: Math.max(1, Number(ds.qtyMax || 1)),
  };
}

/**
 * Çerçevedeki belgenin durumu (aynı köken); okunamazsa null.
 *
 * @param {HTMLIFrameElement} frame Çerçeve.
 * @return {{bodyClasses: string[], hasReceived: boolean, blank: boolean}|null} Gözlem.
 */
function probeFrame(frame) {
  try {
    const doc = frame.contentDocument;
    if (!doc || !doc.body) {
      return null;
    }
    return {
      bodyClasses: Array.from(doc.body.classList),
      hasReceived: Boolean(doc.querySelector('.woocommerce-thankyou-order-received')),
      blank: frame.contentWindow.location.href === 'about:blank',
    };
  } catch {
    return null;
  }
}

/**
 * @param {HTMLElement} root Kart kökü ([data-dp-compact]).
 * @return {{show: Function, reset: Function, getState: Function}|null} Denetleyici.
 */
export function createCompact(root) {
  const form = root.querySelector('[data-dp-cform]');
  if (!form) {
    return null;
  }
  const ds = form.dataset;
  const { fixed, direct, decimals, currency, locale, symbol, unit, qtyMax } = readConfig(ds);
  const sections = STEPS.map((id) => form.querySelector(`[data-dp-cstep="${id}"]`));
  const live = form.querySelector('[data-dp-live]');
  const quick = Array.from(form.querySelectorAll('[data-dp-cquick]'));
  const amountIn = form.querySelector('[data-dp-camount-in]');
  const qtyIn = form.querySelector('[data-dp-cqty-in]');
  const qtyOut = form.querySelector('[data-dp-cqty-out]');
  const qtyButtons = Array.from(form.querySelectorAll('[data-dp-cqty]'));
  const nextButton = form.querySelector('[data-dp-cnext]');
  const nextLabel = form.querySelector('[data-dp-cnext-label]');
  const payButton = form.querySelector('[data-dp-cpay]');
  const payLabel = form.querySelector('[data-dp-cpay-label]');
  const paySection = sections[2];
  const payDefault = payLabel ? payLabel.textContent : '';
  const state = { step: 0, qty: 1, quick: null, busy: false, payUrl: '', round: 0, value: null };

  const money = (value) => formatTotal(value, symbol, decimals, locale);
  const amount = () =>
    evaluateAmount({ fixed, quick: state.quick, raw: amountIn ? amountIn.value : '', unit, qty: state.qty, min: Number(ds.min || 0), currency });
  const amountMessage = (error) => ({ amount: ds.msgAmount, format: ds.msgFormat, min: ds.msgMin })[error] || '';

  /**
   * Adımın tek hata satırı (yer önceden ayrılmıştır; yükseklik değişmez) ve geçersiz alan işaretleri.
   *
   * @param {number}        index   Adım.
   * @param {string}        message İleti.
   * @param {HTMLElement[]} fields  Geçersiz alanlar.
   */
  const setError = (index, message, fields = []) => {
    const section = sections[index];
    if (!section) {
      return;
    }
    const node = section.querySelector('[data-dp-cerr]');
    if (node) {
      node.textContent = message || '';
      node.classList.toggle('is-on', Boolean(message));
    }
    section.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
    fields.forEach((el) => el.setAttribute('aria-invalid', 'true'));
  };

  /** Ana düğme: tutar geçerli olana kadar pasif ("Tutar seçin"). */
  const paintNext = (pending) => {
    if (nextButton) {
      nextButton.setAttribute('aria-disabled', pending ? 'true' : 'false');
      nextButton.classList.toggle('is-pending', pending);
    }
    if (nextLabel) {
      nextLabel.textContent = (pending && !fixed ? ds.labelChoose : ds.labelNext) || '';
    }
  };

  /** Seçilen tutar: üst bölgeler, özet, ödeme düğmesi. */
  const paintAmount = () => {
    const shown = state.value !== null ? money(state.value) : '';
    form.querySelectorAll('[data-dp-camount], [data-dp-crecap-amount]').forEach((node) => {
      node.textContent = shown;
    });
    if (payLabel && payButton) {
      payLabel.textContent = shown !== '' ? fill(payButton.dataset.label || '', [shown]) : payDefault;
    }
  };

  const paint = () => {
    const { value, error } = amount();
    state.value = error ? null : value;
    paintNext(error !== '');
    paintAmount();
    paintQty();
  };

  const paintQty = () => {
    if (qtyIn) {
      qtyIn.value = String(state.qty);
    }
    if (qtyOut) {
      qtyOut.textContent = String(state.qty);
    }
    qtyButtons.forEach((button) => {
      button.disabled = Number(button.dataset.dpCqty) < 0 ? state.qty <= 1 : state.qty >= qtyMax;
    });
  };

  /**
   * Adımı gösterir: diğerleri `inert` + `aria-hidden` (görünmez ama yer kaplar: yükseklik sabit). Odak yeni adımın başlığına
   * (mobilde klavye kendiliğinden açılmaz), ekran okuyucuya kısa duyuru.
   *
   * @param {number}  index Adım.
   * @param {boolean} focus Odak taşınsın mı (false: sessiz; ilk çizim ve görünmezken sıfırlama).
   */
  const show = (index, focus = true) => {
    state.step = index;
    sections.forEach((section, i) => {
      if (!section) {
        return;
      }
      const on = i === index;
      section.classList.toggle('is-on', on);
      section.toggleAttribute('inert', !on);
      if (on) {
        section.removeAttribute('aria-hidden');
      } else {
        section.setAttribute('aria-hidden', 'true');
      }
    });
    root.dataset.dpStep = STEPS[index];
    const section = sections[index];
    if (focus && section) {
      const title = section.querySelector('[data-dp-ctitle]');
      if (title) {
        title.focus({ preventScroll: true });
      }
    }
    if (live && section && focus) {
      live.textContent = announcement(ds.msgStep || '', index, section.dataset.stepName || '');
    }
  };

  /**
   * Kartı başa döndürür: tutar seçili değil, adet 1; yazılan bilgiler korunur.
   *
   * @param {boolean} focus Odak başlığa.
   */
  const reset = (focus) => {
    state.quick = null;
    state.qty = 1;
    quick.forEach((radio) => {
      radio.checked = false;
    });
    if (amountIn) {
      amountIn.value = '';
    }
    sections.forEach((_, i) => setError(i, ''));
    paint();
    show(0, focus);
  };

  // ---- Tutar adımı ----
  quick.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (!radio.checked) {
        return;
      }
      state.quick = Number(radio.value);
      if (amountIn) {
        amountIn.value = '';
      }
      setError(0, '');
      paint();
    });
  });
  if (amountIn) {
    amountIn.addEventListener('input', () => {
      state.quick = null;
      quick.forEach((radio) => {
        radio.checked = false;
      });
      const { error } = amount();
      // Yazılırken yalnız biçim/en düşük tutar uyarısı (boş alan hata değildir).
      setError(0, amountIn.value.trim() !== '' && error !== 'amount' ? amountMessage(error) : '', error && amountIn.value.trim() !== '' ? [amountIn] : []);
      paint();
    });
  }
  qtyButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.qty = Math.min(qtyMax, Math.max(1, state.qty + Number(button.dataset.dpCqty)));
      paint();
    });
  });

  // ---- Bilgiler adımı ----
  form.querySelectorAll('[data-dp-dial]').forEach((select) => {
    const label = select.parentElement ? select.parentElement.querySelector('[data-dp-dial-label]') : null;
    select.addEventListener('change', () => {
      if (label) {
        label.textContent = `+${select.value}`;
      }
    });
  });
  const detailsInputs = () => Array.from(sections[1] ? sections[1].querySelectorAll('input[name]') : []);
  detailsInputs().forEach((input) => {
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') {
        setError(1, '');
      }
    });
  });

  const validateDetails = () => {
    const bad = detailsInputs().filter((input) => {
      if (input.type === 'checkbox' || input.disabled) {
        return false;
      }
      const value = input.value.trim();
      if (input.required && value === '') {
        return true;
      }
      return value !== '' && input.type === 'email' && input.validity && input.validity.typeMismatch;
    });
    if (!bad.length) {
      return true;
    }
    const first = bad[0];
    const message = first.value.trim() === '' ? first.dataset.requiredMsg || ds.msgInvalid : ds.msgEmail || ds.msgInvalid;
    setError(1, message || '', bad);
    first.focus();
    return false;
  };

  const values = () => {
    const out = {};
    if (fixed) {
      const hidden = form.querySelector('input[type="hidden"][name="amount"]');
      out.amount = hidden ? hidden.value : String(unit);
      out.quantity = String(state.qty);
    } else {
      const v = state.value || 0;
      const text = Number.isInteger(v) ? String(v) : v.toFixed(Math.max(decimals, 2)).replace(/0+$/, '').replace(/\.$/, '');
      out.amount = text.replace('.', currency.decimalSeparator);
    }
    detailsInputs().forEach((input) => {
      if (input.disabled) {
        return;
      }
      if (input.type === 'checkbox') {
        if (input.checked) {
          out[input.name] = '1';
        }
        return;
      }
      out[input.name] = input.type === 'tel' ? phoneValue(input) : input.value.trim();
    });
    return out;
  };

  /**
   * Sunucu alan hataları: en erken hatalı adıma döner, tek satırda ilk iletiyi gösterir.
   *
   * @param {Record<string, string>} errors Alan adı -> ileti.
   */
  const serverErrors = (errors) => {
    const names = Object.keys(errors);
    const amountSide = names.find((name) => ['amount', 'quantity'].includes(name));
    if (amountSide) {
      show(0);
      setError(0, errors[amountSide], amountIn ? [amountIn] : []);
      return;
    }
    const fields = names.map((name) => form.querySelector(`[name="${name}"]`)).filter(Boolean);
    show(1);
    setError(1, errors[names[0]] || ds.msgInvalid || '', fields);
  };

  // ---- Ödeme adımı ----
  let layer = null;
  let frame = null;
  let body = null;
  let alt = null;

  const onFrameLoad = () => {
    const probe = probeFrame(frame);
    if (probe && probe.blank) {
      return;
    }
    if (body) {
      body.removeAttribute('data-loading');
    }
    const status = frameState(probe);
    if (alt) {
      alt.classList.toggle('is-alert', status === 'unknown');
    }
    if (status === 'paid') {
      paid();
    }
  };

  const ensureFrame = () => {
    if (frame || !layer || !layer.build()) {
      return Boolean(frame);
    }
    frame = paySection.querySelector('[data-dp-cframe]');
    body = paySection.querySelector('[data-dp-cpaybody]');
    alt = paySection.querySelector('[data-dp-cpayalt]');
    if (frame) {
      frame.addEventListener('load', onFrameLoad);
    }
    return Boolean(frame);
  };

  const loadFrame = (url) => {
    const target = embedUrl(url, window.location.origin);
    if (!target || !ensureFrame()) {
      // Ödeme adresi başka kökende ya da katman yok: üst pencerede standart ödeme sayfası.
      window.location.assign(url);
      return;
    }
    if (alt) {
      alt.href = url;
      alt.classList.remove('is-off');
    }
    if (body) {
      body.setAttribute('data-loading', '1');
    }
    frame.src = target;
  };

  function paid() {
    state.round += 1;
    state.payUrl = '';
    const thanks = form.querySelector('[data-dp-cthanks]');
    if (thanks) {
      thanks.textContent = fill(thanks.dataset.text || '', [state.value !== null ? money(state.value) : '', thanks.dataset.title || '']);
    }
    const finish = () => {
      if (frame) {
        frame.src = 'about:blank';
      }
      if (body) {
        body.setAttribute('data-loading', '1');
      }
      if (alt) {
        alt.classList.add('is-off');
      }
      show(3);
      if (live && ds.msgPaid) {
        live.textContent = ds.msgPaid;
      }
      refreshCampaign();
    };
    if (layer && layer.isOpen()) {
      root.addEventListener('dp:closed', finish, { once: true });
      layer.close();
    } else {
      finish();
    }
  }

  const closeLayer = () => {
    if (layer) {
      layer.close();
    }
  };

  /**
   * Sunucu yanıtı: alan hataları adımına döner; doğrudan bağışta ödeme sayfası katmandaki çerçevede, sepet akışında üst
   * pencerede açılır.
   *
   * @param {{ok: boolean, errors?: Record<string, string>, checkoutUrl?: string, rate?: boolean}} outcome Sonuç.
   */
  const handleOutcome = (outcome) => {
    if (outcome.errors) {
      closeLayer();
      serverErrors(outcome.errors);
      return;
    }
    const target = outcome.ok ? outcome.checkoutUrl || (direct ? '' : root.dataset.dpCheckout) : '';
    if (!target) {
      throw new Error(outcome.rate ? 'rate' : 'failed');
    }
    if (!direct) {
      window.location.assign(target);
      return;
    }
    state.payUrl = target;
    loadFrame(target);
  };

  const pay = async () => {
    // Katman aynı siparişin ödeme sayfasıyla yeniden açıldıysa yeni istek yok.
    if (state.busy || (direct && state.payUrl)) {
      return;
    }
    state.busy = true;
    payButton.classList.add('is-loading');
    setError(2, '');
    try {
      handleOutcome(await addToCart(root, root.dataset.dpProduct, values(), direct, state.round ? `#${state.round}` : ''));
    } catch (error) {
      closeLayer();
      setError(2, (error && error.message === 'rate' ? ds.msgRate : ds.msgFailed) || '');
    } finally {
      state.busy = false;
      payButton.classList.remove('is-loading');
    }
  };

  if (direct && paySection && payButton) {
    // Katman (popup / mobilde alttan panel) ödeme düğmesine bağlanır; açılış anında, sipariş isteği beklenmeden.
    payButton.setAttribute('data-dp-open', '');
    layer = createLayer(paySection);
  }

  // ---- Gezinme ----
  form.querySelectorAll('[data-dp-cback]').forEach((button) => {
    button.addEventListener('click', () => {
      setError(state.step, '');
      show(moveStep(state.step, -1));
    });
  });
  const again = form.querySelector('[data-dp-cagain]');
  if (again) {
    again.addEventListener('click', () => reset(true));
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.step === 0) {
      const { error } = amount();
      if (error) {
        setError(0, amountMessage(error), amountIn ? [amountIn] : []);
        if (amountIn) {
          amountIn.focus();
        } else if (quick[0]) {
          quick[0].focus();
        }
        return;
      }
      setError(0, '');
      show(1);
      return;
    }
    if (state.step === 1) {
      if (!validateDetails()) {
        return;
      }
      setError(1, '');
      const name = form.querySelector('[data-dp-crecap-name]');
      const nameInput = form.querySelector('input[name="donation_full_name"]');
      if (name) {
        name.textContent = nameInput ? nameInput.value.trim() : '';
      }
      // Sürüm değişince (tutar/bilgi) eski ödeme sayfası kullanılmaz; aynı içerik aynı siparişi bulur (sunucu).
      state.payUrl = '';
      show(2);
      return;
    }
    if (state.step === 2) {
      pay();
    }
  });

  // ---- Kampanya çubuğu: teşekkürde tek hafif istek (herkese açık, önbelleklenebilir REST) ----
  function refreshCampaign() {
    const blocks = Array.from(root.querySelectorAll('[data-dp-ccamp]'));
    if (!blocks.length || !root.dataset.dpRest) {
      return;
    }
    window
      .fetch(`${root.dataset.dpRest}progress/${Number(root.dataset.dpProduct)}`, { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) {
          blocks.forEach((block) => paintCampaign(block, data));
        }
      })
      .catch(() => undefined);
  }

  /**
   * @param {HTMLElement} block Kampanya bloğu.
   * @param {object}      data  `progress/{id}` yanıtı.
   */
  function paintCampaign(block, data) {
    const cur = data.currency || {};
    const fmt = (v) => formatTotal(Number(v) || 0, cur.symbol ?? symbol, Number(cur.decimals ?? decimals), locale);
    const zero = !(Number(data.raised) > 0);
    const pct = percentOf(data.percent);
    block.dataset.zero = zero ? '1' : '0';
    const set = (selector, text, hidden) => {
      const node = block.querySelector(selector);
      if (node) {
        if (text !== null) {
          node.textContent = text;
        }
        node.hidden = hidden;
      }
    };
    set('[data-dp-craised]', fmt(data.raised), false);
    set('[data-dp-craised-row]', null, zero);
    set('[data-dp-cfirst]', null, !zero);
    set('[data-dp-cpct]', `${pct}%`, zero);
    const bar = block.querySelector('[data-dp-cbar]');
    if (bar) {
      bar.setAttribute('aria-valuenow', String(pct));
      const fillBar = bar.querySelector('span');
      if (fillBar) {
        fillBar.style.inlineSize = `${pct}%`;
      }
    }
    const donors = block.querySelector('[data-dp-cdonors]');
    if (donors) {
      const text = donorsText(data.donors, donors.dataset.one || '', donors.dataset.many || '', locale);
      donors.textContent = text;
      donors.hidden = text === '';
    }
  }

  // ---- Kaydırıcı uyumu ----
  isolate(root);
  if (root.dataset.dpReset === '1' && 'IntersectionObserver' in window) {
    let seen = false;
    const observer = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          seen = true;
        } else if (seen && state.step > 0 && !state.busy && !(layer && layer.isOpen())) {
          reset(false);
        }
      });
    });
    observer.observe(root);
  }

  paint();
  show(0, false);
  root.dataset.dpReady = '1';
  return { show, reset, getState: () => ({ ...state }) };
}
