import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import ts from 'typescript';

const SNAPSHOT_SCHEMA_VERSION = 1;
const DEFAULT_SNAPSHOT_RELATIVE_PATH = 'quality/feature-surface.snapshot.json';
const NAVIGATION_TYPES_PATH = 'src/mobile/app/app-shell/navigation/types.ts';
const ROOT_NAVIGATOR_PATH = 'src/mobile/app/app-shell/navigation/RootNavigator.tsx';
const MAIN_TABS_PATH = 'src/mobile/app/app-shell/navigation/MainTabs.tsx';
const ROUTE_LOADERS_PATH = 'src/mobile/app/app-shell/navigation/routes.ts';
const APP_CONFIG_PATH = 'app.config.ts';
const ANDROID_MANIFEST_PATH = 'android/app/src/main/AndroidManifest.xml';
const NOTIFICATION_CONTRACT_PATH = 'src/mobile/app/data/contracts/notification.ts';
const NOTIFICATION_STATE_PATH =
  'src/mobile/app/features/notifications/application/useNotificationsScreenState.ts';
const SETTINGS_STATE_PATH =
  'src/mobile/app/features/settings/application/useSettingsScreenState.ts';
const SETTINGS_SCREEN_PATH = 'src/mobile/app/features/settings/ui/screens/SettingsScreen.tsx';
const SETTINGS_UI_ROOT = 'src/mobile/app/features/settings/ui';
const EDGE_FUNCTIONS_ROOT = 'supabase/functions';
const MIGRATIONS_ROOT = 'supabase/migrations';

const CURRENT_INTERNAL_TABLES = new Set([
  'private.auth_login_guards',
  'private.cloudflare_origin_nonces',
  'private.edge_rate_limits',
  // Service-only state machine for existing media uploads; it has no user-facing
  // route, screen, notification, or product data contract.
  'private.media_upload_sessions',
  'private.push_delivery_jobs',
  'private.system_broadcast_deliveries',
  'public.account_deletion_jobs',
  'public.request_nonces',
]);

const INTERNAL_TABLE_NAME_PATTERNS = [
  /^(?:security|ops|telemetry|ota|cloudflare)_(?:audit|event|events|health|lock|locks|metric|metrics|nonce|nonces|rate_limit|rate_limits|release|releases|request|requests|rollout|rollouts|state)(?:_[a-z0-9]+)*$/,
  /^[a-z][a-z0-9_]*_(?:audit_events|outbox|outbox_jobs|security_events|telemetry_events)$/,
  /^(?:api|edge)_(?:audit_events|idempotency_keys|rate_limits|request_nonces|security_events|telemetry_events)$/,
  /^moderation_(?:appeals|audit_events|case_events|cases|sanctions)$/,
];

const INTERNAL_EDGE_CONTRACT_PATTERN =
  /^(?:security|ops|telemetry|outbox|ota|cloudflare)-(?:audit|dispatch|edge-gateway|event|events|gateway|health|ingest|manifest|nonce|proxy|rate-limit|reconcile|replay|rollback|status|verify|webhook)(?:-[a-z0-9]+)*$/;

const PERMISSION_PLUGIN_PATTERN =
  /(?:^|[-/])(?:audio|biometric|bluetooth|calendar|camera|contacts|health|image-picker|local-authentication|location|media-library|microphone|notifications|reminders|sms|tracking)(?:$|[-/])/;
const PERMISSION_PROPERTY_PATTERN = /(?:permission|permissions|recordAudioAndroid)$/i;

const REQUIRED_STRING_ARRAY_PATHS = [
  'navigation.rootRoutes',
  'navigation.tabRoutes',
  'nativeCapabilities.expoAndroidPermissions',
  'nativeCapabilities.expoAndroidBlockedPermissions',
  'nativeCapabilities.expoPermissionPlugins',
  'nativeCapabilities.expoPermissionDeclarations',
  'nativeCapabilities.expoIosEntitlements',
  'nativeCapabilities.iosUsageDescriptionKeys',
  'nativeCapabilities.iosBackgroundModes',
  'nativeCapabilities.androidManifestPermissions',
  'nativeCapabilities.androidManifestRemovedPermissions',
  'nativeCapabilities.iosEntitlements',
  'notifications.types',
  'notifications.categories',
  'api.edgeFunctionContracts',
  'api.mobileEdgeFunctionContracts',
  'data.productTables',
  'data.internalTablesAtBaseline',
  'data.storageBuckets',
  'settings.views',
  'settings.visibleGroups',
  'settings.visibleCtas',
];

function fail(message) {
  throw new Error(`[feature-surface] ${message}`);
}

function portable(filePath) {
  return filePath.replaceAll('\\', '/');
}

function sorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'en'));
}

function readRequiredText(rootDir, relativePath) {
  const filePath = path.join(rootDir, relativePath);

  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    fail(`cannot read required file ${portable(relativePath)}: ${error.message}`);
  }
}

export function parseTypeScriptText(sourceText, fileName = 'feature-surface.ts') {
  const scriptKind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const parseDiagnostics = sourceFile.parseDiagnostics ?? [];

  if (parseDiagnostics.length > 0) {
    const diagnostic = parseDiagnostics[0];
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    fail(`cannot parse ${portable(fileName)}: ${message}`);
  }

  return sourceFile;
}

function parseRequiredTypeScript(rootDir, relativePath) {
  return parseTypeScriptText(readRequiredText(rootDir, relativePath), relativePath);
}

function unwrapExpression(node) {
  let current = node;

  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current))
  ) {
    current = current.expression;
  }

  return current;
}

function propertyNameText(nameNode) {
  if (ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode) || ts.isNumericLiteral(nameNode)) {
    return nameNode.text;
  }

  return null;
}

function findTypeAlias(sourceFile, aliasName) {
  let result = null;

  function visit(node) {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === aliasName) {
      result = node;
      return;
    }

    if (!result) ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!result) fail(`cannot find type alias ${aliasName} in ${portable(sourceFile.fileName)}`);
  return result;
}

