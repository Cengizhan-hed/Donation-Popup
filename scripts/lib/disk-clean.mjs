/**
 * Disk temizliği çekirdeği (CLAUDE.md §14). Yalnız verilen proje kökü altında çalışır.
 * Saf planlama + silme; uzak erişim yok.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const PROTECTED_WORKTREES = ['wt-e0', 'wt-k56', 'wt-k8', 'wt-disk'];
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export function dirSize(p) {
  let st;
  try { st = fs.lstatSync(p); } catch { return 0; }
  if (!st.isDirectory()) return st.size;
  let sum = 0;
  for (const e of fs.readdirSync(p)) sum += dirSize(path.join(p, e));
  return sum;
}

export function fmtSize(n) {
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
}

function entries(dir) {
  try {
    return fs.readdirSync(dir).map((n) => {
      const p = path.join(dir, n);
      return { p, mtime: fs.lstatSync(p).mtimeMs };
    });
  } catch { return []; }
}

/** En yeni `keep` kaydı bırakır, kalanını döndürür. */
export function olderThanNewest(list, keep) {
  return [...list].sort((a, b) => b.mtime - a.mtime).slice(keep);
}

function inside(root, p) {
  const rel = path.relative(root, p);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

/** Biten worktree'ler: ana depoya bağlı, wt-* adlı, dalı merge edilmiş, temiz, korumasız. */
export function finishedWorktrees(root, { protectedNames = PROTECTED_WORKTREES, mergeTargets = ['main', 'ikram-ortam'] } = {}) {
  const out = [];
  let list;
  try { list = git(root, ['worktree', 'list', '--porcelain']); } catch { return out; }
  const parent = fs.realpathSync(path.dirname(root));
  for (const block of list.split('\n\n')) {
    const wt = /^worktree (.+)$/m.exec(block)?.[1];
    const branch = /^branch refs\/heads\/(.+)$/m.exec(block)?.[1];
    if (!wt || !branch || fs.realpathSync(wt) === fs.realpathSync(root)) continue;
    const name = path.basename(wt);
    if (path.dirname(fs.realpathSync(wt)) !== parent || !name.startsWith('wt-') || protectedNames.includes(name)) continue;
    if (/^(main|ikram-ortam)$/.test(branch)) continue;
    const merged = mergeTargets.some((t) => {
      try { git(root, ['merge-base', '--is-ancestor', branch, t]); return true; } catch { return false; }
    });
    if (!merged) continue;
    try { if (git(wt, ['status', '--porcelain']).trim()) continue; } catch { continue; }
    out.push({ rule: 'worktree', p: wt, size: dirSize(wt), kind: 'worktree' });
  }
  return out;
}

/** Silinecek öğeleri planlar. */
export function buildPlan(root, { now = Date.now(), isPortBusy = () => false, includeWorktrees = true, protectedNames } = {}) {
  const items = [];
  const add = (rule, list) => list.forEach((e) => { if (inside(root, e.p)) items.push({ rule, p: e.p, size: dirSize(e.p) }); });
  const b = (...s) => path.join(root, 'build', ...s);

  // Playwright çıktıları: koşu öncesi hepsi silinir (en yeni iki koşu: başarılı+başarısız kalır).
  for (const d of ['test-results', 'playwright-report', 'blob-report', 'tests/e2e/test-results', 'tests/e2e/playwright-report']) {
    add('pw-output', olderThanNewest(entries(path.join(root, d)), 2));
  }
  // İz zip'leri: profil başına en yeni 2.
  for (const prof of entries(b('e2e', 'traces'))) {
    if (fs.lstatSync(prof.p).isDirectory()) add('traces', olderThanNewest(entries(prof.p), 2));
  }
  // Eski paketler: yalnız son zip kalır.
  add('zip', olderThanNewest(entries(b()).filter((e) => e.p.endsWith('.zip')), 1));
  // Ship günlükleri: en yeni 5.
  add('ship-log', olderThanNewest(entries(b()).filter((e) => /ship-.*\.txt$/.test(e.p)), 5));
  add('ship-log', olderThanNewest(entries(b('e2e')).filter((e) => /(ship|full|quick|matrix)-.*\.log$/.test(e.p)), 10));
  // İnceleme/anlık görüntü klasörleri: en yeni 2 review-*, 7 günden eski debug/stability/current/report.
  add('review', olderThanNewest(entries(b('e2e')).filter((e) => /\/review-[^/]+$/.test(e.p)), 2));
  for (const d of ['debug', 'stability', 'current', 'report', 'conflicts', 'diff']) {
    add('e2e-regen', entries(b('e2e', d)).filter((e) => now - e.mtime > 7 * DAY));
  }
  // Matris işçi kopyaları: 1 saatten eski ve portu boşta olanlar (yeniden üretilebilir).
  add('matrix-workers', entries(b('e2e', 'matrix', '_workers')).filter((e) => {
    const port = Number(/-(\d{4,5})$/.exec(e.p)?.[1] || 0);
    return now - e.mtime > HOUR && !isPortBusy(port);
  }));
  // Eski gözden geçirme çıktıları ve migrasyon karşılaştırmaları: 14 günden eski.
  for (const d of ['review-ikram', 'review-staging', 'visual']) {
    add('review-old', entries(b(d)).filter((e) => now - e.mtime > 14 * DAY));
  }
  if (includeWorktrees) {
    for (const w of finishedWorktrees(root, { protectedNames })) items.push(w);
  }
  return items;
}

export function applyPlan(root, items, { dryRun = true, runGit = (args) => git(root, args) } = {}) {
  let freed = 0;
  const done = [];
  for (const it of items) {
    if (!dryRun) {
      if (it.kind === 'worktree') runGit(['worktree', 'remove', it.p]);
      else if (inside(root, it.p)) fs.rmSync(it.p, { recursive: true, force: true });
      else continue;
    }
    freed += it.size;
    done.push(it);
  }
  return { freed, done };
}

export function summarize(items) {
  const by = {};
  for (const i of items) { by[i.rule] ??= { count: 0, size: 0 }; by[i.rule].count++; by[i.rule].size += i.size; }
  return by;
}
