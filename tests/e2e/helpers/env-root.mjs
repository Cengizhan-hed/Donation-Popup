/**
 * Ortak kök yolu — env.mjs dairesel ithalatı kırmamak için ayrı dosya.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../../..');
