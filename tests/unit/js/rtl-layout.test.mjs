import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isRtlLocale, RTL_LAYOUT_CODE } from '../../e2e/helpers/rtl-layout.mjs';
import { loadMatrix, rtlSpec, isRtlLocale as coverRtl } from '../../e2e/helpers/matrix-cover.mjs';
import { ROOT } from '../../e2e/helpers/env-root.mjs';

const srcCss = path.join(ROOT, 'assets/css/src');

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

  it('CSS yığını ve rtl.css yan panel / sheen içerir', () => {
    const stack = fs.readFileSync(path.join(ROOT, 'includes/config/frontend-css-stack.php'), 'utf8');
    assert.match(stack, /src\/foundation\/rtl\.css/);
    const rtl = fs.readFileSync(path.join(srcCss, 'foundation/rtl.css'), 'utf8');
    assert.match(rtl, /wdp-side-panel-slide-in-rtl/);
    assert.match(rtl, /translateX\(-100%\)/);
    assert.match(rtl, /wdp-progress-sheen-rtl/);
  });

  it('i18n-locale.php RTL text_direction yazar', () => {
    const php = fs.readFileSync(path.join(ROOT, 'tests/local-wp/i18n-locale.php'), 'utf8');
    assert.match(php, /wdp_i18n_locale_is_rtl/);
    assert.match(php, /text_direction/);
    assert.match(php, /he_IL|ar/);
  });

  it('JS konum satırları yön okur (metin yok)', () => {
    const progress = fs.readFileSync(path.join(ROOT, 'assets/js/src/progress-bar.js'), 'utf8');
    assert.match(progress, /insetInlineStart/);
    assert.equal(progress.includes("el.style.left ="), false);
    const phone = fs.readFileSync(path.join(ROOT, 'assets/js/src/phone-input.js'), 'utf8');
    assert.match(phone, /document\.documentElement\.dir/);
    const modal = fs.readFileSync(path.join(ROOT, 'assets/js/src/modal.js'), 'utf8');
    assert.match(modal, /document\.documentElement\.dir/);
    const cta = fs.readFileSync(path.join(ROOT, 'assets/js/src/core/cta-viewport.js'), 'utf8');
    assert.match(cta, /data-wdp-dir/);
    const cart = fs.readFileSync(path.join(ROOT, 'assets/js/src/cart/woo.js'), 'utf8');
    assert.match(cart, /textAlign = "start"/);
    assert.match(cart, /paddingInlineEnd/);
  });

  it('yan panel mantıksal yarıçap + gölge jetonu', () => {
    const css = fs.readFileSync(path.join(srcCss, 'components/side-panel.css'), 'utf8');
    assert.match(css, /border-start-start-radius/);
    assert.match(css, /border-inline-start/);
    assert.match(css, /--wdp-side-panel-shadow/);
    assert.match(css, /inset-inline-end/);
  });
});
