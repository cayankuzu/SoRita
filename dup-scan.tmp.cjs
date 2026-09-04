const fs = require('fs');
const src = fs.readFileSync('src/mobile/app/shared/theme/tokens.ts', 'utf8');
const lines = src.split('\n');

function collect(header) {
  const start = lines.findIndex((l) => l.startsWith(`export const ${header} = {`));
  if (start === -1) return null;
  const byValue = new Map();
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\} as const;|^\};/.test(line)) break;
    const m = line.match(/^\s*'?([A-Za-z0-9_]+)'?:\s*(.+?),\s*$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim();
    if (!byValue.has(value)) byValue.set(value, []);
    byValue.get(value).push(key);
  }
  return byValue;
}

for (const header of ['colors', 'spacing', 'radius', 'typography', 'iconSize', 'controlSize']) {
  const g = collect(header);
  if (!g) { console.log(`### ${header}: not found`); continue; }
  const dups = [...g].filter(([, keys]) => keys.length > 1);
  console.log(`### ${header}: ${g.size} distinct values, ${dups.length} duplicated`);
  for (const [value, keys] of dups) console.log(`   ${value.padEnd(24)} <- ${keys.join(', ')}`);
}
