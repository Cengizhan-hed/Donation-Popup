/**
 * Ürün meta okuma/yazma — aktif ortamın SSH + wp-cli yolu.
 * Yazma yalnız fixture ürün + named op. Sayfa oluştur/sil/onar YOK.
 * .env.deploy değerleri asla loglanmaz / yazdırılmaz.
 */
import { loadDeployEnvSilent, remote, wpCliPath } from './wp-remote.mjs';
import { assertProductWritable, safeDeleteMarked } from './safe-remote-write.mjs';
import { isRunIdOk, loadRegistry, registerCreated, registerMutated } from './run-registry.mjs';
import { E2E_META_KEY } from './run-registry.mjs';

/**
 * @param {number|string} productId
 * @param {string} metaKey
 * @returns {Promise<string>}
 */
export async function getProductMeta(productId, metaKey) {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) {
    throw new Error(`staging-wp-meta: ${loaded.reason}`);
  }
  const flag = wpCliPath(loaded.env);
  const id = String(Math.abs(Number.parseInt(String(productId), 10) || 0));
  const key = String(metaKey).replace(/'/g, `'\\''`);
  return remote(
    loaded.env,
    `wp post meta get ${id} '${key}' ${flag} 2>/dev/null || true`
  );
}

/**
 * @param {number|string} productId
 * @param {string} metaKey
 * @param {string} value Empty string → delete meta.
 * @returns {Promise<void>}
 */
export async function setProductMeta(productId, metaKey, value) {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) {
    throw new Error(`staging-wp-meta: ${loaded.reason}`);
  }
  await assertProductWritable(productId, 'set-fixture-product-meta');
  const flag = wpCliPath(loaded.env);
  const id = String(Math.abs(Number.parseInt(String(productId), 10) || 0));
  const key = String(metaKey).replace(/'/g, `'\\''`);
  if (id === '0') {
    throw new Error('staging-wp-meta: invalid product id');
  }
  registerMutated({ id, type: 'product', keys: [String(metaKey)] });
  if (value === '' || value === null || value === undefined) {
    remote(loaded.env, `wp post meta delete ${id} '${key}' ${flag} 2>/dev/null || true`);
  } else {
    const val = String(value).replace(/'/g, `'\\''`);
    remote(loaded.env, `wp post meta update ${id} '${key}' '${val}' ${flag}`);
  }
  // product_info / bağış / donor önbelleğini düşür (meta hook kaçarsa diye).
  remote(
    loaded.env,
    `wp eval 'if (class_exists("WDP_Utils")) { WDP_Utils::invalidate_product_donation_caches(${id}); } if (function_exists("wc_delete_product_transients")) { wc_delete_product_transients(${id}); } clean_post_cache(${id}); wp_cache_delete("wdp_donor_count_${id}", "wdp_donations"); wp_cache_delete("wdp_total_donation_${id}", "wdp_donations");' ${flag} 2>/dev/null || true`
  );
}

/**
 * Persist WooCommerce product prices through the product object (lookup table + cache).
 *
 * @param {number|string} productId
 * @param {{price:string,regular:string,sale?:string}} amounts
 * @returns {Promise<void>}
 */
export async function saveProductPrices(productId, amounts) {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) {
    throw new Error(`staging-wp-meta: ${loaded.reason}`);
  }
  await assertProductWritable(productId, 'set-fixture-product-price');
  const flag = wpCliPath(loaded.env);
  const id = String(Math.abs(Number.parseInt(String(productId), 10) || 0));
  if (id === '0') {
    throw new Error('staging-wp-meta: invalid product id');
  }
  registerMutated({ id, type: 'product', keys: ['_price', '_regular_price', '_sale_price'] });
  const price = String(amounts.price ?? '').replace(/'/g, `'\\''`);
  const regular = String(amounts.regular ?? amounts.price ?? '').replace(/'/g, `'\\''`);
  const sale = String(amounts.sale ?? '').replace(/'/g, `'\\''`);
  remote(
    loaded.env,
    `wp eval '$p=wc_get_product(${id}); if(!$p){fwrite(STDERR,"missing product"); exit(1);} $p->set_regular_price("${regular}"); $p->set_sale_price("${sale}"); $p->set_price("${price}"); $p->save(); echo $p->get_price();' ${flag}`
  );
}

/**
 * Woo sepet sayfası kalıcı bağlantısı + durum (404 kök nedeni).
 * @returns {Promise<{url:string,path:string,status:string,id:number}>}
 */
export async function getWooCartPageInfo() {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) {
    throw new Error(`staging-wp-meta: ${loaded.reason}`);
  }
  const flag = wpCliPath(loaded.env);
  const raw = remote(
    loaded.env,
    `wp eval '$id=function_exists("wc_get_page_id")?wc_get_page_id("cart"):0; $url=function_exists("wc_get_cart_url")?wc_get_cart_url():""; echo wp_json_encode(array("id"=>(int)$id,"url"=>$url,"status"=>$id? (string)get_post_status($id):"","permalink"=>$id? (string)get_permalink($id):""));' ${flag}`
  );
  const line = String(raw || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('{'))
    .pop();
  let parsed = {};
  try {
    parsed = JSON.parse(line || '{}');
  } catch {
    parsed = {};
  }
  let pathName = '/cart/';
  const href = String(parsed.permalink || parsed.url || '');
  if (href) {
    try {
      pathName = new URL(href).pathname || '/cart/';
    } catch {
      pathName = href.startsWith('/') ? href : '/cart/';
    }
  }
  return {
    url: href,
    path: pathName,
    status: String(parsed.status || ''),
    id: Math.abs(Number.parseInt(String(parsed.id || 0), 10) || 0),
  };
}

/**
 * Woo sepet sayfası bozuksa test ONARMAZ; kırmızı mesaj.
 * @returns {Promise<{url:string,path:string,status:string,id:number}>}
 */
export async function assertWooCartPagePublished() {
  const info = await getWooCartPageInfo();
  if (!info.id) {
    throw new Error('Woo sepet sayfası (id=0) yok: elle düzeltin');
  }
  if (info.status !== 'publish') {
    throw new Error(
      `Woo sepet sayfası (id=${info.id}) çöpte/taslakta (status=${info.status}): elle düzeltin`
    );
  }
  return info;
}

/**
 * Invalidate [wdp_donations] HTML cache on staging.
 *
 * @returns {Promise<void>}
 */
export async function bumpListCache() {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) {
    throw new Error(`staging-wp-meta: ${loaded.reason}`);
  }
  const flag = wpCliPath(loaded.env);
  remote(
    loaded.env,
    `wp eval 'if (class_exists("WDP_Donations_List")) { WDP_Donations_List::reset_bump_guard(); WDP_Donations_List::bump_cache(); }' ${flag}`
  );
}

export async function createTempPage() {
  throw new Error('createTempPage kaldırıldı (2026-10-22): uzak sitede sayfa oluşturulmaz.');
}

/**
 * @param {number|string} postId
 * @returns {Promise<void>}
 */
/**
 * @param {number|string} productId
 * @returns {Promise<{price:string,regular:string,sale:string}>}
 */
export async function snapshotProductPrices(productId) {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) {
    throw new Error(`staging-wp-meta: ${loaded.reason}`);
  }
  const flag = wpCliPath(loaded.env);
  const id = String(Math.abs(Number.parseInt(String(productId), 10) || 0));
  if (id === '0') {
    throw new Error('staging-wp-meta: invalid product id');
  }
  const raw = remote(
    loaded.env,
    `wp eval '$p=wc_get_product(${id}); if(!$p){echo "{}"; return;} echo wp_json_encode(array("price"=>(string)$p->get_price(),"regular"=>(string)$p->get_regular_price(),"sale"=>(string)$p->get_sale_price()));' ${flag}`
  );
  const line = String(raw || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('{'))
    .pop();
  let parsed = { price: '', regular: '', sale: '' };
  try {
    parsed = { ...parsed, ...JSON.parse(line || '{}') };
  } catch {
    throw new Error(`staging-wp-meta: price snapshot JSON yok (${String(raw).slice(0, 80)})`);
  }
  return {
    price: String(parsed.price ?? ''),
    regular: String(parsed.regular ?? ''),
    sale: String(parsed.sale ?? ''),
  };
}

