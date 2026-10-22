/**
 * Mobil + masaüstü davranış denetimleri (eklenti kodu değiştirilmez; hata bulgudur).
 */
import { SEL } from './selectors.mjs';
import { clickShellTrigger, makeFailure, openShellLocator, waitForShellClosed } from './checks.mjs';

const MIN_TOUCH = 44;

/**
 * @param {import('@playwright/test').Page} page
 */
export async function probeHorizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflow: doc.scrollWidth > doc.clientWidth + 1,
    };
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} scopeSel
 */
export async function probeTouchTargets(page, scopeSel) {
  return page.evaluate(
    ({ sel, min }) => {
      const root = document.querySelector(sel) || document.body;
      const nodes = Array.from(
        root.querySelectorAll(
          'button, a[href], [role="button"], .wdp-amount-preset, .wdp-chip, input[type="checkbox"], .wdp-product-quantity-increase, .wdp-product-quantity-decrease, .wdp-share-btn-increase, .wdp-share-btn-decrease, .wdp-modal-close, .wdp-nav-tab, [role="tab"]'
        )
      );
      function vis(el) {
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return (
          st.display !== 'none' &&
          st.visibility !== 'hidden' &&
          r.width > 0 &&
          r.height > 0
        );
      }
      const bad = [];
      const ok = [];
      for (const el of nodes) {
        if (!vis(el)) continue;
        const r = el.getBoundingClientRect();
        const row = {
          tag: el.tagName,
          name: el.getAttribute('name') || el.className || '',
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
        if (r.width + 1 < min || r.height + 1 < min) bad.push(row);
        else ok.push(row);
      }
      return { bad, okCount: ok.length, min };
    },
    { sel: scopeSel, min: MIN_TOUCH }
  );
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function probeInputModes(page) {
  return page.evaluate(() => {
    const amount = document.querySelector('input[name="custom_price"]');
    const phone = document.querySelector('input[name="donation_phone"]');
    return {
      amount: amount
        ? {
            type: amount.getAttribute('type'),
            inputMode: amount.getAttribute('inputmode'),
          }
        : null,
      phone: phone
        ? {
            type: phone.getAttribute('type'),
            inputMode: phone.getAttribute('inputmode'),
          }
        : null,
    };
  });
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function probeScrollLock(page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const cls = `${html.className} ${body.className}`;
    const overflow = `${getComputedStyle(html).overflow} ${getComputedStyle(body).overflow}`;
    return {
      locked: /wdp-.*open|modal-open|no-scroll|overflow:\s*hidden/i.test(`${cls} ${overflow}`),
      htmlOverflow: getComputedStyle(html).overflow,
      bodyOverflow: getComputedStyle(body).overflow,
      bodyPosition: getComputedStyle(body).position,
    };
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{top:number,bottom:number,left:number,right:number}} inset
 */
export async function probeSafeArea(page, inset) {
  return page.evaluate((box) => {
    const vv = window.visualViewport;
    const vw = vv && vv.width ? vv.width : window.innerWidth;
    const vh = vv && vv.height ? vv.height : window.innerHeight;
    const root = document.querySelector('.hdf-donation-modal-wrapper.wdp-modal.show');
    if (!root) return { clipped: [], vw, vh, box, pendingAnim: false };
    if (root.classList.contains('wdp-side-panel--opening')) {
      return { clipped: [], vw, vh, box, pendingAnim: true };
    }
    const content = root.querySelector('.wdp-modal-content');
    const tr = content ? window.getComputedStyle(content).transform : 'none';
    if (tr && tr !== 'none') {
      return { clipped: [], vw, vh, box, pendingAnim: true };
    }
    const els = Array.from(
      root.querySelectorAll(
        'button.wdp-modal-close, button[name="donation_add_to_cart"], button[name="donation_go_checkout"]'
      )
    );
    const clipped = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const st = window.getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) continue;
      if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      const hit = {
        name: el.getAttribute('name') || el.className,
        top: r.top < box.top - 2,
        bottom: r.bottom > vh - box.bottom + 2,
        left: r.left < box.left - 2,
        right: r.right > vw - box.right + 2,
      };
      if (hit.top || hit.bottom || hit.left || hit.right) clipped.push(hit);
    }
    return { clipped, vw, vh, box };
  }, inset);
}

/**
 * Klavye: visualViewport ile aktif alan + ana CTA görünür mü?
 * @param {import('@playwright/test').Locator} field
 * @param {import('@playwright/test').Page} page
 */
export async function probeKeyboardVisibility(page, field) {
  await field.click({ timeout: 4000, force: true });
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const vv = window.visualViewport;
    const active = document.activeElement;
    const btn = document.querySelector(
      '.wdp-modal.show button[name="donation_go_checkout"], .wdp-modal.show button[name="donation_add_to_cart"]'
    );
    function inVv(el) {
      if (!el || !vv) return null;
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= vv.height + 8 && r.left >= 0 && r.right <= vv.width + 8;
    }
    return {
      vvH: vv ? vv.height : null,
      innerH: window.innerHeight,
      activeTag: active ? active.tagName : null,
      activeName: active ? active.getAttribute('name') : null,
      fieldInView: inVv(active),
      ctaInView: inVv(btn),
    };
  });
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function probeDesktopFocus(page) {
  return page.evaluate(() => {
    const modal = document.querySelector('.wdp-modal.show');
    if (!modal) return { open: false };
    const ae = document.activeElement;
    return {
      open: true,
      focusInside: !!(ae && modal.contains(ae)),
      active: ae ? `${ae.tagName}.${ae.className}` : null,
    };
  });
}

