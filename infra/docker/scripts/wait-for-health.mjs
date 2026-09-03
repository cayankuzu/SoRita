const args = new Set(process.argv.slice(2));
const once = args.has('--once');
const url = process.argv.slice(2).find((value) => /^https?:\/\//u.test(value));
const attempts = once ? 1 : 30;

if (!url) {
  throw new Error('A health URL is required.');
}

let lastError;

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) throw new Error(`health_status_${response.status}`);
    process.stdout.write(`${JSON.stringify({ attempt, status: response.status, url })}\n`);
    process.exit(0);
  } catch (error) {
    lastError = error;
  }

  if (attempt < attempts) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
}

process.stderr.write(
  `${JSON.stringify({ error: lastError instanceof Error ? lastError.name : 'health_failed', url })}\n`,
);
process.exit(1);

