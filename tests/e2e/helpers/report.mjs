/**
 * pixelmatch compare + HTML report (largest diffs first).
 * İşlevsel hatalar en üstte ayrı bölümde.
 * Yalnızca bu çalıştırmada çekilen ekranlar karşılaştırılır.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/**
 * @param {string} baselineDir
 * @param {string} currentDir
 * @param {string} reportDir
 * @param {Array<{check:string,description:string,detail?:string,screenshot?:string,debugFile?:string}>} [failures]
 * @param {number} [diffThreshold] yüzde; üstü "Değişti"
 * @param {{
 *   skips?: Array<{check:string,description:string,detail?:string}>,
 *   flaky?: Array<{check:string,firstError?:string,attemptMs?:number[]}>,
 *   stats?: { passed?: number, skipped?: number, failed?: number },
 *   capturedScreens?: string[],
 *   mode?: string,
 *   autoCreateBaseline?: boolean
 * }} [extra]
 */
export function compareAndReport(baselineDir, currentDir, reportDir, failures = [], diffThreshold = 0.5, extra = {}) {
  const skips = Array.isArray(extra.skips) ? extra.skips : [];
  const flaky = Array.isArray(extra.flaky) ? extra.flaky : [];
  const stats = extra.stats || {};
  const passedCount = Number(stats.passed) || 0;
  const skippedCount = Number(stats.skipped) || skips.length;
  const failedCount = Number(stats.failed) || (failures ? failures.length : 0);
  const autoCreateBaseline = extra.autoCreateBaseline !== false;
  fs.mkdirSync(reportDir, { recursive: true });
  const diffDir = path.join(reportDir, 'diff');
  fs.mkdirSync(diffDir, { recursive: true });
  const threshold = Number.isFinite(diffThreshold) ? diffThreshold : 0.5;

  const currentPngs = fs.existsSync(currentDir)
    ? fs.readdirSync(currentDir).filter((f) => f.endsWith('.png'))
    : [];
  const baselinePngs = fs.existsSync(baselineDir)
    ? fs.readdirSync(baselineDir).filter((f) => f.endsWith('.png'))
    : [];

  /** Bu çalıştırmada çekilen ekranlar (manifest veya current klasörü). */
  let captured = Array.isArray(extra.capturedScreens)
    ? extra.capturedScreens.filter((n) => String(n).endsWith('.png'))
    : currentPngs;
  captured = [...new Set(captured.map((n) => path.basename(String(n))))].sort();

  const capturedSet = new Set(captured);
  const notCaptured = baselinePngs.filter((n) => !capturedSet.has(n)).sort();

  const rows = [];
  let newBaselineCount = 0;
  const changedScreens = [];
  const newBaselineScreens = [];

  for (const name of captured) {
    const baseFile = path.join(baselineDir, name);
    const curFile = path.join(currentDir, name);
    if (!fs.existsSync(curFile)) {
      rows.push({
        name,
        pct: 100,
        missing: 'current',
        diffFile: '',
        status: 'Değişti',
      });
      changedScreens.push(name);
      continue;
    }
    // İlk çalıştırma: current var, baseline yok → otomatik referans (stability’de kapalı)
    if (!fs.existsSync(baseFile)) {
      if (autoCreateBaseline) {
        fs.mkdirSync(baselineDir, { recursive: true });
        fs.copyFileSync(curFile, baseFile);
        newBaselineCount += 1;
        newBaselineScreens.push(name);
        rows.push({
          name,
          pct: 0,
          missing: '',
          diffFile: '',
          status: 'Yeni referans',
        });
      } else {
        rows.push({
          name,
          pct: 100,
          missing: 'baseline',
          diffFile: '',
          status: 'Değişti',
        });
        changedScreens.push(name);
      }
      continue;
    }

    const img1 = PNG.sync.read(fs.readFileSync(baseFile));
    const img2 = PNG.sync.read(fs.readFileSync(curFile));
    const heightDiffPx = Math.abs(img1.height - img2.height);
    const useCommonTop = heightDiffPx <= 16;
    let a;
    let b;
    let width;
    let height;
    let heightNote = '';
    if (useCommonTop) {
      width = Math.min(img1.width, img2.width);
      height = Math.min(img1.height, img2.height);
      a = cropTopLeft(img1, width, height);
      b = cropTopLeft(img2, width, height);
      if (heightDiffPx > 0) {
        heightNote = `Yükseklik farkı: ${heightDiffPx} px`;
      }
    } else {
      width = Math.max(img1.width, img2.width);
      height = Math.max(img1.height, img2.height);
      a = pad(img1, width, height);
      b = pad(img2, width, height);
    }
    const diff = new PNG({ width, height });
    const mismatched = pixelmatch(a.data, b.data, diff.data, width, height, {
      threshold: 0.1,
    });
    const pct = height > 0 && width > 0 ? (mismatched / (width * height)) * 100 : 100;
    const diffName = name.replace(/\.png$/, '') + '-diff.png';
    const diffFile = path.join(diffDir, diffName);
    fs.writeFileSync(diffFile, PNG.sync.write(diff));
    // ≤16 px yükseklik farkı tek başına Değişti sayılmaz; ortak üst alan eşiğe göre
    const status = pct <= threshold ? 'Aynı' : 'Değişti';
    if (status === 'Değişti') changedScreens.push(name);
    rows.push({
      name,
      pct,
      missing: '',
      diffFile: path.relative(reportDir, diffFile),
      status,
      heightNote,
      heightDiffPx,
    });
  }

  rows.sort((x, y) => {
    if (x.status === 'Yeni referans' && y.status !== 'Yeni referans') return -1;
    if (y.status === 'Yeni referans' && x.status !== 'Yeni referans') return 1;
    return y.pct - x.pct;
  });
  const changedCount = changedScreens.length;

  const skipBlock =
    skips.length > 0
      ? `<section class="skips"><h1>Atlanan kontroller</h1>
${skips
  .map(
    (s) => `<article class="skip-card">
  <h2>${escapeHtml(s.check)}</h2>
  <p class="desc">${escapeHtml(s.description || '')}</p>
  <pre class="detail">${escapeHtml(s.detail || '')}</pre>
</article>`
  )
  .join('\n')}
</section>`
      : '';

  const flakyBlock =
    flaky.length > 0
      ? `<section class="flaky"><h1>Kararsız (yeniden denemede geçti)</h1>
<p>Senaryo geçti sayıldı; ilk deneme başarısız, ikinci deneme başarılı.</p>
${flaky
  .map(
    (f) => `<article class="flaky-card">
  <h2>${escapeHtml(f.check)}</h2>
  <p class="desc">İlk hata: ${escapeHtml(f.firstError || '')}</p>
  <pre class="detail">Süreler (ms): ${escapeHtml(JSON.stringify(f.attemptMs || []))}</pre>
</article>`
  )
  .join('\n')}
</section>`
      : '';

  const notCapturedBlock =
    notCaptured.length > 0
      ? `<section class="out-of-scope"><h1>Bu çalıştırmada çekilmedi (quick kapsamı dışında)</h1>
<p>Baseline’da var; bu çalıştırmada alınmadı. Değişti/Aynı sayımına dahil değil.</p>
<ul>${notCaptured.map((n) => `<li><code>${escapeHtml(n)}</code></li>`).join('')}</ul>
</section>`
      : '';

  const functionalBlock =
    failures && failures.length
      ? `<section class="functional">
<h1>İşlevsel hatalar</h1>
<p>Görsel karşılaştırmadan önce düzeltilmesi gereken kontroller.</p>
${failures
  .map((f) => {
    const shotName = f.screenshot || '';
    const shotRel = shotName
      ? path.relative(reportDir, path.join(currentDir, shotName.endsWith('.png') ? shotName : `${shotName}.png`))
      : '';
    const shotExists = shotRel && fs.existsSync(path.join(reportDir, shotRel));
    return `<article class="fail-card">
  <h2>${escapeHtml(f.check)}</h2>
  <p class="desc">${escapeHtml(f.description || '')}</p>
  <pre class="detail">${escapeHtml(f.detail || '')}</pre>
  ${f.debugFile ? `<p class="debug">Tam log: <code>${escapeHtml(f.debugFile)}</code></p>` : ''}
  ${
    shotExists
      ? `<figure><figcaption>İlgili ekran</figcaption><img src="${escapeHtml(shotRel)}" alt="${escapeHtml(f.check)}"/></figure>`
      : shotName
        ? `<p class="debug">Ekran: ${escapeHtml(shotName)}</p>`
        : ''
  }
</article>`;
  })
  .join('\n')}
</section>`
      : `<section class="functional ok"><h1>İşlevsel hatalar</h1><p>Yok — işlevsel kontroller geçti.</p></section>`;

  const modeNote = extra.mode ? ` Mod: <code>${escapeHtml(extra.mode)}</code>.` : '';

  const html = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/><title>WDP E2E visual report</title>
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;margin:24px;background:#f6f7f8;color:#111}
h1{font-size:1.4rem}
h2{font-size:1.1rem;margin:0 0 6px}
table{border-collapse:collapse;width:100%;background:#fff}
th,td{border:1px solid #ddd;padding:10px;vertical-align:top}
img{max-width:280px;height:auto;border:1px solid #ccc;background:#fff}
.pct{font-weight:700}
.warn{color:#b45309}.bad{color:#b91c1c}
.status-same{color:#15803d;font-weight:600}
.status-changed{color:#b91c1c;font-weight:700}
.status-new{color:#1d4ed8;font-weight:700}
.functional{margin-bottom:28px;padding:16px 18px;background:#fff;border:1px solid #e5e7eb;border-radius:8px}
.functional.ok{border-color:#bbf7d0;background:#f0fdf4}
.skips,.flaky,.out-of-scope{margin-bottom:28px;padding:16px 18px;background:#fff;border:1px solid #fde68a;border-radius:8px}
.flaky{border-color:#f59e0b;background:#fffbeb}
.out-of-scope{border-color:#e5e7eb;background:#fafafa}
.fail-card{margin:14px 0;padding:14px;border-left:4px solid #b91c1c;background:#fef2f2}
.skip-card,.flaky-card{margin:14px 0;padding:14px;border-left:4px solid #d97706;background:#fffbeb}
.fail-card .desc,.skip-card .desc,.flaky-card .desc{font-weight:600;margin:0 0 8px}
.fail-card .detail,.skip-card .detail,.flaky-card .detail{white-space:pre-wrap;font-size:12px;background:#fff;padding:10px;border:1px solid #fecaca;overflow:auto;max-height:180px}
.fail-card .debug{font-size:12px;color:#666}
.stats{display:flex;gap:16px;flex-wrap:wrap;margin:12px 0 20px}
.stat{padding:10px 14px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;font-size:14px}
.stat strong{font-size:1.2rem}
.stat-pass strong{color:#15803d}.stat-skip strong{color:#b45309}.stat-fail strong{color:#b91c1c}
.note{margin:16px 0;padding:12px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:14px;color:#1e3a5f}
figure{margin:10px 0 0}
figcaption{font-size:12px;color:#555;margin-bottom:4px}
.out-of-scope ul{margin:8px 0 0;padding-left:1.2rem;columns:2}
.height-note{font-size:12px;color:#64748b;margin-top:4px}
</style></head><body>
<div class="stats">
  <div class="stat stat-pass">Geçti: <strong>${passedCount}</strong></div>
  <div class="stat stat-skip">Atlandı: <strong>${skippedCount}</strong></div>
  <div class="stat stat-fail">Hata: <strong>${failedCount}</strong></div>
  <div class="stat">Görsel değişti: <strong>${changedCount}</strong></div>
  <div class="stat">Bu çalıştırmada: <strong>${captured.length}</strong></div>
</div>
${functionalBlock}
${flakyBlock}
${skipBlock}
${notCapturedBlock}
<h1>WDP staging görsel rapor</h1>
<p>Eşik: ≤ ${threshold}% → <span class="status-same">Aynı</span>; üstü → <span class="status-changed">Değişti</span>. Değişen ekran: <strong>${changedCount}</strong>.${modeNote}</p>
<p class="note">Akış: <code>npm run ship:staging</code> → rapor temizse devam; bilerek değiştiyse <code>npm run e2e:accept</code> (yalnızca bu çalıştırmanın ekranları + işlevsel hata yokken). Eksik baseline otomatik <span class="status-new">Yeni referans</span>.</p>
${
  newBaselineCount
    ? `<p class="note">Bu çalıştırmada <strong>${newBaselineCount}</strong> ekran için yeni referans oluşturuldu.</p>`
    : ''
}
<table><thead><tr><th>Ekran</th><th>Durum</th><th>Fark %</th><th>Önce</th><th>Sonra</th><th>Fark</th></tr></thead><tbody>
${rows
  .map((r) => {
    const cls = r.pct > 5 ? 'bad' : r.pct > 1 ? 'warn' : '';
    const statusCls =
      r.status === 'Değişti'
        ? 'status-changed'
        : r.status === 'Yeni referans'
          ? 'status-new'
          : 'status-same';
    const before = path.relative(reportDir, path.join(baselineDir, r.name));
    const after = path.relative(reportDir, path.join(currentDir, r.name));
    const heightInfo = r.heightNote
      ? `<div class="height-note">${escapeHtml(r.heightNote)}</div>`
      : '';
    return `<tr>
<td>${escapeHtml(r.name)}${r.missing ? ` <em>(missing ${r.missing})</em>` : ''}${heightInfo}</td>
<td class="${statusCls}">${escapeHtml(r.status)}</td>
<td class="pct ${cls}">${r.pct.toFixed(3)}%</td>
<td>${r.status === 'Yeni referans' || r.missing === 'baseline' ? '—' : `<img src="${escapeHtml(before)}" alt="before"/>`}</td>
<td>${r.missing === 'current' ? '—' : `<img src="${escapeHtml(after)}" alt="after"/>`}</td>
<td>${r.diffFile ? `<img src="${escapeHtml(r.diffFile)}" alt="diff"/>` : '—'}</td>
</tr>`;
  })
  .join('\n')}
</tbody></table></body></html>`;

  const reportFile = path.join(reportDir, 'report.html');
  fs.writeFileSync(reportFile, html, 'utf8');
  return {
    reportFile,
    rows,
    changedCount,
    changedScreens,
    newBaselineCount,
    newBaselineScreens,
    notCapturedScreens: notCaptured,
    capturedScreens: captured,
    threshold,
    passedCount,
    skippedCount,
    failedCount,
  };
}

function pad(img, width, height) {
  if (img.width === width && img.height === height) return img;
  const out = new PNG({ width, height });
  PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
  return out;
}

/** Ortak üst alan (sol-üst kırpma). */
function cropTopLeft(img, width, height) {
  const w = Math.min(width, img.width);
  const h = Math.min(height, img.height);
  if (img.width === w && img.height === h) return img;
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(img, out, 0, 0, w, h, 0, 0);
  return out;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}
