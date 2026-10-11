import { deflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_DIMENSION = 2048;

// CRC-32 (IEEE 802.3), the checksum every PNG chunk carries. Table built once.
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

/** @param {Uint8Array} bytes */
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** FNV-1a: a tiny, stable string hash (the color must not depend on the runtime). */
function hashString(text) {
  let hash = 0x811c9dc5;
  for (const character of text) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function hslToRgb(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = hue / 60;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const [red, green, blue] = [
    [chroma, secondary, 0],
    [secondary, chroma, 0],
    [0, chroma, secondary],
    [0, secondary, chroma],
    [secondary, 0, chroma],
    [chroma, 0, secondary],
  ][Math.floor(sector) % 6];
  const offset = lightness - chroma / 2;

  return [red, green, blue].map((channel) => Math.round((channel + offset) * 255));
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, checksum]);
}

/**
 * A fictional placeholder: an RGB PNG with a vertical gradient whose hue comes from `seed`.
 * Same input -> same bytes. No dependencies: `zlib` compresses, `crc32` seals each chunk.
 *
 * @param {{ width: number, height: number, seed: string }} options
 * @returns {Buffer}
 */
export function createPlaceholderPng({ width, height, seed }) {
  for (const dimension of [width, height]) {
    if (!Number.isInteger(dimension) || dimension < 1 || dimension > MAX_DIMENSION) {
      throw new RangeError(`PNG dimensions must be integers from 1 to ${MAX_DIMENSION}.`);
    }
  }

  const hue = hashString(seed) % 360;
  const stride = 1 + width * 3;
  const raw = Buffer.alloc(height * stride); // filter byte 0 (None) at the start of each row

  for (let row = 0; row < height; row += 1) {
    const progress = height === 1 ? 0 : row / (height - 1);
    const pixel = Buffer.from(hslToRgb(hue, 0.55, 0.74 - 0.34 * progress));
    raw.fill(pixel, row * stride + 1, (row + 1) * stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit depth, truecolor RGB, deflate, no filter method, no interlace

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
