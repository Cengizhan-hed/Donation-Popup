#!/usr/bin/env node
/**
 * Ikram Aid güvenli kurulum / geri alma (e2e yok).
 * Hedef = profil + izin listesi. rsync ship-core içinde.
 *
 * KAYIT: ikramaid.uk izni Ikram Aid yayına alınmadan önce KALDIRILACAK.
 *
 *   node scripts/deploy-ikram.mjs
 *   node scripts/deploy-ikram.mjs --dry-run
 *   node scripts/deploy-ikram.mjs --rollback
 */
import { runShipCli } from './lib/ship-core.mjs';

await runShipCli({ envName: 'ikram' });
