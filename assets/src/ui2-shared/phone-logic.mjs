/**
 * Telefon kuralları (saf işlevler; DOM yok).
 *
 * PHP `Support\Phone_Rules` ile BİREBİR aynı kural; ortak kaynak `src/Support/phone-rules.json`,
 * ortak vektörler `tests/fixtures/phone-vectors.json` (iki tarafta aynı beklenen sonuç).
 * Tablo satırı: iso -> [arama kodu, en az, en çok, gruplama ("3 3 2 2"), mobil başlangıç, 0 korunur].
 */

/**
 * @param {Record<string, unknown>} rules JSON tablo.
 * @return {{table: Record<string, {dial:string,min:number,max:number,groups:string,mobile:string,zero:boolean}>, byDial: Record<string, string[]>, primary: Record<string, string>}} Dizin.
 */
export function buildIndex(rules) {
  const table = {};
  const byDial = {};
  Object.keys(rules).forEach((iso) => {
    const row = rules[iso];
    if (iso[0] === '_' || !Array.isArray(row) || row.length < 3) {
      return;
    }
    const dial = String(row[0]);
    table[iso] = { dial, min: row[1], max: row[2], groups: row[3] || '', mobile: row[4] || '', zero: Boolean(row[5]) };
    (byDial[dial] = byDial[dial] || []).push(iso);
  });
  return { table, byDial, primary: rules._p || {}, strict: new Set(rules._s || []) };
}

/**
 * Aynı arama kodunu paylaşan ülkelerin uzunluk aralığı. `min`/`max` ENGEL sınırıdır: güvenilir (`_s`) ülkede kuralın
 * kendisi; diğerlerinde kural ±3 hane gevşetilir (E.164: en çok 15 hane). `softMin`/`softMax` kural aralığıdır: dışındaki
 * numara engellenmez, yalnız uyarı (`length`) alır.
 *
 * @param {object} idx  Dizin.
 * @param {string} iso  Ülke.
 * @return {{min:number,max:number,softMin:number,softMax:number}} Aralık.
 */
function lengthRange(idx, iso) {
  const rule = idx.table[iso];
  const out = { min: 99, max: 0, softMin: 99, softMax: 0 };
  (idx.byDial[rule.dial] || [iso]).forEach((code) => {
    const row = idx.table[code];
    const strict = idx.strict.has(code);
    out.softMin = Math.min(out.softMin, row.min);
    out.softMax = Math.max(out.softMax, row.max);
    out.min = Math.min(out.min, strict ? row.min : Math.max(4, row.min - 3));
    out.max = Math.max(out.max, strict ? row.max : Math.min(15 - row.dial.length, row.max + 3));
  });
  return out;
}

/**
 * `+` sonrası rakamların başındaki arama kodunu bulur (en uzun eşleşme).
 *
 * @param {object} idx    Dizin.
 * @param {string} digits Rakamlar.
 * @return {{dial:string, isos:string[]}|null} Eşleşme.
 */
export function matchDial(idx, digits) {
  for (let len = 3; len >= 1; len -= 1) {
    const dial = digits.slice(0, len);
    if (idx.byDial[dial]) {
      return { dial, isos: idx.byDial[dial] };
    }
  }
  return null;
}

/**
 * @param {object}   idx         Dizin.
 * @param {string}   dial        Arama kodu.
 * @param {string[]} isos        Aynı kodu paylaşan ülkeler.
 * @param {string}   preferred   Tercih edilen (seçili/varsayılan) ülke.
 * @return {string} Gösterilecek ülke.
 */
function pickIso(idx, dial, isos, preferred) {
  if (isos.includes(preferred)) {
    return preferred;
  }
  const primary = idx.primary[dial];
  return primary && isos.includes(primary) ? primary : isos[0];
}

/**
 * Ulusal numarada baştaki deneme sıfırı(ları) atılır (İtalya gibi 0 korunan ülkelerde atılmaz).
 *
 * @param {object} idx      Dizin.
 * @param {string} iso      Ülke.
 * @param {string} national Rakamlar.
 * @return {string} Temiz numara.
 */
function stripTrunk(idx, iso, national) {
  return idx.table[iso].zero ? national : national.replace(/^0+/, '');
}

/**
 * Ülke kodu `+` olmadan yapıştırıldıysa (905301234567) ve numara sığmıyorsa kodu ayıklar.
 *
 * @param {object} idx      Dizin.
 * @param {string} iso      Ülke.
 * @param {string} national Rakamlar.
 * @return {string} Numara.
 */
function stripOwnDial(idx, iso, national) {
  const { dial, zero } = idx.table[iso];
  const { min, max } = lengthRange(idx, iso);
  if (national.length > max && national.startsWith(dial)) {
    const rest = national.slice(dial.length);
    const clean = zero ? rest : rest.replace(/^0+/, '');
    if (clean.length >= min && clean.length <= max) {
      return clean;
    }
  }
  return national;
}

/**
 * Ülkeyi belirler: `+`/`00` varsa arama kodundan, yoksa varsayılan ülkeden (bilinmiyorsa null).
 *
 * @param {boolean} explicit  Ülke kodu yazılmış mı.
 * @param {string}  digits    Rakamlar (`00` ayıklanmış).
 * @param {string}  preferred Varsayılan/seçili ülke.
 * @param {object}  idx       Dizin.
 * @return {{iso:string, national:string}|null} Ülke ve kalan rakamlar.
 */
function resolveCountry(explicit, digits, preferred, idx) {
  if (!explicit) {
    return idx.table[preferred] ? { iso: preferred, national: digits } : null;
  }
  const found = matchDial(idx, digits);
  return found ? { iso: pickIso(idx, found.dial, found.isos, preferred), national: digits.slice(found.dial.length) } : null;
}

