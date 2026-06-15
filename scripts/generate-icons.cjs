/* eslint-disable */
/**
 * Procedural icon generator for the 2026 redesign.
 *
 * No image library is installed (no sharp/jimp/imagemagick), so this script
 * decodes/encodes 8-bit RGBA PNGs with the built-in `zlib` and composites the
 * existing FastMemo glyph over a freshly rendered AppBackground gradient
 * (deep night-blue #05091A + eased accent radial glows), matching
 * src/components/ui/AppBackground.tsx exactly.
 *
 * Run: node scripts/generate-icons.cjs
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const IMG = path.join(__dirname, "..", "assets", "images");

/* ---------- CRC32 (PNG chunk checksums) ---------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ---------- PNG decode (8-bit, colorType 2/6, non-interlaced) ---------- */
function decodePNG(buf) {
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  const interlace = buf[28];
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`Unsupported PNG: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
  }
  const channels = colorType === 6 ? 4 : 3;

  let off = 8;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    if (type === "IDAT") idat.push(buf.subarray(off + 8, off + 8 + len));
    off += 12 + len;
    if (type === "IEND") break;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));

  const stride = w * channels;
  const out = Buffer.alloc(w * h * 4);
  const prev = Buffer.alloc(stride);
  let cur = Buffer.alloc(stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      switch (filter) {
        case 1:
          v = (v + a) & 0xff;
          break;
        case 2:
          v = (v + b) & 0xff;
          break;
        case 3:
          v = (v + ((a + b) >> 1)) & 0xff;
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a),
            pb = Math.abs(p - b),
            pc = Math.abs(p - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          v = (v + pr) & 0xff;
          break;
        }
      }
      cur[i] = v;
    }
    for (let x = 0; x < w; x++) {
      const si = x * channels;
      const di = (y * w + x) * 4;
      out[di] = cur[si];
      out[di + 1] = cur[si + 1];
      out[di + 2] = cur[si + 2];
      out[di + 3] = channels === 4 ? cur[si + 3] : 255;
    }
    cur.copy(prev);
  }
  return { width: w, height: h, data: out };
}

/* ---------- PNG encode (8-bit RGBA) ---------- */
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------- Gradient (mirrors AppBackground.tsx) ---------- */
const BASE = [5, 9, 26]; // #05091A
const ACCENT = [79, 107, 255]; // #4F6BFF
const ACCENT_DEEP = [58, 82, 224]; // #3A52E0

function glowAlpha(x, y, W, H, cxF, cyF, rxF, ryF, peak) {
  const dx = (x - cxF * W) / (rxF * W);
  const dy = (y - cyF * H) / (ryF * H);
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d >= 1) return 0;
  const f = 1 - d;
  return peak * f * f; // eased quadratic falloff
}

function renderGradient(W, H) {
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = BASE[0],
        g = BASE[1],
        b = BASE[2];
      const aT = glowAlpha(x, y, W, H, 0.88, -0.02, 0.7, 0.55, 0.28);
      r = ACCENT[0] * aT + r * (1 - aT);
      g = ACCENT[1] * aT + g * (1 - aT);
      b = ACCENT[2] * aT + b * (1 - aT);
      const aB = glowAlpha(x, y, W, H, 0.06, 1.04, 0.55, 0.45, 0.18);
      r = ACCENT_DEEP[0] * aB + r * (1 - aB);
      g = ACCENT_DEEP[1] * aB + g * (1 - aB);
      b = ACCENT_DEEP[2] * aB + b * (1 - aB);
      const di = (y * W + x) * 4;
      out[di] = Math.round(r);
      out[di + 1] = Math.round(g);
      out[di + 2] = Math.round(b);
      out[di + 3] = 255;
    }
  }
  return out;
}

/* ---------- Composite glyph (same size) over a background ---------- */
function compositeOver(bg, fg, W, H) {
  const out = Buffer.from(bg);
  for (let i = 0; i < W * H; i++) {
    const a = fg[i * 4 + 3] / 255;
    if (a === 0) continue;
    const di = i * 4;
    out[di] = Math.round(fg[di] * a + out[di] * (1 - a));
    out[di + 1] = Math.round(fg[di + 1] * a + out[di + 1] * (1 - a));
    out[di + 2] = Math.round(fg[di + 2] * a + out[di + 2] * (1 - a));
    out[di + 3] = 255;
  }
  return out;
}

/* ---------- Run ---------- */
const W = 1024,
  H = 1024;

const glyph = decodePNG(fs.readFileSync(path.join(IMG, "splash-logo.png")));
if (glyph.width !== W || glyph.height !== H) throw new Error("Unexpected glyph size");

const gradient = renderGradient(W, H);
const iconRGBA = compositeOver(gradient, glyph.data, W, H);

const writes = {
  "icon.png": encodePNG(W, H, iconRGBA),
  "splash-icon.png": encodePNG(W, H, iconRGBA),
  "adaptive-icon-bg.png": encodePNG(W, H, gradient),
};
for (const [name, buf] of Object.entries(writes)) {
  fs.writeFileSync(path.join(IMG, name), buf);
  console.log("wrote", name, `(${buf.length} bytes)`);
}
