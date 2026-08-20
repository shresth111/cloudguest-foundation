/**
 * A minimal, dependency-free PNG decoder -- just enough to read back what
 * Playwright's `page.screenshot()` hands us.
 *
 * Why not a package: this repo has no image dependency at all, and adding
 * `pngjs`/`sharp` to `devDependencies` for a measurement script means a
 * native build step (sharp) or a transitive tree, on a branch whose whole
 * point is that the guest bundle does not grow. Chromium's screenshot output
 * is a fixed, narrow shape -- 8-bit, non-interlaced, colour type 6 (RGBA) or
 * 2 (RGB) -- so the general decoder is not needed and its absence is not a
 * limitation we will hit. Anything outside that shape throws loudly rather
 * than returning plausible-looking wrong pixels, because this decoder feeds
 * an accessibility assertion.
 *
 * Reference: PNG spec (W3C REC-png-3), clauses 11 (chunks) and 9 (filters).
 */

import { inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Paeth predictor, PNG spec 9.4. */
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export const PNG = {
  /**
   * @param {Buffer} buf a complete PNG file
   * @returns {{width:number,height:number,data:Uint8Array}} `data` is always
   *   RGBA, 4 bytes per pixel, row-major -- the same shape `pngjs` returns,
   *   so callers index it identically whether the source was RGB or RGBA.
   */
  decode(buf) {
    if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG");

    let pos = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const idat = [];

    while (pos < buf.length) {
      const length = buf.readUInt32BE(pos);
      const type = buf.toString("ascii", pos + 4, pos + 8);
      const body = buf.subarray(pos + 8, pos + 8 + length);
      pos += 12 + length; // length + type + data + CRC

      if (type === "IHDR") {
        width = body.readUInt32BE(0);
        height = body.readUInt32BE(4);
        bitDepth = body[8];
        colorType = body[9];
        const interlace = body[12];
        if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${bitDepth}`);
        if (colorType !== 6 && colorType !== 2)
          throw new Error(`unsupported PNG colour type ${colorType}`);
        if (interlace !== 0) throw new Error("interlaced PNG is not supported");
      } else if (type === "IDAT") {
        idat.push(body);
      } else if (type === "IEND") {
        break;
      }
    }

    const channels = colorType === 6 ? 4 : 3;
    const raw = inflateSync(Buffer.concat(idat));
    const stride = width * channels;
    const out = new Uint8Array(width * height * 4);
    // The previous *unfiltered* scanline, which every filter type except 0
    // and 1 refers back to. Kept as a separate buffer rather than read out of
    // `out`, because `out` is RGBA and this is `channels`-wide.
    let prev = new Uint8Array(stride);
    let cur = new Uint8Array(stride);

    for (let y = 0; y < height; y++) {
      const rowStart = y * (stride + 1);
      const filter = raw[rowStart];
      const line = raw.subarray(rowStart + 1, rowStart + 1 + stride);

      for (let x = 0; x < stride; x++) {
        const a = x >= channels ? cur[x - channels] : 0; // left
        const b = prev[x]; // up
        const c = x >= channels ? prev[x - channels] : 0; // up-left
        let v = line[x];
        if (filter === 1) v += a;
        else if (filter === 2) v += b;
        else if (filter === 3) v += (a + b) >> 1;
        else if (filter === 4) v += paeth(a, b, c);
        else if (filter !== 0) throw new Error(`unknown PNG filter ${filter}`);
        cur[x] = v & 0xff;
      }

      for (let x = 0; x < width; x++) {
        const s = x * channels;
        const d = (y * width + x) * 4;
        out[d] = cur[s];
        out[d + 1] = cur[s + 1];
        out[d + 2] = cur[s + 2];
        out[d + 3] = channels === 4 ? cur[s + 3] : 255;
      }

      const swap = prev;
      prev = cur;
      cur = swap;
    }

    return { width, height, data: out };
  },
};
