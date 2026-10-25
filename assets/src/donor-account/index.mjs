/**
 * Donation Panel — Bağışçı hesabı. Giriş/kayıt/şifre sıfırlama penceresi (mobilde alttan panel),
 * Bağışlarım sayfası (daha fazla yükle) ve misafir bağış bağlama. Kimlik doğrulama sunucuda
 * WordPress/WooCommerce ile; burada yalnız REST çağrıları. jQuery yok; tema/oluşturucuya özel kod yok.
 */
import './donor-account.css';
import { endpoint, errorKey, isEmail, isStrongEnough, nextFocusIndex, shouldDismissOnDrag } from './logic.mjs';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * @param {string} base REST taban adresi.
 * @param {string} path Uç.
 * @param {{method?: string, nonce?: string, body?: Object, query?: Object}} options Seçenekler.
 * @return {Promise<{ok: boolean, status: number, data: Object}>} Yanıt.
 */
async function call(base, path, options = {}) {
  const url = new URL(endpoint(base, path), window.location.href);
  Object.entries(options.query || {}).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const headers = { Accept: 'application/json' };
  if (options.nonce) {
    headers['X-WP-Nonce'] = options.nonce;
  }
  const init = { method: options.method || 'GET', credentials: 'same-origin', cache: 'no-store', headers };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }
  const response = await window.fetch(url.toString(), init);
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

/**
 * Taze nonce (önbellekli sayfalarda bayat nonce'ı önler).
 *
 * @param {string} base REST taban adresi.
 * @return {Promise<string>} Nonce.
 */
async function freshNonce(base) {
  const r = await call(base, 'session');
  return r.ok && r.data && typeof r.data.nonce === 'string' ? r.data.nonce : '';
}

/**
 * @param {HTMLElement} root Pencere kökü.
 */
