/**
 * Compact bağış kartı denetleyicisi: adımlar aynı grid hücresinde; yükseklik CSS ile sabittir, burada ölçüm YOKTUR. Pasif
 * adımlar `inert` + `aria-hidden`. Sepetli akış 2 adım (tutar → bilgiler; bilgiler adımının düğmesi sepete ekleyip üst
 * pencerede ödeme sayfasını açar). Doğrudan akış 3 adım (tutar → bilgiler → ödeme) + teşekkür: order-pay sayfası mevcut
 * katmanda (popup / alttan panel) aynı kökenli çerçevede.
 */
import { addToCart, phoneValue } from '../experiences/form.mjs';
import { phoneBad, phoneBind } from '../ui2-shared/phone-lazy.mjs';
import { formatTotal } from '../experiences/store.mjs';
import { createLayer } from '../experiences/layer.mjs';
import { REVEAL_GAP_PX, TEXT_FIELD } from '../experiences/keyboard.mjs';
import { ISOLATED_EVENTS, STEPS, announcement, backStep, countedStep, effectLine, embedUrl, evaluateAmount, fill, frameState, horizontalWheel } from './logic.mjs';

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
  let tiers;
  try {
    tiers = ds.impact ? JSON.parse(ds.impact) : [];
  } catch {
    tiers = [];
  }
  return {
    fixed: ds.kind === 'fixed',
    direct: ds.direct === '1',
    total: Number(ds.steps) || (ds.direct === '1' ? 3 : 2) - (ds.kind === 'fixed' ? 1 : 0),
    decimals,
    currency: { decimals, thousandSeparator: ds.thousandSep ?? ',', decimalSeparator: ds.decimalSep ?? '.' },
    locale: document.documentElement.lang || undefined,
    symbol: ds.symbol || '',
    unit: Number(ds.unit || 0),
    qtyMax: Math.max(1, Number(ds.qtyMax || 1)),
    tiers: Array.isArray(tiers) ? tiers : [],
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
  const { fixed, direct, total, decimals, currency, locale, symbol, unit, qtyMax, tiers } = readConfig(ds);
  // Sepetli akışta ödeme/teşekkür adımı çizilmez (null).
  const sections = STEPS.map((id) => form.querySelector(`[data-dp-cstep="${id}"]`));
  // Bilgi alanlarının bulunduğu adım: serbest tutarda "bilgiler" (1); sabit fiyatta tek ekran (0, ayrı tutar adımı yok).
  const detailsAt = fixed ? 0 : 1;
  const effect = form.querySelector('[data-dp-ceffect]');
  const totalOut = form.querySelector('[data-dp-ctotal]');
  const amountNodes = Array.from(form.querySelectorAll('[data-dp-camount], [data-dp-crecap-amount]'));
  /**
   * Metni yalnız değiştiyse yazar (gereksiz DOM değişikliği ve yeniden yerleşim yok).
   *
   * @param {Element|null} node Öğe.
   * @param {string}       text Metin.
   */
  const setText = (node, text) => {
    if (node && node.textContent !== text) {
      node.textContent = text;
    }
  };
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

  // WooCommerce ayırıcılarıyla; tam sayıda ondalık yok.
  const money = (value) => formatTotal(value, symbol, decimals, locale, { thousands: currency.thousandSeparator, decimal: currency.decimalSeparator });
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
      // Hata, güven satırının yerini alır (aynı ayrılmış satır; yükseklik değişmez).
      if (node.parentElement) {
        node.parentElement.classList.toggle('has-err', Boolean(message));
      }
    }
    section.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
    fields.forEach((el) => el.setAttribute('aria-invalid', 'true'));
  };

  /** Ana düğme: tutar geçerli olana kadar pasif ("Tutar seçin"). */
  const paintNext = (pending) => {
    if (nextButton && nextButton.getAttribute('aria-disabled') !== (pending ? 'true' : 'false')) {
      nextButton.setAttribute('aria-disabled', pending ? 'true' : 'false');
      nextButton.classList.toggle('is-pending', pending);
    }
    setText(nextLabel, (pending && !fixed ? ds.labelChoose : ds.labelNext) || '');
  };

  /** Seçilen tutar: üst bölgeler, özet, ödeme düğmesi. */
  const paintAmount = () => {
    const shown = state.value !== null ? money(state.value) : '';
    amountNodes.forEach((node) => setText(node, shown));
    if (payLabel && payButton) {
      setText(payLabel, shown !== '' ? fill(payButton.dataset.label || '', [shown]) : payDefault);
    }
    // Yalnız değişince yazılır (ilk çizimde sunucu metni aynıdır: DOM/yerleşim işi yok).
    setText(totalOut, shown !== '' ? shown : '—');
    if (tiers.length) {
      setText(effect, effectLine(state.value, tiers, locale));
    }
  };

  /**
   * Kampanya çubuğunun kişisel önizlemesi (ortak canlı çubuk; yalnız bu tarayıcı): seçilen tutarı bildirir.
   *
   * @param {number} value Tutar (0: önizleme yok).
   */
  const emitAmount = (value) => {
    if (state.emitted !== value) {
      state.emitted = value;
      root.dispatchEvent(new CustomEvent('donation-panel:amount', { bubbles: true, detail: { productId: Number(root.dataset.dpProduct), amount: value } }));
    }
  };

  const paint = () => {
    const { value, error } = amount();
    state.value = error ? null : value;
    paintNext(error !== '');
    paintAmount();
    paintQty();
    // İlk çizimde değil, bağışçı seçtiğinde (önerilen tutar kendiliğinden önizlenmez).
    // (Kart tembel kurulur: `data-dp-ready` yüklemede yazılır; ilk çizim ayrımı yerel bayrakla.)
    if (state.mounted && state.step < 3) {
      emitAmount(state.value || 0);
    }
  };

  const paintQty = () => {
    if (qtyIn) {
      qtyIn.value = String(state.qty);
    }
    setText(qtyOut, String(state.qty));
    qtyButtons.forEach((button) => {
      const off = Number(button.dataset.dpCqty) < 0 ? state.qty <= 1 : state.qty >= qtyMax;
      if (button.disabled !== off) {
        button.disabled = off;
      }
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
    if (index !== detailsAt) {
      // Beyan katmanı açıksa kapanır (show yalnız kurulumdan sonra çağrılır).
      closeSheet();
    }
    state.step = index;
    sections.forEach((section, i) => {
      if (!section) {
        return;
      }
      const on = i === index;
      // Durum zaten doğruysa dokunulmaz (ilk çizimde sunucu durumu aynıdır).
      if (section.classList.contains('is-on') === on && section.hasAttribute('inert') === !on) {
        return;
      }
      section.classList.toggle('is-on', on);
      section.toggleAttribute('inert', !on);
      if (on) {
        section.removeAttribute('aria-hidden');
      } else {
        section.setAttribute('aria-hidden', 'true');
      }
    });
    if (root.dataset.dpStep !== STEPS[index]) {
      root.dataset.dpStep = STEPS[index];
    }
    const section = sections[index];
    if (focus && section) {
      const title = section.querySelector('[data-dp-ctitle]');
      if (title) {
        title.focus({ preventScroll: true });
      }
    }
    if (live && section && focus) {
      live.textContent = announcement(ds.msgStep || '', countedStep(fixed, index), section.dataset.stepName || '', total);
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
  // Gizli alanlar (sabit fiyatın tutar/adedi) bilgi değildir.
  const detailsInputs = () => Array.from(sections[detailsAt] ? sections[detailsAt].querySelectorAll('input[name]:not([type="hidden"])') : []);
  detailsInputs().forEach((input) => {
    input.addEventListener('input', () => {
      if (input.getAttribute('aria-invalid') === 'true') {
        setError(detailsAt, '');
      }
    });
  });

  // Telefon: yazarken biçimleme/sınır (ortak `phone.mjs`); eksik hane iletisi odak çıkınca, mobil önek yalnız uyarı;
  // dolu ama eksik numarada "devam" düğmesi geçerli olana kadar pasif.
  let phoneMessageOn = false;
  // Kurallar tembel pakettedir (ilk odak/yazma/otomatik doldurmada yüklenir); çekirdekte yalnız bu bağlam
  // (devam düğmesinin pasifliğini paket kendisi yönetir; soluk görünümü `.donation-panel-btn[aria-disabled="true"]` verir).
  phoneBind(form, {
    // Hata satırı: eksik hane (alan geçersiz işaretli: bad) ya da yalnız uyarı (işaretsiz, devam engellenmez).
    say: (input, message, bad) => {
      if (message || phoneMessageOn) {
        phoneMessageOn = !!message;
        setError(detailsAt, message, bad ? [input] : []);
      }
    },
  });

  const validateDetails = () => {
    const off = phoneBad(sections[detailsAt]);
    const bad = detailsInputs().filter((input) => {
      if (input.type === 'checkbox' || input.disabled) {
        return false;
      }
      const value = input.value.trim();
      if (input.required && value === '') {
        return true;
      }
      return off.includes(input) || value !== '' && input.type === 'email' && input.validity && input.validity.typeMismatch;
    });
    if (!bad.length) {
      return true;
    }
    const first = bad[0];
    const message = first.value.trim() === '' ? first.dataset.requiredMsg || ds.msgInvalid : first.dataset.msgShort || ds.msgEmail || ds.msgInvalid;
    setError(detailsAt, message || '', bad);
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
    show(detailsAt);
    setError(detailsAt, errors[names[0]] || ds.msgInvalid || '', fields);
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
    if (state.busy || (direct && state.payUrl) || !payButton) {
      return;
    }
    const at = state.step;
    state.busy = true;
    payButton.classList.add('is-loading');
    setError(at, '');
    try {
      handleOutcome(await addToCart(root, root.dataset.dpProduct, values(), direct, state.round ? `#${state.round}` : ''));
    } catch (error) {
      closeLayer();
      setError(state.step, (error && error.message === 'rate' ? ds.msgRate : ds.msgFailed) || '');
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

  /** Ödeme adımı özeti: ad, e-posta (yazıldıysa), vergi indirimi beyanı (verildiyse). */
  function fillRecap() {
    const text = (name) => {
      const input = form.querySelector(`input[name="${name}"]`);
      return input ? input.value.trim() : '';
    };
    const name = form.querySelector('[data-dp-crecap-name]');
    if (name) {
      name.textContent = text('donation_full_name');
    }
    const email = form.querySelector('[data-dp-crecap-email]');
    const emailRow = form.querySelector('[data-dp-crecap-email-row]');
    if (email && emailRow) {
      email.textContent = text('donation_email');
      emailRow.hidden = email.textContent === '';
    }
    const taxRow = form.querySelector('[data-dp-crecap-tax-row]');
    const tax = form.querySelector('[data-dp-ctax]');
    if (taxRow) {
      taxRow.hidden = !(tax && tax.checked);
    }
  }

  // ---- Vergi indirimi beyanının tam metni: kart içi katman (yükseklik değişmez); Esc / "Tamam" kapatır, odak geri döner ----
  const taxMore = form.querySelector('[data-dp-ctax-more]');
  const taxSheet = form.querySelector('[data-dp-ctax-sheet]');
  const setSheet = (open, focus = true) => {
    if (!taxMore || !taxSheet) {
      return;
    }
    taxSheet.classList.toggle('is-open', open);
    taxSheet.toggleAttribute('inert', !open);
    taxMore.setAttribute('aria-expanded', open ? 'true' : 'false');
    // Katman açıkken arkasındaki adım içeriği erişilemez (yalnız katman).
    Array.from(taxSheet.parentElement.children).forEach((child) => {
      if (child !== taxSheet) {
        child.toggleAttribute('inert', open);
      }
    });
    if (focus) {
      (open ? taxSheet : taxMore).focus({ preventScroll: true });
    }
  };
  function closeSheet() {
    if (taxSheet && taxSheet.classList.contains('is-open')) {
      setSheet(false, false);
    }
  }
  if (taxMore && taxSheet) {
    taxMore.addEventListener('click', () => setSheet(true));
    const done = taxSheet.querySelector('[data-dp-ctax-close]');
    if (done) {
      done.addEventListener('click', () => setSheet(false));
    }
    taxSheet.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSheet(false);
      }
    });
  }

  // ---- Gezinme ----
  form.querySelectorAll('[data-dp-cback]').forEach((button) => {
    button.addEventListener('click', () => {
      setError(state.step, '');
      show(backStep(fixed, state.step));
    });
  });
  const again = form.querySelector('[data-dp-cagain]');
  if (again) {
    again.addEventListener('click', () => reset(true));
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    // Sabit fiyatta tutar adımı yok: ilk ekran doğrudan bilgiler adımıdır.
    if (state.step === 0 && !fixed) {
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
    if (state.step === detailsAt) {
      if (!validateDetails()) {
        return;
      }
      setError(detailsAt, '');
      if (!direct) {
        // Sepetli akışın son adımı: sepete ekler, ödeme sayfasına geçer.
        pay();
        return;
      }
      fillRecap();
      // Sürüm değişince (tutar/bilgi) eski ödeme sayfası kullanılmaz; aynı içerik aynı siparişi bulur (sunucu).
      state.payUrl = '';
      show(2);
      return;
    }
    if (state.step === 2) {
      pay();
    }
  });

  // ---- Kampanya çubuğu: teşekkürde ortak canlı çubuk tek hafif istekle gerçek toplamı alır; önizleme dolumla birleşir ----
  function refreshCampaign() {
    const paidAmount = state.value || 0;
    emitAmount(0);
    root.dispatchEvent(
      new CustomEvent('donation-panel:progress-refresh', { bubbles: true, detail: { productId: Number(root.dataset.dpProduct), amount: paidAmount } })
    );
  }

  // ---- Ekran klavyesi (124-kbd): odaktaki alanın (satırı) alt kenarı ile klavyenin üst kenarı arasında ≥12 px boşluk. Kart
  // sayfada akışta durur, sabit alt çubuğu yoktur (gizlenecek bölüm yok; yükseklik/yerleşim değişmez); yalnız sayfa kaydırılır. ----
  const vv = window.visualViewport;
  const reveal = () => {
    const field = document.activeElement;
    if (!vv || !(field instanceof Element) || !form.contains(field) || !field.matches(TEXT_FIELD)) {
      return;
    }
    const row = field.closest('.donation-panel-compact__field') || field;
    const over = row.getBoundingClientRect().bottom - (vv.offsetTop + vv.height - REVEAL_GAP_PX);
    if (over > 0) {
      window.scrollBy(0, over);
    }
  };
  if (vv && window.matchMedia('(pointer: coarse)').matches) {
    form.addEventListener('focusin', () => window.setTimeout(reveal, 320));
    vv.addEventListener('resize', reveal);
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
  state.mounted = true;
  root.dataset.dpReady = '1';
  return { show, reset, getState: () => ({ ...state }) };
}
