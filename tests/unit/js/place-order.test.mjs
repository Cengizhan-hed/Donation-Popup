import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../../tests/e2e/helpers/env-root.mjs';
import {
  PLACE_ORDER_NAME_RE,
  CONTINUE_NAME_RE,
  DONOR_NAME,
  SHAREHOLDER_NAME,
  parseOrderIdFromUrl,
  assertLocalOrderRecord,
} from '../../../tests/e2e/helpers/place-order.mjs';
import { skipOrderReasonFor, pickOfflineGateway } from '../../../tests/e2e/helpers/checkout-setup.mjs';

describe('yerel sipariş (3M)', () => {
  it('Place order rol/ad eşleşir; #place_order varsayımı yok', () => {
    assert.match('Place order', PLACE_ORDER_NAME_RE);
    assert.match('Sipariş ver', PLACE_ORDER_NAME_RE);
    assert.match('Siparişi onayla', PLACE_ORDER_NAME_RE);
    assert.doesNotMatch('#place_order', PLACE_ORDER_NAME_RE);
    assert.match('Continue', CONTINUE_NAME_RE);
    assert.doesNotMatch('Place order', CONTINUE_NAME_RE);
  });

  it('bağışçı adı Türkçe karakter örneğini içerir', () => {
    assert.match(DONOR_NAME, /Çağrı/);
    assert.match(DONOR_NAME, /Şükrü/);
    assert.match(DONOR_NAME, /Öztürk/);
    assert.match(DONOR_NAME, /İğdır/);
    assert.match(SHAREHOLDER_NAME, /Gülşen|Çığ|İğdır/);
  });

  it('order-received URL’den id okur', () => {
    assert.equal(parseOrderIdFromUrl('http://127.0.0.1:8899/checkout/order-received/42/?key=wc_order_x'), 42);
    assert.equal(parseOrderIdFromUrl('http://127.0.0.1:8899/checkout/?order=9'), 9);
    assert.equal(parseOrderIdFromUrl('http://127.0.0.1:8899/checkout/'), 0);
  });

  it('sipariş kaydı TR karakter ve anonim silmez', () => {
    const rec = {
      ok: true,
      total: '10',
      currency: 'TRY',
      hpos: true,
      billingName: DONOR_NAME,
      billingEmail: 'cagri.sukru@wdp-e2e.test',
      billingPhone: '5551234567',
      items: [
        {
          name: 'WDP E2E Custom',
          total: '10',
          meta: {
            wdp_donor_name: DONOR_NAME,
            wdp_donor_email: 'cagri.sukru@wdp-e2e.test',
            wdp_donor_phone: '5551234567',
            wdp_dedication: DONOR_NAME,
            wdp_anonymous: 'yes',
            wdp_shareholder_1_name: SHAREHOLDER_NAME,
          },
        },
      ],
    };
    assert.doesNotThrow(() =>
      assertLocalOrderRecord(rec, {
        donorName: DONOR_NAME,
        donorEmail: 'cagri.sukru@wdp-e2e.test',
        donorPhone: '5551234567',
        dedication: DONOR_NAME,
        shareholderName: SHAREHOLDER_NAME,
        amount: 10,
        currency: 'TRY',
        anonymous: true,
        hpos: true,
        productName: 'WDP E2E Custom',
      })
    );
    assert.throws(
      () =>
        assertLocalOrderRecord(
          {
            ...rec,
            items: [{ ...rec.items[0], meta: { ...rec.items[0].meta, wdp_donor_name: 'Cagri Sukru Ozturk Igdir' } }],
          },
          { donorName: DONOR_NAME, anonymous: true }
        ),
      /bozulmuş|Türkçe/
    );
    assert.throws(
      () =>
        assertLocalOrderRecord(
          {
            ...rec,
            items: [{ ...rec.items[0], meta: { ...rec.items[0].meta, wdp_donor_name: 'Ç***' } }],
          },
          { donorName: DONOR_NAME, anonymous: true }
        ),
      /maskelendi/
    );
  });

  it('uzakta skip, yerelde atlama yok', () => {
    assert.match(skipOrderReasonFor({ remote: true, offline: { id: 'cheque' } }), /uzak/);
    assert.equal(skipOrderReasonFor({ remote: false, offline: { id: 'cheque' } }), '');
    assert.equal(skipOrderReasonFor({ remote: false, offline: null }), '');
    assert.equal(
      pickOfflineGateway([
        { id: 'stripe', enabled: true },
        { id: 'cheque', enabled: true },
        { id: 'cod', enabled: true },
      ])?.id,
      'cheque'
    );
  });

  it('donation-flow #place_order yok diye atlamaz; matrix ortak yardımcıyı kullanır', () => {
    const flow = fs.readFileSync(path.join(ROOT, 'tests/e2e/helpers/donation-flow.mjs'), 'utf8');
    assert.doesNotMatch(flow, /place_order yok/);
    assert.match(flow, /completeLocalCheckout/);
    const matrix = fs.readFileSync(path.join(ROOT, 'tests/e2e/helpers/matrix-scenarios.mjs'), 'utf8');
    assert.match(matrix, /from '\.\/place-order\.mjs'/);
    assert.doesNotMatch(matrix, /async function placeOrder/);
    assert.doesNotMatch(matrix, /async function fillBlocksCheckout/);
  });
});
