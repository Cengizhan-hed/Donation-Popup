/**
 * E2E sipariş/müşteri işaretleme ve temizlik.
 * Tek kaynak: cleanup-e2e.php (kayıt defteri + run_id + kara liste).
 */
import { loadDeployEnvSilent, remote, resolveWpPath, runEvalFile } from './wp-remote.mjs';
import { isRunIdOk, loadRegistry, registerCreated, registryIds } from './run-registry.mjs';

export const E2E_META_KEY = '_wdp_e2e_test';
export const E2E_EMAIL_DOMAIN = 'wdp-e2e.test';
export const CLEANUP_EVAL_FILE = 'tests/e2e/helpers/cleanup-e2e.php';

export function e2eEmail(stamp = Date.now()) {
  return `e2e.${stamp}@${E2E_EMAIL_DOMAIN}`;
}

export async function snapshotGuardOrder() {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) return null;
  const wpPath = resolveWpPath(loaded.env).replace(/'/g, `'\\''`);
  try {
    const raw = remote(
      loaded.env,
      `wp eval 'if(!function_exists("wc_get_orders")){echo "0"; return;} $q=wc_get_orders(["limit"=>1,"orderby"=>"date","order"=>"DESC","return"=>"ids"]); echo $q? (int)$q[0]:0;' --path='${wpPath}'`
    );
    const id = Math.abs(Number.parseInt(String(raw).trim(), 10) || 0);
    return id > 0 ? { id } : null;
  } catch (e) {
    throw new Error(`snapshotGuardOrder: ${e && e.message ? e.message : e}`);
  }
}

export async function markOrderAsE2E(orderId) {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) throw new Error(`test-cleanup: ${loaded.reason}`);
  const registry = loadRegistry();
  if (!isRunIdOk(registry.runId)) {
    throw new Error('test-cleanup: runId yok; sipariş işaretlenmez');
  }
  const wpPath = resolveWpPath(loaded.env).replace(/'/g, `'\\''`);
  const id = String(Math.abs(Number.parseInt(String(orderId), 10) || 0));
  if (id === '0') throw new Error('test-cleanup: invalid order id');
  const run = registry.runId.replace(/'/g, '');
  remote(
    loaded.env,
    `wp eval '$o=wc_get_order(${id}); if(!$o){fwrite(STDERR,"missing"); exit(1);} $o->update_meta_data("${E2E_META_KEY}","${run}"); $o->save(); echo "ok";' --path='${wpPath}'`
  );
  registerCreated({ id: Number(id), type: 'order' });
}

/**
 * @param {{guardOrderId?:number, execFn?: (file:string, extra:object)=>string}} [opts]
 */
export async function cleanupE2EData(opts = {}) {
  const registry = loadRegistry();
  const created = Array.isArray(registry.created) ? registry.created : [];
  const empty = {
    orders_deleted: 0,
    customers_deleted: 0,
    products_deleted: 0,
    posts_deleted: 0,
    guard_ok: true,
    failed: [],
    message: 'hiçbir şey silinmedi',
    skipped: 'empty-registry',
  };
  if (!isRunIdOk(registry.runId) || !created.length) {
    return empty;
  }
  const guard = Math.abs(Number.parseInt(String(opts.guardOrderId || '0'), 10) || 0);
  const b64 = Buffer.from(JSON.stringify(created), 'utf8').toString('base64');
  const extraEnv = {
    WDP_E2E_REGISTRY_B64: b64,
    WDP_E2E_RUN_ID: registry.runId,
  };
  if (guard) extraEnv.WDP_E2E_GUARD_ORDER_ID = String(guard);
  const raw = opts.execFn
    ? opts.execFn(CLEANUP_EVAL_FILE, extraEnv)
    : runEvalFile(CLEANUP_EVAL_FILE, extraEnv);
  const jsonLine = String(raw || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('{'))
    .pop();
  let parsed = {};
  try {
    parsed = JSON.parse(jsonLine || '{}');
  } catch {
    throw new Error(`cleanup JSON parse failed: ${String(raw || '').slice(0, 200)}`);
  }
  if (Array.isArray(parsed.failed) && parsed.failed.length) {
    throw new Error(`E2E temizlik hataları: ${parsed.failed.join('; ')}`);
  }
  return parsed;
}

export { registryIds };
