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
    throw new Error('Image must be 50 KB or smaller.');
  }
}

export async function assertImageBytes(request: Request, contentType: string, expectedDimensions?: { width: number | null; height: number | null }) {
  const bytes = new Uint8Array(await request.arrayBuffer());

  if (bytes.byteLength === 0) {
    throw new Error('Image file is empty.');
  }

  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('Image must be 50 KB or smaller.');
  }

  if (!magicBytesMatch(bytes, contentType)) {
    throw new Error('Image bytes do not match the declared content type.');
  }

  const dimensions = readWebpDimensions(bytes);
  if (!dimensions || dimensions.width !== dimensions.height) {
    throw new Error('Image must be square.');
  }

  if (expectedDimensions?.width && expectedDimensions?.height && (dimensions.width !== expectedDimensions.width || dimensions.height !== expectedDimensions.height)) {
    throw new Error('Image dimensions do not match the prepared upload.');
  }

  return bytes;
}

export function magicBytesMatch(bytes: Uint8Array, contentType: string) {
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

function readWebpDimensions(bytes: Uint8Array) {
  if (!magicBytesMatch(bytes, 'image/webp')) return null;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = ascii(bytes, offset, 4);
    const chunkSize = readUint32Le(bytes, offset + 4);
    const dataOffset = offset + 8;

    if (dataOffset + chunkSize > bytes.length) return null;

    if (chunkType === 'VP8X' && chunkSize >= 10) {
      return {
        width: readUint24Le(bytes, dataOffset + 4) + 1,
        height: readUint24Le(bytes, dataOffset + 7) + 1,
      };
    }

    if (chunkType === 'VP8 ' && chunkSize >= 10) {
      return {
        width: readUint16Le(bytes, dataOffset + 6) & 0x3fff,
        height: readUint16Le(bytes, dataOffset + 8) & 0x3fff,
      };
    }

    if (chunkType === 'VP8L' && chunkSize >= 5) {
      const bits = bytes[dataOffset + 1] | (bytes[dataOffset + 2] << 8) | (bytes[dataOffset + 3] << 16) | (bytes[dataOffset + 4] << 24);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }

    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  return null;
}

function readUint16Le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24Le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32Le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}
