#!/usr/bin/env node
/**
 * Yalnızca staging’e güvenli kurulum / geri alma (e2e yok).
 * Hedef = profil + izin listesi.
 *
 *   node scripts/deploy-staging.mjs
 *   node scripts/deploy-staging.mjs --dry-run
 *   node scripts/deploy-staging.mjs --rollback
 */
import { runShipCli } from './lib/ship-core.mjs';

await runShipCli({ envName: 'staging' });
