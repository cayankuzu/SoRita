import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, 'src', 'mobile', 'app');
const DEFAULT_MAX_LINES = 700;
const DEFAULT_MAX_FUNCTION_LINES = 300;
const HOTSPOT_LIMITS = new Map(Object.entries({
  'src/mobile/app/shared/i18n/tr.ts': 1_100,
  'src/mobile/app/data/repositories/listsRepository.ts': 980,
  'src/mobile/app/features/map/application/usePlaceEditorState.ts': 970,
  'src/mobile/app/platform/supabase/media.ts': 950,
  'src/mobile/app/features/map/application/useMapScreenState.ts': 900,
  'src/mobile/app/data/query/optimisticSocialCache.ts': 900,
  'src/mobile/app/features/profile/ui/screens/UserProfileScreen.tsx': 860,
  'src/mobile/app/features/places/ui/components/PlaceCard.tsx': 820,
  'src/mobile/app/platform/media/images.ts': 820,
  'src/mobile/app/features/lists/ui/components/ListEditorModal.tsx': 810,
  'src/mobile/app/features/map/ui/screens/MapScreen.tsx': 790,
  'src/mobile/app/platform/media/MediaLibrarySelectionHost.tsx': 770,
  'src/mobile/app/features/auth/application/useAuthScreenState.ts': 730,
}));
const FUNCTION_HOTSPOT_LIMITS = new Map(Object.entries({
  'src/mobile/app/features/map/application/usePlaceEditorState.ts': 860,
  'src/mobile/app/features/map/application/useMapScreenState.ts': 800,
  'src/mobile/app/features/profile/ui/screens/UserProfileScreen.tsx': 700,
  'src/mobile/app/features/auth/application/useAuthScreenState.ts': 620,
  'src/mobile/app/features/places/ui/components/PlaceCard.tsx': 630,
  'src/mobile/app/features/profile/ui/screens/ProfileScreen.tsx': 590,
  'src/mobile/app/features/lists/ui/screens/ListDetailScreen.tsx': 560,
  'src/mobile/app/platform/media/MediaLibrarySelectionHost.tsx': 480,
  'src/mobile/app/features/map/ui/components/PlaceEditorModal.tsx': 480,
  'src/mobile/app/features/lists/ui/components/ListEditorModal.tsx': 470,
  'src/mobile/app/features/map/ui/screens/MapScreen.tsx': 460,
  'src/mobile/app/features/settings/application/useSettingsScreenState.ts': 390,
  'src/mobile/app/app-shell/notifications/PushNotificationsController.tsx': 380,
  'src/mobile/app/app-shell/auth/session/useAuthActions.ts': 370,
  'src/mobile/app/features/places/application/usePlaceCardState.ts': 360,
  'src/mobile/app/features/social/ui/components/CommentPanel.tsx': 350,
  'src/mobile/app/features/settings/ui/screens/SettingsScreen.tsx': 345,
  'src/mobile/app/platform/media/VideoCameraCaptureHost.tsx': 330,
}));

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(entryPath);
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [entryPath] : [];
  });
}

function portable(filePath) {
  return path.relative(ROOT, filePath).replaceAll('\\', '/');
}

const files = walk(SOURCE_ROOT);
const knownFiles = new Set(files.map((filePath) => path.resolve(filePath)));
const violations = [];

