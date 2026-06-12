import * as SplashScreen from 'expo-splash-screen';

let nativeSplashHidden = false;
let nativeSplashPrepared = false;

export async function prepareNativeSplashScreen() {
  if (nativeSplashPrepared) {
    return;
  }

  nativeSplashPrepared = true;

  try {
    await SplashScreen.preventAutoHideAsync();
  } catch {
    nativeSplashPrepared = true;
  }
}

export async function hideNativeSplashScreen() {
  if (nativeSplashHidden) {
    return;
  }

  nativeSplashHidden = true;

  try {
    await SplashScreen.hideAsync();
  } catch {
    nativeSplashHidden = false;
  }
}

void prepareNativeSplashScreen();
