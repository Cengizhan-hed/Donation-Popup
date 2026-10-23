/**
 * E2E AJAX hata türü sınıflandırması (kişisel veri yok).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPluginAjaxErrorKind } from '../../e2e/helpers/ajax-error-kind.mjs';

describe('classifyPluginAjaxErrorKind', () => {
  it('200 + success:false + rate_limit → rate', () => {
    assert.equal(
      classifyPluginAjaxErrorKind(200, { success: false, code: 'rate_limit', message: 'Çok fazla istek gönderildi.' }),
      'rate'
    );
  });
  it('429 → rate', () => {
    assert.equal(classifyPluginAjaxErrorKind(429, { success: false, message: 'x' }), 'rate');
  });
  it('403 nonce → nonce', () => {
    assert.equal(
      classifyPluginAjaxErrorKind(403, { success: false, code: 'nonce' }),
      'nonce'
    );
  });
  it('403 capability → capability', () => {
    assert.equal(
      classifyPluginAjaxErrorKind(403, { success: false, code: 'capability', message: 'Yetkiniz bulunmuyor' }),
      'capability'
    );
  });
  it('400 geçersiz ürün → id', () => {
    assert.equal(
      classifyPluginAjaxErrorKind(400, { success: false, message: 'Geçersiz ürün ID' }),
      'id'
    );
  });
});
