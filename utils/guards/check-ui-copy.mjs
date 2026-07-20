import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const workspace = fileURLToPath(new URL('../..', import.meta.url));
const sourceRoot = join(workspace, 'src/mobile/app');
const userFacingAttributes = new Set([
  'accessibilityHint',
  'accessibilityLabel',
  'cancelLabel',
  'confirmLabel',
  'description',
  'label',
  'placeholder',
  'title',
]);
const userFacingProperties = new Set([
  'cancelLabel',
  'confirmLabel',
  'description',
  'label',
  'message',
  'title',
]);
const userFacingCalls = new Map([
  ['Alert.alert', 2],
  ['failAuthRedirect', 1],
  ['showToast', 1],
]);
const violations = [];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  }));
  return files.flat();
}

function containsWords(value) {
  return /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(value);
}

for (const path of await collectFiles(sourceRoot)) {
  if (
    !['.ts', '.tsx'].includes(extname(path)) ||
    /(?:__tests__|\.test\.tsx?$|[\\/]catalog[\\/]|[\\/]ui[\\/]content[\\/]|[\\/]shared[\\/]i18n[\\/])/.test(path)
  ) {
    continue;
  }

  const sourceText = await readFile(path, 'utf8');
  const sourceFile = ts.createSourceFile(
    path,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    extname(path) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function report(node, value) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    violations.push(`${relative(workspace, path)}:${position.line + 1} ${JSON.stringify(value.trim())}`);
  }

  function reportRenderableStringLiterals(node) {
    if (ts.isStringLiteralLike(node) && containsWords(node.text)) {
      report(node, node.text);
      return;
    }

    if (ts.isTemplateExpression(node)) {
      const literalCopy = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join('');

      if (containsWords(literalCopy)) {
        report(node, literalCopy);
      }
      return;
    }

    if (ts.isConditionalExpression(node)) {
      reportRenderableStringLiterals(node.whenTrue);
      reportRenderableStringLiterals(node.whenFalse);
      return;
    }

    if (ts.isParenthesizedExpression(node)) {
      reportRenderableStringLiterals(node.expression);
    }
  }

  function visit(node) {
    if (ts.isJsxText(node) && containsWords(node.text)) {
      report(node, node.text);
    }

    if (
      ts.isJsxAttribute(node) &&
      userFacingAttributes.has(node.name.getText(sourceFile)) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      containsWords(node.initializer.text)
    ) {
      report(node, node.initializer.text);
    }

    if (
      ts.isJsxAttribute(node) &&
      userFacingAttributes.has(node.name.getText(sourceFile)) &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression
    ) {
      reportRenderableStringLiterals(node.initializer.expression);
    }

    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      reportRenderableStringLiterals(node.expression);
    }

    if (
      ts.isPropertyAssignment(node) &&
      userFacingProperties.has(node.name.getText(sourceFile)) &&
      ts.isStringLiteral(node.initializer) &&
      containsWords(node.initializer.text)
    ) {
      report(node, node.initializer.text);
    }

    if (ts.isCallExpression(node)) {
      const userFacingArgumentCount = userFacingCalls.get(node.expression.getText(sourceFile));

      if (userFacingArgumentCount) {
        node.arguments.slice(0, userFacingArgumentCount).forEach((argument) => {
          if (ts.isStringLiteral(argument) && containsWords(argument.text)) {
            report(argument, argument.text);
          }
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

if (violations.length > 0) {
  console.error('[ui-copy] User-facing copy must come from the locale catalog:');
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exit(1);
}

console.log('[ui-copy] OK (no raw JSX or accessibility copy)');
