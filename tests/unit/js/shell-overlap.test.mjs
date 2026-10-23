import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyShellOverlap,
  MIN_SHELL_OPACITY,
  POPUP_OVERLAP_CODE,
} from '../../e2e/helpers/shell-overlap.mjs';

function sample(over = {}) {
  return {
    found: true,
    opacities: [
      { tag: 'DIV', className: 'wdp-modal show', opacity: 1 },
      { tag: 'BODY', className: '', opacity: 1 },
    ],
    contentOpacity: 1,
    hits: [
      {
        name: 'donation_full_name',
        x: 200,
        y: 300,
        inShell: true,
        topTag: 'INPUT',
        topClass: 'wdp-field-stack__input',
      },
    ],
    animRunning: 0,
    parentIsBody: true,
    ...over,
  };
}

describe('classifyShellOverlap', () => {
  it('opak + alan modal içinde → geçer', () => {
    const r = classifyShellOverlap(sample());
    assert.equal(r.ok, true);
    assert.equal(r.code, '');
    assert.equal(r.outside, 0);
  });

  it('kabuk yok → POPUP-OVERLAP', () => {
    const r = classifyShellOverlap({ found: false });
    assert.equal(r.ok, false);
    assert.equal(r.code, POPUP_OVERLAP_CODE);
    assert.match(r.reasons[0], /kabuk yok/);
  });

  it('içerik opaklığı 0.5 → POPUP-OVERLAP', () => {
    const r = classifyShellOverlap(sample({ contentOpacity: 0.5 }));
    assert.equal(r.ok, false);
    assert.equal(r.code, POPUP_OVERLAP_CODE);
    assert.match(r.reasons.join(' '), /opaklık/);
  });

  it('ata opaklığı 0.9 → POPUP-OVERLAP', () => {
    const r = classifyShellOverlap(
      sample({
        opacities: [
          { tag: 'DIV', className: 'wdp-modal show', opacity: 1 },
          { tag: 'BODY', className: '', opacity: 0.9 },
        ],
      })
    );
    assert.equal(r.ok, false);
    assert.ok(r.minOpacity < MIN_SHELL_OPACITY);
  });

  it('elementFromPoint modal dışında → POPUP-OVERLAP', () => {
    const r = classifyShellOverlap(
      sample({
        hits: [
          {
            name: 'donation_full_name',
            x: 40,
            y: 20,
            inShell: false,
            topTag: 'H1',
            topClass: 'wp-block-site-title',
          },
        ],
      })
    );
    assert.equal(r.ok, false);
    assert.equal(r.code, POPUP_OVERLAP_CODE);
    assert.equal(r.outside, 1);
    assert.match(r.reasons.join(' '), /wp-block-site-title/);
  });

  it('hit yok → POPUP-OVERLAP', () => {
    const r = classifyShellOverlap(sample({ hits: [] }));
    assert.equal(r.ok, false);
    assert.match(r.reasons.join(' '), /form alanı/);
  });
});
