import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ISOLATED_EVENTS,
  STEPS,
  announcement,
  donorsText,
  effectLine,
  evaluateAmount,
  fill,
  horizontalWheel,
  isolates,
  moveStep,
  percentOf,
} from '../../../assets/src/compact/logic.mjs';

const GBP = { decimals: 2, thousandSeparator: ',', decimalSeparator: '.' };
const TRY3 = { decimals: 3, thousandSeparator: '.', decimalSeparator: ',' };
const base = { fixed: false, quick: null, raw: '', unit: 0, qty: 1, min: 0, currency: GBP };

test('adımlar sabit sırada: tutar → ad/telefon (ödeme adımı ve teşekkür yok)', () => {
  assert.deepEqual(STEPS, ['amount', 'details']);
  assert.equal(moveStep(0, -1), 0);
  assert.equal(moveStep(1, -1), 0);
  assert.equal(moveStep(1, 1), 1);
  assert.equal(moveStep(0, 1), 1);
});

test('tutar: boş/geçersiz/belirsiz/en düşük; hızlı tutar ve sabit fiyat', () => {
  assert.deepEqual(evaluateAmount(base), { value: null, error: 'amount' });
  assert.deepEqual(evaluateAmount({ ...base, raw: 'abc' }), { value: null, error: 'amount' });
  assert.deepEqual(evaluateAmount({ ...base, raw: '0' }), { value: null, error: 'amount' });
  assert.deepEqual(evaluateAmount({ ...base, raw: '25' }), { value: 25, error: '' });
  assert.deepEqual(evaluateAmount({ ...base, raw: '1,250.50' }), { value: 1250.5, error: '' });
  assert.deepEqual(evaluateAmount({ ...base, raw: '4', min: 5 }), { value: 4, error: 'min' });
  // Belirsiz biçim tahmin edilmez (form çekirdeğiyle aynı ayrıştırıcı).
  assert.equal(evaluateAmount({ ...base, raw: '12,5,6' }).error, 'format');
  assert.deepEqual(evaluateAmount({ ...base, raw: '1.250', currency: TRY3 }), { value: 1250, error: '' });
  assert.deepEqual(evaluateAmount({ ...base, quick: 50, raw: 'abc' }), { value: 50, error: '' });
  // Sabit fiyat: tutar = birim × adet, bağışçı değiştiremez; en düşük tutar kuralı uygulanmaz.
  assert.deepEqual(evaluateAmount({ ...base, fixed: true, unit: 250, qty: 2, min: 1000 }), { value: 500, error: '' });
  assert.deepEqual(evaluateAmount({ ...base, fixed: true, unit: 0 }), { value: null, error: 'amount' });
});

test('çevrilebilir yer tutucular sırayla ve konumla dolar', () => {
  assert.equal(fill('Donate %s securely', ['£10']), 'Donate £10 securely');
  assert.equal(fill('%2$s için %1$s bağışınız alındı.', ['₺10', 'Su']), 'Su için ₺10 bağışınız alındı.');
  assert.equal(fill('Step %1$d of %2$d: %3$s', [2, 3, 'Your details']), 'Step 2 of 3: Your details');
  assert.equal(fill('%s and %s', ['a']), 'a and %s');
});

test('duyuru: varsayılan toplam iki adım', () => {
  assert.equal(announcement('Step %1$d of %2$d: %3$s', 0, 'Amount', 2), 'Step 1 of 2: Amount');
});

test('kaydırıcı yalıtımı: başlatma/hareket/tekerlek/klavye durur, bitiş olayları geçer', () => {
  ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'mousedown', 'wheel', 'keydown'].forEach((type) => assert.equal(isolates(type), true, type));
  ['pointerup', 'touchend', 'click', 'focusin'].forEach((type) => assert.equal(isolates(type), false, type));
  assert.ok(ISOLATED_EVENTS.length >= 7);
  assert.equal(horizontalWheel(30, 2), true);
  assert.equal(horizontalWheel(2, 30), false);
  assert.equal(horizontalWheel(NaN, 0), false);
});

test('bağışçı sayısı ve yüzde', () => {
  assert.equal(donorsText(0, '%s supporter', '%s supporters', 'en'), '');
  assert.equal(donorsText(1, '%s supporter', '%s supporters', 'en'), '1 supporter');
  assert.equal(donorsText(1200, '%s supporter', '%s supporters', 'en'), '1,200 supporters');
  assert.equal(percentOf(140), 100);
  assert.equal(percentOf(-3), 0);
  assert.equal(percentOf('42.6'), 43);
});

test('12.4: duyuru gerçek adım sayısıyla (serbest tutar 2, sabit fiyat tek ekran 1)', () => {
  assert.equal(announcement('Step %1$d of %2$d: %3$s', 1, 'Your details', 2), 'Step 2 of 2: Your details');
  assert.equal(announcement('Step %1$d of %2$d: %3$s', 0, 'Amount', 2), 'Step 1 of 2: Amount');
  assert.equal(announcement('Step %1$d of %2$d: %3$s', 0, 'Donation and details', 1), 'Step 1 of 1: Donation and details');
});

test('12.3 v2: seçilen tutarın etki ifadesi (kademe yoksa boş)', () => {
  const tiers = [
    { unit: 10, one: '{count} hot meal', other: '{count} hot meals' },
    { unit: 50, one: '{count} family food parcel', other: '{count} family food parcels' },
  ];
  assert.equal(effectLine(25, tiers, 'en'), '2 hot meals');
  assert.equal(effectLine(10, tiers, 'en'), '1 hot meal');
  assert.equal(effectLine(100, tiers, 'en'), '2 family food parcels');
  assert.equal(effectLine(5, tiers, 'en'), '');
  assert.equal(effectLine(null, tiers, 'en'), '');
  assert.equal(effectLine(50, [], 'en'), '');
});
