const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs']);

const forbiddenRoots = [
  path.join(ROOT, 'src', 'app', 'components'),
  path.join(ROOT, 'src', 'app', 'context'),
  path.join(ROOT, 'src', 'app', 'pages'),
  path.join(ROOT, 'src', 'app', 'types'),
  path.join(ROOT, 'src', 'app', 'utils'),
  path.join(ROOT, 'src', 'mobile', 'components'),
  path.join(ROOT, 'src', 'mobile', 'context'),
  path.join(ROOT, 'src', 'mobile', 'data'),
  path.join(ROOT, 'src', 'mobile', 'navigation'),
  path.join(ROOT, 'src', 'mobile', 'pages'),
  path.join(ROOT, 'src', 'mobile', 'theme'),
  path.join(ROOT, 'src', 'mobile', 'types'),
  path.join(ROOT, 'src', 'mobile', 'utils'),
];

const shellRoots = [
  path.join(ROOT, 'src', 'app', 'app-shell'),
  path.join(ROOT, 'src', 'mobile', 'app', 'app-shell'),
];

const sharedRoots = [
  path.join(ROOT, 'src', 'app', 'shared'),
  path.join(ROOT, 'src', 'mobile', 'app', 'shared'),
];

const platformRoots = [
  path.join(ROOT, 'src', 'app', 'platform'),
  path.join(ROOT, 'src', 'mobile', 'app', 'platform'),
];

function listFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listFiles(fullPath);
    }
    return [fullPath];
  });
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

const failures = [];

for (const forbiddenRoot of forbiddenRoots) {
  const sourceFiles = listFiles(forbiddenRoot).filter((filePath) => FILE_EXTENSIONS.has(path.extname(filePath)));
  if (sourceFiles.length > 0) {
    failures.push(`${rel(forbiddenRoot)} must not contain source files.`);
  }
}

const publicIndexFiles = listFiles(path.join(ROOT, 'src')).filter((filePath) =>
  /[\\/]public[\\/]index\.(ts|tsx|js|jsx)$/.test(filePath),
);

for (const filePath of publicIndexFiles) {
  failures.push(`${rel(filePath)} must not exist; use narrow public/* contracts.`);
}

const wildcardPublicExports = listFiles(path.join(ROOT, 'src')).filter((filePath) => {
  if (!/public[\\/].+\.(ts|tsx|js|jsx)$/.test(filePath)) {
    return false;
  }
  const source = fs.readFileSync(filePath, 'utf8');
  return /^\s*export\s+\*\s+from\s+/m.test(source);
});

for (const filePath of wildcardPublicExports) {
  failures.push(`${rel(filePath)} must not use wildcard re-exports.`);
}

for (const shellRoot of shellRoots) {
  const shellFiles = listFiles(shellRoot).filter((filePath) => FILE_EXTENSIONS.has(path.extname(filePath)));
  for (const filePath of shellFiles) {
    const source = fs.readFileSync(filePath, 'utf8');
    const matches = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)];
    for (const [, specifier] of matches) {
      if (!specifier.startsWith('@/')) {
        continue;
      }
      if (!specifier.includes('/features/')) {
        continue;
      }
      if (!specifier.includes('/public/')) {
        failures.push(`${rel(filePath)} must import features through public/* contracts.`);
      }
    }
  }
}

for (const sharedRoot of sharedRoots) {
  const sharedFiles = listFiles(sharedRoot).filter((filePath) => FILE_EXTENSIONS.has(path.extname(filePath)));
  for (const filePath of sharedFiles) {
    const source = fs.readFileSync(filePath, 'utf8');
    const matches = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)];
    for (const [, specifier] of matches) {
      if (!specifier.startsWith('@/')) {
        continue;
      }
      if (specifier.includes('/features/')) {
        failures.push(`${rel(filePath)} must not import feature internals; move the dependency to shared or introduce a public contract elsewhere.`);
      }
    }
  }
}

for (const platformRoot of platformRoots) {
  const platformFiles = listFiles(platformRoot).filter((filePath) => FILE_EXTENSIONS.has(path.extname(filePath)));
  for (const filePath of platformFiles) {
    const source = fs.readFileSync(filePath, 'utf8');
    const matches = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)];
    for (const [, specifier] of matches) {
      if (!specifier.startsWith('@/')) {
        continue;
      }
      if (
        specifier.includes('/data/') ||
        specifier.includes('/features/') ||
        specifier.includes('/app-shell/')
      ) {
        failures.push(`${rel(filePath)} must stay infrastructure-only and must not import data, features, or app-shell layers.`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('[architecture-boundaries] FAIL');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[architecture-boundaries] OK');
