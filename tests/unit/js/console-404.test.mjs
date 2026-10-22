import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyResourceUrl, assertNoConsoleErrors } from '../../../tests/e2e/helpers/checks.mjs';

describe('classifyResourceUrl', () => {
  it('favicon vs theme vs plugin', () => {
    assert.equal(classifyResourceUrl('https://x.test/favicon.ico'), 'favicon');
    assert.equal(
      classifyResourceUrl('https://x.test/wp-content/themes/blocksy/style.css'),
      'theme'
    );
    assert.equal(
      classifyResourceUrl(
        'https://x.test/wp-content/plugins/woo-donation-popup/assets/js/x.js'
      ),
      'plugin'
    );
    assert.equal(
      classifyResourceUrl('https://x.test/wp-content/plugins/other/a.js'),
      'other-plugin'
    );
    assert.equal(
      classifyResourceUrl('https://x.test/wp-content/uploads/Hedef-Dernegi-Logo.webp'),
      'upload'
    );
  });

  it('upload/theme/favicon 404 test başarısızlığı sayılmaz; plugin 404 sayılır', () => {
    assert.doesNotThrow(() =>
      assertNoConsoleErrors(['HTTP 404 https://x.test/wp-content/uploads/a.webp kind=upload'])
    );
    assert.doesNotThrow(() =>
      assertNoConsoleErrors(['HTTP 404 https://x.test/favicon.ico kind=favicon'])
    );
    assert.throws(
      () =>
        assertNoConsoleErrors([
          'HTTP 404 https://x.test/wp-content/plugins/woo-donation-popup/x.js kind=plugin',
        ]),
      /kind=plugin/
    );
    assert.doesNotThrow(() =>
      assertNoConsoleErrors([
        'XMLHttpRequest cannot load https://x.test/wp-admin/admin-ajax.php due to access control checks.',
      ])
    );
  });
});