/**
 * Private + gizli katalog, Genel fiyat boş, işaretli bağışçı-belirler ürün.
 * @param {{ title?: string, min?: string }} [opts]
 * @returns {Promise<{id:number,url:string,slug:string}>}
 */
export async function createMarkedDonationProduct(opts = {}) {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) {
    throw new Error(`staging-wp-meta: ${loaded.reason}`);
  }
  const registry = loadRegistry();
  if (!isRunIdOk(registry.runId)) {
    throw new Error('staging-wp-meta: runId yok; ürün oluşturulmaz');
  }
  const flag = wpCliPath(loaded.env);
  const title = String(opts.title || 'WDP E2E Empty Price').replace(/'/g, `'\\''`);
  const min = String(opts.min || '5').replace(/[^0-9.]/g, '') || '5';
  const php = [
    'if(!function_exists("wc_get_product")){fwrite(STDERR,"no-wc"); exit(1);}',
    '$p=new WC_Product_Simple();',
    `$p->set_name('${title}');`,
    '$p->set_status("private");',
    '$p->set_catalog_visibility("hidden");',
    '$p->set_regular_price("");',
    '$p->set_price("");',
    '$p->set_virtual(true);',
    '$p->update_meta_data("_allow_custom_price","yes");',
    `$p->update_meta_data("_min_custom_price","${min}");`,
    `$p->update_meta_data("${E2E_META_KEY}","${String(loadRegistry().runId || '').replace(/'/g, '')}");`,
    '$p->update_meta_data("_wdp_donation_product","yes");',
    '$id=$p->save();',
    'if(!$id){fwrite(STDERR,"create-failed"); exit(1);}',
    'echo wp_json_encode(array("id"=>(int)$id,"url"=>get_permalink($id),"slug"=>$p->get_slug()));',
  ].join(' ');
  const raw = remote(loaded.env, `wp eval '${php.replace(/'/g, `'\\''`)}' ${flag}`);
  const line = String(raw || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('{'))
    .pop();
  let parsed = {};
  try {
    parsed = JSON.parse(line || '{}');
  } catch {
    throw new Error(`staging-wp-meta: temp product JSON yok (${String(raw).slice(0, 120)})`);
  }
  const id = Math.abs(Number.parseInt(String(parsed.id || 0), 10) || 0);
  if (id <= 0) {
    throw new Error('staging-wp-meta: temp product id yok');
  }
  registerCreated({ id, type: 'product' });
  return {
    id,
    url: String(parsed.url || '').trim(),
    slug: String(parsed.slug || '').trim(),
  };
}

/**
 * Yalnız _wdp_e2e_test=1 ürünü kalıcı siler; işaretsiz → hata.
 * @param {number|string} productId
 */
export async function deleteMarkedProduct(productId) {
  const id = Math.abs(Number.parseInt(String(productId), 10) || 0);
  await safeDeleteMarked({ op: 'delete-marked-product', id, expectedType: 'product' });
}

export async function deletePost() {
  throw new Error('deletePost kaldırıldı (2026-10-22): uzak sitede sayfa/yazı silinmez.');
}
