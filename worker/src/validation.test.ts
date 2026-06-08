import { describe, expect, it } from 'vitest';
import { assertAllowedContentLength, assertAllowedContentType, magicBytesMatch } from './validation';

describe('upload validation', () => {
  it('only accepts configured compressed WebP content type', () => {
    expect(assertAllowedContentType('image/webp; charset=binary')).toBe('image/webp');
    expect(() => assertAllowedContentType('image/png')).toThrow('Only compressed WebP images are allowed.');
  });

  it('rejects invalid or oversized content-length values', () => {
    expect(() => assertAllowedContentLength('100000')).not.toThrow();
    expect(() => assertAllowedContentLength('100001')).toThrow('Image must be 100 KB or smaller.');
    expect(() => assertAllowedContentLength('0')).toThrow('Invalid Content-Length header.');
  });

  it('validates WebP magic bytes', () => {
    const webp = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]);
    const png = new Uint8Array([0x89, 80, 78, 71, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(magicBytesMatch(webp, 'image/webp')).toBe(true);
    expect(magicBytesMatch(png, 'image/webp')).toBe(false);
  });
});
