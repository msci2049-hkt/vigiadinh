/**
 * Sinh icon PWA từ linh vật ngôi sao (`assets/mascot/mascot-wave.png`, 640×640).
 *
 * CHẠY TAY, KHÔNG nằm trong build — output đã commit vào `apps/web/public/icons/`
 * (cùng quy ước với `scripts/prepare-ui-assets.py` ở root: tài sản sinh ra thì
 * commit, script chỉ để TÁI LẬP). Máy build production không cần chạy file này.
 *
 *   node scripts/make-app-icons.mjs
 *
 * KHÔNG phụ thuộc thư viện ảnh nào — chỉ `node:zlib`. Máy này không có Pillow,
 * sharp, ImageMagick hay rsvg, và `pngjs` chỉ tồn tại trong store pnpm như một
 * dep BẮC CẦU: dựa vào nó là để script chết im lặng ở lần nâng lockfile kế tiếp.
 * Codec dưới đây chỉ nhận đúng dạng của file nguồn (8-bit, không interlace) và
 * THROW nếu khác — thà đỏ ồn ào còn hơn sinh ra icon hỏng.
 *
 * Thu nhỏ bằng TRUNG BÌNH DIỆN TÍCH: tỉ lệ thu 3–7 lần mà lấy mẫu điểm sẽ làm
 * nét vẽ mảnh của linh vật đứt quãng.
 *
 * Hai loại icon, CỐ Ý tách rời:
 *   - `any`      : chủ thể to (0.86 cạnh) — đây là icon người dùng nhìn thấy.
 *   - `maskable` : Android cắt theo hình tròn/squircle của máy. Vùng an toàn là
 *                  đường tròn đường kính 0.8·N, nên hình vuông bao chủ thể phải
 *                  ≤ 0.8/√2 ≈ 0.566·N thì bốn góc mới không bị xén. Dùng chung
 *                  một file cho cả hai purpose là cách kinh điển để linh vật bị
 *                  cắt cụt tay chân trên máy Android.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "apps/web/public/assets/mascot/mascot-wave.png");
const OUT_DIR = join(ROOT, "apps/web/public/icons");

/** `--fw-paper` trong `components/family/family.css` — nền giấy của chính app. */
const PAPER = [253, 252, 247];

/** Ngưỡng coi một pixel là "khác nền" khi dò khung chủ thể (tổng lệch RGB). */
const SUBJECT_THRESHOLD = 24;

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Decode PNG 8-bit RGB/RGBA không interlace → { width, height, rgb: Buffer } (3 byte/pixel). */
function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("không phải file PNG");
  let offset = 8;
  let header;
  const idat = [];
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  if (!header) throw new Error("thiếu chunk IHDR");
  if (header.depth !== 8 || header.interlace !== 0 || ![2, 6].includes(header.colorType)) {
    throw new Error(
      `chỉ hỗ trợ PNG 8-bit RGB/RGBA không interlace — nhận depth=${header.depth} colorType=${header.colorType} interlace=${header.interlace}`,
    );
  }

  const channels = header.colorType === 6 ? 4 : 3;
  const stride = header.width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(header.width * header.height * 3);
  const line = Buffer.alloc(stride);
  const previous = Buffer.alloc(stride);

  for (let y = 0; y < header.height; y++) {
    const filter = raw[y * (stride + 1)];
    raw.copy(line, 0, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = previous[i];
      const c = i >= channels ? previous[i - channels] : 0;
      let value = line[i];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) {
        throw new Error(`filter PNG lạ: ${filter}`);
      }
      line[i] = value & 0xff;
    }
    for (let x = 0; x < header.width; x++) {
      const src = x * channels;
      const dst = (y * header.width + x) * 3;
      out[dst] = line[src];
      out[dst + 1] = line[src + 1];
      out[dst + 2] = line[src + 2];
    }
    line.copy(previous);
  }
  return { width: header.width, height: header.height, rgb: out };
}

/** Encode RGB 8-bit (filter 0 mọi dòng — icon nhỏ, không cần tối ưu kích thước). */
function encodePng(width, height, rgb) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function subjectBox(img) {
  const bg = [img.rgb[0], img.rgb[1], img.rgb[2]];
  let x0 = img.width;
  let y0 = img.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (img.width * y + x) * 3;
      const delta =
        Math.abs(img.rgb[i] - bg[0]) +
        Math.abs(img.rgb[i + 1] - bg[1]) +
        Math.abs(img.rgb[i + 2] - bg[2]);
      if (delta > SUBJECT_THRESHOLD) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Trung bình diện tích một ô nguồn → một pixel đích (giữ nét mảnh khi thu nhỏ). */
function sampleBox(src, sx0, sy0, sx1, sy1) {
  const x0 = Math.max(0, Math.floor(sx0));
  const y0 = Math.max(0, Math.floor(sy0));
  const x1 = Math.min(src.width, Math.max(x0 + 1, Math.ceil(sx1)));
  const y1 = Math.min(src.height, Math.max(y0 + 1, Math.ceil(sy1)));
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (src.width * y + x) * 3;
      r += src.rgb[i];
      g += src.rgb[i + 1];
      b += src.rgb[i + 2];
      n++;
    }
  }
  return n === 0 ? PAPER : [r / n, g / n, b / n];
}

/** Vẽ chủ thể (đã canh giữa, tỉ lệ `fill`) lên canvas vuông nền giấy. */
function render(src, box, size, fill) {
  const out = Buffer.alloc(size * size * 3);
  const side = Math.max(box.w, box.h);
  const target = size * fill;
  const scale = target / side;
  // Ô nguồn hình vuông bao chủ thể, canh giữa theo cả hai trục.
  const srcSide = side;
  const srcX = box.x0 + box.w / 2 - srcSide / 2;
  const srcY = box.y0 + box.h / 2 - srcSide / 2;
  const drawn = srcSide * scale;
  const offset = (size - drawn) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) * 3;
      let rgb = PAPER;
      if (x >= offset && x < offset + drawn && y >= offset && y < offset + drawn) {
        const u = srcX + (x - offset) / scale;
        const v = srcY + (y - offset) / scale;
        const step = 1 / scale;
        rgb = sampleBox(src, u, v, u + step, v + step);
      }
      out[i] = Math.round(rgb[0]);
      out[i + 1] = Math.round(rgb[1]);
      out[i + 2] = Math.round(rgb[2]);
    }
  }
  return out;
}

const source = decodePng(readFileSync(SOURCE));
const box = subjectBox(source);
console.log(`nguồn ${source.width}×${source.height}, khung chủ thể`, box);

const OUTPUTS = [
  // Icon người dùng nhìn thấy — chủ thể to.
  { file: "icon-192.png", size: 192, fill: 0.86 },
  { file: "icon-512.png", size: 512, fill: 0.86 },
  { file: "apple-touch-icon.png", size: 180, fill: 0.86 },
  // Android cắt theo mặt nạ của máy — chủ thể phải nằm gọn trong đường tròn 0.8·N.
  { file: "icon-maskable-512.png", size: 512, fill: 0.56 },
];

for (const { file, size, fill } of OUTPUTS) {
  const rgb = render(source, box, size, fill);
  writeFileSync(join(OUT_DIR, file), encodePng(size, size, rgb));
  console.log(`✅ ${file} — ${size}×${size}, chủ thể ${Math.round(fill * 100)}%`);
}
