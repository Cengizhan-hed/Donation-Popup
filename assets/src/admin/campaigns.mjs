/**
 * Kampanyalar ekranı: devreden tutar kaydı + ürün başına "Yeniden hesapla" (tarih aralığı -> ÖNİZLEME -> onay).
 * Önizleme hiçbir şey yazmaz; yazma yalnız "Uygula" ile ve önizlemede görülen tutarla yapılır.
 */
import { qsa } from './dom.mjs';

/**
 * @param {HTMLElement} root Sayfa kökü.
 * @param {{post: Function}} api REST istemcisi.
 * @param {Function} notify Bildirim.
 * @param {Function} t Metin çevirici.
 */
export function initCampaigns(root, api, notify, t) {
  const base = (id) => 'admin/campaigns/' + id;

  const showRaised = (id, res) => {
    const stored = root.querySelector('[data-dpa-stored="' + id + '"]');
    if (stored) {
      stored.textContent = res.raised_text || res.computed_text || res.stored_text;
    }
    const pending = root.querySelector('[data-dpa-pending="' + id + '"]');
    if (pending) {
      pending.hidden = !res.pending;
    }
  };

  qsa(root, '[data-dpa-manual-save]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-dpa-manual-save');
      const input = root.querySelector('[data-dpa-manual="' + id + '"]');
      if (!input) {
        return;
      }
      btn.disabled = true;
      try {
        const res = await api.post(base(id) + '/manual', { amount: input.value === '' ? 0 : Number(input.value) });
        input.value = String(res.manual);
        showRaised(id, res);
        notify(root, t('manualSaved', 'The amount added by hand was saved.'), false);
      } catch (e) {
        notify(root, e.message || t('error', 'Something went wrong.'), true);
      } finally {
        btn.disabled = false;
      }
    });
  });

  qsa(root, '[data-dpa-carried-save]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-dpa-carried-save');
      const input = root.querySelector('[data-dpa-carried="' + id + '"]');
      if (!input) {
        return;
      }
      btn.disabled = true;
      try {
        const res = await api.post(base(id) + '/carried', { amount: input.value === '' ? 0 : Number(input.value) });
        input.value = String(res.carried);
        showRaised(id, res);
        notify(root, t('carriedSaved', 'The carried-over amount was saved.'), false);
      } catch (e) {
        notify(root, e.message || t('error', 'Something went wrong.'), true);
      } finally {
        btn.disabled = false;
      }
    });
  });

  qsa(root, '[data-dpa-recalc-open]').forEach((open) => {
    const id = open.getAttribute('data-dpa-recalc-open');
    const row = root.querySelector('[data-dpa-recalc="' + id + '"]');
    if (!row) {
      return;
    }
    const from = row.querySelector('[data-dpa-recalc-from]');
    const to = row.querySelector('[data-dpa-recalc-to]');
    const previewBtn = row.querySelector('[data-dpa-recalc-preview]');
    const applyBtn = row.querySelector('[data-dpa-recalc-apply]');
    const result = row.querySelector('[data-dpa-recalc-result]');
    const cell = (key) => row.querySelector('[data-dpa-r="' + key + '"]');
    let expected = null;

    const reset = () => {
      expected = null;
      applyBtn.disabled = true;
      result.hidden = true;
    };
    const range = () => ({ from: from.value, to: to.value });

    const show = (res) => {
      cell('stored').textContent = res.stored_text || '-';
      cell('computed').textContent = res.computed_text;
      cell('diff').textContent = res.diff_text || '-';
      cell('orders').textContent = String(res.orders);
      const same = res.diff !== null && Math.abs(res.diff) < 0.005;
      const notes = [same ? t('rcSame', 'The stored total already matches. Nothing to change.') : t('rcNote', 'Applying replaces the stored total.')];
      if (res.unconverted > 0) {
        notes.push(t('rcNoRate', 'Some donations had no exchange rate and were left out.'));
      }
      cell('note').textContent = notes.join(' ');
      result.hidden = false;
      expected = res.computed;
      applyBtn.disabled = same;
    };

    open.addEventListener('click', () => {
      const opened = row.hidden;
      row.hidden = !opened;
      open.setAttribute('aria-expanded', opened ? 'true' : 'false');
      if (opened) {
        from.focus();
      }
    });
    [from, to].forEach((el) => el.addEventListener('change', reset));

    previewBtn.addEventListener('click', async () => {
      reset();
      previewBtn.disabled = true;
      notify(root, t('rcPreviewing', 'Calculating the preview...'), false);
      try {
        show(await api.post(base(id) + '/recalc/preview', range()));
        notify(root, '', false);
      } catch (e) {
        notify(root, e.message || t('error', 'Something went wrong.'), true);
      } finally {
        previewBtn.disabled = false;
      }
    });

    applyBtn.addEventListener('click', async () => {
      if (expected === null) {
        return;
      }
      applyBtn.disabled = true;
      notify(root, t('rcApplying', 'Applying...'), false);
      try {
        const res = await api.post(base(id) + '/recalc', { ...range(), expected });
        showRaised(id, res);
        show(res);
        notify(root, t('rcApplied', 'The total was updated.'), false);
      } catch (e) {
        if (e.status === 409) {
          reset();
          notify(root, t('rcStale', 'The numbers changed since the preview. Please preview again.'), true);
        } else {
          applyBtn.disabled = false;
          notify(root, e.message || t('error', 'Something went wrong.'), true);
        }
      }
    });
  });
}