/**
 * @param {object} opts
 */
export async function runMobileA11yChecks({
  page,
  device,
  profile,
  failures,
  stats,
  knownFindings,
}) {
  const shellSel = SEL.openModalShell;
  const overflow = await probeHorizontalOverflow(page);
  const check = `a11y-overflow-${device.id}`;
  if (overflow.overflow) {
    const rec = {
      check,
      env: profile.id,
      device: device.id,
      control: 'yatay kaydırma yok',
      result: 'fail',
      detail: `scrollWidth=${overflow.scrollWidth} clientWidth=${overflow.clientWidth}`,
    };
    knownFindings.push(rec);
    failures.push(
      makeFailure({
        check,
        description: 'Yatay kaydırma var (document.scrollWidth > viewport)',
        detail: rec.detail,
      })
    );
    stats.failed += 1;
  } else {
    knownFindings.push({
      check,
      env: profile.id,
      device: device.id,
      control: 'yatay kaydırma yok',
      result: 'pass',
    });
    stats.passed += 1;
  }

  if ((await page.locator(shellSel).count()) > 0) {
    const touch = await probeTouchTargets(page, shellSel);
    const tCheck = `a11y-touch-${device.id}`;
    if (device.isMobile && touch.bad.length) {
      knownFindings.push({
        check: tCheck,
        env: profile.id,
        device: device.id,
        control: 'dokunma hedefi ≥44px',
        result: 'fail',
        detail: JSON.stringify(touch.bad.slice(0, 8)),
      });
      failures.push(
        makeFailure({
          check: tCheck,
          description: 'Dokunma hedefi 44px altı',
          detail: JSON.stringify(touch.bad.slice(0, 8)),
        })
      );
      stats.failed += 1;
    } else {
      knownFindings.push({
        check: tCheck,
        env: profile.id,
        device: device.id,
        control: 'dokunma hedefi ≥44px',
        result: device.isMobile ? 'pass' : 'skip-desktop',
      });
      if (device.isMobile) stats.passed += 1;
    }

    const modes = await probeInputModes(page);
    const amountOk =
      !modes.amount ||
      /numeric|decimal/i.test(String(modes.amount.inputMode || '')) ||
      /number|tel/i.test(String(modes.amount.type || ''));
    const phoneOk =
      !modes.phone ||
      modes.phone.type === 'tel' ||
      /tel/i.test(String(modes.phone.inputMode || ''));
    const mCheck = `a11y-inputmode-${device.id}`;
    if (!amountOk || !phoneOk) {
      knownFindings.push({
        check: mCheck,
        env: profile.id,
        device: device.id,
        control: 'inputmode tutar/tel',
        result: 'fail',
        detail: JSON.stringify(modes),
      });
      failures.push(
        makeFailure({
          check: mCheck,
          description: 'Tutar/telefon klavye tipi beklenen değil',
          detail: JSON.stringify(modes),
        })
      );
      stats.failed += 1;
    } else {
      knownFindings.push({
        check: mCheck,
        env: profile.id,
        device: device.id,
        control: 'inputmode tutar/tel',
        result: 'pass',
      });
      stats.passed += 1;
    }

    const lock = await probeScrollLock(page);
    const lCheck = `a11y-scrolllock-${device.id}`;
    if (!lock.locked && lock.bodyOverflow !== 'hidden' && lock.htmlOverflow !== 'hidden') {
      knownFindings.push({
        check: lCheck,
        env: profile.id,
        device: device.id,
        control: 'arka sayfa kaydırma kilidi',
        result: 'fail',
        detail: JSON.stringify(lock),
      });
      failures.push(
        makeFailure({
          check: lCheck,
          description: 'Popup/panel açıkken arka sayfa kaydırma kilidi yok',
          detail: JSON.stringify(lock),
        })
      );
      stats.failed += 1;
    } else {
      knownFindings.push({
        check: lCheck,
        env: profile.id,
        device: device.id,
        control: 'arka sayfa kaydırma kilidi',
        result: 'pass',
      });
      stats.passed += 1;
    }

    if (device.id === 'iphone' && device.safeArea) {
      let safe = await probeSafeArea(page, device.safeArea);
      if (safe.pendingAnim) {
        await page.waitForTimeout(400);
        safe = await probeSafeArea(page, device.safeArea);
      }
      const sCheck = `a11y-safearea-${device.id}`;
      if (safe.clipped.length) {
        knownFindings.push({
          check: sCheck,
          env: profile.id,
          device: device.id,
          control: 'güvenli alan',
          result: 'fail',
          detail: JSON.stringify(safe.clipped),
        });
        failures.push(
          makeFailure({
            check: sCheck,
            description: 'Çentik/güvenli alanda kesilen düğme',
            detail: JSON.stringify(safe.clipped),
          })
        );
        stats.failed += 1;
      } else {
        knownFindings.push({
          check: sCheck,
          env: profile.id,
          device: device.id,
          control: 'güvenli alan',
          result: 'pass',
        });
        stats.passed += 1;
      }
    }

    if (device.isMobile) {
      const kCheck = `a11y-keyboard-${device.id}`;
      let field = page.locator(SEL.customPrice).first();
      let fieldVisible = (await field.count()) > 0 && (await field.isVisible().catch(() => false));
      if (!fieldVisible) {
        field = page
          .locator(
            '.wdp-modal.show input:not([type=hidden]):not([type=checkbox]):not([type=radio]), .wdp-donation-form input:not([type=hidden]):not([type=checkbox]):not([type=radio])'
          )
          .first();
        fieldVisible = (await field.count()) > 0 && (await field.isVisible().catch(() => false));
      }
      if (fieldVisible) {
        await field.scrollIntoViewIfNeeded().catch(() => {});
        const kb = await probeKeyboardVisibility(page, field);
        const vvShrunk = kb.vvH != null && kb.innerH && kb.vvH < kb.innerH * 0.92;
        if (!vvShrunk) {
          knownFindings.push({
            check: kCheck,
            env: profile.id,
            device: device.id,
            control: 'klavye açıkken alan+CTA görünür',
            result: 'emulation-limited',
            detail: JSON.stringify(kb),
          });
        } else if (kb.fieldInView === false || kb.ctaInView === false) {
          knownFindings.push({
            check: kCheck,
            env: profile.id,
            device: device.id,
            control: 'klavye açıkken alan+CTA görünür',
            result: 'fail',
            detail: JSON.stringify(kb),
          });
          failures.push(
            makeFailure({
              check: kCheck,
              description: 'Klavye açıkken aktif alan veya ana buton visualViewport dışında',
              detail: JSON.stringify(kb),
            })
          );
          stats.failed += 1;
        } else {
          knownFindings.push({
            check: kCheck,
            env: profile.id,
            device: device.id,
            control: 'klavye açıkken alan+CTA görünür',
            result: 'pass',
          });
          stats.passed += 1;
        }
      } else {
        knownFindings.push({
          check: kCheck,
          env: profile.id,
          device: device.id,
          control: 'klavye açıkken alan+CTA görünür',
          result: 'skip-no-field',
        });
      }
    } else {
      const stretch = await page.evaluate(() => {
        const modal = document.querySelector('.wdp-modal.show .wdp-modal-content');
        if (!modal) return { open: false };
        const r = modal.getBoundingClientRect();
        return {
          open: true,
          modalW: Math.round(r.width),
          vw: window.innerWidth,
          ratio: window.innerWidth ? r.width / window.innerWidth : 0,
        };
      });
      const wCheck = `a11y-stretch-${device.id}`;
      if (stretch.open && stretch.ratio > 0.92 && stretch.vw >= 1200) {
        knownFindings.push({
          check: wCheck,
          env: profile.id,
          device: device.id,
          control: 'geniş ekranda form uzamıyor',
          result: 'fail',
          detail: JSON.stringify(stretch),
        });
        failures.push(
          makeFailure({
            check: wCheck,
            description: 'Geniş ekranda form/kart viewport’un %92’sinden geniş',
            detail: JSON.stringify(stretch),
          })
        );
        stats.failed += 1;
      } else {
        knownFindings.push({
          check: wCheck,
          env: profile.id,
          device: device.id,
          control: 'geniş ekranda form uzamıyor',
          result: stretch.open ? 'pass' : 'skip-closed',
        });
        if (stretch.open) stats.passed += 1;
      }

      const focus = await probeDesktopFocus(page);
      const fCheck = `a11y-focus-trap-${device.id}`;
      if (focus.open && !focus.focusInside) {
        knownFindings.push({
          check: fCheck,
          env: profile.id,
          device: device.id,
          control: 'odak tuzağı',
          result: 'fail',
          detail: JSON.stringify(focus),
        });
        failures.push(
          makeFailure({
            check: fCheck,
            description: 'Odak açık panel dışında',
            detail: JSON.stringify(focus),
          })
        );
        stats.failed += 1;
      } else {
        knownFindings.push({
          check: fCheck,
          env: profile.id,
          device: device.id,
          control: 'odak tuzağı',
          result: 'pass',
        });
        stats.passed += 1;
      }

      const tabCheck = `a11y-tab-${device.id}`;
      let leftModal = false;
      for (let i = 0; i < 12; i += 1) {
        await page.keyboard.press('Tab');
      }
      const afterTab = await probeDesktopFocus(page);
      leftModal = afterTab.open && afterTab.focusInside === false;
      if (leftModal) {
        knownFindings.push({
          check: tabCheck,
          env: profile.id,
          device: device.id,
          control: 'Tab sırası panelde kalır',
          result: 'fail',
          detail: JSON.stringify(afterTab),
        });
        failures.push(
          makeFailure({
            check: tabCheck,
            description: 'Tab ile odak panel dışına çıktı',
            detail: JSON.stringify(afterTab),
          })
        );
        stats.failed += 1;
      } else {
        knownFindings.push({
          check: tabCheck,
          env: profile.id,
          device: device.id,
          control: 'Tab sırası panelde kalır',
          result: afterTab.open ? 'pass' : 'skip-closed',
        });
        if (afterTab.open) stats.passed += 1;
      }
    }

    const closeBtn = page.locator(`${SEL.openModalShell} ${SEL.modalClose}`).first();
    const cCheck = `a11y-close-${device.id}`;
    if ((await closeBtn.count()) > 0) {
      await closeBtn.click({ timeout: 8000 }).catch(async () => {
        await closeBtn.evaluate((el) => el && el.click && el.click());
      });
      let closed = false;
      try {
        await waitForShellClosed(page, 8000);
        closed = true;
      } catch {
        closed = false;
      }
      if (!closed) {
        knownFindings.push({
          check: cCheck,
          env: profile.id,
          device: device.id,
          control: 'kapat düğmesi',
          result: 'fail',
        });
        failures.push(
          makeFailure({
            check: cCheck,
            description: 'Kapat düğmesi kabuğu kapatmadı',
          })
        );
        stats.failed += 1;
      } else {
        knownFindings.push({
          check: cCheck,
          env: profile.id,
          device: device.id,
          control: 'kapat düğmesi',
          result: 'pass',
        });
        stats.passed += 1;
      }
    }

    const reopen = page.locator(
      `${SEL.centeredPopupTrigger}, ${SEL.sidePanelTrigger}, .wdp-card__cta, .wdp-loop-donate`
    );
    if ((await reopen.count()) > 0 && (await page.locator(SEL.openModalShell).count()) === 0) {
      await clickShellTrigger(reopen, 8000).catch(() => {});
      await page.locator(SEL.openModalShell).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    }
    const eCheck = `a11y-esc-${device.id}`;
    if ((await page.locator(SEL.openModalShell).count()) > 0) {
      await page.keyboard.press('Escape');
      let closedEsc = false;
      try {
        await waitForShellClosed(page, 8000);
        closedEsc = true;
      } catch {
        closedEsc = false;
      }
      if (!closedEsc) {
        knownFindings.push({
          check: eCheck,
          env: profile.id,
          device: device.id,
          control: 'Esc ile kapatma',
          result: 'fail',
        });
        failures.push(
          makeFailure({
            check: eCheck,
            description: 'Escape kabuğu kapatmadı',
          })
        );
        stats.failed += 1;
      } else {
        knownFindings.push({
          check: eCheck,
          env: profile.id,
          device: device.id,
          control: 'Esc ile kapatma',
          result: 'pass',
        });
        stats.passed += 1;
      }
    } else {
      knownFindings.push({
        check: eCheck,
        env: profile.id,
        device: device.id,
        control: 'Esc ile kapatma',
        result: 'skip-closed',
      });
    }
  }
}
