import AsyncStorage from '@react-native-async-storage/async-storage';

const LEGAL_CONSENT_STORAGE_KEY = 'sorita.legal-consent.version';

export async function savePersistedLegalConsentVersion(version: string | null) {
  if (!version) {
    await AsyncStorage.removeItem(LEGAL_CONSENT_STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(LEGAL_CONSENT_STORAGE_KEY, version);
}

export async function getPersistedLegalConsentVersion(): Promise<string | null> {
  const value = await AsyncStorage.getItem(LEGAL_CONSENT_STORAGE_KEY);
  return value || null;
}
