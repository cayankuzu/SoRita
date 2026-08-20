const DEFAULT_METRO_PORT = 18083;

function readPort(value) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535
    ? parsed
    : DEFAULT_METRO_PORT;
}

export const ANDROID_APP_ID =
  process.env.ANDROID_APP_ID || 'com.cayan.sorita.socialmap';
export const EXPECTED_EXPO_PROJECT_SLUG = 'sorita';
export const METRO_PORT = readPort(
  process.env.SORITA_METRO_PORT || process.env.EXPO_PACKAGER_PORT,
);

export async function readExpoProjectSlug(port = METRO_PORT, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`http://127.0.0.1:${port}`, {
      headers: {
        Accept: 'application/expo+json',
        'Expo-Platform': 'android',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const manifest = await response.json();
    const slug = manifest?.extra?.expoClient?.slug;
    return typeof slug === 'string' ? slug : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function isSoRitaMetro(port = METRO_PORT) {
  return (await readExpoProjectSlug(port)) === EXPECTED_EXPO_PROJECT_SLUG;
}
