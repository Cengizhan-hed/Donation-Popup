/**
 * Tek korumalı yazma/silme kapısı.
 * Adlandırılmış işlem + izin listesi. İşaretsiz / defter dışı / kara liste → yazma yok.
 */
import { loadDeployEnvSilent, remote, wpCliPath } from './wp-remote.mjs';
import {
  BLACKLISTED_TYPES,
  E2E_META_KEY,
  isRunIdOk,
  loadRegistry,
  registryHas,
} from './run-registry.mjs';
import { peekActiveProfile } from './profile.mjs';
import { isFixtureProductId } from './fixtures.mjs';

export const E2E_EMAIL_NEEDLE = '@wdp-e2e.test';
export const FORBIDDEN_POST_TYPES = BLACKLISTED_TYPES;

export const ALLOWED_WRITE_OPS = new Set([
  'delete-marked-product',
  'delete-marked-order',
  'create-fixture-product',
  'restore-product-meta',
  'set-fixture-product-meta',
  'set-fixture-product-price',
]);

/** @type {null | ((cmd: string) => string)} */
let execOverride = null;
/** @type {number[] | null} */
let coreIdsOverride = null;

export function setSafeRemoteExec(fn) {
  execOverride = fn;
}

export function setCorePageIdsForTest(ids) {
  coreIdsOverride = ids;
}

export function resetSafeRemoteTestHooks() {
  execOverride = null;
  coreIdsOverride = null;
}

function wpPathFlagArg() {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) throw new Error(`safe-remote-write: ${loaded.reason}`);
  return wpCliPath(loaded.env);
}

function execRemote(cmd) {
  if (execOverride) return execOverride(cmd);
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) throw new Error(`safe-remote-write: ${loaded.reason}`);
  return remote(loaded.env, cmd);
}

