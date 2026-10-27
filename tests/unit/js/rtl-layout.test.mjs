import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isRtlLocale, RTL_LAYOUT_CODE } from '../../e2e/helpers/rtl-layout.mjs';
import { loadMatrix, rtlSpec, isRtlLocale as coverRtl } from '../../e2e/helpers/matrix-cover.mjs';
import { ROOT } from '../../e2e/helpers/env-root.mjs';

describe('RTL yerleşim', () => {
  it('locale tanıma ar/he_IL/fa_IR/ur', () => {
    assert.equal(isRtlLocale('ar'), true);
    assert.equal(isRtlLocale('he_IL'), true);
    assert.equal(isRtlLocale('fa_IR'), true);
    assert.equal(isRtlLocale('ur'), true);
    assert.equal(isRtlLocale('tr_TR'), false);
    assert.equal(isRtlLocale('en_US'), false);
    assert.equal(coverRtl('he_IL'), true);
    assert.equal(RTL_LAYOUT_CODE, 'RTL-LAYOUT');
  });

  it('matrix.json rtl yapılandırması ar + he_IL', () => {
    const spec = rtlSpec(loadMatrix());
    assert.deepEqual(spec.locales, ['ar', 'he_IL']);
    assert.ok(spec.devices.includes('iphone'));
    assert.ok(spec.devices.includes('desktop'));
    assert.ok(spec.screens.includes('popup'));
    assert.ok(spec.screens.includes('panel'));
  });

  it('i18n-locale.php RTL text_direction yazar', () => {
    const php = fs.readFileSync(path.join(ROOT, 'tests/local-wp/i18n-locale.php'), 'utf8');
    assert.match(php, /wdp_i18n_locale_is_rtl/);
    assert.match(php, /text_direction/);
    assert.match(php, /he_IL|ar/);
  });

});