function extractTypeLiteralKeys(sourceFile, aliasName) {
  const alias = findTypeAlias(sourceFile, aliasName);

  if (!ts.isTypeLiteralNode(alias.type)) {
    fail(`${aliasName} must remain a type literal in ${portable(sourceFile.fileName)}`);
  }

  const names = alias.type.members.map((member) => {
    if (!ts.isPropertySignature(member) || !member.name) {
      fail(`${aliasName} contains an unsupported member in ${portable(sourceFile.fileName)}`);
    }

    const name = propertyNameText(member.name);
    if (!name) fail(`${aliasName} contains a computed property in ${portable(sourceFile.fileName)}`);
    return name;
  });

  if (names.length === 0) fail(`${aliasName} has no entries in ${portable(sourceFile.fileName)}`);
  return sorted(names);
}

function collectStringLiteralTypes(typeNode, values) {
  if (ts.isUnionTypeNode(typeNode)) {
    for (const child of typeNode.types) collectStringLiteralTypes(child, values);
    return;
  }

  if (ts.isLiteralTypeNode(typeNode) && ts.isStringLiteral(typeNode.literal)) {
    values.push(typeNode.literal.text);
    return;
  }

  fail(`expected a string-literal union, found ${ts.SyntaxKind[typeNode.kind]}`);
}

function extractStringUnionAlias(sourceFile, aliasName) {
  const alias = findTypeAlias(sourceFile, aliasName);
  const values = [];
  collectStringLiteralTypes(alias.type, values);

  if (values.length === 0) fail(`${aliasName} has no string values`);
  return sorted(values);
}

function extractStringUnionProperty(sourceFile, aliasName, propertyName) {
  const alias = findTypeAlias(sourceFile, aliasName);

  if (!ts.isTypeLiteralNode(alias.type)) {
    fail(`${aliasName} must remain a type literal in ${portable(sourceFile.fileName)}`);
  }

  const property = alias.type.members.find(
    (member) =>
      ts.isPropertySignature(member) &&
      member.name &&
      propertyNameText(member.name) === propertyName,
  );

  if (!property || !ts.isPropertySignature(property) || !property.type) {
    fail(`cannot find ${aliasName}.${propertyName} in ${portable(sourceFile.fileName)}`);
  }

  const values = [];
  collectStringLiteralTypes(property.type, values);

  if (values.length === 0) fail(`${aliasName}.${propertyName} has no string values`);
  return sorted(values);
}

function extractJsxRouteNames(sourceFile, navigatorName) {
  const names = [];

  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      if (node.tagName.getText(sourceFile) === navigatorName) {
        const nameAttribute = node.attributes.properties.find(
          (attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === 'name',
        );

        if (
          !nameAttribute ||
          !ts.isJsxAttribute(nameAttribute) ||
          !nameAttribute.initializer ||
          !ts.isStringLiteral(nameAttribute.initializer)
        ) {
          fail(`${navigatorName} has a non-literal or missing name in ${portable(sourceFile.fileName)}`);
        }

        names.push(nameAttribute.initializer.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (names.length === 0) fail(`cannot find ${navigatorName} registrations`);
  return sorted(names);
}

function assertSameValues(left, right, label) {
  if (JSON.stringify(sorted(left)) !== JSON.stringify(sorted(right))) {
    fail(`${label} declarations and registrations disagree`);
  }
}

function extractDeferredScreenEntrypoints(sourceFile) {
  const entrypoints = [];

  function inspectVariable(node) {
    if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return;
    const variableName = node.name.text;
    if (!variableName.endsWith('RouteScreen')) return;

    const matches = [];
    function findRequireProperty(child) {
      if (
        ts.isPropertyAccessExpression(child) &&
        ts.isCallExpression(child.expression) &&
        ts.isIdentifier(child.expression.expression) &&
        child.expression.expression.text === 'require'
      ) {
        const [request] = child.expression.arguments;
        if (!request || !ts.isStringLiteral(request)) {
          fail(`${variableName} uses a non-literal screen entrypoint`);
        }
        matches.push({ module: request.text, exportName: child.name.text });
        return;
      }

      ts.forEachChild(child, findRequireProperty);
    }

    findRequireProperty(node.initializer);
    if (matches.length !== 1) {
      fail(`${variableName} must resolve exactly one deferred screen entrypoint`);
    }

    entrypoints.push({
      route: variableName.slice(0, -'RouteScreen'.length),
      module: matches[0].module,
      exportName: matches[0].exportName,
    });
  }

  function visit(node) {
    inspectVariable(node);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (entrypoints.length === 0) fail('no deferred route screen entrypoints were found');
  return entrypoints.sort((left, right) => left.route.localeCompare(right.route, 'en'));
}

function findVariableInitializer(sourceFile, variableName) {
  let initializer = null;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName &&
      node.initializer
    ) {
      initializer = node.initializer;
      return;
    }

    if (!initializer) ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  if (!initializer) fail(`cannot find variable ${variableName} in ${portable(sourceFile.fileName)}`);
  return initializer;
}

function requireObjectLiteral(expression, label) {
  const value = unwrapExpression(expression);
  if (!value || !ts.isObjectLiteralExpression(value)) fail(`${label} must remain an object literal`);
  return value;
}

function objectPropertyExpression(objectLiteral, propertyName, label) {
  const property = objectLiteral.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) &&
      propertyNameText(candidate.name) === propertyName,
  );

  if (!property || !ts.isPropertyAssignment(property)) {
    fail(`cannot find ${label}.${propertyName}`);
  }

  return property.initializer;
}

function optionalObjectPropertyExpression(objectLiteral, propertyName) {
  const property = objectLiteral.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) &&
      propertyNameText(candidate.name) === propertyName,
  );
  return property && ts.isPropertyAssignment(property) ? property.initializer : null;
}

