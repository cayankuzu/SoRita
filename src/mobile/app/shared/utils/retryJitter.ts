const DEFAULT_JITTER_RATIO = 0.2;

// Spreads a retry delay by up to ±ratio, so devices that failed together do
// not all retry in the same instant. `random` is injectable for tests.
export function withRetryJitter(
  delayMs: number,
  ratio = DEFAULT_JITTER_RATIO,
  random: () => number = Math.random,
) {
  const multiplier = 1 - ratio + random() * ratio * 2;
  return Math.max(1, Math.round(delayMs * multiplier));
}
