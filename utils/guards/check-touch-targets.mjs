import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import ts from 'typescript';

// Effective touch-area contract.
//
// `check-pressable-accessibility.mjs` proves every pressable has a role and a
// name. It says nothing about whether a finger can hit it. Material asks for
// 48dp and Apple's HIG for 44pt, and the number that matters is the *effective*
// area — the painted box grown by `hitSlop` — not the icon a reader sees. Small
// affordances are deliberate here (20dp tile crosshairs, 24dp clear buttons), so
// the fix is `hitSlop`, not a bigger box, and this guard measures the sum.
//
// A control whose painted size is not statically declared cannot be measured and
// is counted as unmeasured rather than quietly passing.

const workspace = process.cwd();
const sourceRoot = path.join(workspace, 'src/mobile/app');
const ANDROID_MINIMUM_DP = 48;

// Size tokens resolved to the Android value, because Android's is the floor
// being enforced. `minTouchSize` is platform-derived and equals touch.android
// there; `controlSize.large` is the 48dp control.
const SIZE_TOKENS = new Map([
  ['minTouchSize', 48],
  ['touch.android', 48],
  ['touch.ios', 44],
  ['controlSize.large', 48],
  ['controlSize.default', 44],
  ['controlSize.compact', 32],
]);

const PRESSABLE_NAMES = new Set([
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'InstantPressable',
]);

async function collectTsxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectTsxFiles(target);
      if (!entry.name.endsWith('.tsx') || entry.name.endsWith('.test.tsx')) return [];
      return [target];
    }),
  );
  return nested.flat();
}

/**
 * Painted width/height per style-sheet entry, across every `StyleSheet.create`
 * in the file. Only numeric literals resolve; a computed dimension is left out
 * so the guard never guesses.
 */
