import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('../..', import.meta.url));
const sourceRoot = join(workspace, 'src/mobile/app');
const MIN_FONT_SIZE = 12;
const violations = [];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  }));
  return files.flat();
}

for (const path of await collectFiles(sourceRoot)) {
  const normalizedPath = path.replaceAll('\\', '/');
  const isUiSource =
    normalizedPath.includes('/ui/') ||
    normalizedPath.includes('/components/') ||
    normalizedPath.includes('/app-shell/chrome/') ||
    normalizedPath.includes('/app-shell/startup/');

  if (
    !isUiSource ||
    !['.ts', '.tsx'].includes(extname(path)) ||
    /(?:__tests__|\.test\.tsx?$|\/shared\/theme\/)/.test(normalizedPath)
  ) {
    continue;
  }

  const source = await readFile(path, 'utf8');
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (/(?:#[0-9a-fA-F]{3,8}|rgba?\s*\()/.test(line)) {
      violations.push(`${relative(workspace, path)}:${index + 1} raw color`);
    }

    const fontSizeMatch = line.match(/fontSize:\s*(\d+(?:\.\d+)?)/);
    if (fontSizeMatch && Number(fontSizeMatch[1]) < MIN_FONT_SIZE) {
      violations.push(`${relative(workspace, path)}:${index + 1} text below ${MIN_FONT_SIZE}px`);
    }
  });
}

// The theme file is exempt from the raw-colour rule because it is where the
// palette is declared, but its type scale still ships to every screen: a
// sub-12px token used to slip through while hand-written styles were blocked.
const themeTokens = join(sourceRoot, 'shared/theme/tokens.ts');
const themeSource = await readFile(themeTokens, 'utf8');
themeSource.split(/\r?\n/).forEach((line, index) => {
  const fontSizeMatch = line.match(/fontSize:\s*(\d+(?:\.\d+)?)/);
  if (fontSizeMatch && Number(fontSizeMatch[1]) < MIN_FONT_SIZE) {
    violations.push(
      `${relative(workspace, themeTokens)}:${index + 1} token declares text below ${MIN_FONT_SIZE}px`,
    );
  }
});

if (violations.length > 0) {
  console.error('[ui-tokens] UI styles must use theme tokens and readable type:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`[ui-tokens] OK (no raw UI colors, no sub-${MIN_FONT_SIZE}px text in styles or tokens)`);
