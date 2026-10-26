/**
 * E8M: eski yol (engine=legacy) lazy modal — katalogda gizli ama yayında bağış ürünü açılır;
 * taslak/özel/parolalı hâlâ 404. YALNIZ yerel WP (`npm run e2e:experiences -- --spec experiences-legacy-hidden`).
 */
import { test, expect } from '@playwright/test';
import { parseLocalEvalJson, runLocalEvalFile } from '../helpers/local-wp-eval.mjs';

const WP_DIR = process.env.WDP_LOCAL_WP_DIR || '';
let ids = {};

test.beforeAll(() => {
  ids = parseLocalEvalJson(runLocalEvalFile('tests/e2e/helpers/wdp-visibility-states.php', ['create'], { env: { WDP_LOCAL_WP_DIR: WP_DIR } }));
  expect(ids.ok).toBe(true);
});

test.afterAll(() => {
  runLocalEvalFile('tests/e2e/helpers/wdp-visibility-states.php', ['delete'], { env: { WDP_LOCAL_WP_DIR: WP_DIR } });
});

/**
 * @param {import('@playwright/test').APIRequestContext} request İstek bağlamı.
 * @param {number} id Ürün.
 * @return {Promise<import('@playwright/test').APIResponse>} Yanıt.
 */
function modal(request, id) {
  return request.get(`/?rest_route=/donation-panel/v1/modal&product_id=${id}&mode=popup&dp_engine=legacy`);
}

test.describe('eski motor lazy modal görünürlük', () => {
  test('yayında + katalogda gizli ürün: modal HTML döner', async ({ request }) => {
    const res = await modal(request, ids.hidden);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(JSON.stringify(body)).toContain('wdp-');
  });

  test('yayında + görünür ürün: modal HTML döner', async ({ request }) => {
    expect((await modal(request, ids.visible)).status()).toBe(200);
  });

  for (const key of ['draft', 'private', 'password']) {
    test(`${key} ürün ziyaretçiye açılmaz (404)`, async ({ request }) => {
      expect((await modal(request, ids[key])).status()).toBe(404);
    });
  }

  test('katalogda gizli ürün yan panel kipinde de açılır', async ({ request }) => {
    const res = await request.get(`/?rest_route=/donation-panel/v1/modal&product_id=${ids.hidden}&mode=side_panel&dp_engine=legacy`);
    expect(res.status()).toBe(200);
  });
});
