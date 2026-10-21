import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyResourceUrl } from '../../../tests/e2e/helpers/checks.mjs';

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
  });
});
