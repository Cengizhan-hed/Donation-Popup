/**
 * "Benzer Bağışlar" boş mobil baseline teşhisi — DOM probe, eklenti kodu yok.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './env-root.mjs';
import { getActiveProfile } from './profile.mjs';

/**
 * @param {import('@playwright/test').Page} page
 */
export async function probeSimilarDonations(page) {
  const profile = getActiveProfile();
  const headingRe = profile.strings?.similarDonationsPattern || 'benzer\\s*bağış';
  const animatedSel = profile.selectors?.animated || '';
  const cardSel = profile.selectors?.loopCards || 'li.product, .post-card';
  const headingSel = profile.selectors?.headings || 'h1,h2,h3,h4';
  const sectionExtra = profile.selectors?.sectionRoots ? `, ${profile.selectors.sectionRoots}` : '';
  const sectionSel = `.related, section, .wp-block-woocommerce-product-collection, .wp-block-woocommerce-related-products${sectionExtra}`;
  return page.evaluate(
    ({ headingRe, animatedSel, cardSel, headingSel, sectionSel }) => {
      const headingPat = new RegExp(headingRe, 'i');
      const headings = Array.from(document.querySelectorAll(headingSel));
      const heading = headings.find((h) => headingPat.test(h.textContent || ''));
      const root =
        (heading && (heading.closest(sectionSel) || heading.parentElement)) ||
        document.querySelector(
          '.related.products, .related, .wp-block-woocommerce-product-collection, .wp-block-woocommerce-related-products'
        );
      const cards = root
        ? Array.from(root.querySelectorAll(cardSel))
        : [];
      const animated = animatedSel ? Array.from(document.querySelectorAll(animatedSel)) : [];
      function vis(el) {
        if (!el) return { display: null, visibility: null, opacity: null, w: 0, h: 0 };
        const st = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          display: st.display,
          visibility: st.visibility,
          opacity: st.opacity,
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
      }
      return {
        headingText: heading ? String(heading.textContent || '').trim().slice(0, 80) : null,
        headingVis: vis(heading),
        rootTag: root ? root.tagName + '.' + root.className : null,
        cardCount: cards.length,
        cards: cards.slice(0, 8).map((c) => vis(c)),
        animatedCount: animated.length,
        animated: animated.slice(0, 6).map((el) => ({
          className: String(el.className || '').slice(0, 120),
          ...vis(el),
        })),
        lazyImgs: Array.from(document.querySelectorAll('img.lazyload, img[loading="lazy"]')).length,
        io: typeof IntersectionObserver !== 'undefined',
        viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
      };
    },
    { headingRe, animatedSel, cardSel, headingSel, sectionSel }
  );
}

/**
 * @param {object} probe
 * @param {string} tag
 */
export function writeSimilarDonationsProbe(probe, tag) {
  const dir = path.join(ROOT, 'build/e2e/debug');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `similar-donations-${tag}.json`);
  fs.writeFileSync(file, JSON.stringify(probe, null, 2) + '\n', 'utf8');
  return file;
}

/**
 * @param {object} probe
 * @returns {'empty-dom'|'hidden-animation'|'lazy-not-triggered'|'ok'|'no-section'}
 */
export function classifySimilarDonations(probe) {
  if (!probe.headingText && probe.cardCount < 1) return 'no-section';
  if (probe.cardCount < 1) return 'empty-dom';
  const hiddenAnim = (probe.animated || []).filter(
    (a) => a.visibility === 'hidden' || Number.parseFloat(a.opacity || '1') < 0.05
  );
  if (hiddenAnim.length) return 'hidden-animation';
  const tiny = (probe.cards || []).filter((c) => c.h < 8 || c.w < 8);
  if (tiny.length === probe.cardCount) return 'lazy-not-triggered';
  return 'ok';
}