function mountDialog(root) {
  if (root.dataset.dpAccMounted === '1') {
    return;
  }
  root.dataset.dpAccMounted = '1';
  const overlay = root.querySelector('[data-dp-acc-overlay]');
  const surface = root.querySelector('[data-dp-acc-surface]');
  const title = root.querySelector('[data-dp-acc-title]');
  if (!overlay || !surface || !title) {
    return;
  }
  const base = root.dataset.dpAccRest || '';
  const msg = (k) => root.dataset[`dpAccMsg${k[0].toUpperCase()}${k.slice(1)}`] || '';
  const titleFor = (v) => root.dataset[`dpAccTitle${v[0].toUpperCase()}${v.slice(1)}`] || title.textContent;
  let lastFocus = null;
  let view = 'login';

  const views = () => Array.from(root.querySelectorAll('[data-dp-acc-view]'));
  const triggers = () => Array.from(document.querySelectorAll('[data-dp-acc-open]'));
  const focusables = () => Array.from(surface.querySelectorAll(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);

  function setView(name, focus = true) {
    if (!views().some((el) => el.dataset.dpAccView === name)) {
      return;
    }
    view = name;
    views().forEach((el) => {
      el.hidden = el.dataset.dpAccView !== name;
    });
    title.textContent = titleFor(name);
    root.querySelectorAll('.dp-ac__tab').forEach((tab) => {
      tab.setAttribute('aria-pressed', String(tab.dataset.dpAccViewBtn === name));
    });
    const tabs = root.querySelector('.dp-ac__tabs');
    if (tabs) {
      tabs.hidden = name !== 'login' && name !== 'register';
    }
    if (focus) {
      const target = root.querySelector(`[data-dp-acc-view="${name}"] input, [data-dp-acc-view="${name}"] button`);
      if (target) {
        target.focus();
      }
    }
  }

  function open() {
    lastFocus = document.activeElement;
    overlay.classList.add('is-open');
    document.documentElement.classList.add('dp-ac-lock');
    triggers().forEach((t) => t.setAttribute('aria-expanded', 'true'));
    setView('login');
  }

  function close() {
    overlay.classList.remove('is-open');
    document.documentElement.classList.remove('dp-ac-lock');
    triggers().forEach((t) => t.setAttribute('aria-expanded', 'false'));
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus();
    }
  }

  function showError(form, text) {
    const box = form.querySelector('[data-dp-acc-error]');
    if (box) {
      box.textContent = text;
      box.hidden = !text;
    }
  }

  function fieldError(input, text) {
    const note = root.querySelector(`#${input.id}-err`);
    input.setAttribute('aria-invalid', text ? 'true' : 'false');
    if (note) {
      note.textContent = text || note.textContent;
      note.hidden = !text;
    }
  }

  function busy(form, on) {
    const btn = form.querySelector('[data-dp-acc-submit]');
    if (btn) {
      btn.disabled = on;
      btn.classList.toggle('is-loading', on);
    }
    form.setAttribute('aria-busy', String(on));
  }

  async function post(path, body, nonce) {
    return call(base, path, { method: 'POST', nonce, body });
  }

  async function submit(form) {
    const kind = form.dataset.dpAccForm;
    const emailInput = form.querySelector('input[type="email"]');
    const passInput = form.querySelector('input[type="password"]');
    showError(form, '');
    let valid = true;
    if (emailInput) {
      const ok = isEmail(emailInput.value);
      fieldError(emailInput, ok ? '' : msg('email'));
      valid = valid && ok;
    }
    if (passInput) {
      const ok = kind === 'register' ? isStrongEnough(passInput.value) : passInput.value !== '';
      fieldError(passInput, ok ? '' : kind === 'register' ? msg('pass') : msg('login'));
      valid = valid && ok;
    }
    if (!valid) {
      const bad = form.querySelector('[aria-invalid="true"]');
      if (bad) {
        bad.focus();
      }
      return;
    }
    busy(form, true);
    try {
      let nonce = await freshNonce(base);
      if (kind === 'reset') {
        const r = await post('reset', { email: emailInput.value.trim() }, nonce);
        if (r.ok) {
          setView('sent');
        } else {
          showError(form, msg(errorKey(r.status, r.data.code, kind)));
        }
        return;
      }
      if (kind === 'register') {
        const r = await post('register', { email: emailInput.value.trim(), password: passInput.value }, nonce);
        if (!r.ok) {
          showError(form, msg(errorKey(r.status, r.data.code, kind)));
          return;
        }
        nonce = await freshNonce(base);
      }
      const r = await post('login', { email: emailInput.value.trim(), password: passInput.value, remember: true }, nonce);
      if (r.ok) {
        window.location.reload();
        return;
      }
      if (kind === 'register') {
        // Kayıt yanıtı hesap var/yok bilgisini sızdırmaz; giriş başarısızsa tek bir ileti gösterilir.
        setView('login', false);
        const loginForm = root.querySelector('[data-dp-acc-form="login"]');
        const loginEmail = loginForm.querySelector('input[type="email"]');
        loginEmail.value = emailInput.value.trim();
        showError(loginForm, msg('login'));
        return;
      }
      showError(form, msg(errorKey(r.status, r.data.code, kind)));
    } catch {
      showError(form, msg('fail'));
    } finally {
      busy(form, false);
    }
  }

  // Sürükleyerek kapatma (yalnız dar ekranda tutamaç/başlık).
  let drag = null;
  surface.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.dp-ac__handle, .dp-ac__head') || e.target.closest('button') || !window.matchMedia('(max-width: 639.98px)').matches) {
      return;
    }
    drag = { y: e.clientY, t: performance.now(), d: 0 };
    surface.setPointerCapture(e.pointerId);
    surface.classList.add('is-dragging');
  });
  surface.addEventListener('pointermove', (e) => {
    if (!drag) {
      return;
    }
    drag.d = Math.max(0, e.clientY - drag.y);
    surface.style.transform = `translateY(${drag.d}px)`;
  });
  const endDrag = () => {
    if (!drag) {
      return;
    }
    const velocity = drag.d / Math.max(1, performance.now() - drag.t);
    const dismiss = shouldDismissOnDrag(drag.d, surface.offsetHeight, velocity);
    drag = null;
    surface.classList.remove('is-dragging');
    surface.style.transform = '';
    if (dismiss) {
      close();
    }
  };
  surface.addEventListener('pointerup', endDrag);
  surface.addEventListener('pointercancel', endDrag);

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-dp-acc-open]');
    if (trigger) {
      e.preventDefault();
      open();
    }
  });
  root.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-dp-acc-close]')) {
      close();
      return;
    }
    const btn = e.target.closest('[data-dp-acc-view-btn]');
    if (btn) {
      setView(btn.dataset.dpAccViewBtn);
    }
  });
  root.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-dp-acc-form]');
    if (form) {
      e.preventDefault();
      submit(form);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('is-open')) {
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      const list = focusables();
      const idx = list.indexOf(document.activeElement);
      const next = nextFocusIndex(idx, list.length, e.shiftKey);
      if (next >= 0 && (idx === -1 || (e.shiftKey && idx === 0) || (!e.shiftKey && idx === list.length - 1))) {
        e.preventDefault();
        list[next].focus();
      }
    }
  });
  if (view !== 'login') {
    setView('login', false);
  }
}

