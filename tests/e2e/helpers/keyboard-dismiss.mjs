/**
 * Ekran klavyesini kapatma (gerçek bağışçının "Bitti"ye / boş alana dokunması). Bağımlılıksız: checks.mjs ve
 * dp-form.mjs ikisi de kullanır (döngüsel içe aktarma olmasın diye ayrı dosya).
 *
 * Neden: 12.4 klavye sözleşmesi — dokunmatik ekranda bir yazı alanı odaktayken alt bölüm (toplam + düğmeler) yerinde,
 * yalnız opacity + inert ile gizlenir (assets/src/experiences/layer.mjs `setBarHidden`; sözleşme testi
 * experiences-instant.spec "alt bölüm yerinde kalır"). 12.3'te bölüm kaydırma alanına taşınıp tıklanabilir kalıyordu;
 * artık gerçek telefonda da düğmeye ancak klavye kapanınca dokunulur. Masaüstünde (ince işaretçi) `data-dp-kb` hiç
 * konmaz; bırakma, gerçek fare tıklamasının zaten yaptığı blur ile aynıdır.
 */

/**
 * Odaktaki (eklenti kökü içindeki) yazı alanını bırakır ve alt bölümün geri gelmesini bekler.
 * @param {import('@playwright/test').Locator|import('@playwright/test').Page} scope
 * @param {number} timeout ms; süre dolarsa Playwright zaman aşımı hatası fırlatır (yutulmaz).
 */
export async function dismissKeyboardWithin(scope, timeout) {
  const page = typeof scope.page === 'function' ? scope.page() : scope;
  await page.evaluate(() => {
    const el = document.activeElement;
    if (el && el.closest && el.closest('[data-dp-exp]') && el.matches('input, textarea, select') && typeof el.blur === 'function') {
      el.blur();
    }
  });
  await page.waitForFunction(
    () => !document.querySelector('[data-dp-exp][data-dp-kb]') && !document.querySelector('[data-dp-exp] .donation-panel-actionbar[inert]'),
    null,
    { timeout }
  );
}
