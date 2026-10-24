import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractJsStrings, scanTurkishStrings, verifyJsMap } from '../../../tools/i18n/verify-js.mjs';

describe('verify-js', () => {
  it('yorumlar atlanır, dizgiler çıkarılır', () => {
    const src = `// Sepete Ekle yorum\n/* Bağış */ const a = 'Add to cart'; const b = "Bağış Yap"; const c = \`Tutar\`;`;
    const s = extractJsStrings(src).map((x) => x.text);
    assert.deepEqual(s, ['Add to cart', 'Bağış Yap', 'Tutar']);
  });

  it('tarama: Türkçe dizgi bulur, yorumda bulmaz', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-js-'));
    fs.writeFileSync(path.join(dir, 'a.js'), "// Bağış\nconst x = 'Bağış Yap';\nconst y = 'Donate';\n");
    const prev = process.env.WDP_I18N_ROOT;
    const hits = scanTurkishStrings([dir]);
    if (prev === undefined) delete process.env.WDP_I18N_ROOT;
    assert.equal(hits.length, 1);
    assert.equal(hits[0].line, 2);
  });
});