function extractLiteralStringArray(expression, label) {
  const value = unwrapExpression(expression);
  if (!value || !ts.isArrayLiteralExpression(value)) fail(`${label} must remain an array literal`);

  const items = value.elements.map((element) => {
    const item = unwrapExpression(element);
    if (!item || !ts.isStringLiteral(item)) fail(`${label} must contain only string literals`);
    return item.text;
  });

  return sorted(items);
}

function staticPermissionSignature(expression) {
  const value = unwrapExpression(expression);

  if (!value) return '<missing>';
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return '<string>';
  if (value.kind === ts.SyntaxKind.TrueKeyword) return 'true';
  if (value.kind === ts.SyntaxKind.FalseKeyword) return 'false';
  if (ts.isArrayLiteralExpression(value)) {
    const entries = value.elements.map((element) => {
      const item = unwrapExpression(element);
      if (item && ts.isStringLiteral(item)) return item.text;
      return '<expression>';
    });
    return JSON.stringify(entries);
  }

  return '<expression>';
}

function staticEntitlementSignature(expression) {
  const value = unwrapExpression(expression);
  if (!value) return '<missing>';
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
    return JSON.stringify(value.text);
  }
  if (value.kind === ts.SyntaxKind.TrueKeyword) return 'true';
  if (value.kind === ts.SyntaxKind.FalseKeyword) return 'false';
  if (ts.isNumericLiteral(value)) return value.text;
  if (ts.isArrayLiteralExpression(value)) {
    return JSON.stringify(
      value.elements.map((element) => {
        const item = unwrapExpression(element);
        return item && ts.isStringLiteral(item) ? item.text : '<expression>';
      }),
    );
  }
  return '<expression>';
}

function collectPermissionProperties(objectLiteral, pluginName, prefix, output) {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = propertyNameText(property.name);
    if (!name) fail(`${pluginName} contains a computed config property`);
    const propertyPath = prefix ? `${prefix}.${name}` : name;
    const value = unwrapExpression(property.initializer);

    if (PERMISSION_PROPERTY_PATTERN.test(name)) {
      output.push(`${pluginName}:${propertyPath}=${staticPermissionSignature(value)}`);
    }

    if (value && ts.isObjectLiteralExpression(value)) {
      collectPermissionProperties(value, pluginName, propertyPath, output);
    }
  }
}

function collectPluginTuple(arrayLiteral, plugins, declarations) {
  const [nameNode, optionsNode] = arrayLiteral.elements;
  const pluginNameNode = nameNode ? unwrapExpression(nameNode) : null;
  if (!pluginNameNode || !ts.isStringLiteral(pluginNameNode)) return false;
  const pluginName = pluginNameNode.text;
  const options = optionsNode ? unwrapExpression(optionsNode) : null;
  const pluginDeclarations = [];

  if (options && ts.isObjectLiteralExpression(options)) {
    collectPermissionProperties(options, pluginName, '', pluginDeclarations);
  }

  if (pluginDeclarations.length > 0 || PERMISSION_PLUGIN_PATTERN.test(pluginName)) {
    plugins.push(pluginName);
  }
  declarations.push(...pluginDeclarations);
  return true;
}

function extractExpoNativeCapabilities(sourceFile) {
  const config = requireObjectLiteral(findVariableInitializer(sourceFile, 'config'), 'config');
  const android = requireObjectLiteral(objectPropertyExpression(config, 'android', 'config'), 'config.android');
  const ios = requireObjectLiteral(objectPropertyExpression(config, 'ios', 'config'), 'config.ios');
  const infoPlist = requireObjectLiteral(
    objectPropertyExpression(ios, 'infoPlist', 'config.ios'),
    'config.ios.infoPlist',
  );
  const pluginsExpression = unwrapExpression(objectPropertyExpression(config, 'plugins', 'config'));

  if (!pluginsExpression || !ts.isArrayLiteralExpression(pluginsExpression)) {
    fail('config.plugins must remain an array literal');
  }

  const iosUsageDescriptionKeys = [];
  for (const property of infoPlist.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = propertyNameText(property.name);
    if (name && /^NS[A-Za-z0-9]+UsageDescription$/.test(name)) iosUsageDescriptionKeys.push(name);
  }

  const pluginNames = [];
  const permissionDeclarations = [];
  const expoIosEntitlements = [];
  const entitlementsExpression = optionalObjectPropertyExpression(ios, 'entitlements');
  if (entitlementsExpression) {
    const entitlements = requireObjectLiteral(entitlementsExpression, 'config.ios.entitlements');
    for (const property of entitlements.properties) {
      if (!ts.isPropertyAssignment(property)) fail('config.ios.entitlements must use static properties');
      const name = propertyNameText(property.name);
      if (!name) fail('config.ios.entitlements contains a computed property');
      expoIosEntitlements.push(`${name}=${staticEntitlementSignature(property.initializer)}`);
    }
  }
  function inspectPluginNode(node) {
    if (ts.isArrayLiteralExpression(node) && collectPluginTuple(node, pluginNames, permissionDeclarations)) {
      return;
    }
    ts.forEachChild(node, inspectPluginNode);
  }

  for (const element of pluginsExpression.elements) {
    const unwrapped = unwrapExpression(element);
    if (unwrapped && ts.isStringLiteral(unwrapped) && PERMISSION_PLUGIN_PATTERN.test(unwrapped.text)) {
      pluginNames.push(unwrapped.text);
    } else {
      inspectPluginNode(element);
    }
  }

  return {
    expoAndroidPermissions: extractLiteralStringArray(
      objectPropertyExpression(android, 'permissions', 'config.android'),
      'config.android.permissions',
    ),
    expoAndroidBlockedPermissions: extractLiteralStringArray(
      objectPropertyExpression(android, 'blockedPermissions', 'config.android'),
      'config.android.blockedPermissions',
    ),
    expoPermissionPlugins: sorted(pluginNames),
    expoPermissionDeclarations: sorted(permissionDeclarations),
    expoIosEntitlements: sorted(expoIosEntitlements),
    iosUsageDescriptionKeys: sorted(iosUsageDescriptionKeys),
    iosBackgroundModes: extractLiteralStringArray(
      objectPropertyExpression(infoPlist, 'UIBackgroundModes', 'config.ios.infoPlist'),
      'config.ios.infoPlist.UIBackgroundModes',
    ),
  };
}

