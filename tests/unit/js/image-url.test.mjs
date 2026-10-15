/**
 * E2E image-url normalize — ağ yok.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeImageStem,
  imageStemsMatch,
  currentSrcMatchesExpected,
} from '../../e2e/helpers/image-url.mjs';

describe('image-url normalize', () => {
  it('a.jpg ↔ a-768x768.jpg', () => {
    assert.equal(normalizeImageStem('a.jpg'), 'a');
    assert.equal(normalizeImageStem('a-768x768.jpg'), 'a');
    assert.equal(currentSrcMatchesExpected('a-768x768.jpg', 'a.jpg'), true);
  });

  it('a.jpg ↔ a.jpg.webp', () => {
    assert.equal(normalizeImageStem('a.jpg.webp'), 'a');
    assert.equal(currentSrcMatchesExpected('a.jpg.webp', 'a.jpg'), true);
  });

  it('a.jpg ↔ a-scaled.webp', () => {
    assert.equal(normalizeImageStem('a-scaled.webp'), 'a');
    assert.equal(currentSrcMatchesExpected('a-scaled.webp', 'a.jpg'), true);
  });

  it('a.jpg?ver=2 ↔ a-300x300.jpg', () => {
    assert.equal(normalizeImageStem('a.jpg?ver=2'), 'a');
    assert.equal(normalizeImageStem('a-300x300.jpg'), 'a');
    assert.equal(currentSrcMatchesExpected('a-300x300.jpg', 'a.jpg?ver=2'), true);
  });

  it('a.jpg ↔ b.jpg eşleşmez', () => {
    assert.equal(imageStemsMatch(normalizeImageStem('a.jpg'), normalizeImageStem('b.jpg')), false);
    assert.equal(currentSrcMatchesExpected('b.jpg', 'a.jpg'), false);
  });

  it('srcset adayı ile eşleşir', () => {
    assert.equal(
      currentSrcMatchesExpected('photo-768x768.jpg.webp', 'photo.jpg', [
        'photo-300x300.jpg 300w, photo-768x768.jpg 768w',
      ]),
      true
    );
  });
});
