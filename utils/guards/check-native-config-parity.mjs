// Expo's own appConfigFieldsNotSyncedCheck is disabled in package.json, because
// this project treats the checked-in Android project as authoritative rather
// than regenerating it (ADR 0004). That decision is defensible, but it removes
// the only thing that was comparing app.config.ts against the native project.
//
// This guard puts a narrower, more accurate check back: the fields where a
// mismatch actually ships a broken build - app identity, version and the deep
// link scheme. It deliberately does not try to diff everything Expo would
// regenerate, because under ADR 0004 most of that divergence is intentional.
import { readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('../..', import.meta.url));
const rel = (path) => relative(workspace, path).split(sep).join('/');

const appConfigPath = join(workspace, 'app.config.ts');
const gradlePath = join(workspace, 'android/app/build.gradle');
const manifestPath = join(workspace, 'android/app/src/main/AndroidManifest.xml');

const [appConfig, gradle, manifest] = await Promise.all([
  readFile(appConfigPath, 'utf8'),
  readFile(gradlePath, 'utf8'),
  readFile(manifestPath, 'utf8'),
]);

const violations = [];

function pick(source, pattern, label, file) {
  const match = source.match(pattern);
  if (!match) {
    violations.push(`${rel(file)}: could not read ${label}; the file shape changed`);
    return null;
  }
  return match[1];
}

// Expo side. These are plain literals in app.config.ts, so a static read is
// both sufficient and safer than evaluating the module.
const expoScheme = pick(appConfig, /const appScheme = '([^']+)'/, 'appScheme', appConfigPath);
const expoVersion = pick(appConfig, /\n {2}version: '([^']+)'/, 'version', appConfigPath);
const expoPackage = pick(appConfig, /\n {4}package: '([^']+)'/, 'android.package', appConfigPath);
const expoVersionCode = pick(appConfig, /\n {4}versionCode: (\d+)/, 'android.versionCode', appConfigPath);
const expoDefaultNotificationChannel = pick(
  appConfig,
  /defaultChannel: '([^']+)'/,
  'expo-notifications.defaultChannel',
  appConfigPath,
);
const expoBundleId = pick(
  appConfig,
  /\n {4}bundleIdentifier: '([^']+)'/,
  'ios.bundleIdentifier',
  appConfigPath,
);

// Native side.
const gradleApplicationId = pick(gradle, /applicationId '([^']+)'/, 'applicationId', gradlePath);
const gradleNamespace = pick(gradle, /namespace '([^']+)'/, 'namespace', gradlePath);
const gradleVersionName = pick(gradle, /versionName "([^"]+)"/, 'versionName', gradlePath);
const gradleVersionCode = pick(gradle, /versionCode (\d+)/, 'versionCode', gradlePath);

const manifestSchemes = new Set(
  [...manifest.matchAll(/android:scheme="([^"]+)"/g)].map((match) => match[1]),
);
const manifestDefaultNotificationChannel = pick(
  manifest,
  /android:name="com\.google\.firebase\.messaging\.default_notification_channel_id"\s+android:value="([^"]+)"/,
  'Firebase default notification channel',
  manifestPath,
);

function expect(label, expoValue, nativeValue, expoLabel, nativeLabel) {
  if (expoValue === null || nativeValue === null) return;
  if (expoValue !== nativeValue) {
    violations.push(
      `${label} disagrees: ${expoLabel} is "${expoValue}" but ${nativeLabel} is "${nativeValue}"`,
    );
  }
}

expect('App identity', expoPackage, gradleApplicationId, 'app.config.ts android.package', 'build.gradle applicationId');
expect('Android namespace', expoPackage, gradleNamespace, 'app.config.ts android.package', 'build.gradle namespace');
expect('Version name', expoVersion, gradleVersionName, 'app.config.ts version', 'build.gradle versionName');
expect('Version code', expoVersionCode, gradleVersionCode, 'app.config.ts android.versionCode', 'build.gradle versionCode');
expect(
  'Default notification channel',
  expoDefaultNotificationChannel,
  manifestDefaultNotificationChannel,
  'app.config.ts expo-notifications.defaultChannel',
  'AndroidManifest.xml Firebase default channel',
);

// iOS has no committed native project, so the bundle identifier can only be
// checked for internal consistency with the Android package - they are the same
// string by product decision, and a silent divergence would split the identity.
expect(
  'Bundle identifier',
  expoBundleId,
  expoPackage,
  'app.config.ts ios.bundleIdentifier',
  'app.config.ts android.package',
);

// A deep link that Expo advertises but the manifest does not register is a link
// that silently fails to open the app.
if (expoScheme !== null && !manifestSchemes.has(expoScheme)) {
  violations.push(
    `Deep link scheme "${expoScheme}" from app.config.ts is not registered in ${rel(manifestPath)} ` +
      `(manifest registers: ${[...manifestSchemes].join(', ') || 'none'})`,
  );
}

if (violations.length > 0) {
  console.error(
    '[native-config-parity] app.config.ts and the committed native project disagree:',
  );
  for (const violation of violations) console.error(`- ${violation}`);
  console.error(
    'Expo\u2019s appConfigFieldsNotSyncedCheck is disabled under ADR 0004, so this guard is the only thing checking these fields.',
  );
  process.exit(1);
}

console.log(
  `[native-config-parity] OK (identity ${expoPackage}, version ${expoVersion} (${expoVersionCode}), notification channel ${expoDefaultNotificationChannel}, scheme ${expoScheme} registered in the manifest)`,
);