function extractAndroidManifestPermissions(rootDir) {
  const manifest = readRequiredText(rootDir, ANDROID_MANIFEST_PATH);
  const permissionTags = [...manifest.matchAll(/<uses-permission\b[^>]*\/?\s*>/gi)];

  if (permissionTags.length === 0) fail('Android main manifest contains no uses-permission declarations');

  const active = [];
  const removed = [];
  for (const match of permissionTags) {
    const tag = match[0];
    const name = tag.match(/android:name\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!name) fail('Android main manifest contains a permission without android:name');

    if (/tools:node\s*=\s*["']remove["']/i.test(tag)) {
      removed.push(name);
      continue;
    }

    const maxSdkVersion = tag.match(/android:maxSdkVersion\s*=\s*["']([^"']+)["']/i)?.[1];
    active.push(maxSdkVersion ? `${name}@maxSdk=${maxSdkVersion}` : name);
  }

  return {
    androidManifestPermissions: sorted(active),
    androidManifestRemovedPermissions: sorted(removed),
  };
}

function walkFiles(directory, predicate) {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(entryPath, predicate);
    return entry.isFile() && predicate(entryPath) ? [entryPath] : [];
  });
}

function extractIosEntitlements(rootDir) {
  const iosRoot = path.join(rootDir, 'ios');
  const files = walkFiles(iosRoot, (filePath) => filePath.endsWith('.entitlements'));
  const entries = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!/<plist\b/i.test(content)) fail(`cannot parse entitlement plist ${portable(path.relative(rootDir, filePath))}`);
    const relativePath = portable(path.relative(rootDir, filePath));
    for (const match of content.matchAll(/<key>\s*([^<]+?)\s*<\/key>/gi)) {
      entries.push(`${relativePath}:${match[1].trim()}`);
    }
  }

  return sorted(entries);
}

function extractMobileEdgeContracts(appConfigSourceFile) {
  const names = [];

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      /^supabase[A-Za-z0-9]*FunctionName$/.test(node.name.text) &&
      node.initializer
    ) {
      const literals = [];
      function findStrings(child) {
        if (ts.isStringLiteral(child) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(child.text)) {
          literals.push(child.text);
          return;
        }
        ts.forEachChild(child, findStrings);
      }
      findStrings(node.initializer);
      const uniqueLiterals = sorted(literals);
      if (uniqueLiterals.length !== 1) {
        fail(`${node.name.text} must contain exactly one literal default Edge Function name`);
      }
      names.push(uniqueLiterals[0]);
    }

    ts.forEachChild(node, visit);
  }

  visit(appConfigSourceFile);
  if (names.length === 0) fail('no mobile Edge Function contracts were found in app.config.ts');
  return sorted(names);
}

function extractEdgeFunctionContracts(rootDir) {
  const functionsRoot = path.join(rootDir, EDGE_FUNCTIONS_ROOT);
  let entries;

  try {
    entries = fs.readdirSync(functionsRoot, { withFileTypes: true });
  } catch (error) {
    fail(`cannot read ${EDGE_FUNCTIONS_ROOT}: ${error.message}`);
  }

  const contracts = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)) {
      fail(`unsupported Edge Function contract directory name: ${entry.name}`);
    }
    const indexPath = path.join(functionsRoot, entry.name, 'index.ts');
    if (!fs.existsSync(indexPath)) fail(`Edge Function ${entry.name} is missing index.ts`);
    contracts.push(entry.name);
  }

  if (contracts.length === 0) fail('no Edge Function contracts were found');
  return sorted(contracts);
}

function stripSqlComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ');
}

function normalizeSqlIdentifier(value) {
  return value.replace(/^"|"$/g, '').toLowerCase();
}

