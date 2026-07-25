import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { gunzipSync, inflateRawSync } from "node:zlib";

const VERSION = "8.30.1";
const RELEASE_BASE = `https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}`;

const targetByPlatform = {
  "darwin-arm64": ["darwin_arm64", "tar.gz", "gitleaks"],
  "darwin-x64": ["darwin_x64", "tar.gz", "gitleaks"],
  "linux-arm64": ["linux_arm64", "tar.gz", "gitleaks"],
  "linux-x64": ["linux_x64", "tar.gz", "gitleaks"],
  "win32-arm64": ["windows_arm64", "zip", "gitleaks.exe"],
  "win32-x64": ["windows_x64", "zip", "gitleaks.exe"],
};

function fail(message) {
  console.error(`[gitleaks-bootstrap] ${message}`);
  process.exit(1);
}

function extractFromZip(archive, wantedName) {
  const endSignature = 0x06054b50;
  let endOffset = -1;
  for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65_557); offset -= 1) {
    if (archive.readUInt32LE(offset) === endSignature) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset === -1) fail("Invalid zip archive: end record not found.");

  const entryCount = archive.readUInt16LE(endOffset + 10);
  let offset = archive.readUInt32LE(endOffset + 16);
  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) fail("Invalid zip archive: central entry not found.");
    const method = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const fileNameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const fileName = archive.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");

    if (basename(fileName) === wantedName) {
      if (archive.readUInt32LE(localOffset) !== 0x04034b50) fail("Invalid zip archive: local entry not found.");
      const localNameLength = archive.readUInt16LE(localOffset + 26);
      const localExtraLength = archive.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = archive.subarray(dataOffset, dataOffset + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) return inflateRawSync(compressed);
      fail(`Unsupported zip compression method ${method}.`);
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  fail(`Archive does not contain ${wantedName}.`);
}

function extractFromTarGz(archive, wantedName) {
  const tar = gunzipSync(archive);
  for (let offset = 0; offset + 512 <= tar.length; ) {
    const name = tar
      .subarray(offset, offset + 100)
      .toString("utf8")
      .replace(/\0.*$/s, "");
    if (!name) break;
    const rawSize = tar
      .subarray(offset + 124, offset + 136)
      .toString("ascii")
      .replace(/\0.*$/s, "")
      .trim();
    const size = Number.parseInt(rawSize || "0", 8);
    const dataOffset = offset + 512;
    if (basename(name) === wantedName) return tar.subarray(dataOffset, dataOffset + size);
    offset = dataOffset + Math.ceil(size / 512) * 512;
  }
  fail(`Archive does not contain ${wantedName}.`);
}

async function download(url) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) fail(`Download failed (${response.status}) for ${url}.`);
  return Buffer.from(await response.arrayBuffer());
}

async function ensureBinary() {
  const target = targetByPlatform[`${process.platform}-${process.arch}`];
  if (!target) fail(`Unsupported platform ${process.platform}-${process.arch}.`);
  const [platformName, extension, binaryName] = target;

  const gitDir = spawnSync("git", ["rev-parse", "--git-dir"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (gitDir.status !== 0) fail("Run this command from inside the family-wallet repository.");

  const toolDir = join(gitDir.stdout.trim(), "tools", "gitleaks", VERSION);
  const binaryPath = join(toolDir, binaryName);
  try {
    await readFile(binaryPath);
    return binaryPath;
  } catch {
    // First run downloads the pinned official release into the untracked .git cache.
  }

  await mkdir(toolDir, { recursive: true });
  const archiveName = `gitleaks_${VERSION}_${platformName}.${extension}`;
  const [archive, checksumFile] = await Promise.all([
    download(`${RELEASE_BASE}/${archiveName}`),
    download(`${RELEASE_BASE}/gitleaks_${VERSION}_checksums.txt`),
  ]);
  const checksumLine = checksumFile
    .toString("utf8")
    .split(/\r?\n/)
    .find((line) => line.endsWith(`  ${archiveName}`) || line.endsWith(` ${archiveName}`));
  if (!checksumLine) fail(`Checksum for ${archiveName} was not published.`);
  const expected = checksumLine.trim().split(/\s+/)[0].toLowerCase();
  const actual = createHash("sha256").update(archive).digest("hex");
  if (actual !== expected) fail(`Checksum mismatch for ${archiveName}.`);

  const binary =
    extension === "zip"
      ? extractFromZip(archive, binaryName)
      : extractFromTarGz(archive, binaryName);
  await writeFile(binaryPath, binary);
  if (process.platform !== "win32") await chmod(binaryPath, 0o755);
  return binaryPath;
}

const binaryPath = await ensureBinary();
const result = spawnSync(binaryPath, process.argv.slice(2), {
  cwd: process.cwd(),
  encoding: "utf8",
  stdio: "inherit",
  windowsHide: true,
});
if (result.error) fail(result.error.message);
process.exit(result.status ?? 1);
