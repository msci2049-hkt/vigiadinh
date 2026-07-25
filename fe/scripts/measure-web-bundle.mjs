import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const distDir = path.resolve("apps/web/dist");
const assetsDir = path.join(distDir, "assets");
const html = await readFile(path.join(distDir, "index.html"), "utf8");
const initialFiles = [
  ...new Set(
    Array.from(html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g), (match) => match[1]),
  ),
].sort();
const allJsFiles = (await readdir(assetsDir)).filter((file) => file.endsWith(".js")).sort();

async function measure(files) {
  const rows = [];
  for (const file of files) {
    const bytes = await readFile(path.join(assetsDir, file));
    rows.push({
      file,
      raw: bytes.byteLength,
      gzip: gzipSync(bytes, { level: 9 }).byteLength,
    });
  }
  return rows;
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + row[key], 0);
}

const initial = await measure(initialFiles);
const allJs = await measure(allJsFiles);
const report = {
  initial: {
    files: initial,
    raw: sum(initial, "raw"),
    gzip: sum(initial, "gzip"),
  },
  allJs: {
    files: allJs.length,
    raw: sum(allJs, "raw"),
    gzip: sum(allJs, "gzip"),
  },
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
