/**
 * İlgili-ürün gizleme kaynağı — ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLUGIN_STYLE_PATH,
  isPluginCssSource,
  isThemeCssSource,
  pathnameFromHref,
  classifyRelatedHideSource,
  formatRelatedHideDebug,
  decideRelatedHideOutcome,
} from '../../../tests/e2e/helpers/css-hide-source.mjs';
import { SKIP_EVIDENCE, SKIP_REASONS, classifySkip, makeSkip } from '../../../tests/e2e/helpers/skip-policy.mjs';

describe('css-source sınıflama', () => {
  it('eklenti yolu plugin-hides-related', () => {
    assert.equal(isPluginCssSource(`${PLUGIN_STYLE_PATH}assets/css/frontend.css`), true);
    assert.equal(isThemeCssSource(`${PLUGIN_STYLE_PATH}assets/css/frontend.css`), false);
    const r = classifyRelatedHideSource({
      hiding: true,
      source: '/wp-content/plugins/woo-donation-popup/assets/css/frontend.css',
    });
    assert.equal(r.verdict, 'plugin');
    assert.equal(r.check, 'plugin-hides-related');
  });

  it('tema yolu theme-hides-related', () => {
    const src = '/wp-content/themes/blocksy/static/bundle/main.min.css';
    assert.equal(isPluginCssSource(src), false);
    assert.equal(isThemeCssSource(src), true);
    const r = classifyRelatedHideSource({ hiding: true, source: src });
    assert.equal(r.verdict, 'theme');
    assert.equal(r.check, 'theme-hides-related');
  });

  it('inline ve boş kaynak atlama değil', () => {
    assert.equal(isThemeCssSource('inline'), false);
    assert.equal(isThemeCssSource(''), false);
    assert.equal(classifyRelatedHideSource({ hiding: true, source: 'inline' }).verdict, 'unknown');
    assert.equal(classifyRelatedHideSource({ hiding: false, source: srcTheme() }).verdict, 'visible');
  });

  it('href pathname sorgu kırpar', () => {
    assert.equal(
      pathnameFromHref('https://example.test/wp-content/themes/blocksy/main.css?ver=2'),
      '/wp-content/themes/blocksy/main.css'
    );
  });

  it('debug yalnız yol/seçici (başlık yok)', () => {
    const txt = formatRelatedHideDebug({
      hiding: true,
      tag: 'SECTION',
      className: 'related products ct-hidden-sm',
      id: '',
      computed: { display: 'none', visibility: 'visible', opacity: '1', height: '0' },
      selector: '.ct-hidden-sm',
      source: '/wp-content/themes/blocksy/static/bundle/main.min.css',
      prop: 'display',
      value: 'none',
      verdict: 'theme',
    });
    assert.match(txt, /tag=SECTION/);
    assert.match(txt, /class=related products ct-hidden-sm/);
    assert.match(txt, /selector=\.ct-hidden-sm/);
    assert.match(txt, /source=\/wp-content\/themes\/blocksy/);
    assert.equal(/Zakat|Bağış|@|phone|mailto/i.test(txt), false);
  });
});

describe('decideRelatedHideOutcome', () => {
  it('tema → skip kaydı classifySkip geçer', () => {
    const out = decideRelatedHideOutcome({
      hiding: true,
      source: '/wp-content/themes/blocksy/static/bundle/main.min.css',
      selector: '.ct-hidden-sm',
      tag: 'SECTION',
      className: 'related products ct-hidden-sm',
      computed: { display: 'none', visibility: 'visible', opacity: '1', height: '0' },
    });
    assert.equal(out.action, 'skip');
    assert.equal(out.check, 'theme-hides-related');
    const rec = makeSkip({
      check: out.check,
      reason: out.reason,
      evidence: out.evidence,
      source: out.source,
      detail: out.detail,
    });
    assert.equal(rec.reason, SKIP_REASONS.THEME_HIDES_RELATED);
    assert.equal(rec.evidence, SKIP_EVIDENCE.CSS_SOURCE);
    assert.equal(classifySkip(rec), 'skip');
  });

  it('eklenti → fail plugin-hides-related', () => {
    const out = decideRelatedHideOutcome({
      hiding: true,
      source: '/wp-content/plugins/woo-donation-popup/assets/css/frontend.css',
      selector: '.related',
    });
    assert.equal(out.action, 'fail');
    assert.equal(out.check, 'plugin-hides-related');
  });
});

function srcTheme() {
  return '/wp-content/themes/blocksy/static/bundle/main.min.css';
}
