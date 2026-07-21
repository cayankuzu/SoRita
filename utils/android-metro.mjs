import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import net from 'node:net';

import {
  EXPECTED_EXPO_PROJECT_SLUG,
  isSoRitaMetro,
  METRO_PORT,
  readExpoProjectSlug,
} from './android-dev-config.mjs';

const STATUS_TIMEOUT_MS = 2000;
const STATUS_POLL_INTERVAL_MS = 2000;

function resolvePlatformToolsDir() {
  const sdkRoot =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    (process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null);

  if (!sdkRoot) {
    return null;
  }

  const platformToolsDir = join(sdkRoot, 'platform-tools');
  return existsSync(platformToolsDir) ? platformToolsDir : null;
}

function createChildEnv() {
  const env = { ...process.env };
  const platformToolsDir = resolvePlatformToolsDir();

  if (platformToolsDir) {
    env.Path = `${platformToolsDir};${env.Path ?? ''}`;
    env.PATH = `${platformToolsDir};${env.PATH ?? ''}`;
  }

  // Expo disables file watching, reloads and Fast Refresh when CI is set.
  // This helper is the interactive development server, so never inherit CI.
  delete env.CI;

  return env;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(STATUS_TIMEOUT_MS);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, '127.0.0.1');
  });
}

async function isMetroRunning() {
  return isSoRitaMetro(METRO_PORT);
}

function readPortOwnerSummary(port) {
  const command = [
    `$connection = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1;`,
    'if (-not $connection) { exit 0 }',
    '$process = Get-CimInstance Win32_Process -Filter ("ProcessId = " + $connection.OwningProcess) -ErrorAction SilentlyContinue;',
    'if ($process) {',
    '  Write-Output ("PID=" + $process.ProcessId + " NAME=" + $process.Name);',
    '} else {',
    '  Write-Output ("PID=" + $connection.OwningProcess);',
    '}',
  ].join(' ');

  const result = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
    encoding: 'utf8',
    shell: false,
  });

  return result.stdout?.trim() ?? '';
}

async function monitorExistingMetro() {
  console.log(`[SoRita][metro] 127.0.0.1:${METRO_PORT} uzerinde calisan Metro bulundu. Bu oturum mevcut Metro'yu kullanacak.`);

  while (true) {
    if (!(await isMetroRunning())) {
      throw new Error('Mevcut Metro oturumu kapandi.');
    }

    await wait(STATUS_POLL_INTERVAL_MS);
  }
}

function startMetro() {
  const expoCliPath = join(process.cwd(), 'node_modules', 'expo', 'bin', 'cli');
  const child = spawn(
    process.execPath,
    [expoCliPath, 'start', '--dev-client', '--host', 'lan', '--port', String(METRO_PORT)],
    {
      stdio: 'inherit',
      shell: false,
      env: createChildEnv(),
    },
  );

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    console.error(`[SoRita][metro] Expo Metro baslatilamadi: ${error.message}`);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    child.kill('SIGTERM');
  });
}

async function main() {
  if (await isMetroRunning()) {
    await monitorExistingMetro();
    return;
  }

  if (await isPortOpen(METRO_PORT)) {
    const ownerSummary = readPortOwnerSummary(METRO_PORT);
    const projectSlug = await readExpoProjectSlug(METRO_PORT);
    const projectSummary = projectSlug
      ? ` Expo projesi=${projectSlug}, beklenen=${EXPECTED_EXPO_PROJECT_SLUG}.`
      : '';
    throw new Error(
      ownerSummary
        ? `127.0.0.1:${METRO_PORT} baska bir surec tarafindan kullaniliyor (${ownerSummary}).${projectSummary} SORITA_METRO_PORT ile bos bir port secin.`
        : `127.0.0.1:${METRO_PORT} baska bir surec tarafindan kullaniliyor.${projectSummary} SORITA_METRO_PORT ile bos bir port secin.`,
    );
  }

  console.log(`[SoRita][metro] Yeni Expo Metro baslatiliyor: ${METRO_PORT}`);
  startMetro();
}

main().catch((error) => {
  console.error(`[SoRita][metro] ${error.message}`);
  process.exit(1);
});
