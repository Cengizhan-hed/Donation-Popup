/**
 * Ürün meta okuma/yazma — aktif ortamın SSH + wp-cli yolu (Hedef veya Ikram).
 * .env.deploy değerleri asla loglanmaz / yazdırılmaz.
 */
import { loadDeployEnvSilent, remote, resolveWpPath } from './wp-remote.mjs';

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
  const wpPath = resolveWpPath(loaded.env).replace(/'/g, `'\\''`);
  const id = String(Math.abs(Number.parseInt(String(productId), 10) || 0));
  const key = String(metaKey).replace(/'/g, `'\\''`);
  return remote(
    loaded.env,
    `wp post meta get ${id} '${key}' --path='${wpPath}' 2>/dev/null || true`
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
  const wpPath = resolveWpPath(loaded.env).replace(/'/g, `'\\''`);
  const id = String(Math.abs(Number.parseInt(String(productId), 10) || 0));
  const key = String(metaKey).replace(/'/g, `'\\''`);
  if (id === '0') {
    throw new Error('staging-wp-meta: invalid product id');
  }
  if (value === '' || value === null || value === undefined) {
    remote(loaded.env, `wp post meta delete ${id} '${key}' --path='${wpPath}' 2>/dev/null || true`);
  } else {
    const val = String(value).replace(/'/g, `'\\''`);
    remote(loaded.env, `wp post meta update ${id} '${key}' '${val}' --path='${wpPath}'`);
  }
  // product_info / bağış / donor önbelleğini düşür (meta hook kaçarsa diye).
  remote(
    loaded.env,
    `wp eval 'if (class_exists("WDP_Utils")) { WDP_Utils::invalidate_product_donation_caches(${id}); } if (function_exists("wc_delete_product_transients")) { wc_delete_product_transients(${id}); } clean_post_cache(${id}); wp_cache_delete("wdp_donor_count_${id}", "wdp_donations"); wp_cache_delete("wdp_total_donation_${id}", "wdp_donations");' --path='${wpPath}' 2>/dev/null || true`
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
  const wpPath = resolveWpPath(loaded.env).replace(/'/g, `'\\''`);
  const id = String(Math.abs(Number.parseInt(String(productId), 10) || 0));
  if (id === '0') {
    throw new Error('staging-wp-meta: invalid product id');
  }
  const price = String(amounts.price ?? '').replace(/'/g, `'\\''`);
  const regular = String(amounts.regular ?? amounts.price ?? '').replace(/'/g, `'\\''`);
  const sale = String(amounts.sale ?? '').replace(/'/g, `'\\''`);
  remote(
    loaded.env,
    `wp eval '$p=wc_get_product(${id}); if(!$p){fwrite(STDERR,"missing product"); exit(1);} $p->set_regular_price("${regular}"); $p->set_sale_price("${sale}"); $p->set_price("${price}"); $p->save(); echo $p->get_price();' --path='${wpPath}'`
  );
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
  const wpPath = resolveWpPath(loaded.env).replace(/'/g, `'\\''`);
  remote(
    loaded.env,
    `wp eval 'if (class_exists("WDP_Donations_List")) { WDP_Donations_List::reset_bump_guard(); WDP_Donations_List::bump_cache(); }' --path='${wpPath}'`
  );
}

/**
 * @param {string} title
 * @param {string} content
 * @returns {Promise<{id:number,url:string}>}
 */
export async function createTempPage(title, content) {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) {
    throw new Error(`staging-wp-meta: ${loaded.reason}`);
  }
  const wpPath = resolveWpPath(loaded.env).replace(/'/g, `'\\''`);
  const t = String(title).replace(/'/g, `'\\''`);
  const c = String(content).replace(/'/g, `'\\''`);
  const idRaw = remote(
    loaded.env,
    `wp post create --post_type=page --post_status=publish --post_title='${t}' --post_content='${c}' --porcelain --path='${wpPath}'`
  );
  const id = Math.abs(Number.parseInt(String(idRaw).trim(), 10) || 0);
  if (id === 0) {
    throw new Error('staging-wp-meta: temp page create failed');
  }
  const url = remote(loaded.env, `wp eval 'echo get_permalink(${id});' --path='${wpPath}'`);
  return { id, url: String(url || '').trim() };
}

/**
 * @param {number|string} postId
 * @returns {Promise<void>}
 */
export async function deletePost(postId) {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) {
    throw new Error(`staging-wp-meta: ${loaded.reason}`);
  }
  const wpPath = resolveWpPath(loaded.env).replace(/'/g, `'\\''`);
  const id = String(Math.abs(Number.parseInt(String(postId), 10) || 0));
  if (id === '0') {
    throw new Error('staging-wp-meta: invalid post id');
  }
  remote(loaded.env, `wp post delete ${id} --force --path='${wpPath}'`);
}
