import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const phaseIndex = process.argv.indexOf('--phase');
const phase = phaseIndex === -1 ? 'all' : process.argv[phaseIndex + 1];
const allowedPhases = new Set(['all', 'start', 'test', 'restore']);
if (!allowedPhases.has(phase)) {
  throw new Error('--phase must be one of: all, start, test, restore');
}
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'sorita-docker-supabase-'));
const projectId = `sorita_docker_${process.pid}_${Date.now().toString(36)}`;
const databaseContainer = `supabase_db_${projectId}`;
const npxCliPath = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
const npxExecutable = process.platform === 'win32' ? process.execPath : 'npx';
const npxPrefix = process.platform === 'win32' ? [npxCliPath] : [];
let stackStartAttempted = false;
let restoreDatabaseCreated = false;

const reserveEphemeralPort = () => new Promise((resolve, reject) => {
  const server = createServer();
  server.unref();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      reject(new Error('Unable to reserve an isolated Supabase port.'));
      return;
    }
    const { port } = address;
    server.close((error) => (error ? reject(error) : resolve(port)));
  });
});

const allocateDistinctPorts = async (keys) => {
  const ports = new Map();
  const used = new Set();
  for (const key of keys) {
    let port;
    do {
      port = await reserveEphemeralPort();
    } while (used.has(port));
    used.add(port);
    ports.set(key, port);
  }
  return ports;
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    shell: false,
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) {
    if (result.error) process.stderr.write(`${result.error.message}\n`);
    if (options.capture) process.stderr.write(result.stderr || result.stdout || 'command failed\n');
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 1}`);
  }
  return result.stdout || '';
};

const supabase = (...args) =>
  run(npxExecutable, [
    ...npxPrefix,
    '--yes',
    'supabase@2.116.0',
    ...args,
    '--workdir',
    temporaryRoot,
  ]);

const supabaseCaptured = (...args) =>
  run(npxExecutable, [
    ...npxPrefix,
    '--yes',
    'supabase@2.116.0',
    ...args,
    '--workdir',
    temporaryRoot,
  ], { capture: true });

const queryScalar = (databaseName, sql) => {
  const output = run('docker', [
    'exec', databaseContainer, 'psql', '--username', 'supabase_admin',
    '--dbname', databaseName, '--tuples-only', '--no-align', '--set', 'ON_ERROR_STOP=1',
    '--command', sql,
  ], { capture: true }).trim();
  if (!/^\d+$/u.test(output)) {
    throw new Error(`Database parity query returned a non-integer result for ${databaseName}.`);
  }
  return Number(output);
};

const collectParity = (databaseName) => ({
  authUsers: queryScalar(databaseName, 'select count(*) from auth.users;'),
  publicRoutines: queryScalar(
    databaseName,
    "select count(*) from information_schema.routines where routine_schema = 'public';",
  ),
  publicTables: queryScalar(
    databaseName,
    "select count(*) from pg_catalog.pg_tables where schemaname = 'public';",
  ),
  rlsPolicies: queryScalar(
    databaseName,
    "select count(*) from pg_catalog.pg_policies where schemaname in ('public', 'storage');",
  ),
  storageBuckets: queryScalar(databaseName, 'select count(*) from storage.buckets;'),
  storageObjects: queryScalar(databaseName, 'select count(*) from storage.objects;'),
});

try {
  cpSync(path.join(repositoryRoot, 'supabase'), path.join(temporaryRoot, 'supabase'), {
    recursive: true,
    filter: (source) => !/[\\/](?:\.temp|\.branches)(?:[\\/]|$)/u.test(source),
  });

  const configPath = path.join(temporaryRoot, 'supabase/config.toml');
  const config = readFileSync(configPath, 'utf8');
  const projectScopedConfig = config.replace(
    /^project_id\s*=\s*"[^"]+"/mu,
    `project_id = "${projectId}"`,
  );
  if (projectScopedConfig === config) throw new Error('Supabase project_id was not found in config.toml.');

  const portKeys = [
    'api.port',
    'db.port',
    'db.shadow_port',
    'db.pooler.port',
    'studio.port',
    'inbucket.port',
    'edge_runtime.inspector_port',
    'analytics.port',
  ];
  const isolatedPorts = await allocateDistinctPorts(portKeys);
  const replacedPortKeys = new Set();
  let currentSection = '';
  const isolatedConfig = projectScopedConfig
    .split(/\r?\n/u)
    .map((line) => {
      const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*$/u);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        return line;
      }
      const portMatch = line.match(/^(\s*(?:port|shadow_port|inspector_port)\s*=\s*)\d+(\s*(?:#.*)?)$/u);
      if (!portMatch) return line;
      const keyName = portMatch[1].match(/\b(shadow_port|inspector_port|port)\b/u)?.[1];
      const configKey = `${currentSection}.${keyName}`;
      const isolatedPort = isolatedPorts.get(configKey);
      if (!isolatedPort) return line;
      replacedPortKeys.add(configKey);
      return `${portMatch[1]}${isolatedPort}${portMatch[2]}`;
    })
    .join('\n');
  const missingPortKeys = portKeys.filter((key) => !replacedPortKeys.has(key));
  if (missingPortKeys.length > 0) {
    throw new Error(`Supabase port configuration is incomplete: ${missingPortKeys.join(', ')}`);
  }
  writeFileSync(configPath, isolatedConfig, { encoding: 'utf8', mode: 0o600 });

  stackStartAttempted = true;
  supabaseCaptured('start');
  process.stdout.write('Isolated Supabase stack started.\n');
  run('docker', ['inspect', databaseContainer], { capture: true });

  if (phase !== 'start') {
    supabase('db', 'reset', '--local');
  }
  if (phase === 'all' || phase === 'test') {
    supabase('db', 'lint', '--local', '--level', 'error', '--fail-on', 'error');
    supabase('test', 'db', '--local');
  }

  let parity = null;
  if (phase === 'all' || phase === 'restore') {
    run('docker', [
      'exec', databaseContainer, 'pg_dump', '--username', 'supabase_admin', '--format', 'custom',
      '--no-owner', '--no-privileges', '--file', '/tmp/sorita.backup', 'postgres',
    ]);
    run('docker', [
      'exec', databaseContainer, 'createdb', '--username', 'supabase_admin', 'sorita_restore_drill',
    ]);
    restoreDatabaseCreated = true;
    run('docker', [
      'exec', databaseContainer, 'sh', '-c',
      "pg_restore --list /tmp/sorita.backup | sed -E '/ (pg_cron|cron) /s/^/;/' > /tmp/sorita.restore.list",
    ]);
    run('docker', [
      'exec', databaseContainer, 'pg_restore', '--username', 'supabase_admin',
      '--dbname', 'sorita_restore_drill', '--exit-on-error', '--no-owner', '--no-privileges',
      '--use-list', '/tmp/sorita.restore.list', '/tmp/sorita.backup',
    ]);
    const sourceParity = collectParity('postgres');
    const restoredParity = collectParity('sorita_restore_drill');
    if (JSON.stringify(sourceParity) !== JSON.stringify(restoredParity)) {
      throw new Error(
        `Restore parity mismatch: source=${JSON.stringify(sourceParity)} restored=${JSON.stringify(restoredParity)}`,
      );
    }
    if (sourceParity.publicTables < 1 || sourceParity.rlsPolicies < 1 || sourceParity.storageBuckets !== 3) {
      throw new Error(`Restore parity evidence is incomplete: ${JSON.stringify(sourceParity)}`);
    }
    parity = sourceParity;
  }

  process.stdout.write(
    `${JSON.stringify({ databaseContainer, parity, phase, projectId, status: 'pass' })}\n`,
  );
} finally {
  if (restoreDatabaseCreated) {
    try {
      run('docker', [
        'exec', databaseContainer, 'dropdb', '--if-exists', '--username', 'supabase_admin',
        'sorita_restore_drill',
      ]);
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
  if (stackStartAttempted) {
    try {
      supabaseCaptured('stop', '--no-backup');
      process.stdout.write('Isolated Supabase stack stopped.\n');
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  const resolvedOsTemp = `${path.resolve(os.tmpdir())}${path.sep}`;
  if (!resolvedTemporaryRoot.startsWith(resolvedOsTemp) || !path.basename(resolvedTemporaryRoot).startsWith('sorita-docker-supabase-')) {
    throw new Error('Refusing to remove an unexpected Supabase test directory.');
  }
  rmSync(resolvedTemporaryRoot, { force: true, recursive: true });
}
