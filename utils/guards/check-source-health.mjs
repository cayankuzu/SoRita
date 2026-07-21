import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, 'src', 'mobile', 'app');
const DEFAULT_MAX_LINES = 700;
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
  const lineCount = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
  const limit = HOTSPOT_LIMITS.get(relativePath) ?? DEFAULT_MAX_LINES;
  if (lineCount > limit) violations.push(`${relativePath}: ${lineCount} lines (limit ${limit})`);
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

if (violations.length > 0) {
  console.error(`[source-health] Failed:\n- ${violations.join('\n- ')}`);
  process.exit(1);
}

console.log(`[source-health] OK (${files.length} files, no cycles, complexity budgets respected)`);
