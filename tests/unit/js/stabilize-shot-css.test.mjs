import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STABILIZE_SHOT_CSS } from '../../e2e/helpers/stabilize-shot-css.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

describe('stabilize-shot-css', () => {
  it('hides admin bar and WooCommerce coming-soon banner', () => {
    assert.match(STABILIZE_SHOT_CSS, /#wpadminbar/);
    assert.match(STABILIZE_SHOT_CSS, /coming-soon-footer-banner/);
    assert.match(STABILIZE_SHOT_CSS, /#coming-soon-footer-banner/);
    assert.match(STABILIZE_SHOT_CSS, /woocommerce-coming-soon-banner/);
    assert.match(STABILIZE_SHOT_CSS, /woocommerce-store-notice/);
    assert.match(STABILIZE_SHOT_CSS, /woocommerce-info/);
    assert.match(STABILIZE_SHOT_CSS, /wc-block-components-notice-banner/);
  });

  it('plugin frontend CSS/PHP does not hide admin bar or coming-soon band', () => {
    const files = [
      ...walk(path.join(root, 'assets/src')).filter((f) => f.endsWith('.css')),
      ...walk(path.join(root, 'src')).filter((f) => f.endsWith('.php')),
    ];
    assert.ok(files.length > 10, 'kaynak dosya bulunamadı');
    const hits = [];
    for (const f of files) {
      const t = fs.readFileSync(f, 'utf8');
      if (/#wpadminbar/.test(t) || /coming-soon-footer-banner/.test(t) || /woocommerce-coming-soon-banner/.test(t)) {
        hits.push(path.relative(root, f));
      }
    }
    assert.deepEqual(hits, [], `eklenti kaynakta screenshot gizleme sızıntısı: ${hits.join(', ')}`);
  });
});
