/**
 * languages/*.po|.pot|.mo zip'e girer; parts/ girmez.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDistignore } from '../../../scripts/lib/pack-excludes.mjs';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';

function isExcluded(rel, patterns) {
  const n = rel.replace(/\\/g, '/');
  for (const p of patterns) {
    if (p.endsWith('/')) {
      const dir = p.slice(0, -1);
      if (n === dir || n.startsWith(dir + '/')) return true;
      continue;
    }
    if (p.includes('*')) {
      const re = new RegExp(
        '^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$'
      );
      if (re.test(n) || re.test(n.split('/').pop())) return true;
      continue;
    }
    if (n === p || n.endsWith('/' + p)) return true;
  }
  return false;
}

describe('i18n pack', () => {
  it('distignore parts/ hariç languages kataloglarını dışlamaz', () => {
    const list = parseDistignore(ROOT);
    assert.ok(list.some((p) => p === 'languages/parts/' || p === 'languages/parts'));
    assert.equal(
      list.some((p) => p === 'languages/' || p === 'languages' || p === 'languages/*'),
      false
    );
    assert.equal(isExcluded('languages/woo-donation-popup.pot', list), false);
    assert.equal(isExcluded('languages/woo-donation-popup-tr_TR.po', list), false);
    assert.equal(isExcluded('languages/woo-donation-popup-tr_TR.mo', list), false);
    assert.equal(isExcluded('languages/parts/A1.po', list), true);
    assert.equal(isExcluded('languages/parts/.gitkeep', list), true);
  });
});
