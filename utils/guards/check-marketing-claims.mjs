// Marketing copy is the one artefact that can promise something the build does
// not do. This guard makes the promise checkable: every screen a marketing
// document names has to exist in the frozen product surface, every claim has to
// carry evidence, and the phrases we banned cannot reappear in approved copy.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('../..', import.meta.url));
const marketingDir = join(workspace, 'docs/marketing');
const registerPath = join(marketingDir, 'claims-register.md');
const snapshotPath = join(workspace, 'quality/feature-surface.snapshot.json');

const violations = [];
const rel = (path) => relative(workspace, path).split(sep).join(String.fromCharCode(47));

// Phrases the register bans outright. Matched only against copy we approved for
// use - the register itself quotes them in its own "yasak" column on purpose.
const BANNED = [
  'en iyi', 'bir numara', 'lider', 'vazgeçilmez',
  'ai destekli', 'yapay zekâ öneri', 'akıllı algoritma',
  'garantili', 'kesin sonuç',
  'binlerce kullanıcı', 'milyonlarca',
  'hiçbir veri toplam',
  'anında açılır', 'çok hızlı',
  'doğrulanmış mekân', 'gerçek zamanlı açık',
];

const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
const knownRoutes = new Set([
  ...(snapshot.navigation?.rootRoutes ?? []),
  ...(snapshot.navigation?.tabRoutes ?? []),
]);

if (knownRoutes.size === 0) {
  violations.push(`${rel(snapshotPath)}: no routes found; the snapshot shape changed`);
}

const registerSource = await readFile(registerPath, 'utf8');

// Parse the claim table. Rows look like: | C1 | claim | audience | surface |
// evidence | allowed phrasing | banned | status |
const claims = new Map();
for (const line of registerSource.split(/\r?\n/)) {
  if (!line.trimStart().startsWith('|')) continue;
  const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
  if (cells.length < 8) continue;
  const [id, claim, , surface, evidence, allowed, , status] = cells;
  if (!/^C\d+$/.test(id)) continue;
  claims.set(id, { claim, surface, evidence, allowed, status });
}

if (claims.size === 0) {
  violations.push(`${rel(registerPath)}: no claim rows parsed; the table shape changed`);
}

const VALID_STATUS = new Set(['KANITLI', 'KOŞULLU', 'ÖLÇÜLMEDİ']);

for (const [id, row] of claims) {
  if (!VALID_STATUS.has(row.status)) {
    violations.push(`${rel(registerPath)}: ${id} has unknown status "${row.status}"`);
  }

  // A usable claim must cite something. Only an explicitly unmeasured claim may
  // have none, and it must also refuse to offer any approved phrasing.
  const hasEvidence = row.evidence.length > 0 && row.evidence.toLowerCase() !== 'yok';
  if (row.status !== 'ÖLÇÜLMEDİ' && !hasEvidence) {
    violations.push(`${rel(registerPath)}: ${id} is ${row.status} but cites no evidence`);
  }
  if (row.status === 'ÖLÇÜLMEDİ' && !/kullanılamaz/i.test(row.allowed)) {
    violations.push(
      `${rel(registerPath)}: ${id} is ÖLÇÜLMEDİ but still offers approved phrasing "${row.allowed}"`,
    );
  }

  // Banned language must never appear in the phrasing we approved.
  const approved = row.allowed.toLowerCase();
  for (const phrase of BANNED) {
    if (approved.includes(phrase)) {
      violations.push(`${rel(registerPath)}: ${id} approves banned phrase "${phrase}"`);
    }
  }
}

const files = (await readdir(marketingDir)).filter((name) => name.endsWith('.md'));
if (files.length === 0) violations.push(`${rel(marketingDir)}: no marketing documents found`);

for (const name of files) {
  const path = join(marketingDir, name);
  const source = await readFile(path, 'utf8');

  // Every C-reference has to resolve to a real register row.
  for (const match of source.matchAll(/\bC(\d+)\b/g)) {
    const id = `C${match[1]}`;
    if (!claims.has(id)) violations.push(`${rel(path)}: cites ${id}, which the register does not define`);
  }

  // Fenced blocks are literal published copy, so they are held to the ban list.
  for (const block of source.matchAll(/```[a-z]*\n([\s\S]*?)```/g)) {
    const body = block[1].toLowerCase();
    for (const phrase of BANNED) {
      if (body.includes(phrase)) {
        violations.push(`${rel(path)}: published copy block contains banned phrase "${phrase}"`);
      }
    }
  }
}

// Screens named in the storyboard must exist in the frozen surface: this is the
// rule that stops a mockup from showing a screen the build does not have.
const storyboardPath = join(marketingDir, 'screenshot-storyboard.md');
const storyboard = await readFile(storyboardPath, 'utf8');
let checkedRoutes = 0;
for (const line of storyboard.split(/\r?\n/)) {
  if (!line.trimStart().startsWith('|')) continue;
  const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
  if (cells.length < 5 || !/^\d+$/.test(cells[0])) continue;
  for (const ref of cells[1].matchAll(/`([A-Z][A-Za-z]+)`/g)) {
    checkedRoutes += 1;
    if (!knownRoutes.has(ref[1])) {
      violations.push(
        `${rel(storyboardPath)}: frame ${cells[0]} shows "${ref[1]}", which is not a route in the frozen surface`,
      );
    }
  }
}

if (checkedRoutes === 0) {
  violations.push(`${rel(storyboardPath)}: no screen references parsed; the frame table shape changed`);
}

if (violations.length > 0) {
  console.error('[marketing-claims] Marketing copy must stay tied to the shipped product:');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `[marketing-claims] OK (${claims.size} claims, ${files.length} documents, ${checkedRoutes} screen references verified against the frozen surface)`,
);
