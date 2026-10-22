/**
 * Yalnız ekran görüntüsü anında enjekte edilir (işlevsel tıklama/akışta yok).
 * Eklenti CSS’si wp-admin / Coming soon bandını gizlemez.
 */
export const STABILIZE_SHOT_CSS = `
*{transition:none!important;animation:none!important;caret-color:transparent!important}
img.lazyload, img.lazyloading, img.lazyloaded, .fusion-image-wrapper img, .lazyload,
.fusion-image-wrapper, .fusion-lazy-load, .awb-image-wrapper, .lazyloaded{
  opacity:1!important;visibility:visible!important
}
.fusion-animated, .fusion-post-cards.fusion-animated, .fusion-animated.fusion-grid-archive,
.fusion-blog-shortcode.fusion-animated, .awb-animate, [class*="fusion-animated"]{
  visibility:visible!important;opacity:1!important;animation:none!important;transform:none!important
}
#wpadminbar,
#wpadminbar *{
  display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;
  overflow:hidden!important;pointer-events:none!important
}
html.admin-bar,
html.wp-toolbar,
html.admin-bar.wp-toolbar{
  margin-top:0!important;padding-top:0!important
}
html.admin-bar body,
html.wp-toolbar body{
  margin-top:0!important;padding-top:0!important
}
@media screen and (max-width: 782px){
  html.admin-bar,
  html.wp-toolbar{margin-top:0!important;padding-top:0!important}
}
.coming-soon-footer-banner,
#coming-soon-footer-banner,
.woocommerce-coming-soon-banner,
#woocommerce-coming-soon-banner,
.woocommerce-store-notice,
.woocommerce-info,
.woocommerce-message,
.wc-block-components-notice-banner,
.wp-block-woocommerce-coming-soon,
.wp-block-woocommerce-store-notices,
body.woocommerce-coming-soon .coming-soon-footer-banner{
  display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;
  overflow:hidden!important;pointer-events:none!important
}
`;

/**
 * Screenshot-only: hide leftover Coming soon admin notice nodes whose class
 * is not in STABILIZE_SHOT_CSS. Does not change the live site.
 * @param {import('@playwright/test').Page} page
 */
export async function hideComingSoonNoticeForShot(page) {
  await page.evaluate(() => {
    const needles = ['Coming soon mode', 'coming soon mode'];
    for (const el of document.querySelectorAll('div, p, aside, section')) {
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (text.length < 24 || text.length > 280) continue;
      if (!needles.some((n) => text.includes(n))) continue;
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('height', '0', 'important');
      el.style.setProperty('overflow', 'hidden', 'important');
    }
  });
}