function parseQualifiedTableName(statement, action) {
  const prefix =
    action === 'create'
      ? /^\s*create\s+table\s+(?:if\s+not\s+exists\s+)?/i
      : /^\s*drop\s+table\s+(?:if\s+exists\s+)?/i;
  const remainder = statement.replace(prefix, '');
  if (remainder === statement) fail(`cannot parse ${action} table statement: ${statement.trim().slice(0, 120)}`);
  const match = remainder.match(
    /^(?:("[^"]+"|[a-z_][a-z0-9_$]*)\s*\.\s*)?("[^"]+"|[a-z_][a-z0-9_$]*)/i,
  );
  if (!match) fail(`cannot parse ${action} table name: ${statement.trim().slice(0, 120)}`);
  const schema = normalizeSqlIdentifier(match[1] ?? 'public');
  const table = normalizeSqlIdentifier(match[2]);
  return `${schema}.${table}`;
}

function extractDatabaseTables(rootDir) {
  const migrationsRoot = path.join(rootDir, MIGRATIONS_ROOT);
  const migrationFiles = walkFiles(migrationsRoot, (filePath) => filePath.endsWith('.sql')).sort();
  if (migrationFiles.length === 0) fail('no Supabase SQL migrations were found');
  const tables = new Set();

  for (const filePath of migrationFiles) {
    const sql = stripSqlComments(fs.readFileSync(filePath, 'utf8'));
    const tableStatementStarts = [...sql.matchAll(/\b(?:create|drop)\s+table\b/gi)].length;
    const statements = [...sql.matchAll(/\b(create|drop)\s+table\b[\s\S]*?;/gi)];
    if (statements.length !== tableStatementStarts) {
      fail(`cannot safely parse all table statements in ${portable(path.relative(rootDir, filePath))}`);
    }

    for (const match of statements) {
      const action = match[1].toLowerCase();
      const tableName = parseQualifiedTableName(match[0], action);
      if (action === 'create') tables.add(tableName);
      else tables.delete(tableName);
    }
  }

  if (tables.size === 0) fail('Supabase migrations yielded no current database tables');
  return sorted(tables);
}

function extractStorageBuckets(rootDir) {
  const migrationsRoot = path.join(rootDir, MIGRATIONS_ROOT);
  const migrationFiles = walkFiles(migrationsRoot, (filePath) => filePath.endsWith('.sql')).sort();
  const buckets = new Set();

  for (const filePath of migrationFiles) {
    const sql = stripSqlComments(fs.readFileSync(filePath, 'utf8'));
    const insertStarts = [...sql.matchAll(/\binsert\s+into\s+storage\.buckets\b/gi)].length;
    const inserts = [...sql.matchAll(/\binsert\s+into\s+storage\.buckets\b[\s\S]*?;/gi)];
    if (insertStarts !== inserts.length) {
      fail(`cannot safely parse all storage bucket inserts in ${portable(path.relative(rootDir, filePath))}`);
    }

    for (const insert of inserts) {
      const parsed = insert[0].match(
        /^\s*insert\s+into\s+storage\.buckets\s*\(([^)]*)\)\s*values\s*([\s\S]*?)(?:\bon\s+conflict\b|;)$/i,
      );
      if (!parsed) fail(`unsupported storage bucket insert in ${portable(path.relative(rootDir, filePath))}`);
      const columns = parsed[1].split(',').map((column) => normalizeSqlIdentifier(column.trim()));
      if (columns[0] !== 'id') {
        fail(`storage bucket inserts must keep id as the first column in ${portable(path.relative(rootDir, filePath))}`);
      }
      const tuples = [...parsed[2].matchAll(/(?:^|,)\s*\(\s*'([^']+)'/g)];
      if (tuples.length === 0) fail(`storage bucket insert has no literal ids in ${portable(path.relative(rootDir, filePath))}`);
      for (const tuple of tuples) buckets.add(tuple[1]);
    }
  }

  if (buckets.size === 0) fail('Supabase migrations yielded no storage buckets');
  return sorted(buckets);
}

function translationKey(expression) {
  let current = unwrapExpression(expression);
  const parts = [];

  while (current && ts.isPropertyAccessExpression(current)) {
    parts.unshift(current.name.text);
    current = unwrapExpression(current.expression);
  }

  return current && ts.isIdentifier(current) && current.text === 'tr'
    ? `tr.${parts.join('.')}`
    : null;
}

function collectStaticSurfaceValues(expression, output) {
  const value = unwrapExpression(expression);
  if (!value) return;
  const key = translationKey(value);
  if (key) {
    output.push(key);
    return;
  }
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
    output.push(`literal:${value.text}`);
    return;
  }
  ts.forEachChild(value, (child) => collectStaticSurfaceValues(child, output));
}

function findSectionsInitializer(sourceFile) {
  let initializer = null;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'sections' &&
      node.initializer
    ) {
      initializer = node.initializer;
      return;
    }
    if (!initializer) ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  const value = initializer ? unwrapExpression(initializer) : null;
  if (!value || !ts.isArrayLiteralExpression(value)) fail('Settings sections must remain an array literal');
  return value;
}

