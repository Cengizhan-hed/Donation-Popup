/**
 * i18n görünür metin: normalize, maskeleme, karşılaştırma, Elementor başlıkları.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env-root.mjs';

export const TR_LETTERS_RE = /[çğıöşüÇĞİÖŞÜ]/;

/** Dönüşüm sonrası en_US için bilinen Türkçe sözcükler (yaklaşık 60). */
export const TR_WORDS = [
  'Bağış',
  'Bağışçı',
  'Sepete',
  'Sepet',
  'Ödeme',
  'Öde',
  'Tutar',
  'Kaydet',
  'Ad Soyad',
  'Telefon',
  'E-posta',
  'Zorunlu',
  'Hata',
  'Başarılı',
  'Yükleniyor',
  'Hisse',
  'Hissedar',
  'Hisseli',
  'Kampanya',
  'Hedef',
  'İptal',
  'Kapat',
  'Gönder',
  'Devam',
  'Geri',
  'Ürün',
  'Fiyat',
  'Minimum',
  'Maksimum',
  'Geçerli',
  'Eksik',
  'Anonim',
  'İthaf',
  'Not',
  'Ara',
  'Ekle',
  'Sil',
  'Düzenle',
  'Ayarlar',
  'Form',
  'Modal',
  'Panel',
  'Liste',
  'Kategori',
  'Gelişmiş',
  'Tasarım',
  'Normal',
  'Progress',
  'Başarı',
  'Kurulum',
  'Görünüm',
  'Renk',
  'Genişlik',
  'Yükseklik',
  'Etiket',
  'Açıklama',
  'Seçiniz',
  'Onay',
  'Uyarı',
  'Gizlilik',
  'Makbuz',
  'Sipariş',
  'Sadaka',
  'Alt Bağış',
];

const TR_WORD_RE = new RegExp(
  `(^|[^A-Za-zÇĞİÖŞÜçğıöşü])(?:${TR_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=$|[^A-Za-zÇĞİÖŞÜçğıöşü])`,
  'i'
);

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeVisibleText(raw) {
  let t = String(raw || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\u200b/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  t = t.replace(/\b[0-3]?\d[./-][0-1]?\d[./-](?:\d{2}|\d{4})\b/g, '#DATE#');
  t = t.replace(/\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?\b/g, '#DATE#');
  t = t.replace(/#\d+\b/g, '#ID#');
  t = t.replace(/\b(?:order|wc_order|post|product)[-_ ]?\d+\b/gi, '#ID#');
  t = t.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '#UUID#');
  t = t.replace(/\b\d{1,3}(?:[.\s]\d{3})+(?:[,.]\d+)?\b/g, '#AMT#');
  t = t.replace(/\b\d+[,.]\d+\b/g, '#AMT#');
  t = t.replace(/\b\d+\b/g, '#N#');
  t = t.replace(/[ \t]+/g, ' ');
  t = t
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
  return t.trim();
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function textToLines(text) {
  return normalizeVisibleText(text)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * @param {string} text
 * @returns {{ letters: string[], words: string[] }}
 */
export function findTurkishInText(text) {
  const letters = [];
  const m = String(text || '').match(new RegExp(TR_LETTERS_RE, 'g'));
  if (m) letters.push(...new Set(m));
  const words = [];
  for (const w of TR_WORDS) {
    const re = new RegExp(
      `(^|[^A-Za-zÇĞİÖŞÜçğıöşü])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^A-Za-zÇĞİÖŞÜçğıöşü])`,
      'i'
    );
    if (re.test(text)) words.push(w);
  }
  return { letters, words };
}

/**
 * @param {{ id: string, lines: string[] }} a
 * @param {{ id: string, lines: string[] }} b
 * @returns {string[]}
 */
export function diffScreenLines(a, b) {
  const left = a.lines || [];
  const right = b.lines || [];
  const diffs = [];
  const n = Math.max(left.length, right.length);
  for (let i = 0; i < n; i += 1) {
    if ((left[i] || '') !== (right[i] || '')) {
      diffs.push(`L${i + 1}: ${JSON.stringify(left[i] || '')} ≠ ${JSON.stringify(right[i] || '')}`);
    }
  }
  return diffs;
}

function unescapePhp(quoted) {
  if (!quoted) return '';
  const q = quoted[0];
  const inner = quoted.slice(1, -1);
  if (q === "'") return inner.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  return inner.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

/**
 * Elementor widget get_title / get_keywords — PHP sınıflarından (tarayıcı yok).
 * @param {string} [root]
 */
export function extractElementorWidgetStrings(root = ROOT) {
  const dir = path.join(root, 'includes/elementor');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.php')).sort()) {
    const src = fs.readFileSync(path.join(dir, name), 'utf8');
    const titleM = src.match(/function\s+get_title\s*\([^)]*\)\s*\{[\s\S]*?return\s+(__|_e|_x|esc_html__)\(\s*(['"])((?:\\.|(?!\2).)*)\2/);
    const title = titleM ? unescapePhp(titleM[2] + titleM[3] + titleM[2]) : '';
    const keywords = [];
    const kwBlock = src.match(/function\s+get_keywords\s*\([^)]*\)\s*\{([\s\S]*?)return\s+array\s*\(([\s\S]*?)\)\s*;/);
    if (kwBlock) {
      const re = /(['"])((?:\\.|(?!\1).)*)\1/g;
      let m;
      while ((m = re.exec(kwBlock[2]))) keywords.push(unescapePhp(m[0]));
    }
    const classM = src.match(/class\s+(\S+)\s+extends/);
    out.push({
      file: `includes/elementor/${name}`,
      class: classM ? classM[1] : '',
      title,
      keywords,
      hasGetKeywords: /function\s+get_keywords\s*\(/.test(src),
    });
  }
  return out;
}

export function goldenDir(locale = 'tr_TR') {
  return path.join(ROOT, 'tests/golden/i18n', locale);
}

export function screenPath(locale, configId, screenId) {
  return path.join(goldenDir(locale), configId, `${screenId}.json`);
}

export function writeScreen(locale, configId, payload) {
  const file = screenPath(locale, configId, payload.id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return file;
}

export function readScreen(locale, configId, screenId) {
  const file = screenPath(locale, configId, screenId);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export { TR_WORD_RE };
