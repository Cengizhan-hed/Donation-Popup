/**
 * 122-cascade: ön yüz CSS parçaları satır içi, çizim sırasıyla basılır (Assets::inline_styles). Aynı seçici iki parçada
 * tanımlıysa sonra basılanın (aynı özgüllükteki) temel kuralı önce basılanın varyantını ezer (staging bulgusu: kampanya
 * paketindeki `.donation-panel-btn` tekrarı `--outline` düğmesini dolu çizdi). Kalıcı kural: bir seçici (at-kural
 * bağlamıyla) yalnız TEK parçada tanımlıdır; ortak kurallar `ui-core` / `ui-controls` / `ui-dpx` parçalarındadır.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(path.join(ROOT, 'package.json'));
const postcss = require('postcss');

/** Satır içi basılan ön yüz parçaları (Assets::SHARED + modül tanımları). */
const CHUNKS = ['ui-core', 'ui-controls', 'ui-dpx', 'ui-fields', 'experiences', 'compact', 'compact-tax', 'progress', 'list', 'campaign', 'donor-account', 'side-cart', 'thanks'];

/**
 * Parçanın anahtarları: "@bağlam|seçici" ve "@bağlam|seçici|özellik" (aynı seçiciye farklı özellik yazan parçalar
 * sıra bağımsızdır, ör. `.donation-panel{--dp-*}` + `.donation-panel{--dpx-*}`; aynı özellik ise çakışmadır).
 *
 * @param {string} css Derlenmiş CSS.
 * @param {boolean} withProps Özellik düzeyinde anahtar.
 * @return {Set<string>} Anahtarlar.
 */
function selectorKeys(css, withProps = true) {
  const keys = new Set();
  postcss.parse(css).walkRules((rule) => {
    let ctx = '';
    for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) {
      if (p.type === 'atrule') ctx = `@${p.name} ${p.params} ${ctx}`;
    }
    for (const s of rule.selectors) {
      const sel = `${ctx}|${s.replace(/\s+/g, ' ').trim()}`;
      if (!withProps) keys.add(sel);
      else rule.walkDecls((d) => keys.add(`${sel}|${d.prop}`));
    }
  });
  postcss.parse(css).walkAtRules('keyframes', (at) => keys.add(`@keyframes ${at.params}`));
  return keys;
}

describe('ön yüz CSS sıra bağımsızlığı', () => {
  const files = CHUNKS.map((c) => [c, path.join(ROOT, 'assets/build', c, 'index.css')]);
  const built = files.every(([, f]) => fs.existsSync(f));

  it('hiçbir seçici+özellik iki satır içi parçada tanımlı değil', { skip: !built && 'derleme çıktısı yok (npm run build)' }, () => {
    const owner = new Map();
    const dups = [];
    for (const [chunk, file] of files) {
      for (const key of selectorKeys(fs.readFileSync(file, 'utf8'))) {
        if (owner.has(key) && owner.get(key) !== chunk) dups.push(`${key} (${owner.get(key)} + ${chunk})`);
        else owner.set(key, chunk);
      }
    }
    assert.deepEqual(dups, [], 'Tekrar eden seçiciler sıra bağımlı sonuç üretir');
  });

  it('düğme temeli ve varyantları yalnız çekirdekte', { skip: !built && 'derleme çıktısı yok' }, () => {
    const core = selectorKeys(fs.readFileSync(path.join(ROOT, 'assets/build/ui-core/index.css'), 'utf8'), false);
    for (const s of ['.donation-panel-btn', '.donation-panel-btn--secondary', '.donation-panel-btn--ghost', '.donation-panel-iconbtn', '.donation-panel-ico']) {
      assert.ok(core.has(`|${s}`), `${s} çekirdekte`);
    }
  });
});