function findSectionsPushArguments(sourceFile) {
  const argumentsFound = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'sections' &&
      node.expression.name.text === 'push'
    ) {
      if (node.arguments.length !== 1) fail('sections.push must receive exactly one section');
      argumentsFound.push(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return argumentsFound;
}

function jsxAttributeExpression(attribute) {
  if (!attribute.initializer) return null;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer;
  if (ts.isJsxExpression(attribute.initializer)) return attribute.initializer.expression ?? null;
  return null;
}

function hasInteractiveHandler(attributes) {
  return attributes.properties.some(
    (attribute) =>
      ts.isJsxAttribute(attribute) &&
      /^on(?:Action|Back|Clear|Confirm|Next|Open|Press|Save|Select|Send|Toggle)$/.test(
        attribute.name.text,
      ),
  );
}

function collectVisibleJsxChildren(children, output) {
  for (const child of children) {
    if (ts.isJsxExpression(child) && child.expression) {
      collectVisibleExpression(child.expression, output);
    } else if (ts.isJsxElement(child)) {
      collectVisibleJsxChildren(child.children, output);
    } else if (ts.isJsxFragment(child)) {
      collectVisibleJsxChildren(child.children, output);
    }
  }
}

function collectVisibleExpression(expression, output) {
  const value = unwrapExpression(expression);
  if (!value) return;
  const key = translationKey(value);
  if (key) {
    output.push(key);
    return;
  }
  if (ts.isCallExpression(value)) {
    const calledKey = translationKey(value.expression);
    if (calledKey) output.push(calledKey);
    return;
  }
  if (ts.isConditionalExpression(value)) {
    collectVisibleExpression(value.whenTrue, output);
    collectVisibleExpression(value.whenFalse, output);
    return;
  }
  if (ts.isBinaryExpression(value)) {
    collectVisibleExpression(value.left, output);
    collectVisibleExpression(value.right, output);
    return;
  }
  if (ts.isJsxElement(value)) {
    collectVisibleJsxChildren(value.children, output);
  } else if (ts.isJsxFragment(value)) {
    collectVisibleJsxChildren(value.children, output);
  }
}

function collectInteractiveJsxValues(sourceFile, output) {
  const interactiveAttributes = new Map([
    ['AuthImagePicker', new Set(['placeholderText'])],
    ['ConfirmActionModal', new Set(['confirmLabel'])],
    ['IconButton', new Set(['accessibilityLabel'])],
    ['PrimaryButton', new Set(['title'])],
    ['PrivacyOption', new Set(['title'])],
    ['SettingsHeader', new Set(['actionLabel'])],
  ]);

  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      const attributes = new Set(interactiveAttributes.get(tagName) ?? []);
      if (hasInteractiveHandler(node.attributes) && /(?:Action|Button|Option|Picker|Pressable|Toggle)$/.test(tagName)) {
        for (const attributeName of [
          'accessibilityLabel',
          'actionLabel',
          'confirmLabel',
          'label',
          'placeholderText',
          'title',
        ]) {
          attributes.add(attributeName);
        }
      }
      if (attributes.size > 0) {
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute) || !attributes.has(attribute.name.text)) continue;
          const expression = jsxAttributeExpression(attribute);
          if (expression) collectStaticSurfaceValues(expression, output);
        }
      }
    }

    if (ts.isJsxElement(node) && hasInteractiveHandler(node.openingElement.attributes)) {
      collectVisibleJsxChildren(node.children, output);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function collectSettingsMenuSection(sectionExpression, visibleGroups, visibleCtas) {
  const section = unwrapExpression(sectionExpression);
  if (!section || !ts.isObjectLiteralExpression(section)) {
    fail('Settings section entries must be object literals');
  }

  const title = objectPropertyExpression(section, 'title', 'settings section');
  collectStaticSurfaceValues(title, visibleGroups);
  const itemsExpression = unwrapExpression(objectPropertyExpression(section, 'items', 'settings section'));
  if (!itemsExpression || !ts.isArrayLiteralExpression(itemsExpression)) {
    fail('Settings section items must remain an array literal');
  }

  for (const itemExpression of itemsExpression.elements) {
    const item = unwrapExpression(itemExpression);
    if (!item || !ts.isObjectLiteralExpression(item)) {
      fail('Settings menu items must remain object literals');
    }
    const label = objectPropertyExpression(item, 'label', 'settings menu item');
    const labels = [];
    collectStaticSurfaceValues(label, labels);
    if (labels.length !== 1) fail('Settings menu item labels must remain one static translation or literal');
    visibleCtas.push(labels[0]);
  }
}

function extractSettingsSurface(rootDir) {
  const settingsScreen = parseRequiredTypeScript(rootDir, SETTINGS_SCREEN_PATH);
  const sections = [findSectionsInitializer(settingsScreen), ...findSectionsPushArguments(settingsScreen)];
  const visibleGroups = [];
  const visibleCtas = [];

  for (const section of sections) {
    const value = unwrapExpression(section);
    if (ts.isArrayLiteralExpression(value)) {
      for (const element of value.elements) {
        collectSettingsMenuSection(element, visibleGroups, visibleCtas);
      }
    } else if (value && ts.isObjectLiteralExpression(value)) {
      collectSettingsMenuSection(value, visibleGroups, visibleCtas);
    } else {
      fail('Settings sections must remain statically inspectable object literals');
    }
  }

  const settingsUiFiles = walkFiles(path.join(rootDir, SETTINGS_UI_ROOT), (filePath) => {
    const portablePath = portable(filePath);
    return (
      filePath.endsWith('.tsx') &&
      !portablePath.includes('/__tests__/') &&
      !portablePath.endsWith('/UiCatalogScreen.tsx')
    );
  });
  if (settingsUiFiles.length === 0) fail('no production Settings UI files were found');

  for (const filePath of settingsUiFiles) {
    const relativePath = portable(path.relative(rootDir, filePath));
    collectInteractiveJsxValues(
      parseTypeScriptText(fs.readFileSync(filePath, 'utf8'), relativePath),
      visibleCtas,
    );
  }

  const settingsState = parseRequiredTypeScript(rootDir, SETTINGS_STATE_PATH);
  return {
    views: extractStringUnionAlias(settingsState, 'SettingsView'),
    visibleGroups: sorted(visibleGroups),
    visibleCtas: sorted(visibleCtas),
  };
}

export function isAllowedInternalTable(tableName) {
  const normalized = tableName.toLowerCase();
  if (CURRENT_INTERNAL_TABLES.has(normalized)) return true;
  const name = normalized.includes('.') ? normalized.slice(normalized.indexOf('.') + 1) : normalized;
  return INTERNAL_TABLE_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

export function isAllowedInternalEdgeContract(contractName) {
  return INTERNAL_EDGE_CONTRACT_PATTERN.test(contractName);
}

export function collectFeatureSurface(rootDir = process.cwd()) {
  const repositoryRoot = path.resolve(rootDir);
  const navigationTypes = parseRequiredTypeScript(repositoryRoot, NAVIGATION_TYPES_PATH);
  const rootNavigator = parseRequiredTypeScript(repositoryRoot, ROOT_NAVIGATOR_PATH);
  const mainTabs = parseRequiredTypeScript(repositoryRoot, MAIN_TABS_PATH);
  const routeLoaders = parseRequiredTypeScript(repositoryRoot, ROUTE_LOADERS_PATH);
  const appConfig = parseRequiredTypeScript(repositoryRoot, APP_CONFIG_PATH);
  const rootRoutes = extractTypeLiteralKeys(navigationTypes, 'RootStackParamList');
  const tabRoutes = extractTypeLiteralKeys(navigationTypes, 'MainTabParamList');
  const registeredRootRoutes = extractJsxRouteNames(rootNavigator, 'Stack.Screen');
  const registeredTabRoutes = extractJsxRouteNames(mainTabs, 'Tabs.Screen');
  assertSameValues(rootRoutes, registeredRootRoutes, 'root route');
  assertSameValues(tabRoutes, registeredTabRoutes, 'tab route');

  const screenEntrypoints = extractDeferredScreenEntrypoints(routeLoaders);
  const expectedDeferredRoutes = sorted([...rootRoutes.filter((route) => route !== 'MainTabs'), ...tabRoutes]);
  assertSameValues(
    expectedDeferredRoutes,
    screenEntrypoints.map((entrypoint) => entrypoint.route),
    'deferred screen entrypoint',
  );

  const expoNativeCapabilities = extractExpoNativeCapabilities(appConfig);
  const manifestCapabilities = extractAndroidManifestPermissions(repositoryRoot);
  const allTables = extractDatabaseTables(repositoryRoot);
  const edgeFunctionContracts = extractEdgeFunctionContracts(repositoryRoot);
  const mobileEdgeFunctionContracts = extractMobileEdgeContracts(appConfig);
  const missingMobileContracts = mobileEdgeFunctionContracts.filter(
    (contract) => !edgeFunctionContracts.includes(contract),
  );
  if (missingMobileContracts.length > 0) {
    fail(`mobile Edge Function defaults have no deployed contract: ${missingMobileContracts.join(', ')}`);
  }

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    navigation: {
      rootRoutes,
      tabRoutes,
      screenEntrypoints,
    },
    nativeCapabilities: {
      ...expoNativeCapabilities,
      ...manifestCapabilities,
      iosEntitlements: extractIosEntitlements(repositoryRoot),
    },
    notifications: {
      types: extractStringUnionProperty(
        parseRequiredTypeScript(repositoryRoot, NOTIFICATION_CONTRACT_PATH),
        'MobileNotification',
        'type',
      ),
      categories: extractStringUnionAlias(
        parseRequiredTypeScript(repositoryRoot, NOTIFICATION_STATE_PATH),
        'NotificationCategory',
      ),
    },
    api: {
      edgeFunctionContracts,
      mobileEdgeFunctionContracts,
    },
    data: {
      productTables: allTables.filter((tableName) => !isAllowedInternalTable(tableName)),
      internalTablesAtBaseline: allTables.filter((tableName) => isAllowedInternalTable(tableName)),
      storageBuckets: extractStorageBuckets(repositoryRoot),
    },
    settings: extractSettingsSurface(repositoryRoot),
  };
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
}

function assertExactKeys(value, keys, label) {
  assertObject(value, label);
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    fail(`${label} keys must be exactly: ${expectedKeys.join(', ')}`);
  }
}

