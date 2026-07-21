import AsyncStorage from '@react-native-async-storage/async-storage';

const MAP_ADD_HINT_SEEN_KEY = 'sorita:ui-hint:map-add:v1';

export async function hasSeenMapAddHint() {
  return (await AsyncStorage.getItem(MAP_ADD_HINT_SEEN_KEY).catch(() => null)) === '1';
}

export async function markMapAddHintSeen() {
  await AsyncStorage.setItem(MAP_ADD_HINT_SEEN_KEY, '1').catch(() => undefined);
}
