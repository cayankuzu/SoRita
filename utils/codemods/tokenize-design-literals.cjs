#!/usr/bin/env node
// One-shot codemod that moves raw spacing, radius and icon-size literals in
// src/mobile/app onto the theme's 4pt scale. It rewrites only literal numbers
// written directly as a style value or as an icon's `size`, so computed
// expressions, negative offsets, 0/1 resets and layout dimensions are left
// alone. Kept in the repo so the change can be re-run or audited.
//
//   node utils/codemods/tokenize-design-literals.cjs [--dry]
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..', '..', 'src', 'mobile', 'app');
const TOKENS_MODULE = '@/mobile/app/shared/theme/tokens';
const dryRun = process.argv.includes('--dry');

const SPACING_PROPS = new Set([
  'padding', 'paddingHorizontal', 'paddingVertical', 'paddingTop', 'paddingBottom',
  'paddingLeft', 'paddingRight', 'paddingStart', 'paddingEnd',
  'margin', 'marginHorizontal', 'marginVertical', 'marginTop', 'marginBottom',
  'marginLeft', 'marginRight', 'marginStart', 'marginEnd',
  'gap', 'rowGap', 'columnGap',
]);
const RADIUS_PROPS = new Set([
  'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
  'borderBottomLeftRadius', 'borderBottomRightRadius',
]);

// Nearest step of each scale; a value halfway between two steps goes up,
// because the scale replaced a denser, more cramped one.
const SPACING_STEPS = [
  [2, 'xxs'], [4, 'xs'], [8, 'sm'], [12, 'md'], [16, 'lg'], [20, 'xl'],
  [24, "'2xl'"], [32, "'3xl'"], [40, "'4xl'"],
];
const RADIUS_STEPS = [[4, 'xs'], [8, 'sm'], [12, 'md'], [16, 'lg'], [20, 'xl'], [24, "'2xl'"]];
const ICON_STEPS = [[12, 'xs'], [16, 'sm'], [20, 'md'], [24, 'lg'], [32, 'xl'], [40, 'xxl']];

function nearest(steps, value) {
  let best = steps[0];
  for (const step of steps) {
    const distance = Math.abs(step[0] - value);
    const bestDistance = Math.abs(best[0] - value);
    if (distance < bestDistance || (distance === bestDistance && step[0] > best[0])) best = step;
  }
  return best[1];
}

function access(object, key) {
  return key.startsWith("'") ? `${object}[${key}]` : `${object}.${key}`;
}

function spacingToken(value) {
  if (value < 2 || value >= 48 || !Number.isInteger(value)) return null;
  return access('spacing', nearest(SPACING_STEPS, value));
}

function radiusToken(value) {
  // Radii of 1-2 are hairline softening, and 30+ belongs to circles sized by
  // their own box; both stay literal.
  if (value < 3 || value > 26 || !Number.isInteger(value)) return null;
  return access('radius', nearest(RADIUS_STEPS, value));
}

function iconToken(value) {
  if (value < 8 || value > 48 || !Number.isInteger(value)) return null;
  return access('iconSize', nearest(ICON_STEPS, value));
}

function collectFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (name === '__tests__') continue;
    if (fs.statSync(full).isDirectory()) collectFiles(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

function propertyName(node) {
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text;
  return null;
}

function lucideNames(sourceFile) {
  const names = new Set();
  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === 'lucide-react-native' &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      for (const element of statement.importClause.namedBindings.elements) names.add(element.name.text);
    }
  }
  return names;
}

function transform(file) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const icons = lucideNames(sourceFile);
  const edits = [];
  const needed = new Set();

  function visit(node) {
    if (ts.isPropertyAssignment(node) && ts.isNumericLiteral(node.initializer)) {
      const name = propertyName(node);
      const value = Number(node.initializer.text);
      const token = SPACING_PROPS.has(name) ? spacingToken(value)
        : RADIUS_PROPS.has(name) ? radiusToken(value)
          : null;
      if (token) {
        edits.push([node.initializer.getStart(sourceFile), node.initializer.getEnd(), token]);
        needed.add(token.split(/[.[]/)[0]);
      }
    }

    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      icons.has(node.tagName.text)
    ) {
      for (const attribute of node.attributes.properties) {
        if (
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(sourceFile) === 'size' &&
          attribute.initializer &&
          ts.isJsxExpression(attribute.initializer) &&
          attribute.initializer.expression &&
          ts.isNumericLiteral(attribute.initializer.expression)
        ) {
          const token = iconToken(Number(attribute.initializer.expression.text));
          if (token) {
            const literal = attribute.initializer.expression;
            edits.push([literal.getStart(sourceFile), literal.getEnd(), token]);
            needed.add('iconSize');
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  if (edits.length === 0) return 0;

  let output = source;
  for (const [start, end, text] of edits.sort((a, b) => b[0] - a[0])) {
    output = output.slice(0, start) + text + output.slice(end);
  }
  output = ensureImports(output, file, [...needed]);
  if (!dryRun) fs.writeFileSync(file, output);
  return edits.length;
}

function ensureImports(source, file, names) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const existing = sourceFile.statements.find(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === TOKENS_MODULE &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      !statement.importClause.isTypeOnly,
  );

  if (existing) {
    const bindings = existing.importClause.namedBindings;
    const present = new Set(bindings.elements.map((element) => element.name.text));
    const missing = names.filter((name) => !present.has(name));
    if (missing.length === 0) return source;
    const all = [...bindings.elements.map((element) => element.getText(sourceFile)), ...missing]
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    const multiline = bindings.getText(sourceFile).includes('\n');
    const text = multiline
      ? `{${newline}${all.map((name) => `  ${name},`).join(newline)}${newline}}`
      : `{ ${all.join(', ')} }`;
    return source.slice(0, bindings.getStart(sourceFile)) + text + source.slice(bindings.getEnd());
  }

  const imports = sourceFile.statements.filter(ts.isImportDeclaration);
  const quote = imports.some((statement) => statement.moduleSpecifier.getText(sourceFile).startsWith('"'))
    ? '"'
    : "'";
  const line = `import { ${[...names].sort().join(', ')} } from ${quote}${TOKENS_MODULE}${quote};`;
  const anchor = imports.length ? imports[imports.length - 1].getEnd() : 0;
  return source.slice(0, anchor) + newline + line + source.slice(anchor);
}

let files = 0;
let total = 0;
for (const file of collectFiles(ROOT)) {
  if (file.replaceAll('\\', '/').endsWith('shared/theme/tokens.ts')) continue;
  const count = transform(file);
  if (count) {
    files += 1;
    total += count;
  }
}
console.log(`${dryRun ? '[dry] ' : ''}${total} literals moved onto tokens in ${files} files`);
