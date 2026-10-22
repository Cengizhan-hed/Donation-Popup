#!/usr/bin/env node
/**
 * Kanarya. Uzak mod REMOTE_FREEZE ile reddedilir.
 * Yerel: npm run test:local-wp
 */
import { isRemoteFrozen, FREEZE_MESSAGE } from '../../scripts/lib/remote-guard.mjs';

if (isRemoteFrozen()) {
  console.error(FREEZE_MESSAGE);
  console.error('Kanarya uzak çalıştırılmaz. Yerel kanıt: npm run test:local-wp');
  process.exit(1);
}
console.error('e2e:canary uzak modu bu görevde kapalı. npm run test:local-wp');
process.exit(1);
