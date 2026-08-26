const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withMonorepoFix(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      let contents = config.modResults.contents;
      
      // We need to inject the extraPackagerArgs into the `react { ... }` block
      // so Metro receives the absolute path and doesn't get confused by the monorepo root.
      
      if (!contents.includes('extraPackagerArgs')) {
        // Find the react block and insert the fix
        contents = contents.replace(
          /react\s*\{/,
          `react {
    // [Injected by withMonorepoFix plugin]
    // Force Metro to use the absolute path for the entry file
    extraPackagerArgs = ["--entry-file", file(["node", "-e", "require('expo/scripts/resolveAppEntry')", rootDir.getAbsoluteFile().getParentFile().getAbsolutePath(), "android", "absolute"].execute(null, rootDir).text.trim()).absolutePath]
`
        );
      }
      
      config.modResults.contents = contents;
    }
    return config;
  });
};
