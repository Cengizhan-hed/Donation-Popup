/**
 * Compact bağış kartı denetleyicisi (slider/hero): adımlar aynı grid hücresinde; yükseklik CSS ile sabittir, burada ölçüm
 * YOKTUR. Pasif adımlar `inert` + `aria-hidden`. Ödeme davranışı HER ZAMAN sepetlidir: son adımın düğmesi bağışı sepete ekler
 * ve üst pencerede WooCommerce ödeme sayfasını açar (doğrudan bağış, ödeme adımı ve çerçeve bu düzende yoktur). Serbest tutar
 * 2 adım (tutar → ad/telefon), sabit fiyat tek ekran. Toplam yalnız ana düğmede ("Ödemeye geç · £X") anında güncellenir.
 */
import { addToCart, phoneValue } from '../experiences/form.mjs';
import { phoneBad, phoneBind } from '../ui2-shared/phone-lazy.mjs';
import { formatTotal } from '../experiences/store.mjs';
import { REVEAL_GAP_PX, TEXT_FIELD } from '../experiences/keyboard.mjs';
import { ISOLATED_EVENTS, STEPS, announcement, effectLine, evaluateAmount, fill, horizontalWheel, moveStep } from './logic.mjs';

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
 * Dokunmatik cihazda ekran klavyesi açılınca odaktaki alanın satırı klavyenin üstünde en az 12 px boşluk bırakır (sayfa
 * kaydırılır; kart içinde ölçüm/yerleşim değişikliği yok).
 *
 * @param {HTMLFormElement} form Kart formu.
 */
function bindKeyboardGap(form) {
  const vv = window.visualViewport;
  if (!vv || !window.matchMedia('(pointer: coarse)').matches) {
    return;
  }
  const reveal = () => {
    const field = document.activeElement;
    if (!(field instanceof Element) || !form.contains(field) || !field.matches(TEXT_FIELD)) {
      return;
    }
    const row = field.closest('.donation-panel-compact__field') || field;
    const over = row.getBoundingClientRect().bottom - (vv.offsetTop + vv.height - REVEAL_GAP_PX);
    if (over > 0) {
      window.scrollBy(0, over);
    }
  };
  form.addEventListener('focusin', () => window.setTimeout(reveal, 320));
  vv.addEventListener('resize', reveal);
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
    total: Number(ds.steps) || (ds.kind === 'fixed' ? 1 : 2),
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
 * @param {HTMLElement} root Kart kökü ([data-dp-compact]).
 * @return {{show: Function, reset: Function, getState: Function}|null} Denetleyici.
 */
export function createCompact(root) {
  const form = root.querySelector('[data-dp-cform]');
  if (!form) {
    return null;
  }
  const ds = form.dataset;
  const { fixed, total, decimals, currency, locale, symbol, unit, qtyMax, tiers } = readConfig(ds);
  // Sabit fiyatta yalnız tek ekran vardır ("amount"); serbest tutarda ikinci bölüm "details" (null olabilir).
  const sections = STEPS.map((id) => form.querySelector(`[data-dp-cstep="${id}"]`));
  // Ad/telefon alanlarının bulunduğu adım: serbest tutarda "details" (1); sabit fiyatta tek ekran (0).
  const detailsAt = fixed ? 0 : 1;
  const effect = form.querySelector('[data-dp-ceffect]');
  const amountNodes = Array.from(form.querySelectorAll('[data-dp-camount]'));
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
  const payDefault = payLabel ? payLabel.textContent : '';
  const state = { step: 0, qty: 1, quick: null, busy: false, value: null };

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
    setText(nextLabel, (pending ? ds.labelChoose : ds.labelNext) || '');
  };

  /** Seçilen tutar: üst bölge, ödeme düğmesindeki toplam (adet/tutar değişince anında), etki satırı. */
  const paintAmount = () => {
    const shown = state.value !== null ? money(state.value) : '';
    amountNodes.forEach((node) => setText(node, shown));
    if (payLabel && payButton) {
      setText(payLabel, shown !== '' ? fill(payButton.dataset.label || '', [shown]) : payDefault);
    }
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

  const paint = () => {
    const { value, error } = amount();
    state.value = error ? null : value;
    paintNext(error !== '');
    paintAmount();
    paintQty();
    // İlk çizimde değil, bağışçı seçtiğinde (önerilen tutar kendiliğinden önizlenmez).
    // (Kart tembel kurulur: `data-dp-ready` yüklemede yazılır; ilk çizim ayrımı yerel bayrakla.)
    if (state.mounted) {
      emitAmount(state.value || 0);
    }
  };

  /**
   * Adımı gösterir: diğeri `inert` + `aria-hidden` (görünmez ama yer kaplar: yükseklik sabit). Odak yeni adımın başlığına
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
      live.textContent = announcement(ds.msgStep || '', index, section.dataset.stepName || '', total);
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

  // ---- Ad/telefon alanları ----
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
      return (input.required && input.value.trim() === '') || off.includes(input);
    });
    if (!bad.length) {
      return true;
    }
    const first = bad[0];
    const message = first.value.trim() === '' ? first.dataset.requiredMsg || ds.msgInvalid : first.dataset.msgShort || ds.msgInvalid;
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
    if (amountSide && !fixed) {
      show(0);
      setError(0, errors[amountSide], amountIn ? [amountIn] : []);
      return;
    }
    const fields = names.map((name) => form.querySelector(`[name="${name}"]`)).filter(Boolean);
    show(detailsAt);
    setError(detailsAt, errors[names[0]] || ds.msgInvalid || '', fields);
  };

  // ---- Sepete ekle ve ödeme sayfasına geç ----
  /**
   * Sunucu yanıtı: alan hataları kendi adımına döner; başarıda üst pencerede WooCommerce ödeme sayfası açılır.
   *
   * @param {{ok: boolean, errors?: Record<string, string>, checkoutUrl?: string, rate?: boolean}} outcome Sonuç.
   */
  const handleOutcome = (outcome) => {
    if (outcome.errors) {
      serverErrors(outcome.errors);
      return;
    }
    const target = outcome.ok ? outcome.checkoutUrl || root.dataset.dpCheckout : '';
    if (!target) {
      throw new Error(outcome.rate ? 'rate' : 'failed');
    }
    window.location.assign(target);
  };

  const pay = async () => {
    if (state.busy || !payButton) {
      return;
    }
    const at = state.step;
    state.busy = true;
    payButton.classList.add('is-loading');
    setError(at, '');
    try {
      handleOutcome(await addToCart(root, root.dataset.dpProduct, values(), false, ''));
    } catch (error) {
      setError(state.step, (error && error.message === 'rate' ? ds.msgRate : ds.msgFailed) || '');
    } finally {
      state.busy = false;
      payButton.classList.remove('is-loading');
    }
  };

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
      show(moveStep(state.step, -1));
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    // Sabit fiyatta tutar adımı yok: ilk ekran doğrudan ad/telefon ekranıdır.
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
    if (validateDetails()) {
      setError(detailsAt, '');
      pay();
    }
  });

  // ---- Ekran klavyesi (124-kbd): kart akışta durur, sabit alt çubuğu yoktur; yalnız sayfa kaydırılır ----
  bindKeyboardGap(form);

  // ---- Kaydırıcı uyumu ----
  isolate(root);
  if (root.dataset.dpReset === '1' && 'IntersectionObserver' in window) {
    let seen = false;
    const observer = new window.IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          seen = true;
        } else if (seen && state.step > 0 && !state.busy) {
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