for (const filePath of files) {
  const relativePath = portable(filePath);
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const lineCount = sourceText.split(/\r?\n/).length;
  const limit = HOTSPOT_LIMITS.get(relativePath) ?? DEFAULT_MAX_LINES;
  if (lineCount > limit) violations.push(`${relativePath}: ${lineCount} lines (limit ${limit})`);

  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const functionLimit = FUNCTION_HOTSPOT_LIMITS.get(relativePath) ?? DEFAULT_MAX_FUNCTION_LINES;

  function inspectFunctionSize(node) {
    const isFunction =
      ts.isArrowFunction(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isMethodDeclaration(node);

    if (isFunction) {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      const end = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
      const functionLines = end - start + 1;

      if (functionLines > functionLimit) {
        violations.push(
          `${relativePath}:${start}: ${functionLines} function lines (limit ${functionLimit})`,
        );
      }
    }

    ts.forEachChild(node, inspectFunctionSize);
  }

  inspectFunctionSize(sourceFile);
}

function resolveModule(fromFile, request) {
  if (!request.startsWith('.') && !request.startsWith('@/')) return null;
  const rawPath = request.startsWith('@/')
    ? path.join(ROOT, 'src', request.slice(2))
    : path.resolve(path.dirname(fromFile), request);
  const candidates = [
    rawPath,
    `${rawPath}.ts`,
    `${rawPath}.tsx`,
    path.join(rawPath, 'index.ts'),
    path.join(rawPath, 'index.tsx'),
  ].map((candidate) => path.resolve(candidate));
  return candidates.find((candidate) => knownFiles.has(candidate)) ?? null;
}

const graph = new Map();
const importPattern = /(?:from\s+|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g;
for (const filePath of files) {
  const source = fs.readFileSync(filePath, 'utf8');
  const dependencies = new Set();
  for (const match of source.matchAll(importPattern)) {
    const resolved = resolveModule(filePath, match[1]);
    if (resolved) dependencies.add(resolved);
  }
  graph.set(path.resolve(filePath), dependencies);
}

const visited = new Set();
const visiting = new Set();
const stack = [];
const cycles = new Set();
function visit(filePath) {
  if (visiting.has(filePath)) {
    const cycleStart = stack.indexOf(filePath);
    const cycle = [...stack.slice(cycleStart), filePath].map(portable);
    cycles.add(cycle.join(' -> '));
    return;
  }
  if (visited.has(filePath)) return;
  visiting.add(filePath);
  stack.push(filePath);
  for (const dependency of graph.get(filePath) ?? []) visit(dependency);
  stack.pop();
  visiting.delete(filePath);
  visited.add(filePath);
}
for (const filePath of graph.keys()) visit(filePath);

if (cycles.size > 0) {
  violations.push(...[...cycles].map((cycle) => `dependency cycle: ${cycle}`));
}

// Backend roots carry the same file-size discipline as the mobile app. Limits
// are ratcheted to the measured size at adoption so existing debt is recorded
// explicitly and can only shrink, never grow silently.
const BACKEND_ROOTS = [
  path.join(ROOT, 'supabase', 'functions'),
  path.join(ROOT, 'infra', 'cloudflare', 'sorita-edge', 'src'),
];
const BACKEND_DEFAULT_MAX_LINES = 600;
const BACKEND_HOTSPOT_LIMITS = new Map(Object.entries({
  'supabase/functions/media-assets/handler.ts': 2_100,
  'infra/cloudflare/sorita-edge/src/index.ts': 1_080,
  'supabase/functions/auth-gateway/handler.ts': 930,
  'supabase/functions/moderation-reports/handler.ts': 770,
}));

function walkBackend(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ['__tests__', '.wrangler', 'node_modules'].includes(entry.name)
        ? []
        : walkBackend(entryPath);
    }
    if (!/\.ts$/.test(entry.name)) return [];
    if (entry.name.endsWith('.d.ts') || entry.name.endsWith('.test.ts')) return [];
    return [entryPath];
  });
}

const backendFiles = BACKEND_ROOTS.flatMap((root) => walkBackend(root));
for (const filePath of backendFiles) {
  const relativePath = portable(filePath);
  const lineCount = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
  const limit = BACKEND_HOTSPOT_LIMITS.get(relativePath) ?? BACKEND_DEFAULT_MAX_LINES;
  if (lineCount > limit) {
    violations.push(`${relativePath}: ${lineCount} lines (limit ${limit})`);
  }
}

for (const [relativePath, limit] of BACKEND_HOTSPOT_LIMITS) {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) {
    violations.push(`stale backend budget for missing file: ${relativePath}`);
    continue;
  }
  const lineCount = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/).length;
  if (lineCount <= BACKEND_DEFAULT_MAX_LINES) {
    violations.push(
      `${relativePath} no longer needs a raised budget (${lineCount} lines); remove its exemption`,
    );
  }
  if (limit - lineCount > 100) {
    violations.push(
      `${relativePath} budget ${limit} is far above its ${lineCount} lines; ratchet it down`,
    );
  }
}

if (violations.length > 0) {
  console.error(`[source-health] Failed:\n- ${violations.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `[source-health] OK (${files.length} app files, ${backendFiles.length} backend files, no cycles, file/function budgets respected)`,
);
