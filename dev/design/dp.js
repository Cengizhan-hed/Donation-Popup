/* Donation Panel — prototip çekirdeği (yalnız tasarım prototipi; eklenti kodu değildir).
 * Dil/tema/koyu mod URL parametreleriyle: ?lang=tr|en|ar &theme=avada|blocksy|tt25|storefront|neutral &scheme=dark &open=0 */
(function () {
  const q = new URLSearchParams(location.search);
  const S = { lang: q.get('lang') || 'tr', theme: q.get('theme') || 'neutral', scheme: q.get('scheme') || '', open: q.get('open') !== '0' };
  const root = document.documentElement;
  root.lang = S.lang; root.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
  root.dataset.theme = S.theme; if (S.scheme) root.dataset.dpScheme = S.scheme;

  /* ---------- Simgeler (kendi çizimimiz, 24x24 çizgi) ---------- */
  const P = {
    x: 'M18 6 6 18M6 6l12 12', check: 'M20 6 9 17l-5-5', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
    heart: 'M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 21.8l8.8-8.8a5.2 5.2 0 0 0 0-7.4z',
    lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6',
    cart: 'M3 4h2l2.4 11h10.2L20 8H6.2M9 20a1 1 0 1 0 0 .01M17 20a1 1 0 1 0 0 .01', drop: 'M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11z',
    box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10', chevron: 'M9 6l6 6-6 6', chevdown: 'M6 9l6 6 6-6', back: 'M15 6l-6 6 6 6', alert: 'M12 8v5M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    info: 'M12 16v-5M12 8h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', users: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a3.5 3.5 0 0 1 0 6.8',
    flag: 'M5 21V4M5 4h11l-2 4 2 4H5', gift: 'M20 12v9H4v-9M2 7h20v5H2zM12 7v14M12 7S10 3 7.5 3a2.2 2.2 0 0 0 0 4.4M12 7s2-4 4.5-4a2.2 2.2 0 0 1 0 4.4',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6', repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
    download: 'M12 3v12m0 0-4-4m4 4 4-4M4 21h16', settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    home: 'M3 11l9-8 9 8M5 10v10h14V10', sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2 2 .7-2 .7L19 21l-.7-2-2-.7 2-.7z', tag: 'M20 12l-8 8-9-9V3h8zM7.5 7.5h.01', menu: 'M4 7h16M4 12h16M4 17h16', mail: 'M3 6h18v12H3zM3 7l9 6 9-6', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', copy: 'M9 9h11v11H9zM5 15H4V4h11v1', share: 'M4 12v7h16v-7M12 3v12M8 7l4-4 4 4',
    plug: 'M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5', globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18', play: 'M7 4l13 8-13 8z', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'
  };
  const ico = (n, cls = '') => `<svg class="dp-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${P[n] || ''}"/></svg>`;

  /* ---------- Çeviri ---------- */
  const D = { tr: {}, en: {}, ar: {} };
  const add = (lang, o) => Object.assign(D[lang], o);
  const t = (k, v) => { let s = (D[S.lang] && D[S.lang][k]) ?? D.en[k] ?? k; if (v) for (const x in v) s = s.replaceAll('{' + x + '}', v[x]); return s; };
  add('tr', {
    close: 'Kapat', back: 'Geri', next: 'Devam', pay: 'Ödemeye geç', donate: 'Bağış yap', donateNow: 'Hemen bağış yap', total: 'Toplam', step: 'Adım {a}/{b}', stAmount: 'Tutar', stDetails: 'Bilgileriniz', stTax: 'Vergi indirimi',
    projName: 'Su Kuyusu Hissesi', projMeta: 'Sahada hayata geçirilir, bağışçıya video gönderilir', formTitle: 'Bağışınızı seçin', formSub: 'Birkaç dokunuşta tamamlayın.',
    once: 'Tek seferlik', monthly: 'Aylık', chooseAmount: 'Bağış tutarı', other: 'Diğer tutar', otherLabel: 'Kendi tutarınız', popular: 'En çok tercih edilen',
    impact1: '1 gıda kolisi', impact2: '1 aile için su kuyusu hissesi', impact3: '5 aileye kışlık yardım', impact4: '1 yetim için aylık destek', impact0: 'Tutarı siz belirleyin',
    feeCover: 'İşlem ücretini ben karşılayayım', feeHint: 'Yaklaşık {fee} ekleyerek bağışın tamamının ulaşmasına yardım edin. İsteğe bağlı.',
    secure: 'Güvenli ödeme', receipt: 'Makbuz e-postayla', video: 'Bağışçıya video',
    fName: 'Ad soyad', fEmail: 'E-posta', fPhone: 'Telefon', fTribute: 'Bir ithaf ekle', fOnBehalf: 'Kim adına', fNote: 'İthaf notu', opt: '(isteğe bağlı)',
    hEmail: 'Makbuzu ve bağış raporunu bu adrese göndereceğiz.', hPhone: 'Gerekirse sahadan sizi arayabiliriz.', hName: 'Makbuzda görünecek ad.',
    eAmount: 'Lütfen en az {min} tutarında bir bağış seçin.', eName: 'Lütfen adınızı ve soyadınızı yazın.', eEmail: 'Geçerli bir e-posta yazın, örneğin ad@alanadi.com.', ePhone: 'Telefon numarası eksik görünüyor.', eFix: '{n} alanı düzeltin.',
    privacy: 'Devam ederek {link} kabul etmiş olursunuz.', privacyLink: 'gizlilik politikasını',
    summary: 'Özet', donation: 'Bağış', fee: 'İşlem ücreti',
    redirecting: 'Ödeme sayfasına geçiliyor', redirectingSub: 'Bu bir tasarım prototipidir; gerçek ödeme yapılmaz.', seeThanks: 'Teşekkür ekranını gör',
    taxQ: 'Bağışınız için vergi indirimi talep edilsin mi?', taxYes: 'Evet, vergi mükellefiyim', taxNo: 'Hayır', taxYesH: 'Bağışınıza %25 ek katkı sağlanır; size maliyeti yok.', taxNoH: 'Bağışınız aynen tamamlanır.',
    taxDecl: 'Bu bağışın ve bugünden önceki 4 yıldaki bağışlarımın vergi indirimi için uygun olduğunu, ödediğim vergi tutarının talep edilen indirimi karşıladığını beyan ederim.', fAddr: 'Adres', fPost: 'Posta kodu', taxRemember: 'Yanıtınız bir sonraki bağışta hatırlanır. Son adımda değiştirebilirsiniz.',
    loading: 'Yükleniyor', emptyT: 'Henüz bağış yok', emptyP: 'İlk bağış sizden gelsin; bu alan bağışlar geldikçe dolacak.', errT: 'Bir şeyler ters gitti', errP: 'Bağlantı koptu. Verileriniz kaybolmadı, tekrar deneyebilirsiniz.', retry: 'Tekrar dene',
    skip: 'İçeriğe geç'
  });
  add('en', {
    close: 'Close', back: 'Back', next: 'Continue', pay: 'Go to payment', donate: 'Donate', donateNow: 'Donate now', total: 'Total', step: 'Step {a} of {b}', stAmount: 'Amount', stDetails: 'Your details', stTax: 'Tax relief',
    projName: 'Water Well Share', projMeta: 'Delivered on the ground, you receive a video update', formTitle: 'Choose your gift', formSub: 'Finish in a few taps.',
    once: 'One-off', monthly: 'Monthly', chooseAmount: 'Donation amount', other: 'Other amount', otherLabel: 'Your amount', popular: 'Most chosen',
    impact1: 'Feeds a family for a week', impact2: '1 food parcel', impact3: 'A winter warmth pack', impact4: 'A share in a water well', impact0: 'Choose any amount',
    feeCover: 'I will cover the processing fee', feeHint: 'Add about {fee} so the full gift reaches the cause. Optional.',
    secure: 'Secure payment', receipt: 'Receipt by email', video: 'Video update',
    fName: 'Full name', fEmail: 'Email', fPhone: 'Phone', fTribute: 'Add a dedication', fOnBehalf: 'On behalf of', fNote: 'Dedication note', opt: '(optional)',
    hEmail: 'We will send your receipt and impact report here.', hPhone: 'Our field team may call if needed.', hName: 'The name shown on your receipt.',
    eAmount: 'Please choose a gift of at least {min}.', eName: 'Please enter your first and last name.', eEmail: 'Enter a valid email, for example name@domain.com.', ePhone: 'The phone number looks incomplete.', eFix: 'Please fix {n} field(s).',
    privacy: 'By continuing you accept our {link}.', privacyLink: 'privacy policy',
    summary: 'Summary', donation: 'Donation', fee: 'Processing fee',
    redirecting: 'Taking you to payment', redirectingSub: 'This is a design prototype; no real payment is made.', seeThanks: 'See the thank-you screen',
    taxQ: 'Would you like to claim tax relief on this gift?', taxYes: 'Yes, I am a UK taxpayer', taxNo: 'No', taxYesH: 'Adds 25% to your gift at no cost to you.', taxNoH: 'Your gift goes through as it is.',
    taxDecl: 'I confirm this gift and any gifts I made in the past 4 years are eligible, and that I have paid enough tax to cover the relief claimed.', fAddr: 'Address', fPost: 'Postcode', taxRemember: 'Your answer is remembered for next time. You can change it at the last step.',
    loading: 'Loading', emptyT: 'No donations yet', emptyP: 'Be the first; this space fills up as gifts arrive.', errT: 'Something went wrong', errP: 'The connection dropped. Nothing was lost, you can try again.', retry: 'Try again',
    skip: 'Skip to content'
  });
  add('ar', {
    close: 'إغلاق', back: 'رجوع', next: 'متابعة', pay: 'الانتقال إلى الدفع', donate: 'تبرّع', donateNow: 'تبرّع الآن', total: 'المجموع', step: 'الخطوة {a} من {b}', stAmount: 'المبلغ', stDetails: 'بياناتك',
    projName: 'سهم في بئر ماء', projMeta: 'يُنفَّذ ميدانيًا وتصلك رسالة مصوّرة', formTitle: 'اختر تبرّعك', formSub: 'أكمل بخطوات بسيطة.',
    once: 'مرة واحدة', monthly: 'شهري', chooseAmount: 'مبلغ التبرع', other: 'مبلغ آخر', otherLabel: 'مبلغك', popular: 'الأكثر اختيارًا',
    impact1: 'سلة غذائية لأسرة', impact2: 'ماء نظيف لأسرة', impact3: 'حقيبة شتوية', impact4: 'سهم في بئر', impact0: 'اختر أي مبلغ',
    feeCover: 'سأتحمل رسوم المعالجة', feeHint: 'أضف نحو {fee} ليصل التبرع كاملًا. اختياري.', secure: 'دفع آمن', receipt: 'إيصال بالبريد', video: 'رسالة مصوّرة',
    fName: 'الاسم الكامل', fEmail: 'البريد الإلكتروني', fPhone: 'الهاتف', fTribute: 'إضافة إهداء', fOnBehalf: 'نيابةً عن', fNote: 'نص الإهداء', opt: '(اختياري)',
    hEmail: 'سنرسل الإيصال والتقرير إلى هذا البريد.', hPhone: 'قد يتصل بك فريقنا الميداني عند الحاجة.', hName: 'الاسم الظاهر على الإيصال.',
    eAmount: 'اختر مبلغًا لا يقل عن {min}.', eName: 'يرجى كتابة الاسم الكامل.', eEmail: 'اكتب بريدًا صحيحًا.', ePhone: 'رقم الهاتف غير مكتمل.', eFix: 'صحّح {n} حقل.',
    privacy: 'بالمتابعة فأنت توافق على {link}.', privacyLink: 'سياسة الخصوصية', summary: 'الملخص', donation: 'التبرع', fee: 'رسوم المعالجة',
    redirecting: 'جارٍ الانتقال إلى الدفع', redirectingSub: 'هذا نموذج تصميم؛ لا يتم أي دفع حقيقي.', seeThanks: 'عرض شاشة الشكر'
  });

  /* ---------- Para / sayı ---------- */
  const CUR = { tr: ['tr-TR', 'TRY', [250, 500, 1000, 2500], 100], en: ['en-GB', 'GBP', [10, 25, 50, 100], 5], ar: ['ar-AE-u-nu-latn', 'AED', [50, 100, 250, 500], 20] }[S.lang] || ['en-GB', 'GBP', [10, 25, 50, 100], 5];
  const money = (n, frac) => new Intl.NumberFormat(CUR[0], { style: 'currency', currency: CUR[1], maximumFractionDigits: frac ?? (Number.isInteger(n) ? 0 : 2), minimumFractionDigits: frac ?? (Number.isInteger(n) ? 0 : 2) }).format(n);
  const num = n => new Intl.NumberFormat(CUR[0].replace('-u-nu-latn', '') + '-u-nu-latn').format(n);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Sayı yumuşak geçişi ---------- */
  function tween(el, from, to, fmt, ms = 420) {
    if (reduce() || from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now(); const step = now => { const k = Math.min(1, (now - t0) / ms); const e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step);
  }

  /* ---------- Katman yöneticisi ---------- */
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
  function overlay({ kind = 'modal', title = '', sub = '', body = '', foot = '', label, onClose, persistent } = {}) {
    const ov = document.createElement('div'); ov.className = `dp dp-overlay dp-overlay--${kind}`;
    const id = 'dp-t' + Math.random().toString(36).slice(2, 7);
    ov.innerHTML = `<section class="dp-surface dp-surface--${kind}" role="dialog" aria-modal="true" aria-labelledby="${id}" tabindex="-1">
      <div class="dp-surface__handle" data-handle aria-hidden="true"></div>
      <header class="dp-surface__head"><div><h2 class="dp-surface__title" id="${id}">${title}</h2>${sub ? `<p class="dp-surface__sub">${sub}</p>` : ''}</div>
      <button type="button" class="dp-iconbtn dp-surface__close" data-close aria-label="${t('close')}">${ico('x')}</button></header>
      <div class="dp-surface__body" data-body>${body}</div>${foot}</section>`;
    document.body.appendChild(ov);
    const surf = $('.dp-surface', ov); let last = null;
    const api = {
      el: ov, surf, body: $('[data-body]', ov),
      open() { last = document.activeElement; document.body.style.overflow = 'hidden'; requestAnimationFrame(() => requestAnimationFrame(() => { ov.classList.add('is-open'); surf.focus({ preventScroll: true }); })); return api; },
      close() { ov.classList.remove('is-open'); document.body.style.overflow = ''; if (last && last.focus) last.focus({ preventScroll: true }); onClose && onClose(); }
    };
    ov.addEventListener('click', e => { if (e.target === ov && !persistent) api.close(); if (e.target.closest('[data-close]')) api.close(); });
    ov.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !persistent) { e.stopPropagation(); api.close(); }
      if (e.key === 'Tab') { const f = $$(FOCUSABLE, surf).filter(x => x.offsetParent !== null); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && (document.activeElement === a || document.activeElement === surf)) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    });
    /* Sürükle-kapat: tutamaç + başlık */
    let y0 = null, dy = 0;
    const sheetish = () => matchMedia('(max-width:639.98px)').matches || kind === 'sheet';
    const down = e => { if (!sheetish()) return; y0 = e.clientY; dy = 0; surf.classList.add('is-dragging'); e.currentTarget.setPointerCapture(e.pointerId); };
    const move = e => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); surf.style.setProperty('--dp-drag', dy + 'px'); };
    const up = () => { if (y0 === null) return; y0 = null; surf.classList.remove('is-dragging'); surf.style.removeProperty('--dp-drag'); if (dy > 110 && !persistent) api.close(); };
    $$('[data-handle], .dp-surface__head', ov).forEach(h => { h.addEventListener('pointerdown', down); h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up); });
    /* Klavye açılınca görünür alan: visualViewport */
    if (window.visualViewport) { const vv = window.visualViewport; const upd = () => { const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); ov.style.setProperty('--dp-kb', kb + 'px'); ov.style.setProperty('--dp-vvh', vv.height + 'px'); }; vv.addEventListener('resize', upd); vv.addEventListener('scroll', upd); }
    ov.addEventListener('focusin', e => { if (e.target.matches('input,textarea,select')) setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' }), 260); });
    return api;
  }

  /* ---------- Form çekirdeği: popup / panel / sayfa içi / alt panel aynı kodu kullanır ---------- */
  function form(opts = {}) {
    const o = Object.assign({ subscription: false, tax: false, share: false, presets: CUR[2], min: CUR[3] / (S.lang === 'tr' ? 2 : 1), preset: 1, popular: 1, impacts: true, thanksHref: 'tesekkur.html', fee: 0.025 }, opts);
    const st = { step: 0, freq: 'once', amount: o.presets[o.preset], other: false, qty: 1, unit: o.presets[1], fee: false, tax: null };
    const steps = ['amount', 'details'].concat(o.tax ? ['tax'] : []);
    const imp = ['impact1', 'impact2', 'impact3', 'impact4'];
    const wrap = document.createElement('div'); wrap.className = 'dp dp-form'; wrap.style.cssText = 'display:flex;flex-direction:column;min-block-size:0;flex:1 1 auto;overflow:hidden';
    const total = () => (o.share ? st.unit * st.qty : st.amount || 0) * (st.fee ? 1 + o.fee : 1);
    const sum = () => (o.share ? st.unit * st.qty : st.amount || 0);
    wrap.innerHTML = `<div class="dp-steps" aria-hidden="true">${steps.map(() => '<i class="dp-steps__i"></i>').join('')}</div>
      <p class="dp-steplabel" data-steplabel aria-live="polite"></p>
      <div class="dp-surface__body" data-stepbody></div>
      <div class="dp-actionbar"><button type="button" class="dp-btn dp-btn--ghost dp-btn--back" data-back aria-label="${t('back')}" hidden>${ico('back')}</button>
        <div class="dp-actionbar__total" aria-live="polite"><small>${t('total')}</small><strong class="dp-num" data-total></strong></div>
        <button type="button" class="dp-btn dp-btn--lg" data-next></button></div>`;
    const bodyEl = $('[data-stepbody]', wrap), totalEl = $('[data-total]', wrap), nextBtn = $('[data-next]', wrap), backBtn = $('[data-back]', wrap);
    let shown = 0;
    const setTotal = () => { const v = total(); tween(totalEl, shown, v, x => money(x, Number.isInteger(Math.round(x * 100) / 100) ? 0 : 2)); shown = v; };
    const label = () => { $('[data-steplabel]', wrap).textContent = t('step', { a: st.step + 1, b: steps.length }) + ' · ' + t({ amount: 'stAmount', details: 'stDetails', tax: 'stTax' }[steps[st.step]]); $$('.dp-steps__i', wrap).forEach((e, i) => { e.className = 'dp-steps__i' + (i < st.step ? ' is-done' : i === st.step ? ' is-current' : ''); }); backBtn.hidden = st.step === 0; nextBtn.textContent = st.step === steps.length - 1 ? t('pay') : t('next'); };
    const project = () => `<div class="dp-project"><div class="dp-project__img" aria-hidden="true">${ico(o.icon || 'drop')}</div><div><p class="dp-project__name">${esc(o.project || t('projName'))}</p><p class="dp-project__meta">${esc(o.meta || t('projMeta'))}</p></div></div>`;

    function viewAmount() {
      const seg = o.subscription ? `<div class="dp-seg" role="radiogroup" aria-label="${t('once')} / ${t('monthly')}" style="--n:2;--i:${st.freq === 'once' ? 0 : 1}"><span class="dp-seg__thumb"></span>
        <button type="button" role="radio" aria-checked="${st.freq === 'once'}" data-freq="once">${t('once')}</button><button type="button" role="radio" aria-checked="${st.freq === 'monthly'}" data-freq="monthly">${t('monthly')}</button></div>` : '';
      let main;
      if (o.share) main = `<div class="dp-qty"><div class="dp-qty__label">${t('projName')}<small class="dp-num">${money(st.unit)} / ${S.lang === 'tr' ? 'hisse' : S.lang === 'ar' ? 'سهم' : 'share'}</small></div>
        <div class="dp-stepper" role="group" aria-label="${S.lang === 'tr' ? 'Hisse adedi' : 'Quantity'}"><button type="button" data-qty="-1" aria-label="−" ${st.qty <= 1 ? 'disabled' : ''}>${ico('minus')}</button><output class="dp-num" aria-live="polite">${st.qty}</output><button type="button" data-qty="1" aria-label="+">${ico('plus')}</button></div></div>`;
      else main = `<fieldset class="dp-fieldset" data-amtset><legend class="dp-legend">${t('chooseAmount')}</legend><div class="dp-amounts" role="radiogroup" aria-label="${t('chooseAmount')}">
        ${o.presets.map((a, i) => `<button type="button" role="radio" class="dp-amount${o.popular === i ? ' dp-amount--popular' : ''}" data-badge="${t('popular')}" aria-checked="${!st.other && st.amount === a}" tabindex="${!st.other && st.amount === a ? 0 : -1}" data-amt="${a}"><span class="dp-amount__check">${ico('check')}</span><span class="dp-amount__v dp-num">${money(a)}</span>${o.impacts ? `<span class="dp-amount__i">${t(imp[i])}</span>` : ''}</button>`).join('')}
        <button type="button" role="radio" class="dp-amount" style="grid-column:1/-1" aria-checked="${st.other}" tabindex="${st.other ? 0 : -1}" data-other><span class="dp-amount__check">${ico('check')}</span><span class="dp-amount__v">${t('other')}</span><span class="dp-amount__i">${t('impact0')}</span></button></div>
        <div class="dp-field" style="margin-block-start:var(--dp-space-3);${st.other ? '' : 'display:none'}" data-otherbox><label for="dp-oa">${t('otherLabel')}</label><div class="dp-prefixed"><span class="pre" aria-hidden="true">${money(0).replace(/[\d.,\s]/g, '')}</span><input id="dp-oa" class="dp-input dp-num" inputmode="decimal" autocomplete="off" aria-describedby="dp-oa-e" placeholder="${CUR[2][1]}"></div><p class="dp-error" id="dp-oa-e" role="alert">${ico('alert')}<span>${t('eAmount', { min: money(o.min) })}</span></p></div></fieldset>`;
      return `${project()}${seg}${main}<label class="dp-check"><input type="checkbox" data-fee ${st.fee ? 'checked' : ''}><span class="dp-check__t"><b>${t('feeCover')}</b><span class="dp-muted">${t('feeHint', { fee: money(Math.round(sum() * o.fee * 100) / 100) })}</span></span></label>
        <div class="dp-trust"><span>${ico('lock')}${t('secure')}</span><span>${ico('receipt')}${t('receipt')}</span><span>${ico('play')}${t('video')}</span></div>`;
    }
    function viewDetails() {
      const code = S.lang === 'tr' ? '+90' : S.lang === 'ar' ? '+971' : '+44';
      const fld = (id, lbl, type, ac, hint, err, extra = '') => `<div class="dp-field" data-f="${id}"><label for="dp-${id}">${lbl}</label><input id="dp-${id}" class="dp-input" type="${type}" autocomplete="${ac}" ${extra} aria-describedby="dp-${id}-h dp-${id}-e"><p class="dp-hint" id="dp-${id}-h">${hint}</p><p class="dp-error" id="dp-${id}-e" role="alert">${ico('alert')}<span>${err}</span></p></div>`;
      return `<div class="dp-summary-err" role="alert" data-sumerr>${ico('alert')}<span></span></div>
        ${fld('name', t('fName'), 'text', 'name', t('hName'), t('eName'))}${fld('email', t('fEmail'), 'email', 'email', t('hEmail'), t('eEmail'), 'inputmode="email" spellcheck="false"')}
        <div class="dp-field" data-f="phone"><label for="dp-phone">${t('fPhone')} <span class="opt">${t('opt')}</span></label><div class="dp-phone"><div class="code dp-num" aria-hidden="true">${code}</div><input id="dp-phone" class="dp-input dp-num" type="tel" inputmode="tel" autocomplete="tel-national" aria-describedby="dp-phone-h dp-phone-e"></div><p class="dp-hint" id="dp-phone-h">${t('hPhone')}</p><p class="dp-error" id="dp-phone-e" role="alert">${ico('alert')}<span>${t('ePhone')}</span></p></div>
        <div class="dp-disclosure" data-disc><button type="button" aria-expanded="false" aria-controls="dp-tr">${ico('plus')}${t('fTribute')}</button><div class="dp-disclosure__panel" id="dp-tr"><div>
          <div class="dp-field" style="padding-block-start:6px"><label for="dp-onb">${t('fOnBehalf')} <span class="opt">${t('opt')}</span></label><input id="dp-onb" class="dp-input" autocomplete="off"></div>
          <div class="dp-field"><label for="dp-note">${t('fNote')} <span class="opt">${t('opt')}</span></label><textarea id="dp-note" class="dp-textarea" rows="3"></textarea></div></div></div></div>
        <div class="dp-lines" aria-label="${t('summary')}"><div><span>${t('donation')}</span><span class="dp-num">${money(sum())}</span></div>${st.fee ? `<div><span>${t('fee')}</span><span class="dp-num">${money(Math.round(sum() * o.fee * 100) / 100)}</span></div>` : ''}<div class="total"><span>${t('total')}</span><span class="dp-num">${money(total())}</span></div></div>
        <p class="dp-hint" style="margin-block-start:var(--dp-space-3);text-align:center">${t('privacy', { link: `<a href="#" style="color:var(--dp-color-primary-strong)">${t('privacyLink')}</a>` })}</p>`;
    }
    function viewTax() {
      return `<div class="dp-summary-err" role="alert" data-sumerr>${ico('alert')}<span></span></div><fieldset class="dp-fieldset" data-taxset><legend class="dp-legend" style="font-size:var(--dp-fs-md)">${t('taxQ')}</legend>
        <label class="dp-check"><input type="radio" name="tx" value="1" ${st.tax === true ? 'checked' : ''}><span class="dp-check__t"><b>${t('taxYes')}</b><span class="dp-muted">${t('taxYesH')}</span></span></label>
        <label class="dp-check"><input type="radio" name="tx" value="0" ${st.tax === false ? 'checked' : ''}><span class="dp-check__t"><b>${t('taxNo')}</b><span class="dp-muted">${t('taxNoH')}</span></span></label>
        <p class="dp-error" role="alert">${ico('alert')}<span>${t('taxQ')}</span></p></fieldset>
        <div data-taxmore style="${st.tax ? '' : 'display:none'}"><div class="dp-card" style="padding:var(--dp-space-4);background:var(--dp-color-info-soft);border-color:transparent;margin-block-end:var(--dp-space-4);box-shadow:none;font-size:var(--dp-fs-sm);display:flex;gap:10px;color:var(--dp-color-text)"><span style="color:var(--dp-color-info)">${ico('info')}</span><span>${t('taxDecl')}</span></div>
        <div class="dp-field" data-f="taxname"><label for="dp-tn">${t('fName')}</label><input id="dp-tn" class="dp-input" autocomplete="name"><p class="dp-error" role="alert">${ico('alert')}<span>${t('eName')}</span></p></div>
        <div class="dp-field" data-f="addr"><label for="dp-ad">${t('fAddr')}</label><input id="dp-ad" class="dp-input" autocomplete="street-address"><p class="dp-error" role="alert">${ico('alert')}<span>${t('fAddr')}</span></p></div>
        <div class="dp-field" data-f="post"><label for="dp-pc">${t('fPost')}</label><input id="dp-pc" class="dp-input" autocomplete="postal-code" style="max-inline-size:200px"><p class="dp-error" role="alert">${ico('alert')}<span>${t('fPost')}</span></p></div></div>
        <p class="dp-hint">${t('taxRemember')}</p>`;
    }
    const views = { amount: viewAmount, details: viewDetails, tax: viewTax };

    function render(keepScroll) { const cur = steps[st.step]; bodyEl.innerHTML = views[cur](); label(); setTotal(); bind(); if (!keepScroll) bodyEl.scrollTop = 0; }
    function bind() {
      const cur = steps[st.step];
      if (cur === 'amount') {
        $$('[data-freq]', bodyEl).forEach(b => b.onclick = () => { st.freq = b.dataset.freq; const sg = $('.dp-seg', bodyEl); sg.style.setProperty('--i', st.freq === 'once' ? 0 : 1); $$('[data-freq]', sg).forEach(x => x.setAttribute('aria-checked', x === b)); });
        const rg = $('.dp-amounts', bodyEl);
        const pick = (btn) => { $$('.dp-amount', bodyEl).forEach(x => { x.setAttribute('aria-checked', x === btn); x.tabIndex = x === btn ? 0 : -1; }); const ob = $('[data-otherbox]', bodyEl); if (btn.hasAttribute('data-other')) { st.other = true; ob.style.display = ''; $('#dp-oa').focus(); st.amount = 0; } else { st.other = false; ob.style.display = 'none'; st.amount = +btn.dataset.amt; const f = $('[data-amtset]', bodyEl); f.classList.remove('has-error'); } $('.dp-check__t .dp-muted', bodyEl).textContent = t('feeHint', { fee: money(Math.round(sum() * o.fee * 100) / 100) }); setTotal(); };
        if (rg) { $$('.dp-amount', rg).forEach(b => b.onclick = () => pick(b)); rg.onkeydown = e => { const bs = $$('.dp-amount', rg), i = bs.indexOf(document.activeElement); const rtl = root.dir === 'rtl'; let n = -1; if (['ArrowRight', 'ArrowDown'].includes(e.key)) n = (i + (e.key === 'ArrowRight' && rtl ? -1 : 1) + bs.length) % bs.length; if (['ArrowLeft', 'ArrowUp'].includes(e.key)) n = (i + (e.key === 'ArrowLeft' && rtl ? 1 : -1) + bs.length) % bs.length; if (n >= 0) { e.preventDefault(); bs[n].focus(); pick(bs[n]); } }; }
        const oa = $('#dp-oa', bodyEl); if (oa) { oa.value = st.other && st.amount ? st.amount : ''; oa.oninput = () => { const v = parseFloat(oa.value.replace(',', '.')); st.amount = isFinite(v) && v > 0 ? v : 0; $('[data-otherbox]', bodyEl).classList.remove('has-error'); setTotal(); }; }
        $$('[data-qty]', bodyEl).forEach(b => b.onclick = () => { st.qty = Math.max(1, Math.min(99, st.qty + +b.dataset.qty)); $('output', bodyEl).textContent = st.qty; $('[data-qty="-1"]', bodyEl).disabled = st.qty <= 1; setTotal(); });
        $('[data-fee]', bodyEl).onchange = e => { st.fee = e.target.checked; setTotal(); };
      }
      if (cur === 'details') {
        const d = $('[data-disc]', bodyEl); $('button', d).onclick = e => { const op = d.classList.toggle('is-open'); e.currentTarget.setAttribute('aria-expanded', op); };
        $$('.dp-input', bodyEl).forEach(i => i.addEventListener('input', () => { const f = i.closest('.dp-field'); if (f) f.classList.remove('has-error'); }));
        ['name', 'email', 'phone'].forEach(k => { const el = $('#dp-' + k, bodyEl); if (el && st[k]) el.value = st[k]; });
      }
      if (cur === 'tax') {
        $$('input[name=tx]', bodyEl).forEach(r => r.onchange = () => { st.tax = r.value === '1'; $('[data-taxmore]', bodyEl).style.display = st.tax ? '' : 'none'; $('[data-taxset]', bodyEl).classList.remove('has-error'); });
      }
    }
    const fail = (fields, msg) => { const bad = []; fields.forEach(([el, ok]) => { const f = el.closest('.dp-field, .dp-fieldset'); f.classList.toggle('has-error', !ok); if (!ok) bad.push(el); }); const se = $('[data-sumerr]', bodyEl); if (se) { se.classList.toggle('is-visible', bad.length > 0); $('span', se).textContent = t('eFix', { n: bad.length }); } if (bad.length) { bad[0].focus(); bad[0].scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' }); } return bad.length === 0; };
    function validate() {
      const cur = steps[st.step];
      if (cur === 'amount') { if (o.share) return true; const ok = sum() >= o.min; if (!ok) { if (st.other) { const f = $('[data-otherbox]', bodyEl); f.classList.add('has-error'); $('#dp-oa').focus(); } else { $('[data-amtset]', bodyEl).classList.add('has-error'); } } return ok; }
      if (cur === 'details') { const n = $('#dp-name', bodyEl), e = $('#dp-email', bodyEl), p = $('#dp-phone', bodyEl); st.name = n.value; st.email = e.value; st.phone = p.value; return fail([[n, n.value.trim().split(/\s+/).length >= 2 && n.value.trim().length > 4], [e, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.value.trim())], [p, !p.value.trim() || p.value.replace(/\D/g, '').length >= 9]]); }
      if (cur === 'tax') { if (st.tax === null) { $('[data-taxset]', bodyEl).classList.add('has-error'); return false; } if (!st.tax) return true; const a = $('#dp-tn', bodyEl), b = $('#dp-ad', bodyEl), c = $('#dp-pc', bodyEl); return fail([[a, a.value.trim().length > 3], [b, b.value.trim().length > 4], [c, c.value.trim().length >= 5]]); }
      return true;
    }
    nextBtn.onclick = () => {
      if (!validate()) return;
      if (st.step < steps.length - 1) { st.step++; render(); return; }
      nextBtn.classList.add('is-loading'); nextBtn.disabled = true;
      setTimeout(() => { nextBtn.classList.remove('is-loading'); $('.dp-steps', wrap).style.display = 'none'; $('[data-steplabel]', wrap).style.display = 'none'; $('.dp-actionbar', wrap).style.display = 'none';
        bodyEl.innerHTML = `<div class="dp-state"><div class="dp-state__art" style="animation:dp-pop .5s var(--dp-ease-spring)">${ico('lock')}</div><h3>${t('redirecting')}</h3><p>${t('redirectingSub')}</p><div class="dp-skel" style="inline-size:180px;block-size:6px;border-radius:9px;margin-block:8px"></div><a class="dp-btn dp-btn--secondary" href="${o.thanksHref}?lang=${S.lang}&theme=${S.theme}${S.scheme ? '&scheme=' + S.scheme : ''}">${t('seeThanks')}</a></div>`; }, 1100);
    };
    backBtn.onclick = () => { if (st.step > 0) { st.step--; render(); } };
    wrap.api = { st, goto(n) { st.step = n; render(); }, setAmount(a) { st.amount = a; const i = o.presets.indexOf(a); const b = $$('.dp-amount', bodyEl)[i]; if (b) b.click(); }, render, fillValid() { st.name = 'Ayşe Yılmaz'; st.email = 'ayse@example.com'; } };
    render();
    return wrap;
  }

  /* ---------- İlerleme çubuğu ---------- */
  function progress({ raised, goal, donors, ends, milestones = [], variant = '', animate = true, label }) {
    const pct = Math.min(100, Math.round(raised / goal * 100));
    const el = document.createElement('div'); el.className = 'dp-progress';
    el.innerHTML = `<div class="dp-progress__nums"><span class="dp-progress__raised dp-num" data-r>${money(animate ? 0 : raised)}</span><span class="dp-progress__goal">${t('ofGoal', { goal: money(goal) })}</span></div>
      <div class="dp-bar ${variant}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${t('pcFunded', { p: pct })}"><div class="dp-bar__fill" style="--p:${animate ? 0 : pct}" data-label="${pct}%"></div>
        ${milestones.map(m => `<span class="dp-bar__ms ${raised >= m.at / 100 * goal ? 'is-hit' : ''}" style="--at:${m.at}">${ico('check')}<span class="dp-bar__ms-label">${esc(m.label)}</span></span>`).join('')}</div>
      <div class="dp-stats" ${milestones.length ? 'style="margin-block-start:14px"' : ''}><span><b class="dp-num">${pct}%</b> ${t('funded')}</span>${donors ? `<span>${ico('users')}<b class="dp-num">${num(donors)}</b> ${t('donorsWord')}</span>` : ''}${ends ? `<span>${ico('clock')}<b>${ends}</b> ${t('daysLeft')}</span>` : ''}</div>`;
    if (animate) { const run = () => { setTimeout(() => { $('.dp-bar__fill', el).style.setProperty('--p', pct); tween($('[data-r]', el), 0, raised, x => money(Math.round(x)), reduce() ? 1 : 1400); }, 250); }; if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { run(); io.disconnect(); } }); io.observe(el); } else run(); }
    return el;
  }
  add('tr', { ofGoal: '{goal} hedefin', pcFunded: '%{p} toplandı', funded: 'tamamlandı', donorsWord: 'bağışçı', daysLeft: 'gün kaldı' });
  add('en', { ofGoal: 'of {goal} goal', pcFunded: '{p}% funded', funded: 'funded', donorsWord: 'supporters', daysLeft: 'days left' });
  add('ar', { ofGoal: 'من هدف {goal}', pcFunded: 'تم جمع {p}%', funded: 'مكتمل', donorsWord: 'متبرع', daysLeft: 'يوم متبقٍ' });

  window.DP = { S, t, add, ico, money, num, esc, $, $$, overlay, form, progress, tween, reduce, P, CUR };
  document.addEventListener('DOMContentLoaded', () => { const sk = document.querySelector('[data-skip]'); if (sk) sk.textContent = t('skip'); });
})();
