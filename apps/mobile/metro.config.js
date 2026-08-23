const path = require('node:path');
const { withNativeWind } = require('nativewind/metro');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// This is a monorepo: @dsm/* packages live under packages/ and native/, both
// outside apps/mobile. Metro only watches/resolves inside projectRoot unless
// told otherwise, so symlinked workspace packages (including
// @dsm/android-radio-bridge under native/) resolve to "module not found"
// without these two lines even though node_modules/@dsm/* symlinks are correct.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// @dsm/codec (shared with the Node backend) imports node:crypto directly.
// React Native/Hermes has no Node crypto module and there is no native build
// step here, so alias it to a pure-JS shim instead of touching the shared
// package. See metro-shims/node-crypto.js.
const cryptoShim = path.resolve(projectRoot, 'metro-shims/node-crypto.js');
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: cryptoShim,
  'node:crypto': cryptoShim,
};

module.exports = withNativeWind(config, { input: './global.css' });
