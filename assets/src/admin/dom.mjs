/**
 * Küçük DOM yardımcıları (jQuery yok).
 */

/**
 * @param {ParentNode} ctx Bağlam.
 * @param {string} sel Seçici.
 * @return {HTMLElement[]} Öğeler.
 */
export function qsa(ctx, sel) {
  return Array.prototype.slice.call(ctx.querySelectorAll(sel));
}

/**
 * Alanın gönderilecek değeri (onay kutusu: boolean; radyo: değer).
 *
 * @param {HTMLInputElement} field Alan.
 * @return {string|boolean} Değer.
 */
export function valueOf(field) {
  if (field.type === 'checkbox') {
    return field.checked;
  }
  return field.value;
}

/**
 * Bir alanın (kimlikle) geçerli değeri bekleneni sağlıyor mu.
 *
 * @param {HTMLElement} root Kök.
 * @param {string} id Alan kimliği.
 * @param {string} expected Beklenen değer.
 * @return {boolean} Eşleşme.
 */
export function whenMatches(root, id, expected) {
  const fields = qsa(root, '[data-dpa-field="' + id + '"]');
  const radios = fields.filter((f) => f.type === 'radio');
  if (radios.length) {
    const on = radios.find((r) => r.checked);
    return on ? on.value === expected : false;
  }
  return fields.length ? String(valueOf(fields[0])) === expected : false;
}
