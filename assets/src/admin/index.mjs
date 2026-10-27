/**
 * Donation Panel — yönetici ekranları. jQuery yok; yalnız kendi ekranlarında yüklenir.
 * Ayarlar REST ile kaydedilir (donation-panel/v1/admin/*, X-WP-Nonce).
 */
import './admin.css';
import { qsa, valueOf, whenMatches } from './dom.mjs';
import { createApi } from './api.mjs';
import { initWizard } from './wizard.mjs';
import { initCampaigns } from './campaigns.mjs';

const cfg = window.donationPanelAdmin || { rest: '', nonce: '', i18n: {} };
const t = (key, fallback) => (cfg.i18n && cfg.i18n[key]) || fallback;
const api = createApi(cfg);

/**
 * Bildirim satırı (canlı bölge).
 *
 * @param {HTMLElement} root Sayfa kökü.
 * @param {string} text Metin.
 * @param {boolean} isError Hata mı.
 */
function notify(root, text, isError) {
  const box = root.querySelector('[data-dpa-notices]');
  if (!box) {
    return;
  }
  box.textContent = '';
  if (!text) {
    return;
  }
  const p = document.createElement('p');
  p.className = 'dpa-notice' + (isError ? ' dpa-notice--error' : ' dpa-notice--ok');
  p.textContent = text;
  box.appendChild(p);
}

/**
 * "data-dpa-when" koşullu alanları gösterir/gizler.
 *
 * @param {HTMLElement} root Sayfa kökü.
 */
function syncWhen(root) {
  qsa(root, '[data-dpa-when]').forEach((el) => {
    const [id, expected] = el.getAttribute('data-dpa-when').split('=');
    el.hidden = !whenMatches(root, id, expected);
  });
}

/**
 * Modül anahtarları: değişince kendiliğinden kaydedilir.
 *
 * @param {HTMLElement} root Sayfa kökü.
 */
function initModules(root) {
  qsa(root, '[data-dpa-module]').forEach((input) => {
    input.addEventListener('change', async () => {
      const slug = input.getAttribute('data-dpa-module');
      input.disabled = true;
      notify(root, t('saving', 'Saving...'), false);
      try {
        await api.post('admin/settings', { modules: { [slug]: input.checked } });
        notify(root, t('saved', 'Saved'), false);
      } catch (e) {
        input.checked = !input.checked;
        notify(root, e.message || t('error', 'Something went wrong.'), true);
      } finally {
        input.disabled = false;
      }
    });
  });
}

/**
 * Alan formu: kaydedilmemiş değişiklik uyarısı + Kaydet düğmesi.
 *
 * @param {HTMLElement} root Sayfa kökü.
 */
function initFields(root) {
  const save = root.querySelector('[data-dpa-save]');
  const msg = root.querySelector('[data-dpa-msg]');
  const fields = qsa(root, '[data-dpa-field]');
  if (!fields.length || !save) {
    return;
  }
  let dirty = false;
  const touched = new Set();
  const setDirty = (value) => {
    dirty = value;
    if (msg) {
      msg.textContent = value ? msg.getAttribute('data-unsaved') || '' : '';
    }
  };
  fields.forEach((field) => {
    const onChange = () => {
      touched.add(field);
      syncWhen(root);
      if (field.type === 'checkbox' && field.hasAttribute('data-dpa-confirm') && field.checked) {
        if (!window.confirm(field.getAttribute('data-dpa-confirm'))) {
          field.checked = false;
          return;
        }
      }
      setDirty(true);
    };
    field.addEventListener('change', onChange);
    if (field.type !== 'checkbox' && field.type !== 'radio') {
      field.addEventListener('input', onChange);
    }
  });
  syncWhen(root);

  save.addEventListener('click', async () => {
    const payload = {};
    fields.forEach((field) => {
      if (field.type === 'color' && field.getAttribute('data-dpa-empty') === '1' && !touched.has(field)) {
        return;
      }
      if (field.type === 'radio' && !field.checked) {
        return;
      }
      payload[field.getAttribute('data-dpa-field')] = valueOf(field);
    });
    save.disabled = true;
    if (msg) {
      msg.textContent = t('saving', 'Saving...');
    }
    try {
      await api.post('admin/settings', { fields: payload });
      setDirty(false);
      if (msg) {
        msg.textContent = msg.getAttribute('data-saved') || t('saved', 'Saved');
      }
      notify(root, '', false);
    } catch (e) {
      notify(root, e.message || t('error', 'Something went wrong.'), true);
      if (msg) {
        msg.textContent = '';
      }
    } finally {
      save.disabled = false;
    }
  });

  window.addEventListener('beforeunload', (event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

/**
 * Kopyala düğmeleri.
 *
 * @param {HTMLElement} root Sayfa kökü.
 */
function initCopy(root) {
  qsa(root, '[data-dpa-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.getAttribute('data-dpa-copy') || '';
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        const area = document.createElement('textarea');
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      const old = btn.textContent;
      btn.textContent = t('copied', 'Copied');
      window.setTimeout(() => {
        btn.textContent = old;
      }, 1500);
    });
  });
}

/**
 * Araçlar: ayar dışa/içe aktarma.
 *
 * @param {HTMLElement} root Sayfa kökü.
 */
function initTools(root) {
  const exportBtn = root.querySelector('[data-dpa-export]');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        const data = await api.get('admin/export');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'donation-panel-settings.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      } catch (e) {
        notify(root, e.message || t('error', 'Something went wrong.'), true);
      }
    });
  }
  const importInput = root.querySelector('[data-dpa-import]');
  if (importInput) {
    importInput.addEventListener('change', async () => {
      const file = importInput.files && importInput.files[0];
      if (!file) {
        return;
      }
      try {
        const parsed = JSON.parse(await file.text());
        if (!parsed || parsed.plugin !== 'donation-panel' || typeof parsed.settings !== 'object') {
          throw new Error(t('badImport', 'Not a Donation Panel export.'));
        }
        await api.post('admin/import', { settings: parsed.settings });
        notify(root, t('imported', 'Imported'), false);
        window.setTimeout(() => window.location.reload(), 800);
      } catch (e) {
        notify(root, e.message || t('badImport', 'Not a Donation Panel export.'), true);
      } finally {
        importInput.value = '';
      }
    });
  }
}

const root = document.querySelector('.dpa');
if (root) {
  root.classList.add('dpa-js');
  initModules(root);
  initCopy(root);
  if (root.getAttribute('data-dpa-page') === 'wizard') {
    initWizard(root, api, notify, t, syncWhen);
  } else {
    initFields(root);
    initTools(root);
    initCampaigns(root, api, notify, t);
  }
}
