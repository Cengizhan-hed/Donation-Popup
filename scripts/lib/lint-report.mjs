/**
 * PHPCS / PHPStan / Plugin Check çıktısını kategorize eder.
 * Kategoriler: güvenlik, uyumluluk, i18n, stil, tip, ölü kod.
 */
import fs from 'node:fs';
import path from 'node:path';

export const LINT_CATEGORIES = ['güvenlik', 'uyumluluk', 'i18n', 'stil', 'tip', 'ölü kod'];

/**
 * @param {string} source
 * @param {string} [message]
 * @returns {string}
 */
export function categorizeIssue(source, message = '') {
  const s = `${source} ${message}`.toLowerCase();
  if (
    /escape|nonce|sanitiz|preparedsql|directdatabasequery|sqlinjection|csrf|unslash|validatedsanitized|safeoutput|safesql|wpdb|outputnotescaped/.test(
      s
    )
  ) {
    return 'güvenlik';
  }
  if (
    /phpcompat|phpcompatibility|deprecated|minimumwp|recommendedversion|wpversion|polyfill|removedfunction/.test(s)
  ) {
    return 'uyumluluk';
  }
  if (/\bi18n\b|textdomain|translator|domain\.|wp\.i18n/.test(s)) {
    return 'i18n';
  }
  if (
    /dead.?code|unused|unreachable|unusedfunction|unusedmethod|unusedclass|unusedproperty|constructedbutnotused|no-unused/.test(
      s
    )
  ) {
    return 'ölü kod';
  }
  if (
    /phpstan|missingtype|invalidtype|unknownclass|undefined(?:function|method|property|variable)|parameter\s|#\s|return\.|property\.|method\.|argument\.|binaryop|cast\.|offsetaccess|nullsafe|deadcatch/.test(
      s
    )
  ) {
    return 'tip';
  }
  return 'stil';
}

/**
 * @param {string} filePath
 * @param {string} root
 */
export function relPosix(filePath, root) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

/**
 * @param {{ file: string, line: number, source: string, message: string, fixable?: boolean }} issue
 */
export function issueFingerprint(issue) {
  return `${issue.file}|${issue.source}|${String(issue.message || '').replace(/\s+/g, ' ').trim()}`;
}

/**
 * @param {Array<{ file: string, line?: number, source: string, message: string, fixable?: boolean, category?: string }>} issues
 */
export function summarizeIssues(issues) {
  const byCat = Object.fromEntries(LINT_CATEGORIES.map((c) => [c, 0]));
  const byFile = new Map();
  let fixable = 0;
  for (const issue of issues) {
    const cat = issue.category || categorizeIssue(issue.source, issue.message);
    issue.category = cat;
    byCat[cat] = (byCat[cat] || 0) + 1;
    byFile.set(issue.file, (byFile.get(issue.file) || 0) + 1);
    if (issue.fixable) fixable += 1;
  }
  const topFiles = [...byFile.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 15)
    .map(([file, count]) => ({ file, count }));
  return {
    total: issues.length,
    fixable,
    categories: byCat,
    topFiles,
  };
}

/**
 * @param {string} title
 * @param {ReturnType<typeof summarizeIssues>} summary
 */
export function summaryMarkdown(title, summary) {
  const rows = LINT_CATEGORIES.map((c) => `| ${c} | ${summary.categories[c] || 0} |`).join('\n');
  const files = summary.topFiles.map((f) => `| \`${f.file}\` | ${f.count} |`).join('\n') || '| — | 0 |';
  return `# ${title}

Toplam: **${summary.total}** · phpcbf ile otomatik düzeltilebilir: **${summary.fixable}**

## Kategori

| Kategori | Sayı |
|----------|------|
${rows}

## En çok hata veren 15 dosya

| Dosya | Sayı |
|-------|------|
${files}
`;
}

/**
 * @param {object} phpcsJson PHPCS --report=json
 * @param {string} root
 */
