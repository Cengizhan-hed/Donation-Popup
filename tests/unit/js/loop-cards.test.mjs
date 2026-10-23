/**
 * İlgili ürün / döngü kart görünürlük sınıflandırması — ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLoopNodeVisible,
  classifyLoopCardsResult,
  formatLoopCardFail,
  shopCardsHiddenFailure,
  SHOP_CARD_SEL,
} from '../../../tests/e2e/helpers/loop-cards.mjs';

describe('isLoopNodeVisible', () => {
  it('opacity/visibility/boyut', () => {
    assert.equal(isLoopNodeVisible({ display: 'block', visibility: 'visible', opacity: '1', w: 80, h: 40 }), true);
    assert.equal(isLoopNodeVisible({ display: 'none', visibility: 'visible', opacity: '1', w: 80, h: 40 }), false);
    assert.equal(isLoopNodeVisible({ display: 'block', visibility: 'hidden', opacity: '1', w: 80, h: 40 }), false);
    assert.equal(isLoopNodeVisible({ display: 'block', visibility: 'visible', opacity: '0', w: 80, h: 40 }), false);
    assert.equal(isLoopNodeVisible({ display: 'block', visibility: 'visible', opacity: '1', w: 2, h: 40 }), false);
  });
});

describe('classifyLoopCardsResult', () => {
  const hidden = {
    i: 0,
    titleText: 'Zakat',
    titleVisible: false,
    btnText: 'Bağış Yap',
    btnVisible: false,
    cardVisible: false,
  };
  const ok = {
    i: 0,
    titleText: 'Zakat',
    titleVisible: true,
    btnText: 'Bağış Yap',
    btnVisible: true,
    cardVisible: true,
  };

  it('uzak ürün: gizli bölüm atlanır (hata değil)', () => {
    const r = classifyLoopCardsResult([hidden], { requireVisible: false });
    assert.equal(r.status, 'skip');
    assert.equal(r.reason, 'hidden-section');
  });

  it('matris: gizli bölüm hata', () => {
    const r = classifyLoopCardsResult([hidden], { requireVisible: true });
    assert.equal(r.status, 'fail');
    assert.equal(r.reason, 'hidden-section');
  });

  it('görünür kart başlık+düğme', () => {
    assert.equal(classifyLoopCardsResult([ok], { requireVisible: true }).status, 'ok');
  });

  it('görünür kartta düğme yok', () => {
    const r = classifyLoopCardsResult([{ ...ok, btnVisible: false }], { requireVisible: true });
    assert.equal(r.status, 'fail');
    assert.equal(r.reason, 'incomplete-card');
    assert.match(formatLoopCardFail(r.bad[0]), /btnVis=false/);
  });

  it('kart yok: uzak skip, matris fail', () => {
    assert.equal(classifyLoopCardsResult([], { requireVisible: false }).status, 'skip');
    assert.equal(classifyLoopCardsResult([], { requireVisible: true }).status, 'fail');
  });
});

describe('shopCardsHiddenFailure', () => {
  it('timeout kırmızı (sessiz yutma yok)', () => {
    const f = shopCardsHiddenFailure(24, 'Timeout 10000ms');
    assert.equal(f.check, 'loop-cards-shop');
    assert.match(f.description, /görünür ürün kartı yok/);
    assert.match(f.detail, /attached=24/);
    assert.match(f.detail, /Timeout/);
    assert.match(SHOP_CARD_SEL, /wdp-e2e-shop-products/);
  });
});
