import '@/mobile/app/shared/performance/appLaunch';

import * as NativeSplashScreen from 'expo-splash-screen';
import { primePersistedStartupData } from '@/mobile/app/app-shell/startup/primePersistedStartupData';

// Keep this module deliberately tiny: it executes before the React app import.
void NativeSplashScreen.preventAutoHideAsync().catch(() => undefined);
void primePersistedStartupData();
