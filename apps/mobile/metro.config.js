const { withNativeWind } = require('nativewind/metro');
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the entire monorepo so Metro sees changes in packages/*
config.watchFolders = [workspaceRoot];

// 2. Resolve packages from workspace root first, then project
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. KEY FIX: The packages use Node.js ESM-style `export * from './foo.js'`
//    Metro can't find the .js files because the source is .ts.
//    This resolver strips the .js extension and retries with .ts/.tsx.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Only remap relative imports ending in .js that don't exist on disk
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const tsPath = path.resolve(
      path.dirname(context.originModulePath),
      moduleName.slice(0, -3) + '.ts',
    );
    const tsxPath = tsPath.replace(/\.ts$/, '.tsx');
    if (fs.existsSync(tsPath)) {
      return { type: 'sourceFile', filePath: tsPath };
    }
    if (fs.existsSync(tsxPath)) {
      return { type: 'sourceFile', filePath: tsxPath };
    }
  }
  // Default resolution for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
