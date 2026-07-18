import * as NativeSplashScreen from 'expo-splash-screen';

import App from '@/mobile/app/App';

void NativeSplashScreen.preventAutoHideAsync().catch(() => undefined);

export default App;
