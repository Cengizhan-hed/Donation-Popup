/** "Klasör yok / boş" denetimleri için: macOS/Windows artıklarını (.DS_Store, Thumbs.db, ._*) yok sayar. */
import fs from 'node:fs';
import path from 'node:path';

export function isOsJunk(name) {
  return name === '.DS_Store' || name === 'Thumbs.db' || name.startsWith('._');
}

/** Klasör hiç yoksa ya da (alt klasörler dahil) yalnız OS artıkları içeriyorsa true; başka dosya varsa false. */
export function dirAbsentOrOnlyOsJunk(dir) {
  let st;
  try { st = fs.lstatSync(dir); } catch { return true; }
  if (!st.isDirectory()) return false;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!dirAbsentOrOnlyOsJunk(p)) return false; } else if (!isOsJunk(e.name)) return false;
  }
  return true;
}
