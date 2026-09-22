// expo-crypto pulls in expo-modules-core, which expects a native runtime and
// throws on import under Node. Any test that merely reaches code using it would
// fail for that reason alone, so vitest.config.ts aliases the package here.
//
// The values are deterministic on purpose: a test that cares about the bytes
// mocks the module itself, and a test that does not should not depend on
// randomness it never asserted.

let uuidCounter = 0;
let byteCounter = 0;

export function randomUUID() {
  uuidCounter += 1;
  const suffix = uuidCounter.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${suffix}`;
}

/** Successive calls differ, because callers rotate secrets and check that. */
export function getRandomBytes(byteCount: number) {
  byteCounter += 1;
  return Uint8Array.from(
    { length: byteCount },
    (_, index) => (index * 7 + byteCounter * 31 + 11) % 256,
  );
}

export async function getRandomBytesAsync(byteCount: number) {
  return getRandomBytes(byteCount);
}

export function resetExpoCryptoMock() {
  byteCounter = 0;
  uuidCounter = 0;
}
