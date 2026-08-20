import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const scanRoots = ['assets', 'src'].map((directory) => path.join(projectRoot, directory));
const imageExtensions = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.heic',
  '.heif',
  '.icns',
  '.ico',
  '.jpeg',
  '.jpg',
  '.jxl',
  '.png',
  '.webp',
]);
const parserBlockedExtensions = new Set(['.avif', '.heic', '.heif', '.icns', '.jxl']);
const heifBrands = new Set(['avif', 'avis', 'heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1']);
const maxAssetBytes = 25 * 1024 * 1024;

function walk(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function readHeader(filePath) {
  const descriptor = fs.openSync(filePath, 'r');
  const header = Buffer.alloc(64);

  try {
    const bytesRead = fs.readSync(descriptor, header, 0, header.length, 0);
    return header.subarray(0, bytesRead);
  } finally {
    fs.closeSync(descriptor);
  }
}

function hasBlockedMagic(header) {
  if (header.subarray(0, 4).toString('ascii') === 'icns') {
    return 'ICNS';
  }

  if (header[0] === 0xff && header[1] === 0x0a) {
    return 'JXL codestream';
  }

  if (
    header.length >= 12 &&
    header.subarray(0, 12).equals(
      Buffer.from([0x00, 0x00, 0x00, 0x0c, 0x4a, 0x58, 0x4c, 0x20, 0x0d, 0x0a, 0x87, 0x0a]),
    )
  ) {
    return 'JXL container';
  }

  if (header.length >= 12 && header.subarray(4, 8).toString('ascii') === 'ftyp') {
    for (let offset = 8; offset + 4 <= header.length; offset += 4) {
      if (heifBrands.has(header.subarray(offset, offset + 4).toString('ascii'))) {
        return 'HEIF/AVIF';
      }
    }
  }

  return null;
}

const imageFiles = scanRoots
  .flatMap(walk)
  .filter((filePath) => imageExtensions.has(path.extname(filePath).toLowerCase()));
const violations = [];

for (const filePath of imageFiles) {
  const relativePath = path.relative(projectRoot, filePath);
  const extension = path.extname(filePath).toLowerCase();
  const size = fs.statSync(filePath).size;

  if (size > maxAssetBytes) {
    violations.push(`${relativePath}: ${(size / 1024 / 1024).toFixed(2)} MiB exceeds 25 MiB`);
    continue;
  }

  const blockedFormat = parserBlockedExtensions.has(extension)
    ? extension.slice(1).toUpperCase()
    : hasBlockedMagic(readHeader(filePath));

  if (blockedFormat) {
    violations.push(`${relativePath}: ${blockedFormat} is blocked from Metro asset processing`);
  }
}

if (violations.length > 0) {
  console.error('[metro-assets] Unsafe build assets:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`[metro-assets] OK (${imageFiles.length} repository image assets inspected)`);
