import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('kabuk ekranı: waitAndAssertShellOverlap ortak', () => {
  it('layout / capture / matrix / conflicts yardımcısı ortak beklemeyi kullanır', () => {
    const layout = read('tests/e2e/helpers/layout.mjs');
    assert.match(layout, /import \{ waitAndAssertShellOverlap \}/);
    assert.match(layout, /waitAndAssertShellOverlap\(page/);
    assert.match(layout, /waitAndAssertShellOverlap\(shell\.page\(\)/);
    assert.match(layout, /CTA-GAP/);
    // FIX6: yan panelde dibe sabit çubuk boşluğu kabul; popup ve oturmayan çubuk hâlâ CTA-GAP
    assert.match(layout, /const isPanel = !!root\.querySelector\('\.wdp-side-panel-main'\)/);
    assert.match(layout, /const tooWide = gap > gapMax && !\(isPanel && ctaAtBottom\)/);

    const capture = read('tests/e2e/helpers/capture.mjs');
    assert.match(capture, /waitAndAssertShellOverlap/);
    assert.doesNotMatch(
      capture,
      /await waitShellAnimationsDone\(page, CHECK_MS\);\s*\} catch \(eWait\) \{\s*catchSoft\('shot:waitShell'/
    );

    const matrix = read('tests/e2e/helpers/matrix-scenarios.mjs');
    assert.match(matrix, /waitAndAssertShellOverlap\(page/);

    const conflicts = read('tests/e2e/run-conflicts.mjs');
    assert.match(conflicts, /waitAndAssertShellOverlap/);
  });
});
