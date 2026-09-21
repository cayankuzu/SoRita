import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  findTouchTargetViolations,
  readStyleModuleSpecifiers,
  resolveStyleModule,
} from '../check-touch-targets.mjs';

import ts from 'typescript';

const parse = (text) =>
  ts.createSourceFile('probe.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const screen = (styleImport, extraProps = '') => `
${styleImport}
export function Screen() {
  return (
    <Pressable accessibilityRole="button"${extraProps} style={styles.action} onPress={noop}>
      <Icon />
    </Pressable>
  );
}
`;

test('a control styled in this file is measured', () => {
  const violations = findTouchTargetViolations(
    'Screen.tsx',
    `const styles = StyleSheet.create({ action: { width: 44, height: 44 } });
${screen('')}`,
    'Screen.tsx',
  );
  assert.equal(violations.length, 2, 'both axes are reported');
  assert.match(violations[0], /44dp/u);
});

test('a control styled in a sibling module is measured too', () => {
  // The regression this guards: before imported sheets resolved, the sizes map
  // was empty, the control counted as unmeasurable, and 44dp shipped silently.
  const violations = findTouchTargetViolations(
    'Screen.tsx',
    screen("import { styles } from './screenStyles';"),
    'Screen.tsx',
    new Map([['action', { width: 44, height: 44 }]]),
  );
  assert.equal(violations.length, 2);
});

test('hitSlop from the sanctioned helper closes the gap', () => {
  const violations = findTouchTargetViolations(
    'Screen.tsx',
    screen("import { styles } from './screenStyles';", ' hitSlop={hitSlopFor(44)}'),
    'Screen.tsx',
    new Map([['action', { width: 44, height: 44 }]]),
  );
  assert.deepEqual(violations, []);
});

test('a sheet in the file shadows the imported one', () => {
  const violations = findTouchTargetViolations(
    'Screen.tsx',
    `const styles = StyleSheet.create({ action: { width: 48, height: 48 } });
${screen("import { styles } from './screenStyles';")}`,
    'Screen.tsx',
    new Map([['action', { width: 10, height: 10 }]]),
  );
  assert.deepEqual(violations, [], 'the local 48dp sheet wins over the imported 10dp one');
});

test('only imports that bind `styles` are followed', () => {
  assert.deepEqual(
    readStyleModuleSpecifiers(parse("import { styles } from './aStyles';")),
    ['./aStyles'],
  );
  assert.deepEqual(
    readStyleModuleSpecifiers(parse("import styles from './bStyles';")),
    ['./bStyles'],
  );
  assert.deepEqual(
    readStyleModuleSpecifiers(parse("import { colors } from './tokens';")),
    [],
    'an unrelated import is not parsed as a sheet',
  );
});

test('a specifier resolves only to a file that exists', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'touch-targets-'));
  writeFileSync(path.join(directory, 'realStyles.ts'), 'export const styles = {};');
  const from = path.join(directory, 'Screen.tsx');

  assert.equal(
    resolveStyleModule('./realStyles', from),
    path.join(directory, 'realStyles.ts'),
  );
  assert.equal(resolveStyleModule('./missingStyles', from), null);
  assert.equal(resolveStyleModule('react-native', from), null, 'packages are not sheets');
});