function wpEval(php) {
  const flag = wpPathFlagArg();
  return execRemote(`wp eval '${String(php).replace(/'/g, `'\\''`)}' ${flag}`);
}

function parseJsonLine(raw) {
  const line = String(raw || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('{') || l.startsWith('['))
    .pop();
  try {
    return JSON.parse(line || '{}');
  } catch {
    throw new Error(`safe-remote-write JSON yok: ${String(raw).slice(0, 160)}`);
  }
}

export function assertNamedOp(op) {
  const name = String(op || '');
  if (!ALLOWED_WRITE_OPS.has(name)) {
    throw new Error(`safe-remote-write: izin listesinde olmayan işlem (${name})`);
  }
}

/**
 * @param {{
 *   id: number,
 *   expectedType: string,
 *   registryIds: number[],
 *   coreIds: number[],
 *   runId: string,
 *   post: { type?: string, status?: string, mark?: string } | null,
 * }} args
 */
export function evaluateDeleteGuard(args) {
  const id = Math.abs(Number.parseInt(String(args.id), 10) || 0);
  if (id <= 0) return { ok: false, reason: 'invalid-id' };
  if (!isRunIdOk(args.runId)) return { ok: false, reason: 'bad-run-id' };
  const registry = (args.registryIds || []).map(Number).filter((n) => n > 0);
  if (!registry.length) return { ok: false, reason: 'empty-registry' };
  if (!registry.includes(id)) return { ok: false, reason: 'not-in-registry' };
  const core = new Set((args.coreIds || []).map(Number).filter((n) => n > 0));
  if (core.has(id)) return { ok: false, reason: `core-blacklist:${id}` };
  const post = args.post;
  if (!post) return { ok: false, reason: 'missing-post' };
  const type = String(post.type || '');
  if (FORBIDDEN_POST_TYPES.has(type) || type === 'page') {
    return { ok: false, reason: 'type-blacklist' };
  }
  if (args.expectedType && type !== args.expectedType && !(args.expectedType === 'product' && type === 'product_variation')) {
    return { ok: false, reason: `type-mismatch:${type}` };
  }
  if (String(post.mark || '') !== String(args.runId)) return { ok: false, reason: 'unmarked' };
  const fixtureIds = (args.fixtureIds || []).map(Number).filter((n) => n > 0);
  if (!args.allowFixtures && fixtureIds.includes(id)) {
    return { ok: false, reason: 'fixture-protected' };
  }
  return { ok: true, reason: '' };
}

/**
 * @param {{
 *   id: number,
 *   registryIds: number[],
 *   runId: string,
 *   email: string,
 *   userMark: string,
 *   ownedPosts: Array<{ type?: string, mark?: string, id?: number }>,
 *   commentCount?: number,
 * }} args
 */
export function evaluateUserDeleteGuard(args) {
  const id = Math.abs(Number.parseInt(String(args.id), 10) || 0);
  if (id <= 0) return { ok: false, reason: 'invalid-id' };
  if (!isRunIdOk(args.runId)) return { ok: false, reason: 'bad-run-id' };
  const registry = (args.registryIds || []).map(Number).filter((n) => n > 0);
  if (!registry.length) return { ok: false, reason: 'empty-registry' };
  if (!registry.includes(id)) return { ok: false, reason: 'not-in-registry' };
  const email = String(args.email || '').toLowerCase();
  if (!email.includes(E2E_EMAIL_NEEDLE)) return { ok: false, reason: 'email' };
  if (String(args.userMark || '') !== String(args.runId)) return { ok: false, reason: 'user-unmarked' };
  if (Number(args.commentCount || 0) > 0) return { ok: false, reason: 'user-has-comments' };
  if ((args.ownedPosts || []).length) return { ok: false, reason: 'user-has-content' };
  return { ok: true, reason: '' };
}

export async function loadCorePageIds() {
  if (coreIdsOverride) return coreIdsOverride.slice();
  const php = [
    '$ids=array(',
    '(int)get_option("page_on_front"),',
    '(int)get_option("page_for_posts"),',
    '(int)get_option("woocommerce_cart_page_id"),',
    '(int)get_option("woocommerce_checkout_page_id"),',
    '(int)get_option("woocommerce_myaccount_page_id"),',
    '(int)get_option("woocommerce_shop_page_id"),',
    '(int)get_option("woocommerce_terms_page_id"),',
    ');',
    '$s=get_option("wdp_success_settings");',
    'if(is_array($s)){ foreach($s as $v){ if(is_int($v)||(is_string($v)&&ctype_digit($v))) $ids[]=(int)$v; } }',
    'echo wp_json_encode(array_values(array_unique(array_filter($ids))));',
  ].join('');
  const parsed = parseJsonLine(wpEval(php));
  return (Array.isArray(parsed) ? parsed : []).map(Number).filter((n) => n > 0);
}

export async function probePost(id) {
  const nid = Math.abs(Number.parseInt(String(id), 10) || 0);
  const php = `$id=${nid}; $p=get_post($id); if(!$p){echo "{}"; return;} echo wp_json_encode(array("id"=>$id,"type"=>$p->post_type,"status"=>$p->post_status,"mark"=>(string)get_post_meta($id,"${E2E_META_KEY}",true)));`;
  const parsed = parseJsonLine(wpEval(php));
  if (!parsed || !parsed.id) return null;
  return {
    id: Number(parsed.id),
    type: String(parsed.type || ''),
    status: String(parsed.status || ''),
    mark: String(parsed.mark || ''),
  };
}

export async function safeDeleteMarked(args) {
  assertNamedOp(args.op || 'delete-marked-product');
  const id = Math.abs(Number.parseInt(String(args.id), 10) || 0);
  const expectedType = String(args.expectedType || '');
  const registry = loadRegistry();
  if (!isRunIdOk(registry.runId)) {
    throw new Error('safe-remote-write: kayıt defteri runId yok; hiçbir şey silinmez');
  }
  if (id <= 0) throw new Error('safe-remote-write: invalid id');
  if (!expectedType) throw new Error('safe-remote-write: expectedType yok');
  if (!registryHas(id, expectedType) && !registryHas(id)) {
    throw new Error(`safe-remote-write: kayıt defterinde yok (id=${id} type=${expectedType})`);
  }
  if (!args.allowFixtures && isFixtureProductId(id)) {
    throw new Error('safe-remote-write: fixture ürün silinmez (yalnız --remove-fixtures)');
  }
  const registryIds = registry.created.map((x) => Number(x.id));
  const coreIds = await loadCorePageIds();
  const post = await probePost(id);
  const guard = evaluateDeleteGuard({
    id,
    expectedType,
    registryIds,
    coreIds,
    runId: registry.runId,
    post,
    fixtureIds: args.fixtureIds,
    allowFixtures: !!args.allowFixtures,
  });
  if (!guard.ok) {
    throw new Error(`safe-remote-write silme reddedildi: ${guard.reason} (id=${id})`);
  }
  const php = [
    `$id=${id}; $want='${expectedType.replace(/'/g, '')}'; $run='${registry.runId.replace(/'/g, '')}';`,
    '$p=get_post($id); if(!$p){fwrite(STDERR,"missing"); exit(1);}',
    '$bad=array("page","attachment","nav_menu_item","wp_template","wp_template_part","elementor_library","wp_block");',
    'if(in_array($p->post_type,$bad,true)){fwrite(STDERR,"type-blacklist"); exit(1);}',
    'if($p->post_type!==$want && !($want==="product" && $p->post_type==="product_variation")){fwrite(STDERR,"type-mismatch"); exit(1);}',
    `$m=(string)get_post_meta($id,"${E2E_META_KEY}",true); if($m!==$run){fwrite(STDERR,"unmarked"); exit(1);}`,
    '$core=array((int)get_option("page_on_front"),(int)get_option("page_for_posts"),(int)get_option("woocommerce_cart_page_id"),(int)get_option("woocommerce_checkout_page_id"),(int)get_option("woocommerce_myaccount_page_id"),(int)get_option("woocommerce_shop_page_id"),(int)get_option("woocommerce_terms_page_id"));',
    'if(in_array($id,$core,true)){fwrite(STDERR,"core-blacklist"); exit(1);}',
    'if(!wp_delete_post($id,true)){fwrite(STDERR,"delete-failed"); exit(1);}',
    'echo "ok";',
  ].join('');
  const out = String(wpEval(php) || '').trim();
  if (!out.endsWith('ok')) {
    throw new Error(`safe-remote-write silme onay yok: ${out.slice(0, 80)}`);
  }
}

export async function assertProductWritable(productId, op = 'set-fixture-product-meta') {
  assertNamedOp(op);
  const id = Math.abs(Number.parseInt(String(productId), 10) || 0);
  if (id <= 0) throw new Error('safe-remote-write: invalid product id');
  const coreIds = await loadCorePageIds();
  if (coreIds.includes(id)) {
    throw new Error(`safe-remote-write: çekirdek sayfa id=${id} yazılamaz`);
  }
  const post = await probePost(id);
  if (post && FORBIDDEN_POST_TYPES.has(post.type)) {
    throw new Error(`safe-remote-write: ${post.type} id=${id} yazılamaz`);
  }
  if (!isFixtureProductId(id) && !registryHas(id, 'product')) {
    throw new Error(`safe-remote-write: id=${id} fixture/kayıt defteri değil; gerçek ürüne yazılmaz`);
  }
  const profile = peekActiveProfile();
  if (profile && profile.allowMetaMutation === false) {
    throw new Error(`safe-remote-write: allowMetaMutation=false (id=${id})`);
  }
  return { id, post, marked: !!(post && post.mark) };
}
