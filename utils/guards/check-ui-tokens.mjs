import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findTypographyViolations } from './ui-token-typography.mjs';

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
  const sourceExtension = extname(path);

  if (
    !['.ts', '.tsx'].includes(sourceExtension) ||
    /(?:__tests__|\.test\.tsx?$|\/shared\/theme\/)/.test(normalizedPath)
  ) {
    continue;
  }

  const source = await readFile(path, 'utf8');
  const relativePath = relative(workspace, path);

  // Colour is checked everywhere, not just in files that look like UI. The
  // Android notification channel painted its LED with a raw blue that was not
  // even the brand primary, and it sat in `platform/notifications` where none
  // of the heuristics below reach.
  source.split(/\r?\n/).forEach((line, index) => {
    if (/(?:#[0-9a-fA-F]{3,8}|rgba?\s*\()/.test(line)) {
      violations.push(`${relativePath}:${index + 1} raw color`);
    }
  });

  const isUiSource =
    sourceExtension === '.tsx' ||
    source.includes('StyleSheet.create') ||
    normalizedPath.includes('/ui/') ||
    normalizedPath.includes('/components/') ||
    normalizedPath.includes('/app-shell/chrome/') ||
    normalizedPath.includes('/app-shell/startup/');

  if (!isUiSource) {
    continue;
  }

  violations.push(...findTypographyViolations({
    minFontSize: MIN_FONT_SIZE,
    normalizedPath,
    relativePath,
    source,
  }));
}

// The theme file is exempt from the raw-colour rule because it is where the
// palette is declared, but its type scale still ships to every screen: a
// sub-12px token used to slip through while hand-written styles were blocked.
const themeTokens = join(sourceRoot, 'shared/theme/tokens.ts');
const themeSource = await readFile(themeTokens, 'utf8');
violations.push(...findTypographyViolations({
  allowRawDeclarations: true,
  minFontSize: MIN_FONT_SIZE,
  normalizedPath: themeTokens.replaceAll('\\', '/'),
  relativePath: relative(workspace, themeTokens),
  source: themeSource,
}).map((violation) => violation.replace(
  `text below ${MIN_FONT_SIZE}px`,
  `token declares text below ${MIN_FONT_SIZE}px`,
)));

// Design tokens rot quietly: four different names once held the same cover
// placeholder and one of them was referenced nowhere at all. A token nothing
// reads is not a design decision, it is a claim the palette no longer honours.
const themeRelative = relative(workspace, themeTokens);

// tokens.ts is included on purpose: semanticColors consumes the raw palette
// from inside the same file, and that counts as a real reference.
const allSources = await Promise.all(
  [...(await collectFiles(sourceRoot))]
    .filter((file) => ['.ts', '.tsx'].includes(extname(file)))
    .map((file) => readFile(file, 'utf8')),
);
const corpus = allSources.join('\n');

function declaredNames(blockName) {
  const block = themeSource.match(
    new RegExp(`export const ${blockName} = \\{([\\s\\S]*?)\\n\\};`, 'u'),
  );
  if (!block) {
    violations.push(`${themeRelative} ${blockName} block could not be parsed`);
    return null;
  }
  return [...block[1].matchAll(/^\s*'?([A-Za-z0-9_]+)'?:/gmu)].map((match) => match[1]);
}

// A token nothing reads is not a design decision, it is a claim the system no
// longer honours. Colour rot was already caught here; spacing rotted the same
// way unseen, and `spacing.none` sat declared with zero readers.
for (const [blockName, accessor] of [
  ['colors', 'colors'],
  ['spacing', 'spacing'],
  ['radius', 'radius'],
]) {
  const declared = declaredNames(blockName);
  if (!declared) continue;

  for (const name of declared) {
    const dotted = corpus.split(`${accessor}.${name}`).length - 1;
    const bracketed = corpus.split(`${accessor}['${name}']`).length - 1;
    if (dotted + bracketed === 0) {
      violations.push(
        `${themeRelative} declares ${blockName} token "${name}" that nothing reads`,
      );
    }
  }
}

// Two names for one value is how a design system stops being one. The discovery
// tiles had minted `compactCardTitleText` and `compactCardMetaText`, byte-identical
// to `labelText` and `metadataText`, and nothing noticed until they were measured.
const typographyBlock = themeSource.match(
  /const typographyStyles = \{([\s\S]*?)\n\} as const;/u,
);
if (!typographyBlock) {
  violations.push(`${themeRelative} typographyStyles block could not be parsed`);
} else {
  const seen = new Map();
  const entryPattern =
    /^\s*([A-Za-z0-9_]+):\s*\{\s*fontSize:\s*(\d+),\s*lineHeight:\s*(\d+),\s*fontWeight:\s*'(\d+)'/gmu;
  for (const [, name, fontSize, lineHeight, fontWeight] of typographyBlock[1].matchAll(
    entryPattern,
  )) {
    const signature = `${fontSize}/${lineHeight}/${fontWeight}`;
    const existing = seen.get(signature);
    if (existing) {
      violations.push(
        `${themeRelative} typography token "${name}" duplicates "${existing}" (${signature}); reuse it instead`,
      );
      continue;
    }
    seen.set(signature, name);
  }
}

if (violations.length > 0) {
  console.error('[ui-tokens] UI styles must use theme tokens and readable type:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log(`[ui-tokens] OK (theme colours, readable type, and guarded UI typography are tokenized)`);
