/** Boş disk kontrolü (CLAUDE.md §14): <20 GB uyarı/otomatik clean, <10 GB hata. */
import { execFileSync } from 'node:child_process';

export const WARN_GB = 20;
export const FAIL_GB = 10;

export function freeGB(dir = process.cwd()) {
  const out = execFileSync('df', ['-k', dir], { encoding: 'utf8' }).trim().split('\n').pop();
  const cols = out.split(/\s+/);
  // df -k: Filesystem 1K-blocks Used Available Capacity ...
  return Number(cols[3]) / 1024 / 1024;
}

/** 0 = tamam, 10 = uyarı (clean:disk öner), 20 = yeni ajan/tam paket başlatma. */
export function classify(gb, warn = WARN_GB, fail = FAIL_GB) {
  if (gb < fail) return 20;
  if (gb < warn) return 10;
  return 0;
}
