import test from 'node:test';
import assert from 'node:assert/strict';
import { endpoint, errorKey, isEmail, isStrongEnough, nextFocusIndex, shouldDismissOnDrag } from '../../../assets/src/donor-account/logic.mjs';

test('isEmail kabul/red', () => {
  assert.equal(isEmail('ayse@example.com'), true);
  assert.equal(isEmail(' çağlar@örnek.org '), true);
  assert.equal(isEmail('ayse@'), false);
  assert.equal(isEmail('a b@c.de'), false);
  assert.equal(isEmail(''), false);
});

test('parola alt sınırı 8', () => {
  assert.equal(isStrongEnough('1234567'), false);
  assert.equal(isStrongEnough('12345678'), true);
  assert.equal(isStrongEnough(null), false);
});

test('errorKey sunucu kodlarını ileti anahtarına çevirir', () => {
  assert.equal(errorKey(429, '', 'login'), 'rate');
  assert.equal(errorKey(401, 'donation_panel_login_failed', 'login'), 'login');
  assert.equal(errorKey(400, 'donation_panel_invalid_email', 'reset'), 'email');
  assert.equal(errorKey(400, 'donation_panel_weak_password', 'register'), 'pass');
  assert.equal(errorKey(500, '', 'register'), 'fail');
});

test('odak tuzağı döner', () => {
  assert.equal(nextFocusIndex(2, 3, false), 0);
  assert.equal(nextFocusIndex(0, 3, true), 2);
  assert.equal(nextFocusIndex(1, 3, false), 2);
  assert.equal(nextFocusIndex(0, 0, false), -1);
});

test('sürükleyerek kapatma eşiği', () => {
  assert.equal(shouldDismissOnDrag(130, 600, 0.1), true);
  assert.equal(shouldDismissOnDrag(20, 600, 0.9), true);
  assert.equal(shouldDismissOnDrag(20, 600, 0.1), false);
});

test('endpoint birleştirir (düz bağlantı yapısı dahil)', () => {
  assert.equal(endpoint('https://x.test/wp-json/donation-panel/v1/account/', '/login'), 'https://x.test/wp-json/donation-panel/v1/account/login');
  assert.equal(endpoint('https://x.test/?rest_route=/donation-panel/v1/account', 'session'), 'https://x.test/?rest_route=/donation-panel/v1/account/session');
});
