/**
 * Sağlık: kaynak ayırt etme (bizden / üçüncü taraf), geri dönüş kararı, açık/kapalı karşılaştırma.
 * Ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  classifyPath,
  classifyLogLines,
  logVerdict,
  attributePages,
  pagesTriggerRollback,
  compareOnOff,
  writeRollbackNotice,
  sanitizeLogLine,
} from '../../../scripts/lib/health-attribution.mjs';
import { evaluatePhpHealth, formatHealthLine, healthIsRed } from '../../../scripts/lib/ship-core.mjs';

const T = '[24-Oct-2026 19:30:00 UTC]';
const OLD = '[24-Oct-2026 10:00:00 UTC]';
const SINCE = Date.parse('2026-10-24T19:00:00Z') / 1000;
const WP = '/home/u/www/site/public_html/wp-content';
const REVSLIDER = `${T} PHP Fatal error:  Uncaught Error: Call to undefined function x() in ${WP}/plugins/revslider/includes/a.php:10`;
const OURS = `${T} PHP Fatal error:  Uncaught TypeError: bad in ${WP}/plugins/woo-donation-popup/includes/class-x.php:42`;
const OURS_WARN = `${T} PHP Warning:  Undefined variable $a in ${WP}/plugins/woo-donation-popup/includes/class-x.php on line 7`;

describe('classifyPath', () => {
  it('bizden / üçüncü taraf / çekirdek / bilinmeyen', () => {
    assert.equal(classifyPath(`${WP}/plugins/woo-donation-popup/a.php`).kind, 'ours');
    assert.equal(classifyPath(`${WP}/plugins/revslider/a.php`).kind, 'third_party');
    assert.equal(classifyPath(`${WP}/themes/Avada/a.php`).owner, 'themes/Avada');
    assert.equal(classifyPath('/x/wp-includes/load.php').owner, 'wp-core');
    assert.equal(classifyPath('/tmp/odd.php').kind, 'unknown');
    // benzer ad bizden sayılmaz
    assert.equal(classifyPath(`${WP}/plugins/woo-donation-popup-pro/a.php`).kind, 'third_party');
  });
});

describe('classifyLogLines', () => {
  it('Y2 senaryosu: revslider fatal üçüncü taraf, geri dönüş yok', () => {
    const cls = classifyLogLines([REVSLIDER], { sinceEpoch: SINCE });
    assert.equal(cls.ours.length, 0);
    assert.equal(cls.fatalThirdParty, 1);
    const v = logVerdict(cls);
    assert.equal(v.red, false);
    assert.deepEqual(v.thirdParty.owners, ['plugins/revslider']);
  });

  it('sahte bizden fatal kırmızı', () => {
    const v = logVerdict(classifyLogLines([OURS], { sinceEpoch: SINCE }));
    assert.equal(v.red, true);
    assert.match(v.reasons[0], /bizden PHP fatal/);
  });

  it('başlangıçtan önceki satırlar sayılmaz; yığın izinden kaynak bulunur', () => {
    const cls = classifyLogLines(
      [
        `${OLD} PHP Fatal error:  old in ${WP}/plugins/woo-donation-popup/a.php:1`,
        `${T} PHP Fatal error:  Uncaught Exception: boom`,
        `#0 ${WP}/plugins/revslider/x.php(3): f()`,
        `#1 {main}`,
      ],
      { sinceEpoch: SINCE }
    );
    assert.equal(cls.ours.length, 0);
    assert.equal(cls.thirdParty.length, 1);
  });

  it('bizden uyarı kırmızı değil (açık/kapalı karşılaştırması bakar); kaynaksız fatal kırmızı', () => {
    assert.equal(logVerdict(classifyLogLines([OURS_WARN], { sinceEpoch: SINCE })).red, false);
    assert.equal(logVerdict(classifyLogLines([`${T} PHP Fatal error:  weird`], { sinceEpoch: SINCE })).red, true);
  });

  it('e-posta maskelenir', () => {
    assert.ok(!sanitizeLogLine('hata a.b@site.org içinde').includes('@'));
  });
});

describe('evaluatePhpHealth + sayfa kaynağı', () => {
  const base = { php_ok: 1, active: 1, version: '1.0', needs_run: 0 };

  it('yalnız üçüncü taraf fatal: php yeşil, bilgi satırı', () => {
    const php = evaluatePhpHealth({ ...base, log_lines: [REVSLIDER] }, '1.0', { sinceEpoch: SINCE });
    assert.equal(php.ok, true);
    const pages = attributePages(
      [{ name: 'admin', ok: false, reason: 'critical/fatal' }, { name: 'home', ok: true }],
      { cls: php.logClass }
    );
    assert.equal(pages[0].thirdParty, true);
    assert.equal(pagesTriggerRollback(pages), false);
    const health = { php, pages };
    assert.equal(healthIsRed(health), false);
    const line = formatHealthLine(health);
    assert.match(line, /YEŞİL/);
    assert.match(line, /üçüncü taraf/);
  });

  it('bizden fatal: php kırmızı, sayfa kırmızı kalır, geri dönüş', () => {
    const php = evaluatePhpHealth({ ...base, log_lines: [OURS, REVSLIDER] }, '1.0', { sinceEpoch: SINCE });
    assert.equal(php.ok, false);
    const pages = attributePages([{ name: 'admin', ok: false, reason: 'critical/fatal' }], { cls: php.logClass });
    assert.equal(pages[0].thirdParty, undefined);
    assert.equal(healthIsRed({ php, pages }), true);
    assert.match(formatHealthLine({ php, pages }), /KIRMIZI/);
  });

  it('günlük yok: kırmızı sayfa temkinli bizden sayılır; kurulum öncesi de kırmızıysa üçüncü taraf', () => {
    const red = [{ name: 'plugins', ok: false, reason: 'HTTP 500' }];
    assert.equal(pagesTriggerRollback(attributePages(red, {})), true);
    assert.equal(pagesTriggerRollback(attributePages(red, { baselineRedNames: ['plugins'] })), false);
  });

  it('bizden fatal varsa taban kırmızısı bile üçüncü taraf sayılmaz', () => {
    const cls = classifyLogLines([OURS], { sinceEpoch: SINCE });
    const pages = attributePages([{ name: 'plugins', ok: false, reason: 'HTTP 500' }], { cls, baselineRedNames: ['plugins'] });
    assert.equal(pagesTriggerRollback(pages), true);
  });
});

describe('compareOnOff', () => {
  const off = { home: { consoleErrors: 1, phpIssues: 2 }, admin: { consoleErrors: 0, phpIssues: 0 } };
  it('eşit sayılar yeşil (üçüncü taraf gürültüsü iki tarafta aynı)', () => {
    assert.equal(compareOnOff(off, { home: { consoleErrors: 1, phpIssues: 2 }, admin: {} }).red, false);
  });
  it('eklenti hata ekliyorsa kırmızı', () => {
    const r = compareOnOff(off, { home: { consoleErrors: 1, phpIssues: 3 }, admin: { consoleErrors: 1 } });
    assert.equal(r.red, true);
    assert.equal(r.rows.filter((x) => x.red).length, 2);
  });
  it('bizden kaynaklı kayıt kırmızı', () => {
    assert.equal(compareOnOff(off, { home: { consoleErrors: 1, phpIssues: 2, ours: 1 } }).red, true);
  });
});

describe('writeRollbackNotice', () => {
  it('bildirim dosyası yazar', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-rb-'));
    const f = writeRollbackNotice(dir, { env: 'x', stamp: 's', version: '1', reasons: ['r'], redPages: ['admin'], thirdParty: ['plugins/revslider'], after: 'ok' });
    assert.match(fs.readFileSync(f, 'utf8'), /revslider/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
