/**
 * Gömülü kart formu paketi çözücüsü (DOM'suz, birim testli). Kodlayıcı: `src/Modules/EntryPoints/class-form-pack.php`.
 *
 * Biçim v1: `{v:1, t:[ops…], f:{"<id>": ops}}`; ops: dize = düz parça, sayı çifti = kopya (konum >= 0 → şablon akışı R,
 * konum < 0 → kendi çıktısı). Şablonlar sırayla çözülüp R'ye eklenir. Bozuk/sınır dışı paket hata fırlatır (çağıran
 * formu "gömülü değil" sayar ve dokunuşta tek istekle alır).
 */

/** Sayfa kimliği (`dom_key`) belirteci. */
export const KEY_TOKEN = '\u0001';
/** Ürün kimliği belirteci. */
export const ID_TOKEN = '\u0002';

/**
 * Bir ops dizisini çözer.
 *
 * @param {Array<string|number>} ops    Ops.
 * @param {string[]}             stream Şablon akışı.
 * @return {string[]} Parçalar.
 */
export function decodeOps(ops, stream) {
  if (!Array.isArray(ops)) {
    throw new Error('ops');
  }
  const out = [];
  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    if (typeof op === 'string') {
      out.push(op);
      continue;
    }
    const len = ops[(i += 1)];
    if (!Number.isInteger(op) || !Number.isInteger(len) || len < 1) {
      throw new Error('op');
    }
    const src = op < 0 ? out : stream;
    const start = op < 0 ? -1 - op : op;
    for (let q = 0; q < len; q += 1) {
      const part = src[start + q];
      if (typeof part !== 'string') {
        throw new Error('range');
      }
      out.push(part);
    }
  }
  return out;
}

/**
 * Paketi okur: şablon akışını bir kez çözer, ürün formlarını istendiğinde.
 *
 * @param {any} data Ayrıştırılmış paket.
 * @return {{ids: string[], form: function(string): (string|null)}|null} Okuyucu ya da (tanınmayan biçim) null.
 */
export function openPack(data) {
  if (!data || data.v !== 1 || !Array.isArray(data.t) || !data.f || typeof data.f !== 'object') {
    return null;
  }
  let stream = null;
  const forms = data.f;
  const ids = Object.keys(forms).filter((id) => /^[1-9]\d*$/.test(id));
  const templates = () => {
    if (!stream) {
      stream = [];
      data.t.forEach((ops) => {
        decodeOps(ops, stream).forEach((part) => stream.push(part));
      });
    }
    return stream;
  };
  return {
    ids,
    /**
     * @param {string} id Ürün.
     * @return {string|null} Belirteçli HTML (çözülemezse null).
     */
    form(id) {
      if (!ids.includes(String(id))) {
        return null;
      }
      try {
        return decodeOps(forms[String(id)], templates()).join('');
      } catch {
        return null;
      }
    },
  };
}

/**
 * Belirteçleri geri koyar: ürün kimliği ve sayfada benzersiz anahtar.
 *
 * @param {string} html Belirteçli HTML.
 * @param {string} id   Ürün.
 * @param {string} key  Sayfada benzersiz anahtar (ör. `dp-12-popup-e1`).
 * @return {string} HTML.
 */
export function restoreTokens(html, id, key) {
  return String(html).split(KEY_TOKEN).join(key).split(ID_TOKEN).join(String(id));
}
