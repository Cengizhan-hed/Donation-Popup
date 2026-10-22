/**
 * Ürün sayfası görünüm eşlemesi — ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDisplay,
  expectedPrimaryKind,
  resolveDisplayFromSources,
  matchPrimaryUi,
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

describe('matchPrimaryUi', () => {
  it('panel düğmesi; döngü sayılmaz (yalnız birincil sayılar)', () => {
    assert.equal(matchPrimaryUi({ kind: 'panel', inlineVisible: 0, panelVisible: 1, popupVisible: 0 }).ok, true);
    assert.equal(matchPrimaryUi({ kind: 'panel', inlineVisible: 0, panelVisible: 0, popupVisible: 0 }).ok, false);
    assert.equal(matchPrimaryUi({ kind: 'form', inlineVisible: 1, panelVisible: 0, popupVisible: 0 }).ok, true);
    assert.equal(matchPrimaryUi({ kind: 'form', inlineVisible: 0, panelVisible: 1, popupVisible: 0 }).ok, false);
    assert.equal(matchPrimaryUi({ kind: '', inlineVisible: 0, panelVisible: 0, popupVisible: 0 }).reason, 'skip');
  });
});
