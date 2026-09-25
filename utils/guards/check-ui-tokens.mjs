import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findTypographyViolations } from './ui-token-typography.mjs';

const workspace = fileURLToPath(new URL('../..', import.meta.url));
const sourceRoot = join(workspace, 'src/mobile/app');
// 11 is Material label-small and iOS caption 2, the smallest size either
// platform sets text at; the type scale moved down one step on 2026-09-25.
const MIN_FONT_SIZE = 11;
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
  violations.push(...findScaleViolations(source, relativePath));

  // One press primitive. 60 of 65 raw Pressables drew no pressed state at all,
  // so half the app's controls gave no sign they had been touched.
  const reactNativeImport = source.match(/import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/u);
  if (
    reactNativeImport &&
    /(?:^|,)\s*Pressable\s*(?:,|$)/u.test(reactNativeImport[1]) &&
    !normalizedPath.endsWith('/shared/components/ui/InstantPressable.tsx')
  ) {
    violations.push(`${relativePath} imports Pressable; use InstantPressable`);
  }
}

// 807 hand-typed spacing values in 33 sizes, 280 icons in 17 sizes and 51
// radii in 16 were moved onto the 4pt scale in one pass. These rules keep a
// literal from coming back. What stays literal is deliberate: 0 and 1 resets,
// negative overlap offsets, dimensions of 48 and up, circles sized by their
// own box, and computed expressions.
function findScaleViolations(source, relativePath) {
  const found = [];
  const lucideNames = new Set();
  for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]lucide-react-native['"]/gu)) {
    for (const name of match[1].split(',')) {
      const local = name.trim().split(/\s+as\s+/u).pop();
      if (local) lucideNames.add(local);
    }
  }

  source.split(/\r?\n/).forEach((line, index) => {
    const spacingMatch = line.match(
      /\b(?:padding|margin)(?:Horizontal|Vertical|Top|Bottom|Left|Right|Start|End)?\s*:\s*(\d+)\s*[,}]|\b(?:gap|rowGap|columnGap)\s*:\s*(\d+)\s*[,}]/u,
    );
    const spacingValue = Number(spacingMatch?.[1] ?? spacingMatch?.[2]);
    if (spacingValue >= 2 && spacingValue < 48) {
      found.push(`${relativePath}:${index + 1} raw spacing ${spacingValue}; use spacing.*`);
    }

    const radiusMatch = line.match(/\bborder(?:TopLeft|TopRight|BottomLeft|BottomRight)?Radius\s*:\s*(\d+)\s*[,}]/u);
    const radiusValue = Number(radiusMatch?.[1]);
    if (radiusValue >= 3 && radiusValue <= 26) {
      found.push(`${relativePath}:${index + 1} raw radius ${radiusValue}; use radius.*`);
    }

    const offsetMatch = line.match(/\b(?:top|bottom|left|right|start|end)\s*:\s*(\d+)\s*(?:[,}]|$)/u);
    const offsetValue = Number(offsetMatch?.[1]);
    if (offsetValue >= 2 && offsetValue <= 24) {
      found.push(`${relativePath}:${index + 1} raw offset ${offsetValue}; use spacing.*`);
    }

    const zIndexMatch = line.match(/\bzIndex\s*:\s*(-?\d+)\s*(?:[,}]|$)/u);
    if (zIndexMatch && Number(zIndexMatch[1]) !== 0) {
      found.push(`${relativePath}:${index + 1} raw zIndex ${zIndexMatch[1]}; use zIndex.*`);
    }

    const opacityMatch = line.match(/\bopacity\s*:\s*(0?\.\d+)\s*(?:[,}]|$)/u);
    if (opacityMatch) {
      found.push(`${relativePath}:${index + 1} raw opacity ${opacityMatch[1]}; use opacity.*`);
    }

    // Twelve files re-derived the platform touch floor by hand.
    if (/touch\.ios\s*:\s*touch\.android/u.test(line)) {
      found.push(`${relativePath}:${index + 1} hand-derived touch floor; use minTouchSize`);
    }

    // Nine styles once hand-rolled their own shadow while three tokens sat
    // almost unused, and the tokens themselves were invisible on iOS.
    if (/\bshadow(?:Color|Opacity|Radius|Offset)\s*:/u.test(line) || /^\s*elevation\s*:\s*\d/u.test(line)) {
      found.push(`${relativePath}:${index + 1} hand-written shadow; use elevation.*`);
    }

    for (const match of line.matchAll(/<([A-Z][A-Za-z0-9]*)\b[^>]*?\bsize=\{(\d+)\}/gu)) {
      if (lucideNames.has(match[1])) {
        found.push(`${relativePath}:${index + 1} raw icon size ${match[2]}; use iconSize.*`);
      }
    }
  });

  return found;
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

// tokens.ts is included on purpose: `colors` consumes the raw palette from
// inside the same file, and that counts as a real reference.
const allSources = await Promise.all(
  [...(await collectFiles(sourceRoot))]
    .filter((file) => ['.ts', '.tsx'].includes(extname(file)))
    .map((file) => readFile(file, 'utf8')),
);
const corpus = allSources.join('\n');

function declaredNames(blockName) {
  const block = themeSource.match(
    new RegExp(`(?:export )?const ${blockName} = \\{([\\s\\S]*?)\\n\\}(?: as const)?;`, 'u'),
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
  ['palette', 'palette'],
  ['colors', 'colors'],
  ['spacing', 'spacing'],
  ['radius', 'radius'],
  ['opacity', 'opacity'],
  ['zIndex', 'zIndex'],
  ['avatarSize', 'avatarSize'],
  ['elevation', 'elevation'],
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

// The palette is the one place a raw colour may be written, so it may be
// written only once: five hex values had each picked up two or three names.
const paletteBlock = themeSource.match(/const palette = \{([\s\S]*?)\n\};/u);
if (!paletteBlock) {
  violations.push(`${themeRelative} palette block could not be parsed`);
} else {
  const seenHex = new Map();
  for (const [, name, hex] of paletteBlock[1].matchAll(/^\s*([A-Za-z0-9_]+):\s*'(#[0-9a-fA-F]{6})'/gmu)) {
    const key = hex.toLowerCase();
    if (seenHex.has(key)) {
      violations.push(`${themeRelative} palette "${name}" repeats ${hex} from "${seenHex.get(key)}"`);
    }
    seenHex.set(key, name);
  }
}

// Outside the palette a colour is a reference, never a literal.
const colorsBlock = themeSource.match(/export const colors = \{([\s\S]*?)\n\};/u);
if (!colorsBlock) {
  violations.push(`${themeRelative} colors block could not be parsed`);
} else if (/#[0-9a-fA-F]{3,8}|rgba?\s*\(/u.test(colorsBlock[1])) {
  violations.push(`${themeRelative} colors must reference the palette, not raw values`);
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
