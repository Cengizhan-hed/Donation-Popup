#!/usr/bin/env node
/**
 * Build languages/woo-donation-popup.pot with xgettext (PHP + JS). No extra deps.
 *
 *   node tools/i18n/make-pot.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.WDP_I18N_ROOT
  ? path.resolve(process.env.WDP_I18N_ROOT)
  : path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'languages/woo-donation-popup.pot');

const PHP_KEYWORDS = [
  '__',
  '_e',
  '_x:1,2c',
  '_n:1,2',
  'esc_html__',
  'esc_attr__',
  'esc_html_e',
  'esc_attr_e',
  'esc_html_x',
  'esc_attr_x',
  '_nx:1,2,4c',
];
const JS_KEYWORDS = ['WDPApp.i18n.__', 'WDPApp.i18n._x:1,2c', '__', '_x:1,2c'];

function walk(dir, pred, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (['node_modules', 'vendor', 'build', '.git'].includes(name.name)) continue;
      walk(abs, pred, out);
      continue;
    }
    if (name.isFile() && pred(abs)) out.push(abs);
  }
  return out;
}

function readPluginVersion(root) {
  const src = fs.readFileSync(path.join(root, 'woo-donation-popup.php'), 'utf8');
  const m = src.match(/^\s*\*\s*Version:\s*(\S+)/m);
  return m ? m[1] : '0.0.0';
}

function rel(abs) {
  return path.relative(ROOT, abs).split(path.sep).join('/');
}

function runXgettext(args) {
  const r = spawnSync('xgettext', args, { encoding: 'utf8', cwd: ROOT });
  if (r.status !== 0) {
    throw new Error(`xgettext: ${(r.stderr || r.stdout || '').slice(0, 800)}`);
  }
}

function patchHeader(pot, version) {
  let text = pot;
  text = text.replace(
    /"Project-Id-Version:.*\\n"/,
    `"Project-Id-Version: woo-donation-popup ${version}\\n"`
  );
  if (!/"Text-Domain:/.test(text)) {
    text = text.replace(/("MIME-Version:.*\\n"\n)/, `$1"Text-Domain: woo-donation-popup\\n"\n`);
  }
  if (!/"X-Domain:/.test(text)) {
    text = text.replace(/("Text-Domain:.*\\n"\n)/, `$1"X-Domain: woo-donation-popup\\n"\n`);
  }
  return text;
}

function main() {
  if (!fs.existsSync(path.join(ROOT, 'languages'))) {
    fs.mkdirSync(path.join(ROOT, 'languages'), { recursive: true });
  }
  const phpFiles = [
    path.join(ROOT, 'woo-donation-popup.php'),
    ...walk(path.join(ROOT, 'src'), (f) => f.endsWith('.php')),
    ...walk(path.join(ROOT, 'templates'), (f) => f.endsWith('.php')),
    ...walk(path.join(ROOT, 'blocks'), (f) => f.endsWith('.php')),
  ].filter((f) => fs.existsSync(f));
  const jsFiles = [
    ...walk(path.join(ROOT, 'assets/js/src'), (f) => f.endsWith('.js')),
    ...walk(path.join(ROOT, 'blocks'), (f) => f.endsWith('.js') && !f.includes(`${path.sep}build${path.sep}`)),
  ].filter((f) => fs.existsSync(f));

  const tmp = path.join(ROOT, 'languages/.wdp-pot-tmp.pot');
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  if (fs.existsSync(OUT)) fs.unlinkSync(OUT);

  const phpArgs = [
    '--language=PHP',
    '--from-code=UTF-8',
    '--add-comments=translators',
    `--package-name=woo-donation-popup`,
    '--package-version=' + readPluginVersion(ROOT),
    '-o',
    tmp,
    ...PHP_KEYWORDS.flatMap((k) => ['--keyword=' + k]),
    '--files-from=-',
  ];
  const phpList = phpFiles.map(rel).join('\n') + '\n';
  const r1 = spawnSync('xgettext', phpArgs, {
    encoding: 'utf8',
    cwd: ROOT,
    input: phpList,
  });
  if (r1.status !== 0) {
    throw new Error(`xgettext PHP: ${(r1.stderr || r1.stdout || '').slice(0, 800)}`);
  }

  if (jsFiles.length) {
    const jsArgs = [
      '--language=JavaScript',
      '--from-code=UTF-8',
      '--join-existing',
      '-o',
      tmp,
      ...JS_KEYWORDS.flatMap((k) => ['--keyword=' + k]),
      '--files-from=-',
    ];
    const r2 = spawnSync('xgettext', jsArgs, {
      encoding: 'utf8',
      cwd: ROOT,
      input: jsFiles.map(rel).join('\n') + '\n',
    });
    if (r2.status !== 0) {
      throw new Error(`xgettext JS: ${(r2.stderr || r2.stdout || '').slice(0, 800)}`);
    }
  }

  const version = readPluginVersion(ROOT);
  const pot = patchHeader(fs.readFileSync(tmp, 'utf8'), version);
  fs.writeFileSync(OUT, pot, 'utf8');
  fs.unlinkSync(tmp);
  console.log(`wrote ${rel(OUT)} (${pot.split('\nmsgid ').length - 1} msgid)`);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    main();
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
}

export { patchHeader, readPluginVersion };