function valueAtPath(value, dottedPath) {
  return dottedPath.split('.').reduce((current, key) => current?.[key], value);
}

function assertSortedUniqueStrings(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    fail(`${label} must be an array of strings`);
  }
  if (JSON.stringify(value) !== JSON.stringify(sorted(value))) {
    fail(`${label} must be sorted and contain no duplicates`);
  }
}

export function validateFeatureSurface(surface, label = 'feature surface') {
  assertExactKeys(
    surface,
    ['schemaVersion', 'navigation', 'nativeCapabilities', 'notifications', 'api', 'data', 'settings'],
    label,
  );
  if (surface.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    fail(`${label}.schemaVersion must be ${SNAPSHOT_SCHEMA_VERSION}`);
  }
  assertExactKeys(surface.navigation, ['rootRoutes', 'tabRoutes', 'screenEntrypoints'], `${label}.navigation`);
  assertExactKeys(
    surface.nativeCapabilities,
    [
      'expoAndroidPermissions',
      'expoAndroidBlockedPermissions',
      'expoPermissionPlugins',
      'expoPermissionDeclarations',
      'expoIosEntitlements',
      'iosUsageDescriptionKeys',
      'iosBackgroundModes',
      'androidManifestPermissions',
      'androidManifestRemovedPermissions',
      'iosEntitlements',
    ],
    `${label}.nativeCapabilities`,
  );
  assertExactKeys(surface.notifications, ['types', 'categories'], `${label}.notifications`);
  assertExactKeys(
    surface.api,
    ['edgeFunctionContracts', 'mobileEdgeFunctionContracts'],
    `${label}.api`,
  );
  assertExactKeys(
    surface.data,
    ['productTables', 'internalTablesAtBaseline', 'storageBuckets'],
    `${label}.data`,
  );
  assertExactKeys(surface.settings, ['views', 'visibleGroups', 'visibleCtas'], `${label}.settings`);

  for (const arrayPath of REQUIRED_STRING_ARRAY_PATHS) {
    assertSortedUniqueStrings(valueAtPath(surface, arrayPath), `${label}.${arrayPath}`);
  }
  for (const tableName of surface.data.internalTablesAtBaseline) {
    if (!isAllowedInternalTable(tableName)) {
      fail(`${label}.data.internalTablesAtBaseline contains a non-internal table: ${tableName}`);
    }
  }

  const entrypoints = surface.navigation.screenEntrypoints;
  if (!Array.isArray(entrypoints)) fail(`${label}.navigation.screenEntrypoints must be an array`);
  const entrypointRoutes = [];
  for (const [index, entrypoint] of entrypoints.entries()) {
    assertExactKeys(
      entrypoint,
      ['route', 'module', 'exportName'],
      `${label}.navigation.screenEntrypoints[${index}]`,
    );
    for (const key of ['route', 'module', 'exportName']) {
      if (typeof entrypoint[key] !== 'string' || entrypoint[key].length === 0) {
        fail(`${label}.navigation.screenEntrypoints[${index}].${key} must be a non-empty string`);
      }
    }
    entrypointRoutes.push(entrypoint.route);
  }
  if (JSON.stringify(entrypointRoutes) !== JSON.stringify(sorted(entrypointRoutes))) {
    fail(`${label}.navigation.screenEntrypoints must be sorted by unique route`);
  }
}

export function loadFeatureSurfaceSnapshot(snapshotPath) {
  let source;
  try {
    source = fs.readFileSync(snapshotPath, 'utf8');
  } catch (error) {
    fail(`cannot read snapshot ${portable(snapshotPath)}: ${error.message}`);
  }

  let snapshot;
  try {
    snapshot = JSON.parse(source);
  } catch (error) {
    fail(`cannot parse snapshot ${portable(snapshotPath)}: ${error.message}`);
  }
  validateFeatureSurface(snapshot, 'snapshot');
  return snapshot;
}

