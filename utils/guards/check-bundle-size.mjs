import fs from 'node:fs';
import path from 'node:path';

const outputRoot = path.resolve(process.argv[2] || '.expo/bundle-budget');
const MAX_ANDROID_JS_BYTES = 12 * 1024 * 1024;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

if (!fs.existsSync(outputRoot)) {
  console.error(`[bundle-size] Export directory does not exist: ${outputRoot}`);
  process.exit(1);
}

const bundleFiles = walk(outputRoot).filter((filePath) => /\.(?:bundle|hbc|js)$/i.test(filePath));
const totalBytes = bundleFiles.reduce((sum, filePath) => sum + fs.statSync(filePath).size, 0);

if (bundleFiles.length === 0) {
  console.error('[bundle-size] No Android JavaScript bundle was found.');
  process.exit(1);
}

if (totalBytes > MAX_ANDROID_JS_BYTES) {
  console.error(
    `[bundle-size] ${totalBytes} bytes exceeds the ${MAX_ANDROID_JS_BYTES}-byte Android budget.`,
  );
  process.exit(1);
}

console.log(
  `[bundle-size] OK (${bundleFiles.length} files, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB / 12 MiB)`,
);
