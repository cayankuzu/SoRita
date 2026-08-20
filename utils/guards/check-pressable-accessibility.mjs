import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import ts from 'typescript';

const workspace = process.cwd();
const sourceRoot = path.join(workspace, 'src/mobile/app');
const rawPressableNames = new Set([
  'Pressable',
  'TouchableOpacity',
  'TouchableWithoutFeedback',
]);
const labelledPressableNames = new Set([...rawPressableNames, 'InstantPressable']);
const violations = [];

async function collectTsxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return collectTsxFiles(target);
      }

      if (!entry.name.endsWith('.tsx') || entry.name.endsWith('.test.tsx')) {
        return [];
      }

      return [target];
    }),
  );

  return nestedFiles.flat();
}

function inspectPressables(filePath, sourceText) {
  const source = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  function hasReadableText(node) {
    let readable = false;

    function inspectChild(child) {
      if (readable) {
        return;
      }

      if (ts.isJsxText(child) && child.getText(source).trim()) {
        readable = true;
        return;
      }

      if (
        (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) &&
        (ts.isJsxElement(child)
          ? child.openingElement.tagName.getText(source)
          : child.tagName.getText(source)) === 'Text'
      ) {
        readable = true;
        return;
      }

      ts.forEachChild(child, inspectChild);
    }

    ts.forEachChild(node, inspectChild);
    return readable;
  }

  function isExplicitlyHidden(properties) {
    const accessible = properties.find(
      (property) => ts.isJsxAttribute(property) && property.name.getText(source) === 'accessible',
    );

    return Boolean(
      accessible &&
      ts.isJsxAttribute(accessible) &&
      accessible.initializer &&
      ts.isJsxExpression(accessible.initializer) &&
      accessible.initializer.expression?.kind === ts.SyntaxKind.FalseKeyword,
    );
  }

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(source);
      if (labelledPressableNames.has(tagName)) {
        const attributes = new Set(
          node.attributes.properties
            .filter(ts.isJsxAttribute)
            .map((attribute) => attribute.name.getText(source)),
        );
        const hidden = isExplicitlyHidden(node.attributes.properties);
        const declaresSemantics =
          attributes.has('accessibilityRole') || attributes.has('accessible');

        if (rawPressableNames.has(tagName) && !declaresSemantics) {
          const position = source.getLineAndCharacterOfPosition(node.getStart(source));
          violations.push(
            `${path.relative(workspace, filePath)}:${position.line + 1} ${tagName}`,
          );
        }

        const hasName =
          attributes.has('accessibilityLabel') ||
          attributes.has('accessibilityLabelledBy') ||
          hasReadableText(
            ts.isJsxOpeningElement(node) && ts.isJsxElement(node.parent)
              ? node.parent
              : node,
          );

        const isInstantPressableImplementation =
          path.basename(filePath) === 'InstantPressable.tsx' && tagName === 'Pressable';

        if (!hidden && !hasName && !isInstantPressableImplementation) {
          const position = source.getLineAndCharacterOfPosition(node.getStart(source));
          violations.push(
            `${path.relative(workspace, filePath)}:${position.line + 1} ${tagName} has no accessible name`,
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
}

for (const filePath of await collectTsxFiles(sourceRoot)) {
  inspectPressables(filePath, await readFile(filePath, 'utf8'));
}

if (violations.length > 0) {
  throw new Error(
    `Pressables must declare semantics and an accessible name:\n${violations.join('\n')}`,
  );
}

console.log('[pressable-accessibility] OK');