export function collectStyleSizes(source) {
  const sizes = new Map();

  function readDimension(properties, names) {
    for (const property of properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const key = property.name.getText();
      if (!names.includes(key)) continue;

      // A control sized from the platform token is measured at its Android
      // value, which is the floor this guard enforces. Resolving these matters:
      // treating them as unmeasurable would turn the fix into a silent pass.
      const token = property.initializer.getText();
      if (SIZE_TOKENS.has(token)) return SIZE_TOKENS.get(token);

      if (!ts.isNumericLiteral(property.initializer)) continue;
      const value = Number(property.initializer.text);
      // `minWidth: 0` / `minHeight: 0` is the flexbox reset that lets a flex
      // child shrink below its content. It declares no touch target, and
      // reading it as one reports every such row as a 0dp control.
      if (value === 0 && key.startsWith('min')) continue;
      return value;
    }
    return null;
  }

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText().endsWith('StyleSheet.create') &&
      node.arguments[0] &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      for (const entry of node.arguments[0].properties) {
        if (!ts.isPropertyAssignment(entry)) continue;
        if (!ts.isObjectLiteralExpression(entry.initializer)) continue;
        const width = readDimension(entry.initializer.properties, ['width', 'minWidth']);
        const height = readDimension(entry.initializer.properties, ['height', 'minHeight']);
        if (width === null && height === null) continue;
        sizes.set(entry.name.getText().replace(/['"]/gu, ''), { width, height });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return sizes;
}

/** The slop an attribute adds per edge; the object form is limited by its smallest edge. */
export function readHitSlop(attribute) {
  if (!attribute?.initializer || !ts.isJsxExpression(attribute.initializer)) return null;
  const expression = attribute.initializer.expression;
  if (!expression) return null;

  if (ts.isNumericLiteral(expression)) return Number(expression.text);

  // `hitSlopFor(paintedSize)` is the sanctioned helper. Resolve it to the number
  // it produces rather than trusting the call, so a painted size that outgrows
  // the helper still surfaces here.
  if (
    ts.isCallExpression(expression) &&
    expression.expression.getText() === 'hitSlopFor' &&
    expression.arguments[0]
  ) {
    const [size, minimum] = expression.arguments;
    if (!ts.isNumericLiteral(size)) return null;
    const floor = minimum && ts.isNumericLiteral(minimum)
      ? Number(minimum.text)
      : ANDROID_MINIMUM_DP;
    return Math.max(0, Math.ceil((floor - Number(size.text)) / 2));
  }

  if (ts.isObjectLiteralExpression(expression)) {
    const edges = expression.properties
      .filter((property) => ts.isPropertyAssignment(property))
      .filter((property) => ['top', 'bottom', 'left', 'right'].includes(property.name.getText()))
      .map((property) =>
        ts.isNumericLiteral(property.initializer) ? Number(property.initializer.text) : null,
      );
    if (edges.length === 0 || edges.some((edge) => edge === null)) return null;
    return Math.min(...edges);
  }

  return null;
}

/** Style-sheet entries a `style` attribute names, including array and callback forms. */
export function readStyleNames(attribute) {
  if (!attribute?.initializer) return [];
  const names = [];
  const visit = (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.expression.getText() === 'styles'
    ) {
      names.push(node.name.getText());
    }
    ts.forEachChild(node, visit);
  };
  visit(attribute.initializer);
  return names;
}

export function findTouchTargetViolations(filePath, sourceText, relativePath) {
  const source = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const sizes = collectStyleSizes(source);
  const violations = [];

  function inspect(node) {
    const opening = ts.isJsxSelfClosingElement(node)
      ? node
      : ts.isJsxElement(node)
        ? node.openingElement
        : null;

    if (opening && PRESSABLE_NAMES.has(opening.tagName.getText())) {
      const attributes = opening.attributes.properties.filter(ts.isJsxAttribute);
      const named = (name) => attributes.find((a) => a.name.getText() === name);

      // A pressable with no press handler is a gesture surface, not a control.
      if (named('onPress') || named('onLongPress')) {
        const declared = readStyleNames(named('style'))
          .map((name) => sizes.get(name))
          .filter(Boolean);

        if (declared.length > 0) {
          const slop = readHitSlop(named('hitSlop'));
          const line =
            source.getLineAndCharacterOfPosition(opening.getStart()).line + 1;
          const location = `${relativePath}:${line} <${opening.tagName.getText()}>`;

          if (slop === null && named('hitSlop')) {
            violations.push(
              `${location}: hitSlop statik olarak ölçülemiyor; hitSlopFor(paintedSize) kullan.`,
            );
          } else {
            const effective = (axis) => {
              const values = declared
                .map((size) => size[axis])
                .filter((value) => typeof value === 'number');
              return values.length === 0 ? null : Math.min(...values) + (slop ?? 0) * 2;
            };
            for (const [label, axis] of [['genişlik', 'width'], ['yükseklik', 'height']]) {
              const value = effective(axis);
              if (value !== null && value < ANDROID_MINIMUM_DP) {
                violations.push(
                  `${location}: etkin dokunma ${label} ${value}dp; en az ${ANDROID_MINIMUM_DP}dp gerekli. ` +
                    `Boyutu koruyup hitSlop={hitSlopFor(paintedSize)} ekle.`,
                );
              }
            }
          }
        }
      }
    }

    ts.forEachChild(node, inspect);
  }

  inspect(source);
  return violations;
}

async function main() {
  const files = await collectTsxFiles(sourceRoot);
  const violations = [];
  for (const file of files) {
    violations.push(
      ...findTouchTargetViolations(
        file,
        await readFile(file, 'utf8'),
        path.relative(workspace, file).replaceAll('\\', '/'),
      ),
    );
  }

  if (violations.length > 0) {
    console.error('Dokunma hedefi guard hataları:');
    violations.forEach((violation) => console.error(`- ${violation}`));
    process.exitCode = 1;
    return;
  }

  console.log(
    `Dokunma hedefi guardı geçti: ${files.length} dosyadaki ölçülebilir kontrollerin etkin alanı en az ${ANDROID_MINIMUM_DP}dp.`,
  );
}

if (process.argv[1]?.endsWith('check-touch-targets.mjs')) await main();
