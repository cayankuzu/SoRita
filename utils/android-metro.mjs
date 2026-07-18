import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import net from 'node:net';

const METRO_PORT = 8081;
const METRO_STATUS_PATH = '/status';
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

  env.CI = env.CI || '1';

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

async function readMetroStatus() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);

  try {
    const response = await fetch(`http://127.0.0.1:${METRO_PORT}${METRO_STATUS_PATH}`, {
      signal: controller.signal,
    });
    const content = await response.text();

    return content.trim();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function isMetroRunning() {
  const status = await readMetroStatus();
  return status === 'packager-status:running';
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
    shell: true,
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
  const child = spawn(
    'npx',
    ['expo', 'start', '--dev-client', '--host', 'lan', '--port', String(METRO_PORT)],
    {
      stdio: 'inherit',
      shell: true,
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
    throw new Error(
      ownerSummary
        ? `127.0.0.1:${METRO_PORT} baska bir surec tarafindan kullaniliyor (${ownerSummary}). Once onu kapatin.`
        : `127.0.0.1:${METRO_PORT} baska bir surec tarafindan kullaniliyor. Once onu kapatin.`,
    );
  }

  console.log(`[SoRita][metro] Yeni Expo Metro baslatiliyor: ${METRO_PORT}`);
  startMetro();
}

main().catch((error) => {
  console.error(`[SoRita][metro] ${error.message}`);
  process.exit(1);
});
