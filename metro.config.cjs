const path = require('path');
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);
const expoVideoIndexPath = require.resolve('expo-video/build/index.js');
const expoVideoAirPlayPath = require.resolve('expo-video/build/VideoAirPlayButton.js');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const separatorPattern = '[\\\\/]';
const projectRootPattern = escapeRegExp(path.resolve(__dirname));
const existingBlockList = Array.isArray(config.resolver.blockList)
  ? config.resolver.blockList
  : config.resolver.blockList
    ? [config.resolver.blockList]
    : [];
const developmentOnlyProjectDirectories = [
  '.codex-artifacts',
  '.expo',
  '.git',
  'android',
  'artifacts',
  'coverage',
];

config.resolver.blockList = [
  ...existingBlockList,
  new RegExp(
    `^${projectRootPattern}${separatorPattern}(?:${developmentOnlyProjectDirectories
      .map(escapeRegExp)
      .join('|')})(?:${separatorPattern}|$)`,
  ),
  new RegExp(
    `^${projectRootPattern}${separatorPattern}node_modules${separatorPattern}(?:@[^\\\\/]+${separatorPattern})?[^\\\\/]+${separatorPattern}(?:android|ios|macos|windows)(?:${separatorPattern}|$)`,
  ),
];

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
