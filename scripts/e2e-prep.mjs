#!/usr/bin/env node
/** E2E koşu öncesi: eski Playwright çıktılarını siler (tek yardımcı; §14). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function cleanPlaywrightOutputs(root) {
  for (const d of ['test-results', 'playwright-report', 'blob-report', 'tests/e2e/test-results', 'tests/e2e/playwright-report']) {
    fs.rmSync(path.join(root, d), { recursive: true, force: true });
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cleanPlaywrightOutputs(path.resolve(path.dirname(process.argv[1]), '..'));
}
