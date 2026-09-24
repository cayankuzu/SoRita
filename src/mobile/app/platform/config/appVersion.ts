import * as Application from 'expo-application';

// The installed build as people and support read it: "1.0.110 (116)". Null
// where the native values are missing, as in tests and web previews.
export function getInstalledAppVersionLabel() {
  const version = Application.nativeApplicationVersion;
  const build = Application.nativeBuildVersion;

  if (!version) {
    return null;
  }

  return build ? `${version} (${build})` : version;
}