export function issuesFromPhpcs(phpcsJson, root) {
  /** @type {Array<{ file: string, line: number, column: number, source: string, message: string, fixable: boolean, severity: string }>} */
  const out = [];
  const files = phpcsJson && phpcsJson.files ? phpcsJson.files : {};
  for (const [abs, info] of Object.entries(files)) {
    const file = relPosix(abs, root);
    const messages = info && Array.isArray(info.messages) ? info.messages : [];
    for (const m of messages) {
      out.push({
        file,
        line: Number(m.line) || 0,
        column: Number(m.column) || 0,
        source: String(m.source || ''),
        message: String(m.message || ''),
        fixable: Boolean(m.fixable),
        severity: String(m.type || 'ERROR'),
      });
    }
  }
  return out;
}

/**
 * @param {object} phpstanJson
 * @param {string} root
 */
export function issuesFromPhpstan(phpstanJson, root) {
  /** @type {Array<{ file: string, line: number, source: string, message: string, fixable: boolean }>} */
  const out = [];
  const files = phpstanJson && phpstanJson.files ? phpstanJson.files : {};
  for (const [abs, info] of Object.entries(files)) {
    const file = relPosix(abs, root);
    const messages = info && Array.isArray(info.messages) ? info.messages : [];
    for (const m of messages) {
      out.push({
        file,
        line: Number(m.line) || 0,
        source: String(m.identifier || 'phpstan'),
        message: String(m.message || ''),
        fixable: false,
      });
    }
  }
  return out;
}

/**
 * Plugin Check JSON (dizi veya { results } / { errors }).
 * @param {unknown} raw
 */
export function issuesFromPluginCheck(raw) {
  /** @type {Array<{ file: string, line: number, source: string, message: string, fixable: boolean }>} */
  const out = [];
  const rows = [];
  if (typeof raw === 'string') {
    const start = raw.search(/[\[{]/);
    if (start >= 0) {
      try {
        return issuesFromPluginCheck(JSON.parse(raw.slice(start)));
      } catch {
        const blocks = raw.split(/^FILE:\s+/m).filter(Boolean);
        for (const block of blocks) {
          const nl = block.indexOf('\n');
          const file = (nl === -1 ? block : block.slice(0, nl)).trim();
          const jsonStart = block.indexOf('[');
          if (jsonStart < 0) continue;
          try {
            const list = JSON.parse(block.slice(jsonStart));
            if (Array.isArray(list)) {
              for (const item of list) rows.push({ ...item, file: item.file || file });
            }
          } catch {
            /* tek blok bozuksa diğerleri */
          }
        }
      }
    }
  } else if (Array.isArray(raw)) rows.push(...raw);
  else if (raw && typeof raw === 'object') {
    const obj = /** @type {Record<string, unknown>} */ (raw);
    if (Array.isArray(obj.results)) rows.push(...obj.results);
    else if (Array.isArray(obj.errors)) rows.push(...obj.errors);
    else if (obj.results && typeof obj.results === 'object') {
      for (const [file, list] of Object.entries(obj.results)) {
        if (!Array.isArray(list)) continue;
        for (const item of list) {
          rows.push({ ...item, file: item.file || file });
        }
      }
    }
  }
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const rec = /** @type {Record<string, unknown>} */ (item);
    const file = String(rec.file || rec.path || rec.filename || '').replace(/\\/g, '/');
    out.push({
      file: file.replace(/^.*woo-donation-popup\//, ''),
      line: Number(rec.line || rec.line_number || 0),
      source: String(rec.code || rec.type || rec.check || 'plugin-check'),
      message: String(rec.message || rec.docs || rec.description || JSON.stringify(rec)),
      fixable: false,
    });
  }
  return out;
}

/**
 * @param {string} dir
 * @param {string} stem
 * @param {object} json
 * @param {string} md
 */
export function writeLintPair(dir, stem, json, md) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${stem}.json`), JSON.stringify(json, null, 2));
  fs.writeFileSync(path.join(dir, `${stem}.md`), md);
}
