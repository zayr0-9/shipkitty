import { ALLOWED_TYPES, MAX_UPLOAD_BYTES } from './constants';

export function assertAllowedContentType(contentType: string | null) {
  const normalized = contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!ALLOWED_TYPES.includes(normalized as (typeof ALLOWED_TYPES)[number])) {
    throw new Error('Only compressed WebP images are allowed.');
  }
  return normalized;
}

export function assertAllowedContentLength(contentLength: string | null) {
  if (!contentLength) return;
  const size = Number(contentLength);
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('Invalid Content-Length header.');
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw new Error('Image must be 100 KB or smaller.');
  }
}

export async function assertImageBytes(request: Request, contentType: string) {
  const bytes = new Uint8Array(await request.arrayBuffer());

  if (bytes.byteLength === 0) {
    throw new Error('Image file is empty.');
  }

  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('Image must be 100 KB or smaller.');
  }

  if (!magicBytesMatch(bytes, contentType)) {
    throw new Error('Image bytes do not match the declared content type.');
  }

  return bytes;
}

function magicBytesMatch(bytes: Uint8Array, contentType: string) {
  if (contentType === 'image/webp') {
    return bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP';
  }

  if (contentType === 'image/png') {
    return bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG' && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  }

  if (contentType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  return false;
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}
