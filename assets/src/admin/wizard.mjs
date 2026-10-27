/**
 * Kurulum sihirbazı: adım gezintisi, her adımda kalıcı kayıt, canlı önizleme.
 */
import { qsa, valueOf } from './dom.mjs';

/**
 * @param {HTMLElement} root Sihirbaz kökü.
 * @param {{post: Function}} api REST istemcisi.
 * @param {Function} notify Bildirim.
 * @param {Function} t Çeviri yardımcısı.
 * @param {Function} syncWhen Koşullu alan eşitleme.
 */
export function initWizard(root, api, notify, t, syncWhen) {
  const total = Number(root.getAttribute('data-dpa-steps')) || 5;
  let step = Number(root.getAttribute('data-dpa-step')) || 1;
  const back = root.querySelector('[data-dpa-back]');
  const next = root.querySelector('[data-dpa-next]');
  const finish = root.querySelector('[data-dpa-finish]');
  const skip = root.querySelector('[data-dpa-skip]');
  const overview = root.getAttribute('data-dpa-overview') || '';
  const phone = root.querySelector('[data-dpa-phone]');

  const panel = () => root.querySelector('[data-dpa-wstep="' + step + '"]');

  const paintPreview = () => {
    if (!phone) {
      return;
    }
    const mode = (root.querySelector('input[name="display.mode"]:checked') || {}).value || 'panel';
    phone.setAttribute('data-mode', mode);
    const custom = (root.querySelector('input[name="design.colors"]:checked') || {}).value === 'custom';
    const brand = root.querySelector('[data-dpa-field="design.brand"]');
    const accent = root.querySelector('[data-dpa-field="design.accent"]');
    phone.style.setProperty('--dpa-pv-brand', custom && brand ? brand.value : '');
    phone.style.setProperty('--dpa-pv-accent', custom && accent ? accent.value : '');
  };

  const paint = () => {
    qsa(root, '[data-dpa-wstep]').forEach((el) => {
      el.hidden = Number(el.getAttribute('data-dpa-wstep')) !== step;
    });
    qsa(root, '[data-dpa-stepper]').forEach((li) => {
      const n = Number(li.getAttribute('data-dpa-stepper'));
      li.classList.toggle('is-done', n < step);
      li.classList.toggle('is-current', n === step);
      if (n === step) {
        li.setAttribute('aria-current', 'step');
      } else {
        li.removeAttribute('aria-current');
      }
    });
    back.hidden = step === 1;
    next.hidden = step === total;
    finish.hidden = step !== total;
    syncWhen(root);
    paintPreview();
    const heading = panel() && panel().querySelector('h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
    }
  };

  const collect = () => {
    const fields = {};
    const modules = {};
    const scope = panel();
    if (!scope) {
      return { fields, modules };
    }
    qsa(scope, '[data-dpa-field]').forEach((field) => {
      if (field.type === 'radio' && !field.checked) {
        return;
      }
      if (field.type === 'color' && field.getAttribute('data-dpa-empty') === '1' && !field.dataset.touched) {
        return;
      }
      fields[field.getAttribute('data-dpa-field')] = valueOf(field);
    });
    qsa(scope, '[data-dpa-module]').forEach((input) => {
      modules[input.getAttribute('data-dpa-module')] = input.checked;
    });
    return { fields, modules };
  };

  const persist = async (nextStep, result) => {
    const body = Object.assign(collect(), { step: nextStep, result: result || '' });
    await api.post('admin/wizard', body);
  };

  const go = async (target, result) => {
    [back, next, finish, skip].forEach((b) => {
      b.disabled = true;
    });
    try {
      await persist(target, result);
      step = target;
      notify(root, '', false);
      paint();
      const heading = panel() && panel().querySelector('h2');
      if (heading) {
        heading.focus();
      }
    } catch (e) {
      notify(root, e.message || t('error', 'Something went wrong.'), true);
    } finally {
      [back, next, finish, skip].forEach((b) => {
        b.disabled = false;
      });
    }
  };

  next.addEventListener('click', () => go(Math.min(total, step + 1), ''));
  back.addEventListener('click', () => go(Math.max(1, step - 1), ''));
  finish.addEventListener('click', async () => {
    await go(total, 'done');
    if (overview) {
      window.location.assign(overview);
    }
  });
  skip.addEventListener('click', async () => {
    try {
      await api.post('admin/wizard', { step, result: 'skipped', fields: {}, modules: {} });
      if (overview) {
        window.location.assign(overview);
      }
    } catch (e) {
      notify(root, e.message || t('error', 'Something went wrong.'), true);
    }
  });

  qsa(root, '[data-dpa-field]').forEach((field) => {
    const onChange = () => {
      if (field.type === 'color') {
        field.dataset.touched = '1';
      }
      syncWhen(root);
      paintPreview();
    };
    field.addEventListener('change', onChange);
    field.addEventListener('input', onChange);
  });

  paint();
}
