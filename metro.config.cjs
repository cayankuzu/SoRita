const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);
const expoVideoIndexPath = require.resolve('expo-video/build/index.js');
const expoVideoAirPlayPath = require.resolve('expo-video/build/VideoAirPlayButton.js');

if (!config.resolver.assetExts.includes('html')) {
  config.resolver.assetExts.push('html');
}

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const originModulePath = context.originModulePath ? path.normalize(context.originModulePath) : '';

  if (moduleName === './VideoAirPlayButton' && originModulePath === path.normalize(expoVideoIndexPath)) {
    return context.resolveRequest(context, expoVideoAirPlayPath, platform);
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

module.exports = config;
