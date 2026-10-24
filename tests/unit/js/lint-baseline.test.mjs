/**
 * Lint baseline + değişen satır kapısı — ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  categorizeIssue,
  issueFingerprint,
  summarizeIssues,
} from '../../../scripts/lib/lint-report.mjs';
import { newErrorsOnChangedLines, baselineFingerprints } from '../../../scripts/lib/lint-baseline.mjs';

describe('lint kategori', () => {
  it('güvenlik / i18n / tip ayırır', () => {
    assert.equal(categorizeIssue('WordPress.Security.EscapeOutput.OutputNotEscaped', ''), 'güvenlik');
    assert.equal(categorizeIssue('WordPress.Security.NonceVerification.Missing', ''), 'güvenlik');
    assert.equal(categorizeIssue('WordPress.WP.I18n.TextDomainMismatch', ''), 'i18n');
    assert.equal(categorizeIssue('PHPCompatibility.FunctionUse.RemovedFunctions', ''), 'uyumluluk');
    assert.equal(categorizeIssue('phpstan', 'Function foo has unused parameter'), 'ölü kod');
    assert.equal(categorizeIssue('missingType.return', ''), 'tip');
    assert.equal(categorizeIssue('WordPress.Arrays.ArrayDeclarationSpacing', ''), 'stil');
  });
});

describe('lint baseline kapısı', () => {
  it('yalnız değişen satırdaki yeni parmak izini kırmızı sayar', () => {
    const issues = [
      { file: 'includes/a.php', line: 10, source: 'S.New', message: 'yeni' },
      { file: 'includes/a.php', line: 11, source: 'S.Old', message: 'eski' },
      { file: 'includes/a.php', line: 99, source: 'S.New', message: 'dokunulmayan' },
    ];
    const lines = new Map([['includes/a.php', new Set([10, 11])]]);
    const baseline = baselineFingerprints({
      errors: [{ file: 'includes/a.php', source: 'S.Old', message: 'eski' }],
    });
    const { neu, existingOnChanged } = newErrorsOnChangedLines(issues, lines, baseline);
    assert.equal(neu.length, 1);
    assert.equal(neu[0].line, 10);
    assert.equal(existingOnChanged.length, 1);
    assert.equal(existingOnChanged[0].source, 'S.Old');
  });

  it('parmak izi satıra bağlı değildir', () => {
    assert.equal(
      issueFingerprint({ file: 'a.php', line: 1, source: 'X', message: 'm' }),
      issueFingerprint({ file: 'a.php', line: 9, source: 'X', message: 'm' })
    );
  });

  it('özet kategori sayar', () => {
    const s = summarizeIssues([
      { file: 'a.php', source: 'WordPress.Security.EscapeOutput', message: 'x', fixable: true },
      { file: 'a.php', source: 'WordPress.WP.I18n', message: 'y' },
      { file: 'b.php', source: 'Generic.WhiteSpace', message: 'z', fixable: true },
    ]);
    assert.equal(s.total, 3);
    assert.equal(s.fixable, 2);
    assert.equal(s.categories.güvenlik, 1);
    assert.equal(s.categories.i18n, 1);
    assert.equal(s.categories.stil, 1);
    assert.equal(s.topFiles[0].file, 'a.php');
  });
});