/**
 * Bağışlarım sayfası: daha fazla yükle + misafir bağlama.
 *
 * @param {HTMLElement} root Sayfa kökü.
 */
function mountPage(root) {
  if (root.dataset.dpAccMounted === '1') {
    return;
  }
  root.dataset.dpAccMounted = '1';
  const base = root.dataset.dpAccRest || '';
  const text = (k) => root.dataset[`dpAccMsg${k[0].toUpperCase()}${k.slice(1)}`] || '';
  const list = root.querySelector('[data-dp-acc-list]');
  const more = root.querySelector('[data-dp-acc-more]');

  if (more && list) {
    more.addEventListener('click', async () => {
      const next = Number(more.dataset.page) + 1;
      more.disabled = true;
      try {
        const nonce = await freshNonce(base);
        const r = await call(base, 'donations', { nonce, query: { page: next } });
        if (r.ok && typeof r.data.html === 'string') {
          list.insertAdjacentHTML('beforeend', r.data.html);
          more.dataset.page = String(next);
          if (next >= Number(more.dataset.pages)) {
            more.hidden = true;
          }
        }
      } finally {
        more.disabled = false;
      }
    });
  }

  const box = root.querySelector('[data-dp-acc-link]');
  if (box) {
    const go = box.querySelector('[data-dp-acc-link-go]');
    const note = box.querySelector('[data-dp-acc-link-msg]');
    const say = (t) => {
      note.textContent = t;
      note.hidden = !t;
    };
    go.addEventListener('click', async () => {
      go.disabled = true;
      say('');
      try {
        const nonce = await freshNonce(base);
        if (box.dataset.mode === 'confirm') {
          const r = await call(base, 'link-guest/confirm', { method: 'POST', nonce, body: { token: box.dataset.token } });
          if (r.ok) {
            const n = Number(r.data.linked) || 0;
            say(n > 0 ? text('done') : text('none'));
            const url = new URL(window.location.href);
            url.searchParams.delete('dp_link_guest');
            window.history.replaceState(null, '', url.toString());
            if (n > 0) {
              window.setTimeout(() => window.location.reload(), 1200);
            }
          } else {
            say(r.status === 429 ? text('rate') : text('bad'));
          }
        } else {
          const r = await call(base, 'link-guest', { method: 'POST', nonce, body: {} });
          say(r.ok ? text('sent') : r.status === 429 ? text('rate') : text('fail'));
        }
      } catch {
        say(text('fail'));
      } finally {
        go.disabled = false;
      }
    });
  }
}

function init() {
  document.querySelectorAll('[data-dp-acc]').forEach(mountDialog);
  document.querySelectorAll('[data-dp-acc-page]').forEach(mountPage);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
