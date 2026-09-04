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

// Design tokens rot quietly: four different names once held the same cover
// placeholder and one of them was referenced nowhere at all. A token nothing
// reads is not a design decision, it is a claim the palette no longer honours.
const colourBlock = themeSource.match(/export const colors = \{([\s\S]*?)\n\};/);
if (!colourBlock) {
  violations.push(`${relative(workspace, themeTokens)} colour palette could not be parsed`);
} else {
  const declared = [...colourBlock[1].matchAll(/^\s*([A-Za-z0-9_]+):/gm)].map((m) => m[1]);
  // tokens.ts is included on purpose: semanticColors consumes the raw palette
  // from inside the same file, and that counts as a real reference.
  const allSources = await Promise.all(
    [...(await collectFiles(sourceRoot))]
      .filter((file) => ['.ts', '.tsx'].includes(extname(file)))
      .map((file) => readFile(file, 'utf8')),
  );
  const corpus = allSources.join('\n');
  for (const name of declared) {
    const uses = corpus.split(`colors.${name}`).length - 1;
    if (uses === 0) {
      violations.push(
        `${relative(workspace, themeTokens)} declares colour token "${name}" that nothing reads`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error('[ui-tokens] UI styles must use theme tokens and readable type:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`[ui-tokens] OK (no raw UI colors, no sub-${MIN_FONT_SIZE}px text in styles or tokens, no unread colour tokens)`);
