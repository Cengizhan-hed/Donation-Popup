/**
 * Donation Panel — bağış listesi: kategori süzgeci (sekmeler) ve kart düğmesiyle formu açma.
 *
 * Form sayfa yüklenirken basılmaz: düğmeye basılınca `GET donation-panel/v1/experience/{id}` ile kap + form alınır,
 * `dp:scan` ile form deneyimi bağlanır ve katman açılır. JS yoksa düğme (gerçek bağlantı) ürün sayfasına gider.
 */
import './list.css';
import { parseHashSlug, matchesCategory, buildExperienceUrl, shouldHandleClick } from './logic.mjs';

const MOUNT_WAIT_MS = 5000;

/**
 * @param {HTMLElement} wrap Liste kökü.
 * @return {HTMLElement[]} Sekmeler.
 */
function tabsOf(wrap) {
  return Array.from(wrap.querySelectorAll('[data-wdp-tab]'));
}

/**
 * Sekmeyi etkinleştirir, kartları süzer.
 *
 * @param {HTMLElement} wrap    Liste kökü.
 * @param {HTMLElement} tab     Sekme.
 * @param {boolean}     fromUrl Adres çubuğundan mı (adres yeniden yazılmaz).
 */
function setTab(wrap, tab, fromUrl) {
  const slug = tab.getAttribute('data-wdp-tab') || 'all';
  tabsOf(wrap).forEach((item) => {
    const on = item === tab;
    item.classList.toggle('is-active', on);
    if (on) {
      item.setAttribute('aria-current', 'true');
    } else {
      item.removeAttribute('aria-current');
    }
  });
  const list = wrap.querySelector('.wdp-list');
  if (list && tab.id) {
    list.setAttribute('aria-labelledby', tab.id);
  }
  wrap.querySelectorAll('.wdp-list__item').forEach((item) => {
    item.hidden = !matchesCategory(item.getAttribute('data-wdp-cats') || '', slug);
  });
  if (!fromUrl && window.history && typeof window.history.replaceState === 'function') {
    const hash = tab.getAttribute('data-wdp-hash');
    const base = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', hash ? `${base}#${hash}` : base);
  }
}

/**
 * @param {HTMLElement} wrap Liste kökü.
 */
function bindTabs(wrap) {
  const nav = wrap.querySelector('[data-wdp-tabs]');
  if (!nav) {
    return;
  }
  nav.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-wdp-tab]');
    if (tab && nav.contains(tab)) {
      event.preventDefault();
      setTab(wrap, tab, false);
    }
  });
  const slug = parseHashSlug(window.location.hash);
  if (slug) {
    const tab = tabsOf(wrap).find((item) => item.getAttribute('data-wdp-tab') === slug);
    if (tab) {
      setTab(wrap, tab, true);
    }
  }
}

/**
 * Form kökü bağlanana kadar bekler.
 *
 * @param {HTMLElement} host Kap sarmalayıcısı.
 * @return {Promise<HTMLElement|null>} Bağlanmış kök ya da zaman aşımında null.
 */
function whenMounted(host) {
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      const root = host.querySelector('[data-dp-exp][data-dp-mounted="1"]');
      if (root) {
        resolve(root);
      } else if (Date.now() - started > MOUNT_WAIT_MS) {
        resolve(null);
      } else {
        window.setTimeout(check, 40);
      }
    };
    document.dispatchEvent(new CustomEvent('dp:scan'));
    check();
  });
}

/**
 * Ürün formunu getirir (bir kez) ve katmanı açar.
 *
 * @param {HTMLElement} wrap Liste kökü.
 * @param {HTMLElement} cta  Tıklanan düğme.
 */
async function openForm(wrap, cta) {
  const id = cta.getAttribute('data-wdp-form');
  const kind = wrap.getAttribute('data-wdp-kind') || 'popup';
  const cache = (wrap.wdpHosts = wrap.wdpHosts || new Map());
  let host = cache.get(id);
  if (!host) {
    cta.classList.add('is-loading');
    cta.setAttribute('aria-busy', 'true');
    try {
      const response = await window.fetch(buildExperienceUrl(wrap.getAttribute('data-wdp-rest'), id, kind), {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(String(response.status));
      }
      const data = await response.json();
      if (!data || typeof data.html !== 'string' || data.html === '') {
        throw new Error('empty');
      }
      host = document.createElement('div');
      host.className = 'wdp-form-host';
      const template = document.createElement('template');
      template.innerHTML = data.html;
      host.appendChild(template.content);
      document.body.appendChild(host);
      host.addEventListener('dp:close', () => {
        if (host.wdpCta) {
          host.wdpCta.focus({ preventScroll: true });
        }
      });
      cache.set(id, host);
    } catch (error) {
      window.location.assign(cta.href);
      return;
    } finally {
      cta.classList.remove('is-loading');
      cta.removeAttribute('aria-busy');
    }
  }
  host.wdpCta = cta;
  const root = await whenMounted(host);
  const trigger = root && root.querySelector('[data-dp-open]');
  if (!trigger) {
    window.location.assign(cta.href);
    return;
  }
  trigger.click();
}

/**
 * @param {HTMLElement} wrap Liste kökü.
 */
function bindForms(wrap) {
  if (!wrap.getAttribute('data-wdp-rest')) {
    return;
  }
  wrap.querySelectorAll('[data-wdp-form]').forEach((cta) => cta.setAttribute('aria-haspopup', 'dialog'));
  wrap.addEventListener('click', (event) => {
    const cta = event.target.closest('[data-wdp-form]');
    if (!cta || !wrap.contains(cta) || !shouldHandleClick(event)) {
      return;
    }
    event.preventDefault();
    openForm(wrap, cta);
  });
}

/**
 * Mağaza/arşiv döngüsü kartlarındaki düğmeler (`a.wdp-loop-donate[data-wdp-form]`): liste istemcisiyle aynı form açılışı.
 * Düğmenin kendi `data-wdp-rest` / `data-wdp-kind` öznitelikleri kullanılır; form kapları sayfada bir kez önbelleğe alınır.
 */
function bindLoop() {
  if (document.documentElement.dataset.wdpLoopBound === '1') {
    return;
  }
  document.documentElement.dataset.wdpLoopBound = '1';
  const hosts = new Map();
  document.addEventListener('click', (event) => {
    const cta = event.target.closest && event.target.closest('a.wdp-loop-donate[data-wdp-form]');
    if (!cta || !shouldHandleClick(event) || !cta.getAttribute('data-wdp-rest')) {
      return;
    }
    event.preventDefault();
    openForm({ getAttribute: (name) => cta.getAttribute(name), wdpHosts: hosts }, cta);
  });
}

function init() {
  bindLoop();
  document.querySelectorAll('.wdp-list-wrap').forEach((wrap) => {
    if (wrap.dataset.wdpBound === '1') {
      return;
    }
    wrap.dataset.wdpBound = '1';
    bindTabs(wrap);
    bindForms(wrap);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