/**
 * Girdiyi çözümler: `+90 530…`, `0090…`, `0530…`, `530…`.
 *
 * @param {unknown} raw        Ham girdi.
 * @param {string}  defaultIso Ülke kodu yoksa kullanılacak ülke.
 * @param {object}  idx        Dizin (`buildIndex`).
 * @return {{status:string,iso:string,dial:string,national:string,e164:string,warning:boolean}} Sonuç (status: empty|ok|short|long|unknown).
 */
export function parsePhone(raw, defaultIso, idx) {
  const out = { status: 'empty', iso: '', dial: '', national: '', e164: '', warning: false, hint: '' };
  const text = raw === null || raw === undefined ? '' : String(raw).trim();
  let digits = text.replace(/\D/g, '');
  if (digits === '') {
    return out;
  }
  const preferred = String(defaultIso || '').toLowerCase();
  let explicit = text[0] === '+';
  if (!explicit && digits.startsWith('00')) {
    explicit = true;
    digits = digits.replace(/^0+/, '');
    if (digits === '') {
      return out;
    }
  }
  const base = resolveCountry(explicit, digits, preferred, idx);
  if (!base) {
    return { ...out, status: 'unknown', national: explicit ? '' : digits };
  }
  const { iso } = base;
  let { national } = base;
  national = stripTrunk(idx, iso, national);
  if (!explicit) {
    national = stripOwnDial(idx, iso, national);
  }
  if (national === '') {
    return out;
  }
  const rule = idx.table[iso];
  const result = { ...out, iso, dial: rule.dial, national };
  const verdict = judge(national, rule, lengthRange(idx, iso));
  if (verdict.status !== 'ok') {
    return { ...result, status: verdict.status };
  }
  return { ...result, status: 'ok', e164: `+${rule.dial}${national}`, warning: verdict.hint !== '', hint: verdict.hint };
}

/**
 * Uzunluk kararı: engel sınırı dışı short/long; sınır içinde ama kural aralığı dışı geçer, yalnız uyarı (`length`);
 * sonra mobil önek ipucu (`mobile`).
 *
 * @param {string} national Rakamlar.
 * @param {object} rule     Ülke kuralı.
 * @param {object} range    `lengthRange` sonucu.
 * @return {{status:string, hint:string}} Karar.
 */
function judge(national, rule, range) {
  const len = national.length;
  if (len < range.min || len > range.max) {
    return { status: len < range.min ? 'short' : 'long', hint: '' };
  }
  if (len < range.softMin || len > range.softMax) {
    return { status: 'ok', hint: 'length' };
  }
  return { status: 'ok', hint: rule.mobile !== '' && !national.startsWith(rule.mobile) ? 'mobile' : '' };
}

/**
 * Ulusal numarayı ülkenin yaygın gruplamasıyla yazar (kalan haneler son gruba eklenir; grup bilinmiyorsa üçerli).
 *
 * @param {string} national Rakamlar.
 * @param {string} iso      Ülke.
 * @param {object} idx      Dizin.
 * @return {string} Biçimli numara.
 */
export function formatNational(national, iso, idx) {
  const rule = idx.table[iso];
  const sizes = rule && rule.groups ? rule.groups.split(' ').map(Number) : [];
  const parts = [];
  let at = 0;
  sizes.forEach((size) => {
    if (at < national.length) {
      parts.push(national.slice(at, at + size));
      at += size;
    }
  });
  if (at < national.length) {
    const rest = national.slice(at);
    if (sizes.length) {
      parts.push(rest);
    } else {
      parts.push(...(rest.match(/.{1,3}/g) || []));
    }
  }
  return parts.join(' ');
}

/**
 * Yazarken/yapıştırırken alan değerini üretir: ülke kodu ve baştaki 0 ayıklanır, ülke seçimi güncellenir,
 * seçili ülkenin en çok hanesi aşılamaz, değer biçimlenir.
 *
 * @param {string}   raw       Alanın o anki değeri.
 * @param {string}   iso       Seçili ülke.
 * @param {object}   idx       Dizin.
 * @param {Set<string>|null} [available] Seçicide bulunan ülkeler (yoksa hepsi).
 * @return {{iso:string, national:string, display:string, hold:boolean}} hold: `+` sonrası kod henüz tamamlanmadı, değer olduğu gibi kalır.
 */
export function typing(raw, iso, idx, available = null) {
  const text = String(raw === null || raw === undefined ? '' : raw);
  let digits = text.replace(/\D/g, '');
  const original = digits;
  let explicit = text.trim()[0] === '+';
  let current = iso;
  if (!explicit && digits.startsWith('00')) {
    explicit = true;
    digits = digits.replace(/^0+/, '');
  }
  if (explicit) {
    const found = digits === '' ? null : matchDial(idx, digits);
    const isos = found ? found.isos.filter((code) => !available || available.has(code)) : [];
    if (!found || !isos.length) {
      return { iso: current, national: '', display: `${text.trim()[0] === '+' ? '+' : ''}${original}`, hold: true };
    }
    current = pickIso(idx, found.dial, isos, iso);
    digits = digits.slice(found.dial.length);
  }
  if (!idx.table[current]) {
    return { iso: current, national: digits, display: text, hold: false };
  }
  let national = stripTrunk(idx, current, digits);
  if (!explicit) {
    national = stripOwnDial(idx, current, national);
  }
  national = national.slice(0, lengthRange(idx, current).max);
  return { iso: current, national, display: formatNational(national, current, idx), hold: false };
}
