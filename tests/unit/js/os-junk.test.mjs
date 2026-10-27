import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dirAbsentOrOnlyOsJunk, isOsJunk } from '../../../scripts/lib/os-junk.mjs';

test('isOsJunk: .DS_Store, Thumbs.db, ._* artıktır; diğerleri değil', () => {
  for (const n of ['.DS_Store', 'Thumbs.db', '._x.php']) assert.equal(isOsJunk(n), true, n);
  for (const n of ['a.php', '.gitkeep', 'DS_Store']) assert.equal(isOsJunk(n), false, n);
});

test('dirAbsentOrOnlyOsJunk: yok / yalnız artık geçer; gerçek dosya kalır', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-junk-'));
  try {
    const d = path.join(base, 'includes');
    assert.equal(dirAbsentOrOnlyOsJunk(d), true, 'klasör yok');
    fs.mkdirSync(path.join(d, 'sub'), { recursive: true });
    assert.equal(dirAbsentOrOnlyOsJunk(d), true, 'boş klasör');
    fs.writeFileSync(path.join(d, '.DS_Store'), 'x');
    fs.writeFileSync(path.join(d, 'sub', '._a'), 'x');
    assert.equal(dirAbsentOrOnlyOsJunk(d), true, 'yalnız artık');
    fs.writeFileSync(path.join(d, 'sub', 'class-a.php'), '<?php');
    assert.equal(dirAbsentOrOnlyOsJunk(d), false, 'gerçek dosya var');
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
