/**
 * E2E sipariş/müşteri işaretleme ve temizlik (HPOS, yalnız işaretliler).
 */
import { loadDeployEnvSilent, remote, resolveWpPath } from './wp-remote.mjs';

export const E2E_META_KEY = '_wdp_e2e_test';
export const E2E_EMAIL_DOMAIN = 'wdp-e2e.test';

export function e2eEmail(stamp = Date.now()) {
  return `e2e.${stamp}@${E2E_EMAIL_DOMAIN}`;
}

/**
 * @returns {Promise<{id:number,email?:string}|null>}
 */
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
  } catch {
    return null;
  }
}

/**
 * @param {number|string} orderId
 */
export async function markOrderAsE2E(orderId) {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) throw new Error(`test-cleanup: ${loaded.reason}`);
  const wpPath = resolveWpPath(loaded.env).replace(/'/g, `'\\''`);
  const id = String(Math.abs(Number.parseInt(String(orderId), 10) || 0));
  if (id === '0') throw new Error('test-cleanup: invalid order id');
  remote(
    loaded.env,
    `wp eval '$o=wc_get_order(${id}); if(!$o){fwrite(STDERR,"missing"); exit(1);} $o->update_meta_data("${E2E_META_KEY}","1"); $o->save(); echo "ok";' --path='${wpPath}'`
  );
}

/**
 * @param {{guardOrderId?:number}} [opts]
 * @returns {Promise<object>}
 */
export async function cleanupE2EData(opts = {}) {
  const loaded = loadDeployEnvSilent();
  if (!loaded.ok) {
    throw new Error(`test-cleanup: ${loaded.reason}`);
  }
  const wpPath = resolveWpPath(loaded.env).replace(/'/g, `'\\''`);
  const guard = Math.abs(Number.parseInt(String(opts.guardOrderId || '0'), 10) || 0);
  const php = [
    'if(!function_exists("wc_get_orders")){echo "{\\"failed\\":[\\"no-wc\\"]}"; return;}',
    '$g=' + guard + ';',
    '$ids=wc_get_orders(array("limit"=>-1,"status"=>array_keys(wc_get_order_statuses()),"meta_key"=>"_wdp_e2e_test","meta_value"=>"1","return"=>"ids"));',
    '$del=array(); $fail=array();',
    'foreach((array)$ids as $id){ $id=absint($id); if($g && $id===$g){$fail[]="guard"; continue;} $o=wc_get_order($id); if(!$o){continue;} $em=strtolower((string)$o->get_billing_email()); if(strpos($em,"@wdp-e2e.test")===false){$fail[]="untagged-".$id; continue;} if($o->delete(true)===false){$fail[]="del-".$id; continue;} $del[]=$id; }',
    '$users=get_users(array("search"=>"*@wdp-e2e.test","search_columns"=>array("user_email"),"fields"=>array("ID","user_email"),"number"=>200)); $cd=array();',
    'foreach($users as $u){ if(strpos(strtolower($u->user_email),"@wdp-e2e.test")===false) continue; if(!wp_delete_user((int)$u->ID)){$fail[]="user-".$u->ID; continue;} $cd[]=(int)$u->ID; }',
    '$ok=true; if($g){ $ok=(bool)wc_get_order($g); if(!$ok) $fail[]="guard-missing"; }',
    'echo wp_json_encode(array("orders_deleted"=>count($del),"customers_deleted"=>count($cd),"guard_ok"=>$ok,"failed"=>$fail));',
  ].join(' ');
  const raw = remote(
    loaded.env,
    `wp eval '${php.replace(/'/g, `'\\''`)}' --path='${wpPath}'`
  );
  const jsonLine = String(raw || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
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
