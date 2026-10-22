/**
 * Ürün sayfası görünüm eşlemesi — ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDisplay,
  expectedPrimaryKind,
  resolveDisplayFromSources,
  classifyVisiblePluginEntry,
  classifyNativeCartVisibility,
  displayMismatchWarning,
  LOOP_EXCLUDE_SEL,
  NATIVE_CART_FORM_SEL,
  STICKY_ATC_SEL,
} from '../../../tests/e2e/helpers/product-page-ui.mjs';

describe('normalizeDisplay', () => {
  it('yalnız eklenti DISPLAYS', () => {
    assert.equal(normalizeDisplay('button_panel'), 'button_panel');
    assert.equal(normalizeDisplay('inline'), 'inline');
    assert.equal(normalizeDisplay('button_popup'), 'button_popup');
    assert.equal(normalizeDisplay('popup'), '');
    assert.equal(normalizeDisplay(''), '');
  });
});

describe('expectedPrimaryKind', () => {
  it('form / panel / popup', () => {
    assert.equal(expectedPrimaryKind('inline'), 'form');
    assert.equal(expectedPrimaryKind('button_panel'), 'panel');
    assert.equal(expectedPrimaryKind('button_popup'), 'popup');
    assert.equal(expectedPrimaryKind(''), '');
  });
});

describe('resolveDisplayFromSources', () => {
  it('katalog öncelikli, DOM yedek', () => {
    assert.equal(resolveDisplayFromSources({ display: 'button_panel', displayAttr: 'inline' }), 'button_panel');
    assert.equal(resolveDisplayFromSources({ display: '', displayAttr: 'inline' }), 'inline');
    assert.equal(resolveDisplayFromSources({}), '');
  });
});

describe('LOOP_EXCLUDE_SEL', () => {
  it('döngü/ilgili kartlar (klasik + Woo blok) ve wdp-loop-donate hariç', () => {
    assert.match(LOOP_EXCLUDE_SEL, /\.related/);
    assert.match(LOOP_EXCLUDE_SEL, /\.wp-block-woocommerce-related-products/);
    assert.match(LOOP_EXCLUDE_SEL, /\.wp-block-woocommerce-product-collection/);
    assert.match(LOOP_EXCLUDE_SEL, /\.wdp-loop-donate/);
  });
});

describe('classifyVisiblePluginEntry', () => {
  it('tam olarak 1 form veya 1 eklenti düğmesi geçer', () => {
    assert.equal(classifyVisiblePluginEntry({ inlineVisible: 1, panelVisible: 0, popupVisible: 0 }).kind, 'form');
    assert.equal(classifyVisiblePluginEntry({ inlineVisible: 0, panelVisible: 1, popupVisible: 0 }).kind, 'panel');
    assert.equal(classifyVisiblePluginEntry({ inlineVisible: 0, panelVisible: 0, popupVisible: 1 }).kind, 'popup');
    assert.equal(classifyVisiblePluginEntry({ inlineVisible: 1, panelVisible: 0, popupVisible: 0 }).ok, true);
  });

  it('0 giriş HATA — tema düğmesi sayılmaz, bağış alınamaz', () => {
    const r = classifyVisiblePluginEntry({ inlineVisible: 0, panelVisible: 0, popupVisible: 0 });
    assert.equal(r.ok, false);
    assert.equal(r.total, 0);
    assert.match(r.reason, /yok/);
    assert.match(r.reason, /tema düğmesi sayılmaz/);
  });

  it('>1 giriş HATA', () => {
    const formAndBtn = classifyVisiblePluginEntry({ inlineVisible: 1, panelVisible: 1, popupVisible: 0 });
    assert.equal(formAndBtn.ok, false);
    assert.equal(formAndBtn.total, 2);
    const twoBtns = classifyVisiblePluginEntry({ inlineVisible: 0, panelVisible: 1, popupVisible: 1 });
    assert.equal(twoBtns.ok, false);
    assert.equal(twoBtns.total, 2);
  });
});

describe('classifyNativeCartVisibility', () => {
  it('0 yerel form/düğme/sticky geçer', () => {
    assert.equal(classifyNativeCartVisibility({ nativeFormsVisible: 0, nativeButtonsVisible: 0, stickyVisible: 0 }).ok, true);
  });

  it('görünür yerel form HATA', () => {
    const r = classifyNativeCartVisibility({ nativeFormsVisible: 1, probe: 'chain=form.cart < div.summary' });
    assert.equal(r.ok, false);
    assert.match(r.reason, /form=1/);
    assert.match(r.reason, /chain=form\.cart/);
  });

  it('sticky HATA', () => {
    const r = classifyNativeCartVisibility({ stickyVisible: 1 });
    assert.equal(r.ok, false);
    assert.match(r.reason, /sticky=1/);
  });
});

describe('native selectors', () => {
  it('tema sınıfı yok, döngü hariç', () => {
    assert.match(NATIVE_CART_FORM_SEL, /form\.cart/);
    assert.match(NATIVE_CART_FORM_SEL, /wdp-form/);
    assert.doesNotMatch(NATIVE_CART_FORM_SEL, /storefront/);
    assert.match(STICKY_ATC_SEL, /sticky-add-to-cart/);
    assert.doesNotMatch(STICKY_ATC_SEL, /storefront/);
  });
});

describe('displayMismatchWarning', () => {
  it('ayar inline, sayfa düğme → UYARI (HATA değil)', () => {
    assert.equal(
      displayMismatchWarning('inline', 'panel'),
      'ayar inline, sayfa düğme gösteriyor — tema/oluşturucu şablonu'
    );
    assert.equal(
      displayMismatchWarning('inline', 'popup'),
      'ayar inline, sayfa düğme gösteriyor — tema/oluşturucu şablonu'
    );
  });

  it('eşleşiyorsa boş', () => {
    assert.equal(displayMismatchWarning('inline', 'form'), '');
    assert.equal(displayMismatchWarning('button_panel', 'panel'), '');
    assert.equal(displayMismatchWarning('button_popup', 'popup'), '');
  });

  it('ayar düğme, sayfa form', () => {
    assert.match(displayMismatchWarning('button_panel', 'form'), /ayar button_panel, sayfa form/);
    assert.match(displayMismatchWarning('button_panel', 'form'), /tema\/oluşturucu şablonu/);
  });
});
