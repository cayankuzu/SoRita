import './src/mobile/app/app-shell/startup/earlyStartup';

import { registerSystemPushBackgroundHandler } from './src/mobile/app/platform/notifications/systemPushBackgroundHandler';

import { registerRootComponent } from 'expo';

// RN Firebase requires this registration to happen before the React tree is
// evaluated so Android headless/iOS terminated data messages have a safe path.
registerSystemPushBackgroundHandler();

// Keep the App require below the FCM registration. Static imports are
// evaluated before this module body, which would otherwise initialize the
// React tree before React Native Firebase can install its headless handler.
const App = require('./App').default;
registerRootComponent(App);
