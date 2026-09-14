import ts from 'typescript';

const TYPE_METRIC_PROPERTIES = new Set(['fontSize', 'lineHeight']);
const TRACKED_PROPERTIES = new Set([
  ...TYPE_METRIC_PROPERTIES,
  'fontWeight',
  'letterSpacing',
]);

function getPropertyName(node) {
  const name = node.name;

  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) {
    return name.text;
  }

  if (
    ts.isComputedPropertyName(name) &&
    ts.isStringLiteralLike(name.expression)
  ) {
    return name.expression.text;
  }

  return null;
}

function unwrapExpression(node) {
  let current = node;

  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

function getNumericValue(node) {
  const expression = unwrapExpression(node);

  if (ts.isNumericLiteral(expression)) {
    return Number(expression.text);
  }

  if (
    ts.isPrefixUnaryExpression(expression) &&
    (expression.operator === ts.SyntaxKind.PlusToken ||
      expression.operator === ts.SyntaxKind.MinusToken)
  ) {
    const operand = unwrapExpression(expression.operand);
    if (ts.isNumericLiteral(operand)) {
      const value = Number(operand.text);
      return expression.operator === ts.SyntaxKind.MinusToken ? -value : value;
    }
  }

  return null;
}

function getRootIdentifier(node) {
  let expression = unwrapExpression(node);

  while (ts.isPropertyAccessExpression(expression)) {
    expression = unwrapExpression(expression.expression);
  }

  return ts.isIdentifier(expression) ? expression.text : null;
}

function isAllowedTokenExpression(node, allowedRoots) {
  const expression = unwrapExpression(node);
  const rootIdentifier = getRootIdentifier(expression);

  if (rootIdentifier && allowedRoots.has(rootIdentifier)) {
    return true;
  }

  if (ts.isConditionalExpression(expression)) {
    return (
      isAllowedTokenExpression(expression.whenTrue, allowedRoots) &&
      isAllowedTokenExpression(expression.whenFalse, allowedRoots)
    );
  }

  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
  ) {
    return (
      isAllowedTokenExpression(expression.left, allowedRoots) &&
      isAllowedTokenExpression(expression.right, allowedRoots)
    );
  }

  return false;
}

function normalizeExpressionText(node, sourceFile) {
  return node.getText(sourceFile).replace(/\s+/gu, ' ').trim();
}

function isApprovedResponsiveTypeMetric(normalizedPath, property, value) {
  if (
    normalizedPath.endsWith('/shared/components/brand/SoRitaLogo.tsx') &&
    value === (property === 'fontSize' ? 'textSizes[size]' : 'textSizes[size] + 2')
  ) {
    return true;
  }

  return (
    normalizedPath.endsWith('/shared/components/ui/AvatarView.tsx') &&
    property === 'fontSize' &&
    value === 'size * 0.28'
  );
}

function getAllowedTokenRoots(property) {
  if (TYPE_METRIC_PROPERTIES.has(property)) {
    return new Set(['typography']);
  }

  if (property === 'fontWeight') {
    return new Set(['fontWeight', 'typography']);
  }

  return new Set(['letterSpacing', 'typography']);
}

function getLineNumber(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

export function findTypographyViolations({
  allowRawDeclarations = false,
  minFontSize,
  normalizedPath,
  relativePath,
  source,
}) {
  const scriptKind = normalizedPath.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const violations = [];

  if (sourceFile.parseDiagnostics.length > 0) {
    for (const diagnostic of sourceFile.parseDiagnostics) {
      const position = diagnostic.start ?? 0;
      const line = sourceFile.getLineAndCharacterOfPosition(position).line + 1;
      violations.push(`${relativePath}:${line} typography source could not be parsed`);
    }
    return violations;
  }

  function inspectNode(node) {
    const isAssignment = ts.isPropertyAssignment(node);
    const isShorthand = ts.isShorthandPropertyAssignment(node);

    if (isAssignment || isShorthand) {
      const property = getPropertyName(node);

      if (property && TRACKED_PROPERTIES.has(property)) {
        const line = getLineNumber(sourceFile, node.name);
        const valueNode = isAssignment ? node.initializer : node.name;
        const numericValue = getNumericValue(valueNode);

        if (
          property === 'fontSize' &&
          numericValue != null &&
          numericValue < minFontSize
        ) {
          violations.push(`${relativePath}:${line} text below ${minFontSize}px`);
        }

        if (!allowRawDeclarations) {
          if (TYPE_METRIC_PROPERTIES.has(property)) {
            if (numericValue != null) {
              violations.push(
                `${relativePath}:${line} tokenized surface uses a raw type metric`,
              );
            } else {
              const value = normalizeExpressionText(valueNode, sourceFile);
              if (
                !isAllowedTokenExpression(valueNode, getAllowedTokenRoots(property)) &&
                !isApprovedResponsiveTypeMetric(normalizedPath, property, value)
              ) {
                violations.push(
                  `${relativePath}:${line} type metric bypasses typography tokens`,
                );
              }
            }
          } else if (
            !isAllowedTokenExpression(valueNode, getAllowedTokenRoots(property))
          ) {
            violations.push(
              property === 'fontWeight'
                ? `${relativePath}:${line} tokenized surface uses a raw font weight`
                : `${relativePath}:${line} tokenized surface uses raw letter spacing`,
            );
          }
        }
      }
    }

    ts.forEachChild(node, inspectNode);
  }

  inspectNode(sourceFile);
  return violations;
}