function displayValue(value) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function compareArray(expected, current, label, differences, key = displayValue) {
  const expectedMap = new Map(expected.map((value) => [key(value), value]));
  const currentMap = new Map(current.map((value) => [key(value), value]));
  const removed = [...expectedMap.keys()].filter((value) => !currentMap.has(value));
  const added = [...currentMap.keys()].filter((value) => !expectedMap.has(value));

  if (removed.length > 0) differences.push(`${label} removed: ${removed.join(', ')}`);
  if (added.length > 0) differences.push(`${label} added: ${added.join(', ')}`);
}

function compareEdgeContracts(expected, current, label, differences) {
  const expectedSet = new Set(expected);
  const currentSet = new Set(current);
  const removed = expected.filter((contract) => !currentSet.has(contract));
  const added = current.filter(
    (contract) => !expectedSet.has(contract) && !isAllowedInternalEdgeContract(contract),
  );

  if (removed.length > 0) differences.push(`${label} removed: ${removed.join(', ')}`);
  if (added.length > 0) {
    differences.push(`${label} added outside the internal hardening allowlist: ${added.join(', ')}`);
  }
}

export function compareFeatureSurface(expected, current) {
  validateFeatureSurface(expected, 'snapshot');
  validateFeatureSurface(current, 'current surface');
  const differences = [];

  compareArray(expected.navigation.rootRoutes, current.navigation.rootRoutes, 'root routes', differences);
  compareArray(expected.navigation.tabRoutes, current.navigation.tabRoutes, 'tab routes', differences);
  compareArray(
    expected.navigation.screenEntrypoints,
    current.navigation.screenEntrypoints,
    'screen entrypoints',
    differences,
    (entrypoint) => `${entrypoint.route}=${entrypoint.module}#${entrypoint.exportName}`,
  );

  for (const capability of [
    'expoAndroidPermissions',
    'expoAndroidBlockedPermissions',
    'expoPermissionPlugins',
    'expoPermissionDeclarations',
    'expoIosEntitlements',
    'iosUsageDescriptionKeys',
    'iosBackgroundModes',
    'androidManifestPermissions',
    'androidManifestRemovedPermissions',
    'iosEntitlements',
  ]) {
    compareArray(
      expected.nativeCapabilities[capability],
      current.nativeCapabilities[capability],
      `native capability ${capability}`,
      differences,
    );
  }

  compareArray(expected.notifications.types, current.notifications.types, 'notification types', differences);
  compareArray(
    expected.notifications.categories,
    current.notifications.categories,
    'notification categories',
    differences,
  );
  compareEdgeContracts(
    expected.api.edgeFunctionContracts,
    current.api.edgeFunctionContracts,
    'Edge Function contracts',
    differences,
  );
  compareEdgeContracts(
    expected.api.mobileEdgeFunctionContracts,
    current.api.mobileEdgeFunctionContracts,
    'mobile Edge Function contracts',
    differences,
  );
  compareArray(expected.data.productTables, current.data.productTables, 'product tables', differences);
  compareArray(expected.data.storageBuckets, current.data.storageBuckets, 'storage buckets', differences);
  compareArray(expected.settings.views, current.settings.views, 'Settings views', differences);
  compareArray(
    expected.settings.visibleGroups,
    current.settings.visibleGroups,
    'visible Settings groups',
    differences,
  );
  compareArray(
    expected.settings.visibleCtas,
    current.settings.visibleCtas,
    'visible Settings CTAs',
    differences,
  );

  return differences;
}

export function runFeatureSurfaceCheck({
  rootDir = process.cwd(),
  snapshotPath = path.join(rootDir, DEFAULT_SNAPSHOT_RELATIVE_PATH),
} = {}) {
  const expected = loadFeatureSurfaceSnapshot(snapshotPath);
  const current = collectFeatureSurface(rootDir);
  const differences = compareFeatureSurface(expected, current);

  if (differences.length > 0) {
    fail(`product surface changed:\n- ${differences.join('\n- ')}`);
  }

  return current;
}

function summary(surface) {
  return [
    `${surface.navigation.rootRoutes.length} root routes`,
    `${surface.navigation.tabRoutes.length} tabs`,
    `${surface.navigation.screenEntrypoints.length} screen entrypoints`,
    `${surface.notifications.types.length} notification types`,
    `${surface.api.edgeFunctionContracts.length} Edge Function contracts`,
    `${surface.data.productTables.length} product tables`,
    `${surface.data.storageBuckets.length} storage buckets`,
    `${surface.settings.visibleGroups.length} Settings groups`,
    `${surface.settings.visibleCtas.length} Settings CTAs`,
  ].join(', ');
}

function parseCliArguments(argv) {
  const options = { printCurrent: false, rootDir: process.cwd(), snapshotPath: null };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--print-current') {
      options.printCurrent = true;
    } else if (argument === '--root') {
      const value = argv[index + 1];
      if (!value) fail('--root requires a path');
      options.rootDir = path.resolve(value);
      index += 1;
    } else if (argument === '--snapshot') {
      const value = argv[index + 1];
      if (!value) fail('--snapshot requires a path');
      options.snapshotPath = path.resolve(value);
      index += 1;
    } else {
      fail(`unknown argument: ${argument}`);
    }
  }

  return options;
}

function main() {
  const options = parseCliArguments(process.argv.slice(2));
  const rootDir = path.resolve(options.rootDir);

  if (options.printCurrent) {
    const current = collectFeatureSurface(rootDir);
    validateFeatureSurface(current, 'current surface');
    process.stdout.write(`${JSON.stringify(current, null, 2)}\n`);
    return;
  }

  const current = runFeatureSurfaceCheck({
    rootDir,
    snapshotPath: options.snapshotPath ?? path.join(rootDir, DEFAULT_SNAPSHOT_RELATIVE_PATH),
  });
  console.log(`[feature-surface] OK (${summary(current)})`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : `[feature-surface] ${String(error)}`);
    process.exitCode = 1;
  }
}
